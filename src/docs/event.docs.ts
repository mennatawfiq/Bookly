import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { jsendSuccess } from "../schemas/jsend.schema";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { CreateEventSchema, eventIdParamSchema, EventSchema, PatchEventSchema } from "../schemas/event.schema";
import { CreateTicketTypeSchema, PatchTicketTypeSchema, TicketTypeIdParamSchema, TicketTypeSummarySchema } from "../schemas/ticketType.schema";

const Event = registry.register("Event", EventSchema);
const EventIdParamSchema = registry.register("EventIdParamSchema", eventIdParamSchema);

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
  path: "/events/{eventId}",
  tags: ["Events"],
  summary: "Get an event",
  description:
    "Returns one event with its ticket types and remaining spots. Published events are visible to everyone. Draft and cancelled events are visible only to their organizer and to admins. Sending a token is optional.",
  security: [{}, { [bearerAuth.name]: [] }],   // token optional
  request: { params: EventIdParamSchema },
  responses: {
    200: jsonResponse("The event", EventSuccess),
    401: jsonResponse("Invalid or expired UUID", ValidationFailResponse),
    404: jsonResponse("Event not found, or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});


const CreateEventRequest = registry.register("CreateEventRequest", CreateEventSchema);
const NewEvent = registry.register("NewEvent", Event.omit({ updatedAt: true }));
const EventCreatedSuccess = registry.register("EventCreatedSuccess", jsendSuccess(z.object({ event: NewEvent })));

registry.registerPath({
  method: "post",
  path: "/events",
  tags: ["Events"],
  summary: "Create an event",
  description:
    "Creates a new event owned by the authenticated user, with status `DRAFT`. Requires the ORGANIZER or ADMIN role. `startsAt` must be in the future and `endsAt` must be after `startsAt`. Drafts are not visible to the public until published.", security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateEventRequest } },
    }
  },
  responses: {
    201: jsonResponse("Event created as a draft", EventCreatedSuccess),
    400: jsonResponse("Validation failed", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ORGANIZER or ADMIN", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

const UpdateEventRequest = registry.register("UpdateEventRequest", PatchEventSchema);

registry.registerPath({
  method: "patch",
  path: "/events/{eventId}",
  tags: ["Events"],
  summary: "Patch an event",
  description: "Updates the details of an event you own (admins can update any event). Send only the fields you want to change, and at least one is required. Only events with status `DRAFT` can be edited. The final `startsAt` must be in the future and `endsAt` must be after `startsAt`.",
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateEventRequest } }
    }
  },
  responses: {
    200: jsonResponse("The updated event", EventCreatedSuccess),
    400: jsonResponse(
      "Validation failed, or the resulting dates are invalid",
      z.union([ValidationFailResponse, MessageFailResponse])
    ),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ORGANIZER or ADMIN", MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse("The event is not a draft", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "post",
  path: "/events/{eventId}/publish",
  tags: ["Events"],
  summary: "Publish a drafted event",
  description: "Changes a `DRAFT` event to `PUBLISHED`, making it visible to everyone. Requires the ORGANIZER or ADMIN role and ownership of the event (admins can publish any event). The event must have a start date in the future and at least one ticket type.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: EventIdParamSchema },
  responses: {
    200: jsonResponse("The published event", EventCreatedSuccess),
    400: jsonResponse("The event id is not a valid UUID", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ORGANIZER or ADMIN", MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse("Not a draft, the start date has passed, or the event has no ticket types", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

const PostTicketTypeRequest = registry.register("PostTicketTypeRequest", CreateTicketTypeSchema);
const TicketTypeSuccess = registry.register("TicketTypeSuccess", TicketTypeSummarySchema);

registry.registerPath({
  method: "post",
  path: "/events/{eventId}/ticket-types",
  tags: ["Events"],
  summary: "Add ticket type to an event",
  description: "Adds a ticket type (`GENERAL` or `VIP`) with a capacity to an event you own (admins can add to any event). Allowed for `DRAFT` and `PUBLISHED` events, not for `CANCELLED` ones. An event can have only one ticket type of each kind. `remaining` starts equal to `capacity`.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: PostTicketTypeRequest } }
    }
  },
  responses: {
    200: jsonResponse("The new ticket type", TicketTypeSuccess),
    400: jsonResponse("Validation failed", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ORGANIZER or ADMIN", MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse("The event is cancelled, or it already has a ticket type of this kind", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

const PatchTicketTypeRequest = registry.register("PatchTicketTypeRequest", PatchTicketTypeSchema);


registry.registerPath({
  method: "patch",
  path: "/events/{eventId}/ticket-types/{ticketTypeId}",
  tags: ["Events"],
  summary: "Patch an event ticket type",
  description: "Updates the capacity or kind of a ticket type for an event you own (admins can update any event). Allowed for DRAFT and PUBLISHED events, but not CANCELLED events. Capacity cannot be lower than the number of active tickets already booked. The ticket kind cannot be changed once tickets have been booked.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: TicketTypeIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: PatchTicketTypeRequest } }
    }
  },
  responses: {
    200: jsonResponse("The updated ticket type", TicketTypeSuccess),
    400: jsonResponse("Validation failed", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ORGANIZER or ADMIN", MessageFailResponse),
    404: jsonResponse("Event or ticket type not found, or the event isn't yours", MessageFailResponse),
    409: jsonResponse("The event is cancelled, or the new capacity is lower than the number of booked tickets, or kind can't be changed due to active bookings", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});