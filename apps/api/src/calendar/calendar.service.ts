/**
 * Calendar integration service.
 *
 * Phase 5 ships the data model + provider interface.
 * Google and Outlook OAuth token exchange are Phase 6 work.
 * Agents can already call calendar.read / calendar.create tools;
 * those tools route here and receive structured error responses
 * when no calendar is connected, prompting the user to connect one.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export type CalendarProvider = 'google' | 'outlook' | 'caldav';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  description?: string;
  attendees?: string[];
  location?: string;
  meetingUrl?: string;
  provider: CalendarProvider;
}

export interface CreateEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
  location?: string;
}

export interface CalendarSlot {
  start: string;
  end: string;
  available: boolean;
}

@Injectable()
export class CalendarService {
  constructor(private readonly db: PrismaClient) {}

  async getIntegration(orgId: string, userId: string, provider: CalendarProvider) {
    return this.db.calendarIntegration.findUnique({
      where: { orgId_userId_provider: { orgId, userId, provider } },
    });
  }

  async listIntegrations(orgId: string, userId: string) {
    return this.db.calendarIntegration.findMany({
      where: { orgId, userId, isActive: true },
      select: { id: true, provider: true, accountEmail: true, isActive: true, createdAt: true },
    });
  }

  async disconnectIntegration(orgId: string, userId: string, provider: CalendarProvider) {
    return this.db.calendarIntegration.updateMany({
      where: { orgId, userId, provider },
      data: { isActive: false },
    });
  }

  /**
   * Stub: list upcoming events.
   * Returns a "not connected" payload until OAuth is wired in Phase 6.
   */
  async listEvents(
    orgId: string,
    userId: string,
    options: { provider?: CalendarProvider; start?: string; end?: string } = {},
  ): Promise<{ events: CalendarEvent[]; connected: boolean; provider?: CalendarProvider }> {
    const provider = options.provider ?? 'google';
    const integration = await this.getIntegration(orgId, userId, provider);

    if (!integration?.isActive) {
      return { events: [], connected: false, provider };
    }

    // Full OAuth + Calendar API calls are wired in Phase 6.
    // For now return connected:true with empty set so UI can show the connect state.
    return { events: [], connected: true, provider };
  }

  /**
   * Stub: find available slots.
   * Phase 6 will call the provider's freebusy API.
   */
  async findAvailableSlots(
    orgId: string,
    userId: string,
    options: {
      provider?: CalendarProvider;
      date: string; // YYYY-MM-DD
      durationMinutes: number;
    },
  ): Promise<CalendarSlot[]> {
    const provider = options.provider ?? 'google';
    const integration = await this.getIntegration(orgId, userId, provider);

    if (!integration?.isActive) {
      return [];
    }

    // Placeholder: return standard business-hours slots until Phase 6
    const date = options.date;
    const duration = options.durationMinutes;
    const slots: CalendarSlot[] = [];

    for (let hour = 9; hour < 17; hour += Math.ceil(duration / 60)) {
      const start = `${date}T${String(hour).padStart(2, '0')}:00:00Z`;
      const end = new Date(new Date(start).getTime() + duration * 60_000).toISOString();
      slots.push({ start, end, available: true });
    }

    return slots;
  }

  /**
   * Stub: create a calendar event.
   * Phase 6 will POST to the provider API with the stored access token.
   */
  async createEvent(
    orgId: string,
    userId: string,
    provider: CalendarProvider,
    input: CreateEventInput,
  ): Promise<{ eventId: string | null; connected: boolean }> {
    const integration = await this.getIntegration(orgId, userId, provider);

    if (!integration?.isActive) {
      return { eventId: null, connected: false };
    }

    // Phase 6: call provider API here
    return { eventId: null, connected: true };
  }
}
