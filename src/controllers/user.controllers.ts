import { Request, Response } from "express";
import { AppError } from "../errorhandling/appError";
import { deleteMeService, getMeService, getUsersService } from "../services/user.services";
import { ListUsersQuerySchema } from "../schemas/user.schema";

export const getMe = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const user = await getMeService(userId);

  res.jsend.success({ user }, 200);

};

export const getUsers = async (req: Request, res: Response) => {

  const { role } = ListUsersQuerySchema.parse(req.query);

  const users = await getUsersService(role);

  res.jsend.success({ users }, 200);

};

export const deleteMe = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  await deleteMeService(userId);

  res.status(204).send();

};