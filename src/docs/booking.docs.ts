import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { AllBookingsSuccess, BookingIdParamSchema, BookingTicketsDetailSuccess, CreateBookingRequest, EventIdParamSchema, UserBookingDetailSuccess, UserBookingsSuccess } from "./components";

registry.registerPath({
  method: "get",
  path: "/bookings",
  tags: ["Bookings"],
  summary: "List all bookings",
  description: "Returns every booking on the platform, newest first, with the user's name and email and the event's title and start time. Requires the ADMIN role.",
  // request: { // later: pagination and limiting
  // },
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse("List of all bookings", AllBookingsSuccess),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "get",
  path: "/bookings/mine",
  tags: ["Bookings"],
  summary: "List my bookings",
  description: "Returns all bookings of the authenticated user, newest first, including cancelled ones. Each booking includes the event's title, start and end time, and status. `activeTicketsCount` is the number of tickets that are not cancelled (valid or used). `cancelledTicketsCount` is the number of cancelled tickets. For a cancelled booking, `cancelledTicketsCount` is the number of tickets it held. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse("List of your bookings", UserBookingsSuccess),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "get",
  path: "/bookings/{bookingId}",
  tags: ["Bookings"],
  summary: "Get a booking",
  description: "Returns one booking with its event details and all of its tickets. Allowed for the user who made the booking, the organizer of the booking's event, and admins. Anyone else gets a 404, the same as when the booking does not exist. `activeTicketsCount` is the number of tickets that are not cancelled (valid or used). `cancelledTicketsCount` is the number of cancelled tickets. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: BookingIdParamSchema },
  responses: {
    200: jsonResponse("The booking", UserBookingDetailSuccess),
    400: jsonResponse("Invalid bookingId", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("Booking not found or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "get",
  path: "/bookings/{bookingId}/tickets",
  tags: ["Bookings"],
  summary: "Get tickets of a booking",
  description: "Returns all tickets of a booking, including each ticket's QR `code`, type, and status. Allowed only for the user who made the booking and for admins. Organizers cannot see the codes. Anyone else gets a 404, the same as when the booking does not exist. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: BookingIdParamSchema },
  responses: {
    200: jsonResponse("The tickets", BookingTicketsDetailSuccess),
    400: jsonResponse("Invalid bookingId", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("Booking not found or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "post",
  path: "/events/{eventId}/bookings",
  tags: ["Bookings"],
  summary: "Create a booking of an event",
  description: "Creates a booking for a published event that has not started yet. The body lists one or more ticket types with a count for each. A ticket type can appear only once in the list, and the total number of tickets can't exceed 10. A user can have only one `CONFIRMED` booking per event. Each ticket gets its own QR code, which you can read from `GET /bookings/{bookingId}/tickets`. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: CreateBookingRequest } }
    }
  },
  responses: {
    201: jsonResponse("The created booking", UserBookingDetailSuccess),
    400: jsonResponse("Validation failed, or the event doesn't have one of the requested ticket types", z.union([ValidationFailResponse, MessageFailResponse])),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("Event not found", MessageFailResponse),
    409: jsonResponse("Not a published event or event has already started or the user already have a `CONFIRMED` booking for this event or a requested type doesn't have enough remaining tickets", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});