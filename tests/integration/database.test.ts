import { afterAll, describe, expect, it } from "vitest";
import prisma from "../../src/lib/prisma";
import { assertTestDatabase } from "../helpers/test-database";

describe("Test database connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to the isolated test database", async () => {
    await expect(assertTestDatabase()).resolves.toBeUndefined();
  });
});