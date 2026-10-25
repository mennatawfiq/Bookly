import prisma from "../lib/prisma";

export async function getTicketsService(bookingId: string) {

  const tickets = await prisma.ticket.findMany({
    where: { bookingId },
    select: {
      id: true,
      ticketType: { select: { type: true } },
      status: true,
      code: true,
      createdAt: true,
      cancelledAt: true,
      usedAt: true,
    },
    orderBy: { createdAt: "asc" }
  });

  return tickets.map(({ ticketType, ...t }) => ({ ...t, type: ticketType.type }));;

};