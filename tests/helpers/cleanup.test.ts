import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';
import { cleanTestDatabase } from '../helpers/cleanup';

describe('Test database cleanup', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cleans application records from the test database', async () => {
    await cleanTestDatabase();

    const rows = await prisma.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;

    expect(rows[0]?.database).toBe('event_booking_test');

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.booking.count()).toBe(0);
    expect(await prisma.ticket.count()).toBe(0);
  });
});
