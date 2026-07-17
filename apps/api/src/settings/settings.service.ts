import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// AES-256-GCM symmetric encryption for stored credentials.
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
function getKey(): Buffer {
  const raw = process.env['ENCRYPTION_KEY'];
  if (!raw || raw.length !== 64) {
    // Fall back to a deterministic key derived from NEXTAUTH_SECRET so tests work without ENCRYPTION_KEY.
    // In production, always set ENCRYPTION_KEY.
    const secret = process.env['NEXTAUTH_SECRET'] ?? 'insecure-dev-key';
    return createHash('sha256').update(secret).digest();
  }
  return Buffer.from(raw, 'hex');
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid ciphertext format');
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

@Injectable()
export class SettingsService {
  constructor(private readonly db: PrismaClient) {}

  // ── Authorization helpers ──────────────────────────────────────────────────

  private async assertAdmin(orgId: string, userId: string): Promise<void> {
    const m = await this.db.membership.findFirst({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException('Not a member of this organization');
    if (!['owner', 'admin'].includes(m.role)) throw new ForbiddenException('Admin access required');
  }

  private async assertOwner(orgId: string, userId: string): Promise<void> {
    const m = await this.db.membership.findFirst({ where: { orgId, userId } });
    if (!m || m.role !== 'owner') throw new ForbiddenException('Owner access required');
  }

  // ── Org profile ────────────────────────────────────────────────────────────

  async getOrg(orgId: string, userId: string) {
    await this.assertAdmin(orgId, userId);
    return this.db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, industry: true, plan: true, status: true, logoUrl: true, domain: true, settings: true, createdAt: true },
    });
  }

  async updateOrg(
    orgId: string,
    userId: string,
    input: { name?: string; industry?: string; logoUrl?: string; domain?: string; settings?: Record<string, unknown> },
  ) {
    await this.assertAdmin(orgId, userId);
    return this.db.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.settings !== undefined
          ? {
              settings: Object.assign(
                {},
                await this.db.organization.findUnique({ where: { id: orgId }, select: { settings: true } }).then((o: { settings: unknown } | null) => (o?.settings as Record<string, unknown>) ?? {}),
                input.settings,
              ) as never,
            }
          : {}),
      },
      select: { id: true, name: true, slug: true, industry: true, plan: true, logoUrl: true, domain: true, settings: true },
    });
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async listMembers(orgId: string, userId: string) {
    await this.assertAdmin(orgId, userId);
    return this.db.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(orgId: string, userId: string, targetUserId: string, role: string) {
    await this.assertOwner(orgId, userId);
    if (targetUserId === userId) throw new ForbiddenException('Cannot change your own role');
    const allowed = ['admin', 'member', 'viewer'];
    if (!allowed.includes(role)) throw new ForbiddenException(`Role must be one of: ${allowed.join(', ')}`);
    const m = await this.db.membership.findFirst({ where: { orgId, userId: targetUserId } });
    if (!m) throw new NotFoundException('Member not found');
    return this.db.membership.update({ where: { id: m.id }, data: { role } });
  }

  async removeMember(orgId: string, userId: string, targetUserId: string) {
    await this.assertAdmin(orgId, userId);
    if (targetUserId === userId) throw new ForbiddenException('Cannot remove yourself');
    const m = await this.db.membership.findFirst({ where: { orgId, userId: targetUserId } });
    if (!m) throw new NotFoundException('Member not found');
    if (m.role === 'owner') throw new ForbiddenException('Cannot remove the org owner');
    return this.db.membership.delete({ where: { id: m.id } });
  }

  // ── API Credentials ────────────────────────────────────────────────────────

  async listCredentials(orgId: string, userId: string) {
    await this.assertAdmin(orgId, userId);
    const creds = await this.db.apiCredential.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, name: true, provider: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return creds;
  }

  async createCredential(
    orgId: string,
    userId: string,
    input: { name: string; provider: string; value: string; metadata?: Record<string, unknown> },
  ) {
    await this.assertAdmin(orgId, userId);
    const existing = await this.db.apiCredential.findFirst({
      where: { orgId, provider: input.provider, name: input.name, deletedAt: null },
    });
    if (existing) throw new ConflictException(`Credential "${input.name}" for "${input.provider}" already exists`);
    const encryptedValue = encrypt(input.value);
    return this.db.apiCredential.create({
      data: {
        orgId,
        name: input.name,
        provider: input.provider,
        encryptedValue,
        metadata: (input.metadata ?? {}) as never,
        createdById: userId,
      },
      select: { id: true, name: true, provider: true, metadata: true, createdAt: true },
    });
  }

  async rotateCredential(
    orgId: string,
    userId: string,
    credentialId: string,
    newValue: string,
  ) {
    await this.assertAdmin(orgId, userId);
    const cred = await this.db.apiCredential.findFirst({
      where: { id: credentialId, orgId, deletedAt: null },
    });
    if (!cred) throw new NotFoundException('Credential not found');
    const encryptedValue = encrypt(newValue);
    return this.db.apiCredential.update({
      where: { id: credentialId },
      data: { encryptedValue },
      select: { id: true, name: true, provider: true, metadata: true },
    });
  }

  async deleteCredential(orgId: string, userId: string, credentialId: string) {
    await this.assertAdmin(orgId, userId);
    const cred = await this.db.apiCredential.findFirst({
      where: { id: credentialId, orgId, deletedAt: null },
    });
    if (!cred) throw new NotFoundException('Credential not found');
    // Soft delete
    return this.db.apiCredential.update({
      where: { id: credentialId },
      data: { deletedAt: new Date() },
    });
  }

  /** Retrieve decrypted value — only for internal service-to-service use, never exposed via HTTP. */
  async resolveCredentialValue(orgId: string, credentialId: string): Promise<string> {
    const cred = await this.db.apiCredential.findFirst({
      where: { id: credentialId, orgId, deletedAt: null },
    });
    if (!cred) throw new NotFoundException('Credential not found');
    return decrypt(cred.encryptedValue);
  }
}
