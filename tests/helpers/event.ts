import { EventStatus, TicketTypeKind } from '../../prisma/generated/enums';
import prisma from '../../src/lib/prisma';

export async function createEvent(
  id: string,
  status: EventStatus = EventStatus.DRAFT,
  startsAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
  endsAt: Date = new Date(Date.now() + 25 * 60 * 60 * 1000),
) {
  return await prisma.event.create({
    data: {
      organizerId: id,
      status,
      title: 'Cairo Jazz Night',
      description: 'An evening of live jazz with local artists. Doors open at 6 PM.',
      location: 'Cairo Opera House, Zamalek, Cairo',
      startsAt,
      endsAt,
    },
  });
}

export async function createTicketType(
  eventId: string,
  ticketType: TicketTypeKind = 'GENERAL',
  capacity: number = 100,
) {
  return await prisma.ticketType.create({
    data: {
      eventId,
      type: ticketType,
      capacity: capacity,
      remaining: capacity,
    },
  });
}
