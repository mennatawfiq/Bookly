import { Request, Response } from "express";
import { getEventsService, getEventService, getMyEventsService, postEventService, patchEventService } from "../services/event.services";
import { AppError } from "../errorhandling/appError";

export const getEvents = async (req: Request, res: Response) => {

  const events = await getEventsService();

  res.jsend.success({ events }, 200);

};

export const getMyEvents = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const events = await getMyEventsService(userId);

  res.jsend.success({ events }, 200);

};

export const getEvent = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const event = await getEventService(eventId, req.user);

  res.jsend.success({ event }, 200);

};

export const postEvent = async (req: Request, res: Response) => {

  const eventInfo = req.body;
  const organizerId = req.user?.id;

  if (typeof organizerId !== "string") {
    throw new AppError(400, "Invalid organizerId");
  }

  const event = await postEventService(eventInfo, organizerId);

  res.jsend.success({ event }, 201);

};

export const patchEvent = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const eventInfo = req.body;

  const event = await patchEventService(eventId, eventInfo);

  res.jsend.success({ event }, 200);

};
