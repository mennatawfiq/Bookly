import { z } from "zod";
import { TicketTypeKind } from "../../prisma/generated/enums";
import { eventIdParamSchema } from "./event.schema";

export const TicketTypeSchema = z.object({
  id: z.uuid().meta({ example: "a1c4e9f2-6b3d-4f18-8e27-5d9c0b7a3e41" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  type: z.enum(TicketTypeKind).meta({ example: "VIP" }),
  capacity: z.int().min(1).max(100_000).meta({ example: 50 }),
  remaining: z.int().min(0).max(100_000).meta({ example: 50 }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  updatedAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
});

// What clients see nested inside an event
export const TicketTypeSummarySchema = TicketTypeSchema.omit({
  eventId: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateTicketTypeSchema = z.object({
  type: z.enum(TicketTypeKind).meta({ example: "VIP" }),
  capacity: z.int().min(1).max(100_1000).meta({ example: 50 }), // TODO: fix this: max(100_000)
});

export type CreateTicketTypeInput = z.infer<typeof CreateTicketTypeSchema>;

export const TicketTypeIdParamSchema = eventIdParamSchema.extend({
  ticketTypeId: z.uuid().meta({
    description: "The unique identifier of the ticket type",
    example: "679e8400-e29b-41d4-a716-446655440000",
  })
});

export type TicketTypeIdParamInput = z.infer<typeof TicketTypeIdParamSchema>;

export const PatchTicketTypeSchema = z.object({
  type: z.enum(TicketTypeKind).optional().meta({ example: "VIP" }),
  capacity: z.int().min(1).max(100_000).optional().meta({ example: 50 }),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided",
  }
);

export type PatchTicketTypeInput = z.infer<typeof PatchTicketTypeSchema>;