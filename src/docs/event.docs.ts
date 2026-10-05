import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { jsendSuccess } from "../schemas/jsend.schema";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { eventIdParamSchema, EventSchema } from "../schemas/event.schema";
import { TicketTypeSummarySchema } from "../schemas/ticketType.schema";

const Event = registry.register("Event", EventSchema);

const AllEvent = registry.register("AllEvent", Event.omit({ status: true, createdAt: true, updatedAt: true }));
const AllEventsSuccess = registry.register("AllEventsSuccess", jsendSuccess(z.object({ events: z.array(AllEvent) })));

registry.registerPath({
  method: "get",
  path: "/events",
  tags: ["Events"],
  summary: "List published events",
  description: "List all Bookly's published events.",
  // request: { // later: pagination and limiting
  // },
  responses: {
    200: jsonResponse("List of published events", AllEventsSuccess),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

const OwnEventsSuccess = registry.register("OwnEventsSuccess", jsendSuccess(z.object({ events: z.array(Event) })));

registry.registerPath({
  method: "get",
  path: "/events/mine",
  tags: ["Events"],
  summary: "List owned published events",
  description: "Returns all events created by the authenticated organizer, in any status (draft, published, cancelled). Requires the ORGANIZER or ADMIN role.",
  security: [{ [bearerAuth.name]: [] }],
  // request: { // later: pagination and limiting
  // },
  responses: {
    200: jsonResponse("List of all organizer's events", OwnEventsSuccess),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("You do not have permission to perform this action", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

const EventDetailSchema = Event.extend({ ticketTypes: z.array(TicketTypeSummarySchema) });
const EventSuccess = registry.register("EventSuccess", jsendSuccess(z.object({ event: EventDetailSchema })));

registry.registerPath({
  method: "get",
  path: "/events/{id}",
  tags: ["Events"],
  summary: "Get an event",
  description:
    "Returns one event with its ticket types and remaining spots. Published events are visible to everyone. Draft and cancelled events are visible only to their organizer and to admins. Sending a token is optional.",
  security: [{}, { [bearerAuth.name]: [] }],   // token optional
  responses: {
    200: jsonResponse("The event", EventSuccess),
    401: jsonResponse("Invalid or expired UUID", ValidationFailResponse),
    404: jsonResponse("Event not found, or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});