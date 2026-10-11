import { z } from "zod";
import { BookingStatus } from "../../prisma/generated/enums";

export const BookingListItemSchema = z.object({
  id: z.uuid().meta({ example: "" }),
  userId: z.uuid().meta({ example: "7b0f6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  status: z.enum(BookingStatus).meta({ example: "CONFIRMED" }),
  user: z.object({
    name: z.string().meta({ example: "Jane Doe" }),
    email: z.email().meta({ example: "jane@example.com" }),
  }),
  event: z.object({
    title: z.string().meta({ example: "Cairo Jazz Night" }),
    startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
  })
});