import { afterAll, describe, expect, it } from "vitest";
import prisma from "../../src/lib/prisma";

describe("Test database connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to the test database", async () => {
    const rows = await prisma.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;

    expect(rows[0]!.database).toBe("event_booking_test");
  });
});