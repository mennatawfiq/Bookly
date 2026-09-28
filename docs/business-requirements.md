# Bookly: Business Requirements (v1)

## 1. Overview and scope

**Bookly** is a backend API for publishing events and reserving spots in them. Organizers create events and define ticket types with limited capacity. Users browse published events and book tickets. Every booked spot becomes its own ticket with a unique QR code, which the organizer scans at the door.

**In v1**
- Registration, login, and role-based access (Admin, Organizer, User)
- Users apply to become organizers, and admins approve or reject
- Organizers create, edit, publish, and cancel their own events, and define ticket types for them
- Anyone can browse published events without logging in
- Users book tickets (possibly of several types in one booking), add or cancel tickets later, and cancel bookings
- Each spot is issued as an individual ticket with its own QR code
- Organizers check tickets in at the door by scanning the QR code
- Capacity is enforced per ticket type: a type can never have more tickets issued than its capacity
- Admins can moderate any event or booking

**Out of v1** (see section 7)
- Prices, payments, and refunds
- Background jobs (BullMQ)
- Email or push notifications
- Waitlists, recurring events, ticket transfers
- Advanced search and recommendations

---

## 2. Actors and roles

| Role | Who they are | Can do |
|---|---|---|
| **User** | Anyone attending events | Browse published events, book tickets (including at any event), manage their own bookings, apply to become an organizer |
| **Organizer** | A user approved to host events | Everything a User can, plus create and manage their **own** events and ticket types, see who booked them, and check tickets in |
| **Admin** | Bookly platform staff | Everything, including moderating any event or booking and reviewing organizer applications |

**How a user becomes an organizer:** they submit an application and an admin approves it. Nobody can choose the organizer role for themselves.

**How the first admin is created:** through a seed script, never through the public API. Registration always creates a `USER`.

**Authorization model:** two checks, applied in order.
1. **Role check** (`authorize`): is this kind of user allowed to use this endpoint at all?
2. **Ownership check** (`requireOwnership`): does this specific resource belong to them? Admins always bypass this check.

**Existence policy:** when a resource does not exist **or** is not owned by the requester, the API returns the same `404` with the same message, so the response never reveals that a resource exists.

---

## 3. Business model

**v1:** Bookly is free for everyone and earns no revenue. Its value is the reservation management itself:
- Organizers publish events and manage attendance without overbooking, and verify attendees at the door.
- Users find events, reliably reserve spots, and hold a QR ticket for each one.

**v2 (planned):** Paid tickets through a real payment gateway. Prices will attach to ticket types, and payment fields to bookings. How the platform earns money (commission, organizer subscription, or another model) is left undecided until then.

**Design implication for v1:** no price fields or payment tables yet. Bookings have a proper status lifecycle so that payment states (such as `PENDING_PAYMENT`) can be added later without restructuring.

---

## 4. Entities and lifecycles

### 4.1 User (exists)

| Field | Purpose |
|---|---|
| `id` | Primary key (UUID) |
| `name` | Display name |
| `email` | Unique. Used to log in. |
| `passwordHash` | The hashed password. The plain password is never stored, and this field is never returned by the API. |
| `role` | `ADMIN` \| `USER` \| `ORGANIZER`. Defaults to `USER`. |
| `createdAt`, `updatedAt` | Bookkeeping |

Registration always creates a `USER`. The role changes only when an admin approves an organizer application (BR-A4), and the first admin is created by a seed script.

### 4.2 OrganizerApplication

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `userId` | Who applied (owner field) |
| `organizationName` | Name they'll host events under (required) |
| `description` | What kind of events they plan to host and why (required) |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` |
| `reviewedById` | Admin who decided (empty until reviewed) |
| `reviewedAt` | When it was decided (empty until reviewed) |
| `reviewNote` | Admin's reason, shown to the applicant |
| `createdAt` | When they applied |

```
PENDING ──► APPROVED
   └──────► REJECTED
