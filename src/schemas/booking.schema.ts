import { z } from "zod";
import { BookingStatus, EventStatus, TicketStatus, TicketTypeKind } from "../../prisma/generated/enums";

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

export const bookingIdParamSchema = z.object({
  bookingId: z.uuid().meta({
    description: "The unique identifier of the Booking",
    example: "88bf6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90",
  })
});

export type BookingIdParamInput = z.infer<typeof bookingIdParamSchema>;

export const UserBookingDetailSchema = z.object({
  id: z.uuid().meta({ example: "c2a9e1d4-8f3b-4b6a-a1d7-9e5f0c3b2a68" }),
  eventId: z.uuid().meta({ example: "3f6d2c8a-5b1e-4e7a-9d34-8c2a1f0b7e55" }),
  status: z.enum(BookingStatus).meta({ example: "CONFIRMED" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  cancelledAt: z.iso.datetime().nullable().meta({ example: null }),
  event: z.object({
    title: z.string().meta({ example: "Cairo Jazz Night" }),
    startsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T18:00:00.000Z" }),
    location: z.string().trim().meta({ example: "Cairo Opera House, Zamalek, Cairo" }),
    endsAt: z.iso.datetime({ offset: true }).meta({ example: "2027-09-20T21:00:00.000Z" }),
    status: z.enum(EventStatus).meta({ example: "PUBLISHED" }),
  }),
  activeTicketsCount: z.int().min(0).meta({ example: 3 }),
  cancelledTicketsCount: z.int().min(0).meta({ example: 0 }),
  activeTicketsByType: z.array(
    z.object({
      type: z.enum(TicketTypeKind).meta({ example: "GENERAL" }),
      count: z.int().min(1).meta({ example: 2 }),
    })
  ).meta({ description: "Number of tickets that are not cancelled, grouped by ticket type. Types with no active tickets are not listed." }),
});

export const BookingTicketsDetailSchema = z.object({
  id: z.uuid().meta({ example: "2f026d48-4a47-4489-b783-02e350203f81" }),
  type: z.enum(TicketTypeKind).meta({ example: "GENERAL" }),
  status: z.enum(TicketStatus).meta({ example: "VALID" }),
  code: z.string().meta({ example: "k3Jx9mQ2vT8bW1nZ5pR7sY4cH6aD0eF2gL9uB3iO1xA" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-05T10:00:00.000Z" }),
  cancelledAt: z.iso.datetime().nullable().meta({ example: null }),
  usedAt: z.iso.datetime().nullable().meta({ example: null }),
});

export const EventBookingListItemSchema = UserBookingListItemSchema
  .omit({ eventId: true, event: true })
  .extend({
    user: z.object({
      name: z.string().meta({ example: "Jane Doe" }),
      email: z.email().meta({ example: "jane@example.com" }),
    })
  });

export const CreateBookingSchema = z.object({
  tickets: z.array(
    z.object({
      type: z.enum(TicketTypeKind).meta({ example: "GENERAL" }),
      count: z.int().min(1).max(10).meta({ example: 2 }),
    })
  )
    .min(1)
    .refine(
      (items) => new Set(items.map((i) => i.type)).size === items.length,
      { message: "Each ticket type can appear only once" }
    )
    .refine(
      (tickets) => tickets.reduce((total, ticket) => total + ticket.count, 0) <= 10,
      { message: "You can book at most 10 tickets per booking", }
    )
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const CancelTicketParamSchema = bookingIdParamSchema.extend({
  ticketId: z.uuid().meta({
    description: "The unique identifier of the ticket",
    example: "618ece97-1e70-4e70-a8aa-ef484b6347b4",
  })
});

// I chose to send count itself and not the delta to ensure idempotency
export const PatchTicketCountSchema = z.object({
  tickets: CreateBookingSchema.shape.tickets
});

export type PatchTicketCountInput = z.infer<typeof PatchTicketCountSchema>;

export const ListBookingsQuerySchema = z.object({
  status: z.enum(BookingStatus).optional().meta({
    description: "Only return bookings with this status",
    example: "CONFIRMED",
  }),
});

export type ListBookingsQuery = z.infer<typeof ListBookingsQuerySchema>;