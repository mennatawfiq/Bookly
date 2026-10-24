import { ApplicationStatus } from "../../prisma/generated/enums";
import { AppError } from "../errorhandling/appError";
import prisma from "../lib/prisma";
import { CreateApplicationInput } from "../schemas/organizerApplication.schema";

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

export async function getMyApplicationsService(userId: string) {

  return await prisma.organizerApplication.findMany({
    where: { userId },
    select: {
      id: true,
      organizationName: true,
      description: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

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

export async function getApplicationsService(status?: ApplicationStatus) {

  return await prisma.organizerApplication.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      organizationName: true,
      description: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

};