```

Decisions are final. A rejected user who wants to try again creates a **new** application, no sooner than 3 days after the rejection.

### 4.3 Event

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `organizerId` | Owner (owner field) |
| `title`, `description` | What the event is |
| `location` | Plain text in v1 |
| `startsAt`, `endsAt` | The time window. "Past" is derived from `endsAt < now`. |
| `status` | `DRAFT` \| `PUBLISHED` \| `CANCELLED` |
| `createdAt`, `updatedAt` | Bookkeeping |

```
DRAFT ──► PUBLISHED ──► CANCELLED
```

There is no stored `COMPLETED` state. An event is "past" when its `endsAt` is earlier than the current time, calculated when needed.

Capacity is **not** on the event. It lives on the event's ticket types, and the event's total is the sum of them.

### 4.4 TicketType

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `eventId` | Which event offers it |
| `type` | Enum. Initial values: `GENERAL`, `VIP` |
| `capacity` | Maximum number of tickets of this type |
| `remaining` | Tickets of this type still available |
| `createdAt`, `updatedAt` | Bookkeeping |

Unique on (`eventId`, `type`): an event has at most one ticket type of each kind. Prices will be added here in v2.

### 4.5 Booking

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `userId` | Who booked (owner field) |
| `eventId` | Which event |
| `status` | `CONFIRMED` \| `CANCELLED` |
| `createdAt`, `updatedAt` | Bookkeeping |
| `cancelledAt` | When it was cancelled (empty while confirmed) |

```
CONFIRMED ──► CANCELLED
```

A partial unique index on (`userId`, `eventId`) where `status = CONFIRMED` guarantees one active booking per user per event, while cancelled bookings stay as history.

There is no `quantity` column. The number of spots in a booking is the number of its tickets that are not cancelled, so the count can never disagree with the tickets. Each booking holds at most 10 tickets, which keeps reading them cheap.

### 4.6 Ticket

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `bookingId` | Which booking it belongs to (the event is reached through the booking) |
| `ticketTypeId` | Which type it is, and therefore which capacity pool it came from |
| `code` | The QR token: long, random, unique, never sequential |
| `status` | `VALID` \| `USED` \| `CANCELLED` |
| `createdAt` | When it was issued |
| `cancelledAt` | When it was cancelled (empty otherwise) |
| `usedAt` | When it was scanned at the door (empty otherwise) |
| `checkedInById` | Which organizer or admin scanned it (empty otherwise) |

```
VALID ──► USED
   └────► CANCELLED
