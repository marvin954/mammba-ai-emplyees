import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@nexusos/database';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<{ token: string; userId: string }> {
    const parsed = registerSchema.parse(input);

    const existing = await this.db.user.findUnique({ where: { email: parsed.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);

    const user = await this.db.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        passwordHash,
        status: 'active',
      },
    });

    const token = this.signToken({ sub: user.id, email: user.email, orgId: null, role: 'org_owner' });

    return { token, userId: user.id };
  }

  async login(input: LoginInput): Promise<{ token: string; userId: string; orgId: string | null }> {
    const parsed = loginSchema.parse(input);

    const user = await this.db.user.findUnique({ where: { email: parsed.email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Find primary org membership
    const membership = await this.db.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const orgId = membership?.orgId ?? null;
    const role = membership?.role ?? 'org_owner';

    const token = this.signToken({ sub: user.id, email: user.email, orgId, role });

    return { token, userId: user.id, orgId };
  }

  async createInviteToken(orgId: string, email: string, role: string, invitedById: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.invitation.create({
      data: { orgId, email, role, invitedById, token, expiresAt },
    });

    return token;
  }

  async acceptInvite(token: string, userId: string): Promise<void> {
    const invite = await this.db.invitation.findUnique({ where: { token } });

    if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
      throw new NotFoundException('Invitation is invalid or has expired');
    }

    await this.db.$transaction([
      this.db.membership.upsert({
        where: { userId_orgId: { userId, orgId: invite.orgId } },
        update: { role: invite.role, acceptedAt: new Date() },
        create: {
          userId,
          orgId: invite.orgId,
          role: invite.role,
          invitedBy: invite.invitedById,
          acceptedAt: new Date(),
        },
      }),
      this.db.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
  }

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }
}
