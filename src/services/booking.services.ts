import { TicketTypeKind } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";

export async function getAllBookingsService() {

  const bookings = await prisma.booking.findMany({
    select: {
      id: true, userId: true, eventId: true, status: true, createdAt: true,
      user: {
        select: {
          name: true, email: true
        }
      },
      event: {
        select: { title: true, startsAt: true }
      }
    },

    orderBy: { createdAt: "desc" }
  });

  return bookings;

};

export async function getMyBookingsService(userId: string) {

  const bookings = await prisma.booking.findMany({
    where: { userId },
    select: {
      id: true, eventId: true, status: true, createdAt: true, cancelledAt: true,
      event: {
        select: { title: true, startsAt: true, endsAt: true, status: true }
      },
      tickets: { select: { status: true } }
    },
    orderBy: { createdAt: "desc" }
  });


  return bookings.map(({ tickets, ...booking }) => {
    const cancelledTicketsCount = tickets.filter((t) => t.status === "CANCELLED").length;
    const activeTicketsCount = tickets.length - cancelledTicketsCount;

    return {
      ...booking,
      activeTicketsCount, cancelledTicketsCount
    }
  });

};

export async function getBookingService(bookingId: string) {

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, eventId: true, status: true, createdAt: true, cancelledAt: true,
      event: {
        select: { title: true, location: true, startsAt: true, endsAt: true, status: true }
      },
      tickets: { select: { status: true, ticketType: { select: { type: true } } } }
    }
  });

  if (!booking) {
    throw new AppError(404, "Booking not found");
  }

  const activeByType = new Map<TicketTypeKind, number>();
  let cancelledTicketsCount = 0;

  for (const t of booking.tickets) {
    if (t.status === "CANCELLED") {
      cancelledTicketsCount++;
    } else {
      const type = t.ticketType.type;
      activeByType.set(type, (activeByType.get(type) ?? 0) + 1);
    }
  }

  const { tickets, ...rest } = booking;

  return {
    rest,
    activeTicketsCount: tickets.length - cancelledTicketsCount,
    cancelledTicketsCount,
    activeTicketsByType: [...activeByType].map(([type, count]) => ({ type, count })),
  };

};