import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import z from 'zod';

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(100, { message: 'Password cannot exceed 100 characters' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  .meta({ example: 'Str0ng!Password' });

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const emailCheck = z.email().safeParse(email);
  if (!emailCheck.success) {
    const reasons = emailCheck.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`ADMIN_EMAIL is bad: ${reasons}`);
  }

  const passwordCheck = passwordSchema.safeParse(password);
  if (!passwordCheck.success) {
    const reasons = passwordCheck.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`ADMIN_PASSWORD is too weak: ${reasons}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Admin', email, passwordHash, role: 'ADMIN' },
  });
}
