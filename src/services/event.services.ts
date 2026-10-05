import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";


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

export async function getEventService(eventId: string) {

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
      status: "PUBLISHED"
    },
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true,
    }
  });

  if (!event) {
    throw new AppError(404, "Event not found")
  }

  return event;
};