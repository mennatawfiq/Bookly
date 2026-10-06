import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { CreateEventInput, PatchEventInput } from "../schemas/event.schema";
import { AuthenticatedUser } from "../types/auth";


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
        select: { id: true, type: true, capacity: true, remaining: true },
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
    }
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
    }
  });

  return updatedEvent;

};