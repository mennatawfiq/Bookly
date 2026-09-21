import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { AppError, UnauthorizedError } from "../errorhandling/appError";

export async function registerUser(name: string, email: string, password: string) {

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError(409, "Email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name, email, passwordHash
    },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true
    }
  });
  return user;

};

export async function loginUser(email: string, password: string) {

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash);

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  return { id: user.id, name: user.name, email, role: user.role };
};