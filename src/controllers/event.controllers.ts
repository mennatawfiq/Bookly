import { Request, Response } from "express";
import { getEventsService, getEventService, getMyEventsService, postEventService, patchEventService, publishEventService, postTicketTypeService, patchTicketTypeService, deleteTicketTypeService, getEventBookingsService, cancelEventService, checkInService } from "../services/event.services";
import { AppError } from "../errorhandling/appError";
import { postBookingService } from "../services/booking.services";
import { ListBookingsQuerySchema } from "../schemas/booking.schema";
import { ListEventsQuerySchema } from "../schemas/event.schema";

export const getEvents = async (req: Request, res: Response) => {

  const { status, page, limit } = ListEventsQuerySchema.parse(req.query);

  const events = await getEventsService(page, limit, req.user, status);

  res.jsend.success({ events }, 200);

};

export const getMyEvents = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const { status, page, limit } = ListEventsQuerySchema.parse(req.query);

  const events = await getMyEventsService(page, limit, userId, status);

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

export const publishEvent = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const event = await publishEventService(eventId);

  res.jsend.success({ event }, 200);

};

export const cancelEvent = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  await cancelEventService(eventId);

  res.status(204).send();

};

export const postTicketType = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const ticketTypeInfo = req.body;

  const ticketType = await postTicketTypeService(eventId, ticketTypeInfo);

  res.jsend.success({ ticketType }, 201);

};

export const patchTicketType = async (req: Request, res: Response) => {

  const { eventId, ticketTypeId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  if (typeof ticketTypeId !== "string") {
    throw new AppError(400, "Invalid ticketTypeId");
  }

  const ticketTypeInfo = req.body;

  const ticketType = await patchTicketTypeService(eventId, ticketTypeId, ticketTypeInfo);

  res.jsend.success({ ticketType }, 200);

};

export const deleteTicketType = async (req: Request, res: Response) => {

  const { eventId, ticketTypeId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  if (typeof ticketTypeId !== "string") {
    throw new AppError(400, "Invalid ticketTypeId");
  }

  await deleteTicketTypeService(eventId, ticketTypeId);

  res.status(204).send();

};

export const getEventBookings = async (req: Request, res: Response) => {

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const { status, page, limit } = ListBookingsQuerySchema.parse(req.query);

  const bookings = await getEventBookingsService(eventId, page, limit, status);

  res.jsend.success({ bookings }, 200);

};

export const postBooking = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const { eventId } = req.params;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  const bookingInfo = req.body;

  const booking = await postBookingService(userId, eventId, bookingInfo);

  res.jsend.success({ booking }, 201);

};

export const checkIn = async (req: Request, res: Response) => {

  const { eventId } = req.params;
  const userId = req.user?.id;

  if (typeof eventId !== "string") {
    throw new AppError(400, "Invalid eventId");
  }

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const checkInInfo = req.body;

  const type = await checkInService(eventId, checkInInfo, userId);

  res.jsend.success({ type }, 200);

};