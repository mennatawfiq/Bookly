import { z } from "zod";
import { EventStatus } from "../../prisma/generated/enums";
import { OffsetPaginationQuerySchema } from "./pagination.schema";

export const eventIdParamSchema = z.object({
  eventId: z.uuid().meta({
    description: "The unique identifier of the event",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
});

export type EventIdParamInput = z.infer<typeof eventIdParamSchema>;

export const EventSchema = z.object({
  id: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  organizerId: z.uuid().meta({ example: "7b0f6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  title: z.string().trim().meta({ example: "Cairo Jazz Night" }),
  description: z.string().trim().meta({
    example: "An evening of live jazz with local artists. Doors open at 6 PM.",
  }),
  location: z.string().trim().meta({ example: "Cairo Opera House, Zamalek, Cairo" }),
  startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
  endsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T21:00:00.000Z" }),
  status: z.enum(EventStatus).meta({ example: "PUBLISHED" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  updatedAt: z.iso.datetime().nullable().meta({ example: "2026-10-05T10:00:00.000Z" }),
});

export const EventInputSchema = z.object({
  title: z.string().trim().meta({ example: "Cairo Jazz Night" }),
  description: z.string().trim().meta({
    example: "An evening of live jazz with local artists. Doors open at 6 PM.",
  }),
  location: z.string().trim().meta({ example: "Cairo Opera House, Zamalek, Cairo" }),
  startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
  endsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T21:00:00.000Z" }),
});

export const CreateEventSchema = EventInputSchema
  .refine(
    (data) => new Date(data.startsAt) > new Date(),
    {
      message: "startsAt must be in the future",
      path: ["startsAt"],
    }
  ).refine( // TODO: add this constraint to db too
    (data) => new Date(data.endsAt) > new Date(data.startsAt),
    {
      message: "endsAt must be after startsAt",
      path: ["endsAt"],
    }
  );
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const PatchEventSchema = EventInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided",
  }
);
export type PatchEventInput = z.infer<typeof PatchEventSchema>;

export const CheckInSchema = z.object({
  code: z.base64url()
});
export type CheckInInfo = z.infer<typeof CheckInSchema>;

export const ListEventsQuerySchema = OffsetPaginationQuerySchema.extend({
  status: z.enum(EventStatus).optional().meta({
    description: "Only return events with this status",
    example: "PUBLISHED",
  }),
});

export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;