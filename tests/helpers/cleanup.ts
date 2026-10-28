import prisma from "../../src/lib/prisma";
import { assertTestDatabase } from "./test-database";

export async function cleanTestDatabase(): Promise<void> {
  // Refuse to clean anything except the test database
  await assertTestDatabase();

  await prisma.$transaction(async (tx) => {
    // Verify again immediately before deleting anything
    const rows = await tx.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;

    if (rows[0]?.database !== "event_booking_test") {
      throw new Error("Refusing to clean a non-test database");
    }

    // Delete dependent records before their parents
    await tx.ticket.deleteMany();
    await tx.booking.deleteMany();
    await tx.ticketType.deleteMany();
    await tx.event.deleteMany();
    await tx.organizerApplication.deleteMany();
    await tx.user.deleteMany();
  });
}