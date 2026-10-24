import { z } from "zod";
import { registry } from "./registry";
import { jsendSuccess } from "../schemas/jsend.schema";
import { bookingIdParamSchema, BookingListItemSchema, BookingTicketsDetailSchema, CreateBookingSchema, EventBookingListItemSchema, PatchTicketCountSchema, UserBookingDetailSchema, UserBookingListItemSchema } from "../schemas/booking.schema";
import { CheckInSchema, CreateEventSchema, eventIdParamSchema, EventSchema, PatchEventSchema } from "../schemas/event.schema";
import { CreateTicketTypeSchema, PatchTicketTypeSchema, TicketTypeSummarySchema } from "../schemas/ticketType.schema";
import { TicketTypeKind } from "../../prisma/generated/enums";
import { AdminApplicationItemSchema, applicationIdParamSchema, ApplicationItemSchema, ApplicationSchema, CreateApplicationSchema } from "../schemas/organizerApplication.schema";

// Events

export const Event = registry.register("Event", EventSchema);
export const EventIdParamSchema = registry.register("EventIdParamSchema", eventIdParamSchema);

export const AllEvent = registry.register("AllEvent", Event.omit({ status: true, createdAt: true, updatedAt: true }));
export const AllEventsSuccess = registry.register("AllEventsSuccess", jsendSuccess(z.object({ events: z.array(AllEvent) })));

export const OwnEventsSuccess = registry.register("OwnEventsSuccess", jsendSuccess(z.object({ events: z.array(Event) })));

export const EventDetailSchema = Event.extend({ ticketTypes: z.array(TicketTypeSummarySchema) });
export const EventSuccess = registry.register("EventSuccess", jsendSuccess(z.object({ event: EventDetailSchema })));

export const CreateEventRequest = registry.register("CreateEventRequest", CreateEventSchema);
export const NewEvent = registry.register("NewEvent", Event.omit({ updatedAt: true }));
export const EventCreatedSuccess = registry.register("EventCreatedSuccess", jsendSuccess(z.object({ event: NewEvent })));

export const UpdateEventRequest = registry.register("UpdateEventRequest", PatchEventSchema);

export const PostTicketTypeRequest = registry.register("PostTicketTypeRequest", CreateTicketTypeSchema);
export const TicketTypeSuccess = registry.register("TicketTypeSuccess", TicketTypeSummarySchema);

export const PatchTicketTypeRequest = registry.register("PatchTicketTypeRequest", PatchTicketTypeSchema);

export const EventBookingListItem = registry.register("EventBookingListItem", EventBookingListItemSchema);
export const EventBookingsSuccess = registry.register("EventBookingsSuccess", jsendSuccess(z.object({ bookings: z.array(EventBookingListItem) })));

export const TicketCheckInRequest = registry.register("TicketCheckInRequest", CheckInSchema);
export const TicketCheckInSuccess = registry.register("TicketCheckInSuccess", jsendSuccess(z.object({ type: z.enum(TicketTypeKind) })));

// Bookings

export const BookingListItem = registry.register("BookingListItem", BookingListItemSchema);
export const AllBookingsSuccess = registry.register("AllBookingsSuccess", jsendSuccess(z.object({ bookings: z.array(BookingListItem) })));

export const UserBookingListItem = registry.register("UserBookingListItem", UserBookingListItemSchema);
export const UserBookingsSuccess = registry.register("UserBookingsSuccess", jsendSuccess(z.object({ bookings: z.array(UserBookingListItem) })));

export const UserBookingDetail = registry.register("UserBookingDetail", UserBookingDetailSchema);
export const UserBookingDetailSuccess = registry.register("UserBookingDetailSuccess", jsendSuccess(z.object({ booking: UserBookingDetail })));
export const BookingIdParamSchema = registry.register("BookingIdParamSchema", bookingIdParamSchema);

export const BookingTicketsDetail = registry.register("BookingTicketsDetail", BookingTicketsDetailSchema);
export const BookingTicketsDetailSuccess = registry.register("BookingTicketsDetailSuccess", jsendSuccess(z.object({ tickets: z.array(BookingTicketsDetail) })));

export const CreateBookingRequest = registry.register("CreateBookingRequest", CreateBookingSchema);
export const PatchTicketCountRequest = registry.register("PatchTicketCountRequest", PatchTicketCountSchema);

// Applications

export const CreateApplicationRequest = registry.register("CreateApplicationRequest", CreateApplicationSchema);
export const Application = registry.register("Application", ApplicationSchema);
export const CreateApplicationSuccess = registry.register("CreateApplicationSuccess", jsendSuccess(z.object({ application: Application })));

export const ApplicationItem = registry.register("ApplicationItem", ApplicationItemSchema);
export const MyApplicationsSuccess = registry.register("MyApplicationsSuccess", jsendSuccess(z.object({ applications: z.array(ApplicationItem) })));

export const ApplicationIdParam = registry.register("ApplicationIdParam", applicationIdParamSchema);
export const MyApplicationSuccess = registry.register("MyApplicationSuccess", jsendSuccess(z.object({ application: ApplicationItem })));

export const AdminApplicationItem = registry.register("AdminApplicationItem", AdminApplicationItemSchema);
export const AllApplicationsSuccess = registry.register("AllApplicationsSuccess", jsendSuccess(z.object({ applications: z.array(AdminApplicationItem) })));
