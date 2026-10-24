import { UserRole } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";

export async function getMeService(userId: string) {

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;

};

export async function getUsersService(role?: UserRole) {

  return await prisma.user.findMany({
    where: role ? { role } : {},
    select: { id: true, name: true, email: true, role: true, createdAt: true, deletedAt: true },
    orderBy: { createdAt: "desc" },
  });

};