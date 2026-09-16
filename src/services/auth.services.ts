import bcrypt from "bcrypt";
import prisma from "../lib/prisma";

export async function registerUser(name: string, email: string, password: string) {

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error("Email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // try {
  const user = await prisma.user.create({
    data: {
      name, email, passwordHash
    },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true
    }
  });
  return user;
  // } catch (error) {
  //   next(error);
  // }

};