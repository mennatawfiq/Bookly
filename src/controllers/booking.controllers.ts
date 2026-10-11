import { Request, Response } from "express";
import { getAllBookingsService, getMyBookingsService } from "../services/booking.services";
import { AppError } from "../errorhandling/appError";

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