import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/live', (req, res) => {
  return res.jsend.success({
    status: 'alive',
  });
});

router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.jsend.success({
      status: 'ready',
      database: 'connected',
    });
  } catch {
    return res.jsend.error('Service unavailable', 503);
  }
});

export default router;
