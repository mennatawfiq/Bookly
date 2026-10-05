import { z } from "zod";
import { TicketTypeKind } from "../../prisma/generated/enums";

export const TicketTypeSchema = z.object({
  id: z.uuid().meta({ example: "a1c4e9f2-6b3d-4f18-8e27-5d9c0b7a3e41" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  type: z.enum(TicketTypeKind).meta({ example: "VIP" }),
  capacity: z.int().min(1).meta({ example: 50 }),
  remaining: z.int().min(0).meta({ example: 32 }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  updatedAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
});

// What clients see nested inside an event
export const TicketTypeSummarySchema = TicketTypeSchema.omit({
  eventId: true,
  createdAt: true,
  updatedAt: true,
});