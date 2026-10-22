import { Prisma } from "../../prisma/generated/client";
import { BookingStatus, EventStatus, TicketTypeKind } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { CreateEventInput, PatchEventInput } from "../schemas/event.schema";
import { CreateTicketTypeInput, PatchTicketTypeInput } from "../schemas/ticketType.schema";
import { AuthenticatedUser } from "../types/auth";


const eventSummarySelect = {
  id: true,
  organizerId: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
} as const;

const ticketTypeSummarySelect = { id: true, type: true, capacity: true, remaining: true } as const;

export async function getEventsService() {

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true,
    },
    orderBy: {
      startsAt: "asc"
    }
  });

  return events;

};

export async function getMyEventsService(userId: string) {

  const events = await prisma.event.findMany({
    where: { organizerId: userId },
    orderBy: {
      startsAt: "asc"
    }
  });

  return events;

}

const canViewEvent = (event: { organizerId: string, status: string }, user?: AuthenticatedUser) => {

  return (event.status === "PUBLISHED" || user?.role === "ADMIN" || event.organizerId === user?.id);

}

export async function getEventService(eventId: string, user?: AuthenticatedUser) {

  const event = await prisma.event.findUnique({
    where: {
      id: eventId
    },          // no status filter anymore
    select: {
      id: true,
      organizerId: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      endsAt: true,
      status: true,
      createdAt: true,
      ticketTypes: {
        select: ticketTypeSummarySelect,
      }
    }
  });

  if (!event || !canViewEvent(event, user)) {
    throw new AppError(404, "Event not found")
  }

  return event;
};

export async function postEventService(eventInfo: CreateEventInput, organizerId: string) {

  const event = await prisma.event.create({
    data: {
      organizerId: organizerId,
      status: "DRAFT",
      title: eventInfo.title,
      description: eventInfo.description,
      location: eventInfo.location,
      startsAt: new Date(eventInfo.startsAt),
      endsAt: new Date(eventInfo.endsAt),
    },
    select: eventSummarySelect
  });

  return event;

};

export async function patchEventService(eventId: string, eventInfo: PatchEventInput) {

  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!existingEvent) {
    throw new AppError(404, "Event not found");
  }

  if (existingEvent.status !== "DRAFT") {
    throw new AppError(400, "Event cannot be edited");
  }

  const startsAt = eventInfo.startsAt ? new Date(eventInfo.startsAt) : existingEvent.startsAt;

  const endsAt = eventInfo.endsAt ? new Date(eventInfo.endsAt) : existingEvent.endsAt;

  if (eventInfo.startsAt && startsAt < new Date()) {
    throw new AppError(400, "startsAt must be in the future");
  }

  if (endsAt <= startsAt) {
    throw new AppError(400, "endsAt must be after startsAt");
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(eventInfo.title !== undefined && { title: eventInfo.title, }),
      ...(eventInfo.description !== undefined && { description: eventInfo.description, }),
      ...(eventInfo.location !== undefined && { location: eventInfo.location, }),
      ...(eventInfo.startsAt !== undefined && { startsAt, }),
      ...(eventInfo.endsAt !== undefined && { endsAt, }),
    },
    select: eventSummarySelect
  });

  return updatedEvent;

};

export async function publishEventService(eventId: string) {

  const updatedEvent = await prisma.$transaction(
    async (tx) => {

      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus; startsAt: Date }[]>
        `SELECT id, status, "startsAt" FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

      const existingEvent = eventRows[0];

      if (!existingEvent) {
        throw new AppError(404, "Event not found");
      }

      if (existingEvent.status !== "DRAFT") {
        throw new AppError(409, "Only draft events can be published");
      }

      if (existingEvent.startsAt <= new Date()) {
        throw new AppError(409, "This event's start date has passed. Update it before publishing");
      }

      const ticketTypeCount = await tx.ticketType.count({ where: { eventId } });

      if (ticketTypeCount === 0) {
        throw new AppError(409, "Add at least one ticket type before publishing");
      }

      return await tx.event.update({
        where: { id: eventId },
        data: {
          status: "PUBLISHED"
        },
        select: eventSummarySelect
      });
    }
  );

  return updatedEvent;

};

export async function cancelEventService(eventId: string) {

  await prisma.$transaction(
    async (tx) => {
      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus; startsAt: Date }[]>
        `SELECT id, status, "startsAt" FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

      const event = eventRows[0];

      if (!event) {
        throw new AppError(404, "Event not found");
      }

      if (event.status === "CANCELLED") {
        throw new AppError(409, "Cancelled events cannot be modified");
      }

      if (event.startsAt <= new Date()) {
        throw new AppError(409, "Event already started");
      }

      const bookingRows = await tx.$queryRaw<{ id: string }[]>
        `SELECT id FROM "Booking" WHERE "eventId" = ${eventId} AND status = 'CONFIRMED' FOR UPDATE`;

      const bookingIds = bookingRows.map((b) => b.id);

      if (bookingIds.length === 0) {
        return;
      }

      await tx.$queryRaw`SELECT id FROM "Ticket" WHERE "bookingId" IN (${Prisma.join(bookingIds)}) AND status = 'VALID'
            ORDER BY id FOR UPDATE`;

      const cancelledAt = new Date();

      await tx.ticket.updateMany({
        where: { bookingId: { in: bookingIds }, status: "VALID" },
        data: { status: "CANCELLED", cancelledAt, }
      });

      await tx.booking.updateMany({
        where: { eventId, status: "CONFIRMED" },
        data: { status: "CANCELLED", cancelledAt }
      });

      await tx.event.update({
        where: { id: eventId },
        data: { status: "CANCELLED" }
      });
    }
  );

};

