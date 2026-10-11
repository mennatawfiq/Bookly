import { z } from "zod";
import { BookingStatus, EventStatus } from "../../prisma/generated/enums";

export const BookingListItemSchema = z.object({
  id: z.uuid().meta({ example: "88bf6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  userId: z.uuid().meta({ example: "7b0f6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  status: z.enum(BookingStatus).meta({ example: "CONFIRMED" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  user: z.object({
    name: z.string().meta({ example: "Jane Doe" }),
    email: z.email().meta({ example: "jane@example.com" }),
  }),
  event: z.object({
    title: z.string().meta({ example: "Cairo Jazz Night" }),
    startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
  })
});


export const UserBookingListItemSchema = z.object({
  id: z.uuid().meta({ example: "88bf6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  status: z.enum(BookingStatus).meta({ example: "CONFIRMED" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  cancelledAt: z.iso.datetime().nullable().meta({ example: null }),
  event: z.object({
    title: z.string().meta({ example: "Cairo Jazz Night" }),
    startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
    endsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T21:00:00.000Z" }),
    status: z.enum(EventStatus).meta({ example: "PUBLISHED" }),
  }),
  activeTicketsCount: z.int().min(0).meta({ example: 4 }),
  cancelledTicketsCount: z.int().min(0).meta({ example: 0 })
});