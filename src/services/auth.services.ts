import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { AppError } from '../errorhandling/appError';

export async function registerUser(name: string, email: string, password: string) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(409, 'Email is already registered.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  return user;
}

const DUMMY_PASSWORD_HASH = '$2b$12$IblQX.MFBASVkhD6EJMqLe3gsSSW/FoVC6hSl9F/lhgQQwCxnnvNK';

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
  });

  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;

  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  return { id: user.id, name: user.name, email, role: user.role };
}
