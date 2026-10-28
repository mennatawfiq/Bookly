import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../src/app";
import { TestCredentials } from "../types.test";
import { UserRole } from "../../prisma/generated/enums";
import prisma from "../../src/lib/prisma";


export async function createUser(role: UserRole = UserRole.USER,) {
  const id = randomUUID();
  const password = "TestPassword123!";

  const user = await prisma.user.create({
    data: {
      name: `Test User ${id}`,
      email: `test-${id}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      role,
    },
  });

  return {
    user,
    credentials: { email: user.email, password, },
  };
}

export async function loginAs(user: TestCredentials) {
  const response = await request(app)
    .post("/auth/login")
    .send({ email: user.email, password: user.password, });

  if (response.status !== 200) {
    throw new Error(`Test login failed: HTTP ${response.status}`,);
  }

  return response.body.data.token as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, };
}
