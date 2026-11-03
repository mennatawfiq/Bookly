import { ApplicationStatus } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { ApproveApplication, CreateApplicationInput, RejectApplication } from "../schemas/organizerApplication.schema";
import { buildPagination } from "../utils/pagination.util";

export async function postApplicationService(userId: string, applicationInfo: CreateApplicationInput) {

  const existingApplication = await prisma.organizerApplication.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true }
  });

  if (existingApplication) {
    throw new AppError(409, "You already have a pending application");
  }

  const lastRejectedApplication = await prisma.organizerApplication.findFirst({
    where: { userId, status: 'REJECTED' },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" }
  });

  if (lastRejectedApplication?.reviewedAt) {
    const canApplyAt = new Date(lastRejectedApplication.reviewedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (canApplyAt > new Date()) {
      throw new AppError(409, `You can apply again after ${canApplyAt.toISOString()}`);
    }
  }

  const application = await prisma.organizerApplication.create({
    data: {
      userId,
      organizationName: applicationInfo.organizationName,
      description: applicationInfo.description
    },
    select: {
      id: true,
      organizationName: true,
      description: true,
      status: true,
      createdAt: true
    }
  });

  return application;

};

export async function getMyApplicationsService(page: number, limit: number, userId: string) {

  const where = { userId };

  const [applications, totalItems] = await prisma.$transaction([
    prisma.organizerApplication.findMany({
      where,
      select: {
        id: true, organizationName: true, description: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizerApplication.count({ where }),
  ]);

  return { applications, pagination: buildPagination(page, limit, totalItems) };

};

export async function getApplicationService(applicationId: string) {

  const application = await prisma.organizerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      organizationName: true,
      description: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  if (!application) {
    throw new AppError(404, "Application not found");
  }

  return application;

};

export async function getApplicationsService(page: number, limit: number, status?: ApplicationStatus) {

  const where = status ? { status } : {};

  const [applications, totalItems] = await prisma.$transaction([
    prisma.organizerApplication.findMany({
      where,
      select: {
        id: true, organizationName: true, description: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizerApplication.count({ where }),
  ]);

  return { applications, pagination: buildPagination(page, limit, totalItems) };

};

export async function approveApplicationService(applicationId: string, adminId: string, reviewNote?: string) {

  const application = await prisma.organizerApplication.findFirst({ where: { id: applicationId, status: "PENDING" }, select: { userId: true } })

  if (!application) {
    throw new AppError(404, "Application not found");
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrganizerApplication" WHERE id = ${applicationId} FOR UPDATE`;

      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${application?.userId} FOR UPDATE`;

      await tx.organizerApplication.update({
        where: { id: applicationId, status: "PENDING" },
        data: {
          reviewedById: adminId,
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null
        }
      });

      const user = await tx.user.update({
        where: { id: application.userId, role: 'USER' },
        data: { role: 'ORGANIZER' }
      });

      if (!user || user.deletedAt) {
        throw new AppError(409, "The applicant's account was deleted");
      }

    }
  );

  return await getApplicationService(applicationId);

};

export async function rejectApplicationService(applicationId: string, adminId: string, reviewNote: string) {

  const application = await prisma.organizerApplication.findFirst({ where: { id: applicationId, status: "PENDING" }, select: { userId: true } })

  if (!application) {
    throw new AppError(404, "Application not found");
  }

  await prisma.$transaction(
    async (tx) => {
      // lock order: application then user
      await tx.$queryRaw`SELECT id FROM "OrganizerApplication" WHERE id = ${applicationId} FOR UPDATE`;

      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${application?.userId} FOR UPDATE`;

      await tx.organizerApplication.update({
        where: { id: applicationId, status: "PENDING" },
        data: {
          reviewedById: adminId,
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewNote
        }
      });

    }
  );

  return await getApplicationService(applicationId);

};