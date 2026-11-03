import { z } from 'zod';
import { bearerAuth, registry } from './registry';
import { jsonResponse } from './helpers';
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from './jsend.docs';
import { TicketTypeIdParamSchema } from '../schemas/ticketType.schema';
import {
  AllEventsSuccess,
  CreateEventRequest,
  EventBookingsSuccess,
  EventCreatedSuccess,
  EventIdParamSchema,
  EventSuccess,
  OwnEventsSuccess,
  PatchTicketTypeRequest,
  PostTicketTypeRequest,
  TicketCheckInRequest,
  TicketCheckInSuccess,
  TicketTypeSuccess,
  UpdateEventRequest,
} from './components';
import { ListEventsQuerySchema } from '../schemas/event.schema';
import { ListBookingsQuerySchema } from '../schemas/booking.schema';

registry.registerPath({
  method: 'get',
  path: '/events',
  tags: ['Events'],
  summary: 'List events',
  description:
    'Without status, returns published events. With status of `DRAFT` or `CANCELLED`, returns only your own events with that status (admins see all). Requires authentication for those. A page after the last one returns an empty list.',
  security: [{}, { [bearerAuth.name]: [] }],
  request: { query: ListEventsQuerySchema },
  responses: {
    200: jsonResponse('List of published events', AllEventsSuccess),
    400: jsonResponse('Invalid status', ValidationFailResponse),
    401: jsonResponse('Unauthenticated user', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'get',
  path: '/events/mine',
  tags: ['Events'],
  summary: 'List all owned events',
  description:
    'Returns all events created by the authenticated organizer, in any status (draft, published, cancelled). Requires the ORGANIZER role. A page after the last one returns an empty list.',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: ListEventsQuerySchema },
  responses: {
    200: jsonResponse("List of all organizer's events", OwnEventsSuccess),
    400: jsonResponse('Invalid status or pagination value', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('You do not have permission to perform this action', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'get',
  path: '/events/{eventId}',
  tags: ['Events'],
  summary: 'Get an event',
  description:
    'Returns one event with its ticket types and remaining spots. Published events are visible to everyone. Draft and cancelled events are visible only to their organizer and to admins. Sending a token is optional.',
  security: [{}, { [bearerAuth.name]: [] }], // token optional
  request: { params: EventIdParamSchema },
  responses: {
    200: jsonResponse('The event', EventSuccess),
    400: jsonResponse('Invalid eventId', ValidationFailResponse),
    401: jsonResponse('Invalid or expired token', MessageFailResponse),
    404: jsonResponse('Event not found, or you are not allowed to see it', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'post',
  path: '/events',
  tags: ['Events'],
  summary: 'Create an event',
  description:
    'Creates a new event owned by the authenticated user, with status `DRAFT`. Requires the ORGANIZER role. `startsAt` must be in the future and `endsAt` must be after `startsAt`. Drafts are not visible to the public until published.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateEventRequest } },
    },
  },
  responses: {
    201: jsonResponse('Event created as a draft', EventCreatedSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/events/{eventId}',
  tags: ['Events'],
  summary: 'Patch an event',
  description:
    'Updates the details of an event you own. Send only the fields you want to change, and at least one is required. Only events with status `DRAFT` can be edited. If you send startsAt, it must be in the future. endsAt must be after startsAt.',
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateEventRequest } },
    },
  },
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse('The updated event', EventCreatedSuccess),
    400: jsonResponse(
      'Validation failed, or the resulting dates are invalid',
      z.union([ValidationFailResponse, MessageFailResponse]),
    ),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse('The event is not a draft', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'post',
  path: '/events/{eventId}/publish',
  tags: ['Events'],
  summary: 'Publish a drafted event',
  description:
    'Changes a `DRAFT` event to `PUBLISHED`, making it visible to everyone. Requires the ORGANIZER role and ownership of the event. The event must have a start date in the future and at least one ticket type.',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: EventIdParamSchema },
  responses: {
    200: jsonResponse('The published event', EventCreatedSuccess),
    400: jsonResponse('The event id is not a valid UUID', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse(
      'Not a draft, the start date has passed, or the event has no ticket types',
      MessageFailResponse,
    ),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'post',
  path: '/events/{eventId}/ticket-types',
  tags: ['Events'],
  summary: 'Add ticket type to an event',
  description:
    'Adds a ticket type (`GENERAL` or `VIP`) with a capacity to an event you own. Allowed for `DRAFT` and `PUBLISHED` events, not for `CANCELLED` ones. An event can have only one ticket type of each kind. `remaining` starts equal to `capacity`.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: PostTicketTypeRequest } },
    },
  },
  responses: {
    201: jsonResponse('The new ticket type', TicketTypeSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse("Event not found, or it isn't yours", MessageFailResponse),
    409: jsonResponse(
      'The event is cancelled, or it already has a ticket type of this kind',
      MessageFailResponse,
    ),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/events/{eventId}/ticket-types/{ticketTypeId}',
  tags: ['Events'],
  summary: 'Patch an event ticket type',
  description:
    'Updates the capacity or kind of a ticket type for an event you own. Allowed for DRAFT and PUBLISHED events, but not CANCELLED events. Capacity cannot be lower than the number of active tickets already booked. The ticket kind cannot be changed once tickets have been booked.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: TicketTypeIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: PatchTicketTypeRequest } },
    },
  },
  responses: {
    200: jsonResponse('The updated ticket type', TicketTypeSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse(
      "Event or ticket type not found, or the event isn't yours",
      MessageFailResponse,
    ),
    409: jsonResponse(
      "The event is cancelled, or the new capacity is lower than the number of booked tickets, or kind can't be changed due to active bookings, or the new kind already exists on this event",
      MessageFailResponse,
    ),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/events/{eventId}/ticket-types/{ticketTypeId}',
  tags: ['Events'],
  summary: 'Delete a ticket type of an event',
  description:
    'Deletes a ticket type of an event you own. A ticket type cannot be deleted if any ticket was ever issued for it, even a cancelled one, if the event is cancelled, or if it is the only ticket type of a published event. Draft events can have zero ticket types. Requires the ORGANIZER role.',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: TicketTypeIdParamSchema },
  responses: {
    204: { description: 'Ticket Type deleted successfully' },
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse(
      "Event not found, ticket type not found, or it isn't yours",
      MessageFailResponse,
    ),
    409: jsonResponse(
      'Cancelled events cannot be modified, published events must have at least one ticket type, or ticket type has booked tickets',
      MessageFailResponse,
    ),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'get',
  path: '/events/{eventId}/bookings',
  tags: ['Events'],
  summary: 'List bookings of an event',
  description:
    'Returns all bookings of an event, newest first, including cancelled ones. Each booking includes the name and email of the user who booked, its status, and ticket counts. `activeTicketsCount` is the number of tickets that are not cancelled (valid or used). `cancelledTicketsCount` is the number of cancelled tickets. Allowed for the event’s organizer and for admins. Requires the `ORGANIZER` or `ADMIN` role. A page after the last one returns an empty list.',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: EventIdParamSchema, query: ListBookingsQuerySchema },
  responses: {
    200: jsonResponse('List of the event’s bookings', EventBookingsSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER or ADMIN', MessageFailResponse),
    404: jsonResponse("Event not found or it isn't yours", MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'post',
  path: '/events/{eventId}/cancel',
  tags: ['Events'],
  summary: 'Cancel an event',
  description:
    "Cancels a DRAFT or PUBLISHED event that has not yet started. All associated confirmed bookings are cancelled, and their valid tickets are invalidated. Allowed for the event's organizer and admins. Requires the ORGANIZER or ADMIN role.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: EventIdParamSchema },
  responses: {
    204: { description: 'Event cancelled successfully' },
    400: jsonResponse('Invalid eventId', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER or ADMIN', MessageFailResponse),
    404: jsonResponse('Event not found or you are not allowed to see it', MessageFailResponse),
    409: jsonResponse('Event is already cancelled or has already started', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

registry.registerPath({
  method: 'post',
  path: '/events/{eventId}/check-ins',
  tags: ['Events'],
  summary: 'Check-in a ticket',
  description:
    "Checks-in a `VALID` ticket of a `PUBLISHED` event that has started and not yet ended. Allowed for the event's organizer only. Requires the `ORGANIZER` role.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: EventIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: TicketCheckInRequest } },
    },
  },
  responses: {
    200: jsonResponse('Ticket type', TicketCheckInSuccess),
    400: jsonResponse('Invalid eventId or code', ValidationFailResponse),
    401: jsonResponse('Missing, invalid, or expired token', MessageFailResponse),
    403: jsonResponse('Not an ORGANIZER', MessageFailResponse),
    404: jsonResponse(
      'Event or ticket not found or you are not allowed to see it',
      MessageFailResponse,
    ),
    409: jsonResponse(
      'Event is not published, has not started, or has ended, or the ticket is not valid (already used or cancelled)',
      MessageFailResponse,
    ),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});