export async function postTicketTypeService(eventId: string, ticketTypeInfo: CreateTicketTypeInput) {

  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!existingEvent) {
    throw new AppError(404, "Event not found");
  }

  if (existingEvent.status === "CANCELLED") {
    throw new AppError(409, "Only draft or published events can recieve new ticket types");
  }

  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: eventId,
      type: ticketTypeInfo.type,
      capacity: ticketTypeInfo.capacity,
      remaining: ticketTypeInfo.capacity
    },
    select: ticketTypeSummarySelect
  });

  return ticketType;
};

export async function patchTicketTypeService(eventId: string, ticketTypeId: string, ticketTypeInfo: PatchTicketTypeInput) {

  const result = await prisma.$transaction(
    async (tx) => {

      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus }[]>
        `SELECT id, status FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

      const existingEvent = eventRows[0];

      if (!existingEvent) {
        throw new AppError(404, "Event not found");
      }

      if (existingEvent.status === "CANCELLED") {
        throw new AppError(409, "Cancelled events cannot be modified");
      }

      const ticketTypeRows = await tx.$queryRaw<{ id: string; capacity: number; remaining: number; type: TicketTypeKind }[]>
        `SELECT id, capacity, remaining, type FROM "TicketType" WHERE id = ${ticketTypeId} AND "eventId" = ${eventId} FOR UPDATE`; // row locked. booking service should lock the row too 

      const existingTicketType = ticketTypeRows[0];

      if (!existingTicketType) {
        throw new AppError(404, "Ticket Type not found");
      }

      const newCapacity = ticketTypeInfo.capacity ?? existingTicketType.capacity;

      const newType = ticketTypeInfo.type ?? existingTicketType.type;

      const bookedTickets = await tx.ticket.count({
        where: {
          ticketTypeId,
          status: { not: "CANCELLED" }
        }
      });

      if (newCapacity < bookedTickets) {
        throw new AppError(409, `Capacity cannot be less than the number of booked tickets (${bookedTickets})`);
      }

      if (ticketTypeInfo.type !== undefined && ticketTypeInfo.type !== existingTicketType.type && bookedTickets > 0) {
        throw new AppError(409, "Ticket type cannot be changed after tickets have been booked");
      }

      return await tx.ticketType.update({
        where: { id: ticketTypeId, eventId },
        data: { type: newType, capacity: newCapacity, remaining: newCapacity - bookedTickets },
        select: ticketTypeSummarySelect
      });

    }
  );

  return result;

};

export async function deleteTicketTypeService(eventId: string, ticketTypeId: string) {

  const result = await prisma.$transaction(
    async (tx) => {

      // lock event row to enforce rule: for a published event, there must be at least one ticket type. so case the of deleting last ticket type of a published event doesn't happen 
      const eventRows = await tx.$queryRaw<{ id: string; status: EventStatus }[]>
        `SELECT id, status FROM "Event" WHERE id = ${eventId} FOR UPDATE`; // must be locked in publishEventService too

      const event = eventRows[0];

      if (!event) {
        throw new AppError(404, "Event not found");
      }

      if (event.status === "CANCELLED") {
        throw new AppError(409, "Cancelled events cannot be modified");
      }

      // row locked so that no booking can happen while deleting this ticket type
      const ticketTypeRows = await tx.$queryRaw<{ id: string }[]>
        `SELECT id FROM "TicketType" WHERE id = ${ticketTypeId} AND "eventId" = ${eventId} FOR UPDATE`;

      const ticketType = ticketTypeRows[0];

      if (!ticketType) {
        throw new AppError(404, "Ticket Type not found");
      }

      const ticketCount = await tx.ticket.count({
        where: { ticketTypeId }
      });

      if (ticketCount > 0) {
        throw new AppError(409, "Ticket Types with at least one booked ticket can't be deleted");
      }

      if (event.status === "PUBLISHED") {
        const ticketTypeCount = await tx.ticketType.count({
          where: { eventId }
        });

        if (ticketTypeCount < 2) {
          throw new AppError(409, "Published events must have at least one ticket type");
        }
      }

      // draft events can have 0 ticket types

      await tx.ticketType.delete({
        where: { id: ticketTypeId, eventId }
      });

    });

  return result;

};

export async function getEventBookingsService(eventId: string) {

  const bookings = await prisma.booking.findMany({
    where: { eventId },
    select: {
      id: true, status: true, createdAt: true, cancelledAt: true,
      user: { select: { name: true, email: true } },
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