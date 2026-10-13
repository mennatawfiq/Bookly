import prisma from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";

export const isEventOrganizer = async (booking: { eventId: string }, user: AuthenticatedUser) => {

  const event = await prisma.event.findUnique({ where: { id: booking.eventId }, select: { organizerId: true } });

  return event?.organizerId === user.id;

};