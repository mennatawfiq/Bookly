import { Prisma } from '../../prisma/generated/client';
import { UserRole } from '../../prisma/generated/enums';
import { AppError } from '../errorhandling/appError';
import prisma from '../lib/prisma';
import { buildPagination } from '../utils/pagination.util';
import { cancelBookingsInTx } from './booking.services';
import crypto from 'node:crypto';

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
}

export async function getUsersService(page: number, limit: number, role?: UserRole) {
  const where = role ? { role } : {};

  const [users, totalItems] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, createdAt: true, deletedAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, pagination: buildPagination(page, limit, totalItems) };
}

export async function deleteMeService(userId: string) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    // `PENDING` applications
    await tx.organizerApplication.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewNote: 'Applicant deleted their account', reviewedAt: now },
    });

    // lock the user row
    const users = await tx.$queryRaw<
      { id: string; role: UserRole }[]
    >`SELECT id, role FROM "User" WHERE id = ${userId} AND "deletedAt" IS NULL FOR UPDATE`;

    const user = users[0];

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.role === 'ORGANIZER') {
      const upcomingEvent = await tx.event.findFirst({
        where: { organizerId: userId, status: 'PUBLISHED', endsAt: { gt: now } },
        select: { id: true },
      });

      if (upcomingEvent) {
        throw new AppError(
          409,
          "You can't delete your account while having upcoming or running events",
        );
      }
    }

    if (user.role === 'ADMIN') {
      const adminsCount = await tx.user.count({ where: { role: 'ADMIN', deletedAt: null } });

      if (adminsCount === 1) {
        throw new AppError(409, 'You are the only system admin');
      }
    }

    const bookings = await tx.booking.findMany({
      where: { userId, status: 'CONFIRMED', event: { startsAt: { gt: now } } },
      select: { eventId: true },
    });

    if (bookings.length > 0) {
      const eventIds = [...new Set(bookings.map((b) => b.eventId))].sort();

      // lock events
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id IN (${Prisma.join(eventIds)}) ORDER BY id FOR SHARE`;

      // read again after the event lock, so the list is fresh. OF b locks only booking rows
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT b.id FROM "Booking" b JOIN "Event" e ON e.id = b."eventId"
          WHERE b."userId" = ${userId} AND b.status = 'CONFIRMED' AND e."startsAt" > ${now}
          ORDER BY b.id FOR UPDATE OF b`;

      await cancelBookingsInTx(
        tx,
        locked.map((b) => b.id),
        now,
      );
    }

    // anonymize
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted user',
        email: `deleted-${userId}@deleted.invalid`,
        passwordHash: crypto.randomBytes(32).toString('base64url'),
        deletedAt: now,
      },
    });
  });
}
