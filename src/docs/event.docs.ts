import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { jsendSuccess } from "../schemas/jsend.schema";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { EventSchema } from "../schemas/event.schema";

const Event = registry.register("Event", EventSchema);

const AllEvents = registry.register("AllEvents", Event.omit({ status: true, createdAt: true, updatedAt: true }));
const AllEventsSuccess = registry.register("AllEventsSuccess", jsendSuccess(z.object({ events: z.array(AllEvents) })));

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