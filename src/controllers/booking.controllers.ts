import { Request, Response } from "express";
import { getAllBookingsService } from "../services/booking.services";

export const getAllBookings = async (req: Request, res: Response) => {

  const bookings = await getAllBookingsService();

  res.jsend.success({ bookings }, 200);

};