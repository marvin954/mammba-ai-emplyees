import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import Bull from 'bull';
import { QUEUE_NAMES } from '@nexusos/events';
import { randomUUID } from 'crypto';

@Injectable()
export class AutomationsService {
  private workflowQueue: Bull.Queue;

  constructor(private readonly db: PrismaClient) {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const { hostname: host, port: portStr } = new URL(redisUrl);
    const port = Number(portStr || 6379);
    this.workflowQueue = new Bull(QUEUE_NAMES.WORKFLOWS, { redis: { host, port } });
  }

  private async assertMember(orgId: string, userId: string) {
    const m = await this.db.membership.findFirst({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException('Not a member of this organization');
    return m;
  }

  async list(orgId: string) {
    return this.db.workflow.findMany({
      where: { orgId },
      include: {
        _count: { select: { executions: true } },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(orgId: string, workflowId: string) {
    const wf = await this.db.workflow.findFirst({
      where: { id: workflowId, orgId },
      include: {
        executions: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { executions: true } },
      },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async create(
    orgId: string,
    userId: string,
    input: { name: string; description?: string; config?: Record<string, unknown> },
  ) {
    await this.assertMember(orgId, userId);
    return this.db.workflow.create({
      data: {
        orgId,
        name: input.name,
        description: input.description,
        config: input.config ?? {},
        isActive: false,
      },
    });
  }

  async update(
    orgId: string,
    userId: string,
    workflowId: string,
    input: { name?: string; description?: string; config?: Record<string, unknown> },
  ) {
    await this.assertMember(orgId, userId);
    const wf = await this.db.workflow.findFirst({ where: { id: workflowId, orgId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    return this.db.workflow.update({
      where: { id: workflowId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.config !== undefined ? { config: input.config } : {}),
      },
    });
  }

  async toggle(orgId: string, userId: string, workflowId: string) {
    await this.assertMember(orgId, userId);
    const wf = await this.db.workflow.findFirst({ where: { id: workflowId, orgId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    return this.db.workflow.update({
      where: { id: workflowId },
      data: { isActive: !wf.isActive },
    });
  }

  async trigger(orgId: string, userId: string, workflowId: string, input: Record<string, unknown> = {}) {
    await this.assertMember(orgId, userId);
    const wf = await this.db.workflow.findFirst({ where: { id: workflowId, orgId } });
    if (!wf) throw new NotFoundException('Workflow not found');

    const idempotencyKey = randomUUID();

    await this.workflowQueue.add({
      type: 'workflow.trigger',
      orgId,
      workflowId,
      input,
      idempotencyKey,
    });

    const execution = await this.db.workflowExecution.create({
      data: { workflowId, orgId, status: 'running', input },
    });

    return { executionId: execution.id, idempotencyKey };
  }

  async delete(orgId: string, userId: string, workflowId: string) {
    await this.assertMember(orgId, userId);
    const wf = await this.db.workflow.findFirst({ where: { id: workflowId, orgId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    return this.db.workflow.delete({ where: { id: workflowId } });
  }

  async getExecutions(orgId: string, workflowId: string) {
    const wf = await this.db.workflow.findFirst({ where: { id: workflowId, orgId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    return this.db.workflowExecution.findMany({
      where: { workflowId, orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
