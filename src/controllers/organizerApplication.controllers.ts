import { Request, Response } from 'express';
import { AppError } from '../errorhandling/appError';
import {
  approveApplicationService,
  getApplicationService,
  getApplicationsService,
  getMyApplicationsService,
  postApplicationService,
  rejectApplicationService,
} from '../services/organizerApplication.services';
import { ListApplicationsQuerySchema } from '../schemas/organizerApplication.schema';
import { OffsetPaginationQuerySchema } from '../schemas/pagination.schema';

export const postApplication = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (typeof userId !== 'string') {
    throw new AppError(400, 'Invalid userId');
  }

  const applicationInfo = req.body;

  const application = await postApplicationService(userId, applicationInfo);

  res.jsend.success({ application }, 201);
};

export const getMyApplications = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (typeof userId !== 'string') {
    throw new AppError(400, 'Invalid userId');
  }

  const { page, limit } = OffsetPaginationQuerySchema.parse(req.query);

  const result = await getMyApplicationsService(page, limit, userId);

  res.jsend.success(result, 200);
};

export const getApplication = async (req: Request, res: Response) => {
  const { applicationId } = req.params;

  if (typeof applicationId !== 'string') {
    throw new AppError(400, 'Invalid applicationId');
  }

  const application = await getApplicationService(applicationId);

  res.jsend.success({ application }, 200);
};

export const getApplications = async (req: Request, res: Response) => {
  const { status, page, limit } = ListApplicationsQuerySchema.parse(req.query);

  const result = await getApplicationsService(page, limit, status);

  res.jsend.success(result, 200);
};

export const approveApplication = async (req: Request, res: Response) => {
  const adminId = req.user?.id;

  if (typeof adminId !== 'string') {
    throw new AppError(400, 'Invalid adminId');
  }

  const { applicationId } = req.params;

  if (typeof applicationId !== 'string') {
    throw new AppError(400, 'Invalid applicationId');
  }

  const { reviewNote } = req.body;

  const application = await approveApplicationService(applicationId, adminId, reviewNote);

  res.jsend.success({ application }, 200);
};

export const rejectApplication = async (req: Request, res: Response) => {
  const adminId = req.user?.id;

  if (typeof adminId !== 'string') {
    throw new AppError(400, 'Invalid adminId');
  }

  const { applicationId } = req.params;

  if (typeof applicationId !== 'string') {
    throw new AppError(400, 'Invalid applicationId');
  }

  const { reviewNote } = req.body;

  const application = await rejectApplicationService(applicationId, adminId, reviewNote);

  res.jsend.success({ application }, 200);
};
