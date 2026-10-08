import { TicketTypeKind } from "../../prisma/generated/enums";
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

  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!existingEvent) {
    throw new AppError(404, "Event not found");
  }

  if (existingEvent.status !== "DRAFT") {
    throw new AppError(409, "Only draft events can be published");
  }

  if (existingEvent.startsAt <= new Date()) {
    throw new AppError(409, "This event's start date has passed. Update it before publishing");
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: { eventId: eventId }
  });

  if (!ticketType) {
    throw new AppError(409, "Add at least one ticket type before publishing");
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "PUBLISHED"
    },
    select: eventSummarySelect
  });

  return updatedEvent;

};

// export async function cancelEventService(eventId: string) { // to be completed after implementing booking routes as we'll need cancel bookings here

//   const existingEvent = await prisma.event.findUnique({
//     where: { id: eventId }
//   });

//   if (!existingEvent) {
//     throw new AppError(404, "Event not found");
//   }

//   if (existingEvent.status === "CANCELLED") {
//     throw new AppError(409, "Can't cancel a cancelled event");
//   }


//   const updatedEvent = await prisma.event.update({
//     where: { id: eventId },
//     data: {
//       status: "CANCELLED"
//     },
//     select: eventSummarySelect
//   });

//   return updatedEvent;

// };

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

      const existingEvent = await tx.event.findUnique({
        where: { id: eventId }
      });

      if (!existingEvent) {
        throw new AppError(404, "Event not found");
      }

      if (existingEvent.status === "CANCELLED") {
        throw new AppError(409, "Cancelled events cannot be modified");
      }

      const row = await tx.$queryRaw<{ id: string; capacity: number; remaining: number; type: TicketTypeKind }[]>
        `SELECT id, capacity, remaining, type FROM "TicketType" WHERE id = ${ticketTypeId} AND "eventId" = ${eventId} FOR UPDATE`; // row locked. booking service should lock the row too 

      const existingTicketType = row[0];

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
export const deleteEventService = async (eventId: string) => {

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true },
  });

  if (!event) {
    throw new AppError(404, "Event not found");
  }

  if (event.status !== "CANCELLED") {
    throw new AppError(409, "Only cancelled events can be deleted");
  }

  await prisma.event.delete({
    where: { id: eventId },
  });

};