```

`USED` and `CANCELLED` are final.

---

## 5. Business rules

### 5.1 Organizer applications

- **BR-A1:** Only a user whose role is `USER` can apply. Organizers and admins cannot.
- **BR-A2:** A user can have at most one `PENDING` application at a time.
- **BR-A3:** Only an admin can approve or reject an application.
- **BR-A4:** Approving an application sets the user's role to `ORGANIZER` and records who reviewed it and when. The status change and the role change happen in **one transaction**.
- **BR-A5:** Only `PENDING` applications can be reviewed. Approved or rejected ones cannot be changed.
- **BR-A6:** A user can view only their own applications. An admin can view all of them.
- **BR-A7:** `organizationName` and `description` are required and have length limits (proposal: 2 to 100 characters for the name, 20 to 1000 for the description), validated with Zod.
- **BR-A8:** Rejecting an application requires a `reviewNote`. Approving does not.
- **BR-A9:** A user whose application was rejected can apply again only after at least 3 days have passed since that rejection (measured from `reviewedAt`).

### 5.2 Events

- **BR-E1:** Only organizers and admins can create events. A new event always starts as `DRAFT`.
- **BR-E2:** `endsAt` is after `startsAt`.
- **BR-E3:** Publishing requires `startsAt` to be in the future and at least one ticket type.
- **BR-E4:** Everyone can see `PUBLISHED` events, with no login required. `DRAFT` events are visible only to their organizer and admins, and anyone else gets a 404.
- **BR-E5:** Only the owning organizer or an admin can edit an event. Past events cannot be edited.
- **BR-E6:** `CANCELLED` is final. A cancelled event cannot be published again.
- **BR-E7:** Booking closes when the event starts, not when it ends.
- **BR-E8 (proposal):** An event can be cancelled only before it starts. This keeps cancellation from ever colliding with tickets that were already scanned.
- **BR-E9:** Cancelling an event, in **one transaction**: marks the event `CANCELLED`, marks all its confirmed bookings `CANCELLED`, marks all their tickets `CANCELLED`, and restores every ticket type's `remaining` to its `capacity`. Bookings and tickets are kept for history, not deleted.

### 5.3 Ticket types

- **BR-T1:** An event has at most one ticket type of each `type`, and each has a `capacity` that is a positive whole number.
- **BR-T2:** When a ticket type is created, `remaining` equals `capacity`.
- **BR-T3 (invariant):** For every ticket type, at all times, `0 ≤ remaining ≤ capacity` and `remaining = capacity − tickets of that type that are not cancelled` (`VALID` plus `USED`).
- **BR-T4:** Changing a type's `capacity` changes its `remaining` by the same amount. The change is rejected if `remaining` would become negative.
- **BR-T5:** Ticket types can be added or edited until the event starts. A type that has tickets issued cannot be deleted.
- **BR-T6 (integrity):** A ticket's type must belong to the same event as the ticket's booking. This is checked whenever tickets are issued.

### 5.4 Bookings and tickets

- **BR-B1:** A booking can be created only for a `PUBLISHED` event that has not started yet (BR-E7).
- **BR-B2:** A booking request lists one or more ticket types with a positive count for each. The **total** across all types is between 1 and 10 (`MAX_SPOTS_PER_BOOKING = 10`), and every listed type must belong to the event. Validated with Zod.
- **BR-B3:** A booking succeeds only if every requested type has enough `remaining`. In **one transaction**, the booking is created, one ticket is issued per spot (each with its own random `code`), and each type's `remaining` is decreased. Each decrease is a single atomic database update ("subtract only if enough remain"). If any type lacks stock, the whole booking fails and nothing changes.
- **BR-B4:** A user can have at most one `CONFIRMED` booking per event, enforced by the partial unique index. A violation is reported as `409 Conflict`. Changing the number of tickets happens by editing that booking.
- **BR-B5:** While the event has not started, the booking's owner can **add tickets** (new codes, subject to BR-B3's stock check per type) or **cancel specific `VALID` tickets** of their choice. After any change the booking holds between 1 and 10 tickets that are not cancelled. Each ticket cancelled returns one spot to its type's `remaining`. All in **one transaction** per change.
- **BR-B6:** Cancelling the last remaining ticket of a booking cancels the booking. A `CONFIRMED` booking always holds at least one ticket.
- **BR-B7:** While the event has not started, the owner can cancel a whole booking. The booking and all its tickets become `CANCELLED`, and each type's `remaining` is restored, in **one transaction**. Cancelling is final, and booking again later creates a new booking.
- **BR-B8:** Users see only their own bookings, with their tickets and QR codes. Organizers see the bookings of their own events. Admins see all bookings.
- **BR-B9:** Admins can edit or cancel any booking, subject to the same before-start limits.

### 5.5 Check-in

- **BR-C1:** Only the event's organizer or an admin can check tickets in. The check-in endpoint is scoped to the event, so the ownership check applies to the event.
- **BR-C2:** A ticket can be checked in only if it belongs to that event, its status is `VALID`, and the event is `PUBLISHED` and in progress (`startsAt ≤ now < endsAt`). Check-in opens when the event starts, and booking changes close at the same moment, so the two never overlap.
- **BR-C3:** Check-in is one atomic update: `VALID` becomes `USED` only if the ticket is still `VALID`. If two scanners read the same ticket at once, exactly one succeeds and the other is told the ticket is already used.
- **BR-C4:** Check-in records `usedAt` and `checkedInById`. `USED` is final, and a used ticket cannot be cancelled or reverted.
- **BR-C5:** A scan of a `CANCELLED` or already `USED` ticket, or of a code that doesn't exist, is rejected with a clear message.

### 5.6 QR codes

- **BR-Q1:** A ticket's `code` is a cryptographically secure random token of at least 128 bits, unique across all tickets. It is never sequential and never derived from an id.
- **BR-Q2:** The QR image simply encodes the `code`. Whether a ticket is valid is always decided by the server looking up its status, so a cancelled ticket fails even if its QR image still exists on someone's phone.

---

## 6. Use cases and endpoints (proposal)

| Actor | Action | Endpoint | Guard |
|---|---|---|---|
| Anyone | Register / log in | `POST /auth/register`, `POST /auth/login` | none |
| User | Apply to be an organizer | `POST /organizer-applications` | `authenticate`, `authorize("USER")` |
| User | View own applications | `GET /organizer-applications/me` | `authenticate` |
| User | View one application | `GET /organizer-applications/:id` | `authenticate`, `requireOwnership` |
| Admin | List applications | `GET /organizer-applications` | `authenticate`, `authorize("ADMIN")` |
| Admin | Approve / reject | `PATCH /organizer-applications/:id/approve`, `/reject` | `authenticate`, `authorize("ADMIN")` |
| Anyone | List published events | `GET /events` | none |
| Anyone | View one event | `GET /events/:eventId` | optional authentication (see notes) |
| Organizer, Admin | Create event | `POST /events` | `authenticate`, `authorize("ORGANIZER", "ADMIN")` |
| Owner, Admin | Edit event | `PATCH /events/:eventId` | `authenticate`, `authorize`, `requireOwnership` |
| Owner, Admin | Publish / cancel event | `PATCH /events/:eventId/publish`, `/cancel` | `authenticate`, `authorize`, `requireOwnership` |
| Owner, Admin | Add / edit ticket type | `POST /events/:eventId/ticket-types`, `PATCH /events/:eventId/ticket-types/:ticketTypeId` | `authenticate`, `authorize`, `requireOwnership` |
| Owner, Admin | List an event's bookings | `GET /events/:eventId/bookings` | `authenticate`, `authorize`, `requireOwnership` |
| Owner, Admin | Check a ticket in | `POST /events/:eventId/check-ins` (body: `code`) | `authenticate`, `authorize`, `requireOwnership` |
| User | Book tickets | `POST /events/:eventId/bookings` | `authenticate` |
| User | List own bookings | `GET /bookings/me` | `authenticate` |
| Owner, Admin | View one booking with tickets | `GET /bookings/:bookingId` | `authenticate`, `requireOwnership` |
| Owner, Admin | Add tickets to a booking | `POST /bookings/:bookingId/tickets` | `authenticate`, `requireOwnership` |
| Owner, Admin | Cancel one ticket | `PATCH /bookings/:bookingId/tickets/:ticketId/cancel` | `authenticate`, `requireOwnership` |
| Owner, Admin | Cancel a booking | `PATCH /bookings/:bookingId/cancel` | `authenticate`, `requireOwnership` |
| Admin | List all bookings | `GET /bookings` | `authenticate`, `authorize("ADMIN")` |

**Implementation notes**
- `GET /events/:eventId` needs an *optional* authentication step, so a logged-in organizer can still see their own draft (BR-E4) while anonymous visitors get a 404 for it.
- Check-in is scoped to the event on purpose: the existing `requireOwnership` checks a direct owner field on the resource in the URL, so it works on the event unchanged. The service then verifies the scanned ticket belongs to that event.
- The 10-ticket cap involves several rows, so two simultaneous edits to the same booking could each pass the check. The booking row should be locked for the duration of the transaction.

---

## 7. Deferred / future work

**Completed-event state via background job**
- *What:* Stored `COMPLETED` status, updated automatically when an event ends.
- *Why deferred:* Needs a job queue (BullMQ), which is out of scope for v1. In v1 "past" is derived from `endsAt < now`.
- *What it changes:* Add a scheduled job and a `COMPLETED` enum value, and simplify the queries that currently compare dates.

**Payments with a real gateway**
- *What:* Paid tickets, prices on ticket types, a payment step in the booking flow.
- *Why deferred:* Adds a lot of complexity (webhooks, failed payments). v1 focuses on booking and ticket logic.
- *What it changes:* Price fields on `TicketType`, payment records, and a `PENDING_PAYMENT` booking state.

**Refunds when tickets are cancelled**
- *What:* When a paid ticket is cancelled, refund its price.
- *Why deferred:* v1 has no payments.
- *What it changes:* Adds refund records and gateway calls to the ticket and booking cancellation flows. The per-ticket cancellation itself stays the same.

**Check-in before the event starts**
- *What:* A configurable window so doors can open before `startsAt`.
- *Why deferred:* In v1 check-in opens exactly at the start, so it never overlaps with booking changes. An earlier window needs new rules for tickets scanned before the booking deadline.

**Organizer-defined ticket types**
- *What:* Custom names such as "Early Bird" or "Student" instead of a fixed enum.
- *Why deferred:* The enum keeps v1 simple and type-safe.

**Notifications**
- *What:* Emails or push messages for booking confirmation, event cancellation, and application decisions.
- *Why deferred:* Best sent through background jobs, which come after v1.

**Other:** waitlists, recurring events, ticket transfers, search and recommendations, geocoded locations.
