import prisma from '../../src/lib/prisma';
import crypto from 'node:crypto';

export async function createBooking(
  userId: string,
  eventId: string,
  ticketTypeId: string,
  count: number = 10,
) {
  const booking = await prisma.booking.create({
    data: { userId, eventId, status: 'CONFIRMED' },
  });

  await createTickets(booking.id, ticketTypeId, count);

  return booking;
}

export async function createTickets(bookingId: string, ticketTypeId: string, count: number = 10) {
  const ticketsData = Array.from({ length: count }, () => ({
    bookingId,
    ticketTypeId,
    status: 'VALID' as const,
    code: crypto.randomBytes(16).toString('base64url'),
  }));

  await prisma.ticket.createMany({
    data: ticketsData,
  });

  await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: { remaining: { decrement: count } },
  });
}

export async function cancelBooking(
  bookingId: string,
  ticketTypeId: string,
  count: number,
  cancelledAt: Date = new Date(Date.now()),
) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED', cancelledAt },
  });

  await prisma.ticket.updateMany({
    where: { bookingId, status: 'VALID' },
    data: { status: 'CANCELLED', cancelledAt },
  });

  await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: { remaining: { increment: count } },
  });
}
