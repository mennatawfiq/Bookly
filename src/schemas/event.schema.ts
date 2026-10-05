import { z } from "zod";

export const getEventSchema = z.object({
  eventId: z.uuid().meta({
    description: "The unique identifier of the event",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
});

export type GetEventInput = z.infer<typeof getEventSchema>;
