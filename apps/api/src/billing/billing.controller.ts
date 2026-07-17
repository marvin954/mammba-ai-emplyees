import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Headers,
  HttpCode,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

class CreateCheckoutDto {
  plan!: string;
  successUrl!: string;
  cancelUrl!: string;
}

class CreatePortalDto {
  returnUrl!: string;
}

@Controller('orgs/:orgId/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  getSubscription(@Param('orgId') orgId: string) {
    return this.billing.getSubscription(orgId);
  }

  @Post('checkout')
  createCheckout(@Param('orgId') orgId: string, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckoutSession(orgId, dto.plan, dto.successUrl, dto.cancelUrl);
  }

  @Post('portal')
  createPortal(@Param('orgId') orgId: string, @Body() dto: CreatePortalDto) {
    return this.billing.createBillingPortalSession(orgId, dto.returnUrl);
  }

  @Get('usage')
  getUsage(@Param('orgId') orgId: string, @Query('month') month?: string) {
    return this.billing.getUsageSummary(orgId, { month });
  }
}

// Separate controller for the webhook — must bypass JSON parsing
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: FastifyRequest,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing Stripe-Signature header');

    // rawBody is set by the fastify raw-body plugin (configured in main.ts)
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new BadRequestException('Raw body unavailable');

    await this.billing.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
