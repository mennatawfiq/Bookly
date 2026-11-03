import { ApplicationStatus } from '../../prisma/generated/enums';
import prisma from '../../src/lib/prisma';

export async function createApplication(
  userId: string,
  status: ApplicationStatus = 'PENDING',
  reviewedAt: Date | null = null,
) {
  return await prisma.organizerApplication.create({
    data: {
      userId,
      status,
      reviewedAt,
      organizationName: 'Cairo Live Events',
      description: 'We organize jazz and indie concerts across Cairo every month.',
    },
  });
}
