/**
 * BillingService — Stripe integration for NexusOS platform subscriptions.
 *
 * Security:
 * - stripe.SecretKey is server-side only; publishable key is exposed to the client
 * - Webhook signature validation via Stripe-Signature header (HMAC)
 * - Raw request body required for webhook validation — must be read before
 *   NestJS JSON parsing (handled by webhook controller route)
 * - Customer IDs are stored in the DB; never trusted from client requests
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaClient } from '@nexusos/database';

export const PLAN_PRICES: Record<string, string> = {
  starter: process.env['STRIPE_PRICE_STARTER'] ?? 'price_starter',
  growth: process.env['STRIPE_PRICE_GROWTH'] ?? 'price_growth',
  enterprise: process.env['STRIPE_PRICE_ENTERPRISE'] ?? 'price_enterprise',
};

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(private readonly db: PrismaClient) {
    this.stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
      apiVersion: '2024-06-20',
    });
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async getSubscription(orgId: string) {
    const sub = await this.db.subscription.findUnique({
      where: { orgId },
    });

    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, status: true },
    });

    return {
      subscription: sub,
      plan: org?.plan ?? 'starter',
      status: org?.status ?? 'trial',
    };
  }

  async createCheckoutSession(
    orgId: string,
    plan: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> {
    const priceId = PLAN_PRICES[plan];
    if (!priceId) throw new BadRequestException(`Unknown plan: ${plan}`);

    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // Find or create Stripe customer
    let stripeCustomerId = await this.getStripeCustomerId(orgId);
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { orgId },
      });
      stripeCustomerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { orgId, plan },
        trial_period_days: plan === 'starter' ? 14 : undefined,
      },
      metadata: { orgId, plan },
    });

    return { url: session.url! };
  }

  async createBillingPortalSession(orgId: string, returnUrl: string): Promise<{ url: string }> {
    const customerId = await this.getStripeCustomerId(orgId);
    if (!customerId) throw new BadRequestException('No billing account found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ─── Usage ────────────────────────────────────────────────────────────────

  async getUsageSummary(orgId: string, options: { month?: string } = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = options.month ? Number(options.month) - 1 : now.getMonth();

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    const [records, agentRunCount] = await Promise.all([
      this.db.usageRecord.findMany({
        where: { orgId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.agentRun.count({
        where: { orgId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    const totalCostUsd = records.reduce((sum, r) => sum + r.totalCostUsd, 0);
    const byProvider: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};

    for (const r of records) {
      if (r.provider) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.totalCostUsd;
      byResourceType[r.resourceType] = (byResourceType[r.resourceType] ?? 0) + r.totalCostUsd;
    }

    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      agentRunCount,
      recordCount: records.length,
      byProvider,
      byResourceType,
    };
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unknown events are silently ignored
        break;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getStripeCustomerId(orgId: string): Promise<string | null> {
    const sub = await this.db.subscription.findUnique({
      where: { orgId },
      select: { stripeCustomerId: true },
    });
    return sub?.stripeCustomerId ?? null;
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.['orgId'];
    const plan = session.metadata?.['plan'] ?? 'starter';
    if (!orgId || !session.subscription) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(session.subscription as string);

    await this.db.$transaction([
      this.db.subscription.upsert({
        where: { orgId },
        create: {
          orgId,
          stripeSubscriptionId: stripeSub.id,
          stripeCustomerId: stripeSub.customer as string,
          plan,
          status: stripeSub.status,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
        update: {
          stripeSubscriptionId: stripeSub.id,
          stripeCustomerId: stripeSub.customer as string,
          plan,
          status: stripeSub.status,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
      }),
      this.db.organization.update({
        where: { id: orgId },
        data: { plan, status: 'active' },
      }),
    ]);
  }

  private async onSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const orgId = stripeSub.metadata['orgId'];
    if (!orgId) return;

    const plan = (stripeSub.metadata['plan'] as string | undefined) ?? 'starter';

    await this.db.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: stripeSub.status,
        plan,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    await this.db.organization.updateMany({
      where: { id: orgId },
      data: {
        plan,
        status: ['active', 'trialing'].includes(stripeSub.status) ? 'active' : 'suspended',
      },
    });
  }

  private async onSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    await this.db.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSub.id },
      data: { status: 'canceled' },
    });

    const orgId = stripeSub.metadata['orgId'];
    if (orgId) {
      await this.db.organization.update({
        where: { id: orgId },
        data: { plan: 'starter', status: 'suspended' },
      });
    }
  }

  private async onPaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    await this.db.subscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: 'past_due' },
    });
  }
}
