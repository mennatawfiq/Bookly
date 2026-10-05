import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
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