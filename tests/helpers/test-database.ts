import prisma from "../../src/lib/prisma";

const EXPECTED_TEST_DATABASE = "event_booking_test";

export async function assertTestDatabase(): Promise<void> {
  // First, check the configured URL before querying the database
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  let configuredDatabase: string;

  try {
    configuredDatabase = decodeURIComponent(
      new URL(databaseUrl).pathname.slice(1),
    );
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (configuredDatabase !== EXPECTED_TEST_DATABASE) {
    throw new Error(
      `Unsafe test database configuration: expected "${EXPECTED_TEST_DATABASE}", ` +
      `received "${configuredDatabase}"`,
    );
  }

  // Then, verify the database PostgreSQL actually connected us to
  const rows = await prisma.$queryRaw<
    { database: string }[]
  >`SELECT current_database() AS database`;

  const actualDatabase = rows[0]?.database;

  if (actualDatabase !== EXPECTED_TEST_DATABASE) {
    throw new Error(
      `Unsafe database connection: expected "${EXPECTED_TEST_DATABASE}", ` +
      `connected to "${actualDatabase ?? "unknown"}"`,
    );
  }
}