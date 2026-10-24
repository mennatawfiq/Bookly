import { Request, Response } from "express";
import { AppError } from "../errorhandling/appError";
import { getApplicationService, getMyApplicationsService, postApplicationService } from "../services/organizerApplication.services";


export const postApplication = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const applicationInfo = req.body;

  const application = await postApplicationService(userId, applicationInfo);

  res.jsend.success({ application }, 201);

};

export const getMyApplications = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const applications = await getMyApplicationsService(userId);

  res.jsend.success({ applications }, 200);

};

export const getApplication = async (req: Request, res: Response) => {

  const { applicationId } = req.params;

  if (typeof applicationId !== "string") {
    throw new AppError(400, "Invalid applicationId");
  }

  const application = await getApplicationService(applicationId);

  res.jsend.success({ application }, 200);

};