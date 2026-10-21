import tr from "zod/v4/locales/tr.js";
import { Prisma } from "../../prisma/generated/client";
import { BookingStatus, EventStatus, TicketTypeKind } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { CreateBookingInput } from "../schemas/booking.schema";
import crypto from "node:crypto";

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

export async function postBookingService(userId: string, eventId: string, bookingInfo: CreateBookingInput) {

  const bookingId = await prisma.$transaction(
    async (tx) => {

      // share lock so bookings run together, but wait for publish, patch, and delete
      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus, startsAt: Date }[]>
        `SELECT id, status, "startsAt" FROM "Event" WHERE id = ${eventId} FOR SHARE`;

      const event = eventRows[0];

      if (!event) {
        throw new AppError(404, "Event not found");
      }

      // BR: an event must be published and not yet started
      if (event.status !== "PUBLISHED") {
        throw new AppError(409, "Only published events can have bookings");
      }

      if (event.startsAt <= new Date()) {
        throw new AppError(409, "Event already started");
      }

      // BR: a user can have no more than one active booking for the same event
      const existingBooking = await tx.booking.findFirst({
        where: { userId, eventId, status: "CONFIRMED" }
      });

      if (existingBooking) {
        throw new AppError(409, "A user can have at most one confirmed booking for an event");
      }

      // check if event has enough remaining tickets of every required type, then decrease this count from the remaining
      const types = bookingInfo.tickets.map((t) => t.type);

      const rows = await tx.$queryRaw<{ id: string; type: TicketTypeKind; remaining: number }[]>
        `SELECT id, type, remaining FROM "TicketType" WHERE "eventId" = ${eventId} AND type IN (${Prisma.join(types)})
      ORDER BY id FOR UPDATE`;

      if (rows.length !== types.length) {
        throw new AppError(400, "This event doesn't have all the required ticket types");
      }

      const countByType = new Map(bookingInfo.tickets.map((t) => [t.type, t.count]));

      for (const { id, type, remaining } of rows) {
        const count = countByType.get(type)!;

        if (remaining < count) {
          throw new AppError(409, `The required tickets count of type ${type} exceeds the remaining capacity`);
        }

        await tx.ticketType.update({
          where: { id, eventId },
          data: { remaining: { decrement: count } }
        });
      }

      // everythig is checked. create booking and tickets
      const booking = await tx.booking.create({
        data: { userId, eventId, status: "CONFIRMED", }
      });

      const ticketsData = rows.flatMap(({ id, type }) => {
        const count = countByType.get(type)!;

        return Array.from({ length: count }, () => ({
          bookingId: booking.id,
          ticketTypeId: id,
          status: "VALID" as const,
          code: crypto.randomBytes(16).toString("base64url"),
        }));
      });

      await tx.ticket.createMany({
        data: ticketsData
      });

      return booking.id;

    });

  // return booking with tickets info
  return await getBookingService(bookingId);

};

export async function cancelBookingService(bookingId: string) {

  // early fetch to get eventId to lock the event row
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { eventId: true } });

  if (!booking) {
    throw new AppError(404, "Booking not found");
  }

  return await prisma.$transaction(
    async (tx) => {

      // share lock so bookings run together, but wait for publish, patch, and delete
      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus, startsAt: Date }[]>
        `SELECT id, status, "startsAt" FROM "Event" WHERE id = ${booking.eventId} FOR SHARE`;

      const event = eventRows[0];

      if (!event) {
        throw new AppError(404, "Event not found");
      }

      // BR: an event must be published and not yet started
      if (event.status !== "PUBLISHED") {
        throw new AppError(409, "Event is not published");
      }

      if (event.startsAt <= new Date()) {
        throw new AppError(409, "Event already started");
      }

      const bookingRows = await tx.$queryRaw<{ id: string; status: BookingStatus }[]>
        `SELECT id, status FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;

      if (!bookingRows[0]) {
        throw new AppError(404, "Booking not found");
      }

      if (bookingRows[0].status === "CANCELLED") {
        throw new AppError(409, "Booking is already cancelled");
      }

      const ticketRows = await tx.$queryRaw<{ id: string; ticketTypeId: string }[]>
        `SELECT id, "ticketTypeId" FROM "Ticket" WHERE "bookingId" = ${bookingId} AND status = 'VALID'
      ORDER BY id FOR UPDATE`;

      const cancelledAt = new Date();

      if (ticketRows.length === 0) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: "CANCELLED", cancelledAt }
        });
        return;
      }

      const ticketTypeIds = [...new Set(ticketRows.map((t) => t.ticketTypeId))];

      await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id IN (${Prisma.join(ticketTypeIds)}) AND 
      "eventId" = ${booking.eventId} ORDER BY id FOR UPDATE`;

      const ticketIds = ticketRows.map((t) => t.id);

      await tx.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { status: "CANCELLED", cancelledAt, }
      });

      const countByType = new Map<string, number>();

      for (const t of ticketRows) {
        const typeId = t.ticketTypeId;
        countByType.set(typeId, (countByType.get(typeId) ?? 0) + 1);
      }

      // sort tickets by id to loop on it in one order
      const sortedCounts = [...countByType].sort(([a], [b]) => a.localeCompare(b));

      for (const [id, count] of sortedCounts) {
        await tx.ticketType.update({
          where: { id, eventId: booking.eventId },
          data: { remaining: { increment: count } }
        });
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", cancelledAt }
      });

    });

};