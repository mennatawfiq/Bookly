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