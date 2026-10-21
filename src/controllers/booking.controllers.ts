import { Request, Response } from "express";
import { cancelBookingService, cancelTicketService, getAllBookingsService, getBookingService, getMyBookingsService } from "../services/booking.services";
import { AppError } from "../errorhandling/appError";
import { getTicketsService } from "../services/ticket.services";

export const getAllBookings = async (req: Request, res: Response) => {

  const bookings = await getAllBookingsService();

  res.jsend.success({ bookings }, 200);

};

export const getMyBookings = async (req: Request, res: Response) => {

  const userId = req.user?.id;

  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid userId");
  }

  const bookings = await getMyBookingsService(userId);

  res.jsend.success({ bookings }, 200);

};

export const getBooking = async (req: Request, res: Response) => {

  const { bookingId } = req.params;

  if (typeof bookingId !== "string") {
    throw new AppError(400, "Invalid bookingId");
  }

  const booking = await getBookingService(bookingId);

  res.jsend.success({ booking }, 200);

};

export const getTickets = async (req: Request, res: Response) => {

  const { bookingId } = req.params;

  if (typeof bookingId !== "string") {
    throw new AppError(400, "Invalid bookingId");
  }

  const tickets = await getTicketsService(bookingId);

  res.jsend.success({ tickets }, 200);

};

export const cancelBooking = async (req: Request, res: Response) => {

  const { bookingId } = req.params;

  if (typeof bookingId !== "string") {
    throw new AppError(400, "Invalid bookingId");
  }

  await cancelBookingService(bookingId);

  res.status(204).send();

};

export const cancelTicket = async (req: Request, res: Response) => {

  const { bookingId, ticketId } = req.params;

  if (typeof bookingId !== "string") {
    throw new AppError(400, "Invalid bookingId");
  }

  if (typeof ticketId !== "string") {
    throw new AppError(400, "Invalid ticketId");
  }

  await cancelTicketService(bookingId, ticketId);

  res.status(204).send();

};