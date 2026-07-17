import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  fromEmail?: string;
  fromName?: string;
  contactId?: string;
}

export interface UpdateTicketInput {
  status?: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  assignedToId?: string;
}

export interface AddMessageInput {
  body: string;
  senderType: 'customer' | 'agent' | 'ai';
  senderId?: string;
  isInternal?: boolean;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

@Injectable()
export class SupportService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Tickets ──────────────────────────────────────────────────────────────

  async listTickets(
    orgId: string,
    options: { status?: string; priority?: string; page?: number; limit?: number } = {},
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.supportTicket.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      this.db.supportTicket.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getTicket(orgId: string, ticketId: string) {
    const t = await this.db.supportTicket.findFirst({
      where: { id: ticketId, orgId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  async createTicket(orgId: string, input: CreateTicketInput, createdById: string) {
    // Auto-increment ticket number per org
    const last = await this.db.supportTicket.findFirst({
      where: { orgId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    const ticketNumber = (last?.ticketNumber ?? 0) + 1;

    const ticket = await this.db.supportTicket.create({
      data: {
        orgId,
        ticketNumber,
        subject: input.subject,
        description: input.description,
        priority: input.priority ?? 'medium',
        category: input.category ?? 'general',
        fromEmail: input.fromEmail ?? null,
        fromName: input.fromName ?? null,
        contactId: input.contactId ?? null,
      },
    });

    // Auto-add the description as first message
    await this.db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        orgId,
        senderType: 'customer',
        senderId: createdById,
        body: input.description,
      },
    });

    return ticket;
  }

  async updateTicket(orgId: string, ticketId: string, input: UpdateTicketInput) {
    const t = await this.assertTicket(orgId, ticketId);

    const now = new Date();
    const resolvedAt =
      input.status === 'resolved' && t.status !== 'resolved' ? now : undefined;
    const closedAt =
      input.status === 'closed' && t.status !== 'closed' ? now : undefined;

    return this.db.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...input,
        ...(resolvedAt ? { resolvedAt } : {}),
        ...(closedAt ? { closedAt } : {}),
      },
    });
  }

  async addMessage(orgId: string, ticketId: string, input: AddMessageInput) {
    await this.assertTicket(orgId, ticketId);
    return this.db.ticketMessage.create({
      data: {
        ticketId,
        orgId,
        senderType: input.senderType,
        senderId: input.senderId ?? null,
        body: input.body,
        isInternal: input.isInternal ?? false,
      },
    });
  }

  async assignToAgent(orgId: string, ticketId: string, agentId: string) {
    await this.assertTicket(orgId, ticketId);
    return this.db.supportTicket.update({
      where: { id: ticketId },
      data: { agentId, status: 'in_progress' },
    });
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(orgId: string) {
    const [total, byStatus, byPriority, avgResolution] = await Promise.all([
      this.db.supportTicket.count({ where: { orgId } }),
      this.db.supportTicket.groupBy({ by: ['status'], where: { orgId }, _count: true }),
      this.db.supportTicket.groupBy({ by: ['priority'], where: { orgId }, _count: true }),
      this.db.supportTicket.findMany({
        where: { orgId, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let avgResolutionHours = 0;
    if (avgResolution.length > 0) {
      const total = avgResolution.reduce((sum: number, t: { resolvedAt: Date | null; createdAt: Date }) => {
        const ms = (t.resolvedAt!.getTime() - t.createdAt.getTime());
        return sum + ms;
      }, 0);
      avgResolutionHours = Math.round(total / avgResolution.length / 3600000 * 10) / 10;
    }

    return {
      total,
      byStatus: Object.fromEntries((byStatus as Array<{ status: string; _count: number }>).map((r) => [r.status, r._count])),
      byPriority: Object.fromEntries(
        (byPriority as Array<{ priority: string; _count: number }>)
          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
          .map((r) => [r.priority, r._count]),
      ),
      avgResolutionHours,
    };
  }

  private async assertTicket(orgId: string, ticketId: string) {
    const t = await this.db.supportTicket.findFirst({ where: { id: ticketId, orgId } });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }
}
