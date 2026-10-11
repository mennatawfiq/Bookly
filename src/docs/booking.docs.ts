import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { jsendSuccess } from "../schemas/jsend.schema";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { BookingListItemSchema } from "../schemas/booking.schema";

const BookingListItem = registry.register("BookingListItem", BookingListItemSchema);
const AllBookingsSuccess = registry.register("AllBookingsSuccess", jsendSuccess(z.object({ bookings: z.array(BookingListItem) })));

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