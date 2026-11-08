import prisma from '../lib/prisma';
import { seedAdmin } from './seed-admin';

seedAdmin()
  .then(() => console.log('Admin is ready'))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
