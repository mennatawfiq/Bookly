# Bookly: Business Requirements (v1)

Status: v1 API complete, with pagination and automated tests. Roadmap added. Last updated 2026-11-03.

---

## 1. Overview and scope

**Bookly** is a backend API for publishing events and reserving spots in them. Organizers create events and define ticket types with limited capacity. Users browse published events and book tickets. Every booked spot becomes its own ticket with a unique QR code, which the organizer scans at the door.

**In v1**

- Registration, login, and role-based access (Admin, Organizer, User)
- Users apply to become organizers, and admins approve or reject
- Organizers create, edit, publish, and cancel their own events, and define ticket types for them
- Anyone can browse published events without logging in
- Users book tickets (possibly of several types in one booking), add tickets later, cancel single tickets, and cancel bookings
- Each spot is issued as an individual ticket with its own QR code
- Organizers check tickets in at the door by scanning the QR code
- Capacity is enforced per ticket type: a type can never have more tickets issued than its capacity
- Admins can moderate: cancel any event, see any event's bookings, and view or cancel any booking. They cannot create, edit, or publish events, manage ticket types, or check tickets in (see section 2)
- Users can delete (anonymize) their own account
- Offset pagination on every list endpoint
- Automated tests (Vitest + Supertest) on a separate test database, including concurrency tests

**Out of v1** (see sections 9 and 10)

- Prices, payments, and refunds
- Background jobs (BullMQ)
- Email or push notifications
- Waitlists, recurring events, ticket transfers
- Advanced search and recommendations

---

## 2. Actors and roles

| Role          | Who they are                   | Can do                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**      | Anyone attending events        | Browse published events, book tickets (at any event), manage their own bookings, apply to become an organizer                                                                                                                                                                                                                                                           |
| **Organizer** | A user approved to host events | Everything a User can, plus create, edit, publish, and cancel their **own** events, manage their ticket types, see who booked, and check tickets in                                                                                                                                                                                                                     |
| **Admin**     | Bookly platform staff          | Everything a User can, plus: cancel any event, list any event's bookings, view, edit, or cancel any booking, view QR codes of any booking, and review organizer applications. Admins **cannot** create, edit, or publish events, **cannot** manage ticket types, and **cannot** check tickets in. An admin who wants to host events needs a separate organizer account. |

**How a user becomes an organizer:** they submit an application and an admin approves it. Nobody can choose the organizer role for themselves.

**How the first admin is created:** through a seed script (run with `npx tsx scripts/run-seed-admin.ts`, reading `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`), never through the public API. Registration always creates a `USER`. The seed script:

- validates `ADMIN_PASSWORD` with the same password rule as registration;
- is safe to run again: if the email already exists, nothing changes (the password is never changed by re-running it).

**Authorization model:** two checks, applied in order.

1. **Role check** (`authorize`): is this kind of user allowed to use this endpoint at all?
2. **Ownership check** (`requireOwnership`): does this specific resource belong to them? Admins always bypass this check, but only on routes where the role check lets them in. A route can add an extra rule (`alsoAllow`) that grants access to non-owners. It is used only on `GET /bookings/:bookingId`, so the organizer of the booking's event can read it.

**Existence policy:** when a resource does not exist **or** is not owned by the requester, the API returns the same `404` with the same message, so the response never reveals that a resource exists.

---

## 3. API conventions

- **Response format:** JSend. `success` has `data`, `fail` (client errors) has `data` with a `message` (and an `errors` list for validation), `error` (server errors) has a `message`.
- **Status codes:** `400` invalid input, `401` missing or invalid token (or deleted user), `403` wrong role, `404` missing or not yours, `409` the request is valid but the current state does not allow it, `500` server error.
- **Actions use POST:** state changes that are not plain field edits (`publish`, `cancel`, `approve`, `reject`, `check-ins`) use `POST`. Field edits use `PATCH`.
- **Empty success:** `204` with no body (cancel, delete) or `200` with data.
- **No hard deletes of business records:** there are no delete routes for events, bookings, or tickets. Cancelling is the end of the lifecycle. The only delete route is for ticket types (BR-T5).
- **Dates:** ISO 8601 strings.
- **Pagination:** every list endpoint takes `page` (default 1) and `limit` (default 10, maximum 100). The response has the items plus a `pagination` object: `page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`. A page after the last one returns an empty list, not an error. Lists are sorted newest first (`createdAt` descending, then `id`). Exceptions: the public event list is sorted by `startsAt` descending, and `GET /events/mine` by `startsAt` ascending.
- **Filters:** `status` on events, bookings, and applications; `role` on users. An invalid value returns `400`.
- **Docs:** the OpenAPI document is generated from the Zod schemas. It is served at `/api-docs` and `/openapi.json`.
- **Tests:** Vitest + Supertest, running against a separate database (`event_booking_test`). The test setup refuses to run against any other database.

---

## 4. Business model

**v1:** Bookly is free for everyone and earns no revenue. Its value is the reservation management itself:

- Organizers publish events and manage attendance without overbooking, and verify attendees at the door.
- Users find events, reliably reserve spots, and hold a QR ticket for each one.

**v2 (planned):** Paid tickets through a real payment gateway. Prices will attach to ticket types, and payment fields to bookings. How the platform earns money (commission, organizer subscription, or another model) is left undecided until then.

**Design implication for v1:** no price fields or payment tables yet. Bookings have a proper status lifecycle so that payment states (such as `PENDING_PAYMENT`) can be added later without restructuring.

---

## 5. Entities and lifecycles

### 5.1 User

| Field                    | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `id`                     | Primary key (UUID)                                              |
| `name`                   | Display name                                                    |
| `email`                  | Unique. Used to log in.                                         |
| `passwordHash`           | The hashed password. Never returned by the API.                 |
| `role`                   | `ADMIN` \| `USER` \| `ORGANIZER`. Defaults to `USER`.           |
| `deletedAt`              | Set when the account is deleted (anonymized). `NULL` otherwise. |
| `createdAt`, `updatedAt` | Bookkeeping                                                     |

Registration always creates a `USER`. The role changes only when an admin approves an organizer application (BR-A4), and the first admin is created by the seed script.

Accounts are never hard-deleted. "Deleting" an account anonymizes it (BR-U1 to U6), and every relation pointing at `User` uses `onDelete: Restrict`.

### 5.2 OrganizerApplication

| Field              | Purpose                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `id`               | Primary key                                                                       |
| `userId`           | Who applied (owner field)                                                         |
| `organizationName` | Name they will host events under (2 to 100 characters)                            |
| `description`      | What kind of events they plan to host and why (20 to 1000 characters)             |
| `status`           | `PENDING` \| `APPROVED` \| `REJECTED`                                             |
| `reviewedById`     | Admin who decided (empty until reviewed)                                          |
| `reviewedAt`       | When it was decided (empty until reviewed)                                        |
| `reviewNote`       | Reason, shown to the applicant. Required when rejecting, optional when approving. |
| `createdAt`        | When they applied                                                                 |

```
PENDING ──► APPROVED
   └──────► REJECTED
```

Decisions are final. A rejected user who wants to try again creates a **new** application, no sooner than 3 days after the rejection. When a user deletes their account, their `PENDING` application is rejected automatically with the note "Applicant deleted their account".

### 5.3 Event

| Field                    | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `id`                     | Primary key                                             |
| `organizerId`            | Owner (owner field)                                     |
| `title`, `description`   | What the event is                                       |
| `location`               | Plain text in v1                                        |
| `startsAt`, `endsAt`     | The time window. "Past" is derived from `endsAt < now`. |
| `status`                 | `DRAFT` \| `PUBLISHED` \| `CANCELLED`                   |
| `createdAt`, `updatedAt` | Bookkeeping                                             |

```
DRAFT ──► PUBLISHED ──► CANCELLED
  └───────────────────────►┘
```

A `DRAFT` event can be published or cancelled. A `PUBLISHED` event can be cancelled. `CANCELLED` is final. There is no stored `COMPLETED` state: an event is "past" when `endsAt` is earlier than the current time.

Capacity is **not** on the event. It lives on the event's ticket types, and the event's total is the sum of them.

### 5.4 TicketType

| Field                    | Purpose                                |
| ------------------------ | -------------------------------------- |
| `id`                     | Primary key                            |
| `eventId`                | Which event offers it                  |
| `type`                   | Enum. Initial values: `GENERAL`, `VIP` |
| `capacity`               | Maximum number of tickets of this type |
| `remaining`              | Tickets of this type still available   |
| `createdAt`, `updatedAt` | Bookkeeping                            |

Unique on (`eventId`, `type`): an event has at most one ticket type of each kind. Prices will be added here in v2.

### 5.5 Booking

| Field                    | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `id`                     | Primary key                                   |
| `userId`                 | Who booked (owner field)                      |
| `eventId`                | Which event                                   |
| `status`                 | `CONFIRMED` \| `CANCELLED`                    |
| `createdAt`, `updatedAt` | Bookkeeping                                   |
| `cancelledAt`            | When it was cancelled (empty while confirmed) |

```
CONFIRMED ──► CANCELLED
```

A partial unique index on (`userId`, `eventId`) where `status = CONFIRMED` guarantees one active booking per user per event, while cancelled bookings stay as history.

There is no `quantity` column. The number of spots in a booking is the number of its tickets that are not cancelled. Each booking holds at most 10 tickets (`MAX_SPOTS_PER_BOOKING = 10`).

### 5.6 Ticket

| Field           | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `id`            | Primary key                                                            |
| `bookingId`     | Which booking it belongs to (the event is reached through the booking) |
| `ticketTypeId`  | Which type it is, and therefore which capacity pool it came from       |
| `code`          | The QR token: random, unique, never sequential                         |
| `status`        | `VALID` \| `USED` \| `CANCELLED`                                       |
| `createdAt`     | When it was issued                                                     |
| `cancelledAt`   | When it was cancelled (empty otherwise)                                |
| `usedAt`        | When it was scanned at the door (empty otherwise)                      |
| `checkedInById` | Which organizer scanned it (empty otherwise)                           |

```
VALID ──► USED
   └────► CANCELLED
```

`USED` and `CANCELLED` are final.

### 5.7 Referential actions (deletes)

Bookly never hard-deletes business records: users are anonymized, events and bookings are cancelled, and tickets are cancelled. So every foreign key uses `onDelete: Restrict`: the database refuses the delete rather than silently cascading through history or leaving `remaining` out of sync.

| Relation                                                | `onDelete` |
| ------------------------------------------------------- | ---------- |
| `Event.organizerId` → `User`                            | `Restrict` |
| `Booking.userId` → `User`                               | `Restrict` |
| `OrganizerApplication.userId`, `.reviewedById` → `User` | `Restrict` |
| `Ticket.checkedInById` → `User`                         | `Restrict` |
| `TicketType.eventId` → `Event`                          | `Restrict` |
| `Booking.eventId` → `Event`                             | `Restrict` |
| `Ticket.bookingId` → `Booking`                          | `Restrict` |
| `Ticket.ticketTypeId` → `TicketType`                    | `Restrict` |

---

## 6. Business rules

### 6.1 Organizer applications

- **BR-A1:** Only a user whose role is `USER` can apply. Organizers and admins cannot.
- **BR-A2:** A user can have at most one `PENDING` application at a time (partial unique index, plus a check for a clear `409` message).
- **BR-A3:** Only an admin can approve or reject an application.
- **BR-A4:** Approving sets the user's role to `ORGANIZER` and records who reviewed it and when. The status change and the role change happen in **one transaction**.
- **BR-A5:** Only `PENDING` applications can be reviewed. Reviewed ones cannot be changed.
- **BR-A6:** A user can view only their own applications. An admin can view all of them, and can filter by `status`.
- **BR-A7:** `organizationName` (2 to 100 characters) and `description` (20 to 1000 characters) are required, validated with Zod.
- **BR-A8:** Rejecting requires a `reviewNote`. Approving does not.
- **BR-A9:** A user whose application was rejected can apply again only after 3 days from the rejection (`reviewedAt`).
- **BR-A10:** Deleting an account rejects the user's `PENDING` application (BR-U3). The approve step also checks `deletedAt` as a safety net, so an application of a deleted user can never be approved.

### 6.2 Events

- **BR-E1:** Only organizers can create events. Admins cannot. A new event always starts as `DRAFT`.
- **BR-E2:** `startsAt` is in the future when creating (and when edited), and `endsAt` is after `startsAt`.
- **BR-E3:** Publishing is done only by the owning organizer. It requires `startsAt` to be in the future and at least one ticket type.
- **BR-E4:** Everyone can see `PUBLISHED` events, with no login required. `DRAFT` and `CANCELLED` events are visible only to their organizer and admins. Anyone else gets a 404.
- **BR-E5:** Only the owning organizer can edit an event, and **only while it is `DRAFT`**. Published and cancelled events cannot be edited, so attendees who booked are never surprised by a changed date or place.
- **BR-E6:** `CANCELLED` is final. A cancelled event cannot be published again.
- **BR-E7:** Booking closes when the event starts, not when it ends.
- **BR-E8:** A `DRAFT` or `PUBLISHED` event can be cancelled only before it starts, by its owning organizer or by an admin. This keeps cancellation from ever colliding with tickets that were already scanned.
- **BR-E9:** Cancelling an event happens in **one transaction**: the event becomes `CANCELLED`, all its `CONFIRMED` bookings become `CANCELLED`, all their `VALID` tickets become `CANCELLED`, and every ticket type's `remaining` goes back to its `capacity`. Bookings and tickets are kept for history. A draft has no bookings, so for a draft only the status changes. A published event with no bookings is still cancelled normally.
- **BR-E10:** An organizer sees all their own events in any status (`GET /events/mine`).
- **BR-E11:** `GET /events` without `status` returns published events and needs no login. With `status=DRAFT` or `status=CANCELLED` it needs a login: an organizer gets only their own events with that status, and an admin gets all of them. Without a token this returns `401`.
- **BR-E12:** `title`, `description`, and `location` are trimmed text with no minimum length in v1 (an empty one is allowed).

### 6.3 Ticket types

- **BR-T1:** An event has at most one ticket type of each `type`, and each has a `capacity` that is a positive whole number (up to 100,000).
- **BR-T2:** When a ticket type is created, `remaining` equals `capacity`.
- **BR-T3 (invariant):** For every ticket type, at all times, `0 ≤ remaining ≤ capacity` and `remaining = capacity − tickets of that type that are not cancelled` (`VALID` plus `USED`).
- **BR-T4:** Changing a type's `capacity` changes its `remaining` by the same amount. It is rejected if the new capacity is lower than the active tickets already issued.
- **BR-T5:** Only the owning organizer can add, edit, or delete ticket types. This is allowed while the event is `DRAFT` or `PUBLISHED`, **including after the event has started**, as long as the capacity and `remaining` rules hold. It is never allowed when the event is `CANCELLED`. Deleting is blocked in these cases:
  - any ticket was ever issued for the type, **even a cancelled one**;
  - it is the only ticket type of a `PUBLISHED` event (a `DRAFT` event may have none).
- **BR-T6:** The `type` (kind) of a ticket type cannot be changed once tickets were issued for it.
- **BR-T7 (integrity):** A ticket's type must belong to the same event as the ticket's booking. This is checked whenever tickets are issued.

### 6.4 Bookings and tickets

- **BR-B1:** A booking can be created only for a `PUBLISHED` event that has not started yet (BR-E7). Any logged-in user can book, including organizers at their own events and admins.
- **BR-B2:** A booking request lists one or more ticket types with a positive count for each. Each type appears only once, the **total** is between 1 and 10, and every listed type must belong to the event. Validated with Zod and again in the service.
- **BR-B3:** A booking succeeds only if every requested type has enough `remaining`. In **one transaction**:
  1. the event row is locked `FOR SHARE` and checked (published, not started);
  2. the requested ticket type rows are locked `FOR UPDATE`;
  3. a first loop checks that **every** requested type has enough `remaining`;
  4. a second loop decreases each type's `remaining` (with `decrement`);
  5. the booking is created and one ticket is issued per spot, each with its own random `code`.

  If any type lacks stock, the first loop fails the whole booking and nothing changes.

- **BR-B4:** A user can have at most one `CONFIRMED` booking per event, enforced by the partial unique index and a check that gives a clear `409`.
- **BR-B5:** While the event has not started, the booking's owner can:
  - **add tickets** with `PATCH /bookings/:bookingId/tickets`. The body gives the **new total per type** (so repeating the same request is safe). A total lower than what the booking already holds is rejected with `409`. The request is checked against stock (`409`) and against the 10-ticket cap of the whole booking (`400`). A type the event does not offer returns `400`.
  - **cancel one specific `VALID` ticket** of their choice. Each cancelled ticket returns one spot to its type's `remaining`.

  Each change is **one transaction**. Reducing tickets is done only by cancelling tickets, so the user decides which QR code stops working.

- **BR-B6:** Cancelling the last remaining ticket of a booking cancels the booking. A `CONFIRMED` booking always holds at least one ticket.
- **BR-B7:** While the event has not started, the owner can cancel a whole booking. The booking and all its tickets become `CANCELLED`, and each type's `remaining` is restored, in **one transaction**. Cancelling is final, and booking again later creates a new booking.
- **BR-B8:** Visibility:
  - Users see their own bookings.
  - The organizer of an event sees that event's bookings (who booked, status, ticket counts) and can open a single booking, but **never sees its QR codes**.
  - Admins see all bookings.
  - **QR codes** (`GET /bookings/:bookingId/tickets`) are visible only to the booking owner and admins.
- **BR-B9:** Admins can cancel or edit any booking, subject to the same before-start limits.

### 6.5 Check-in

- **BR-C1:** Only the organizer who owns the event can check tickets in. Admins cannot. The endpoint is scoped to the event, so the ownership check applies to the event.
- **BR-C2:** A ticket can be checked in only if it belongs to that event, its status is `VALID`, and the event is `PUBLISHED` and in progress (`startsAt ≤ now ≤ endsAt`). Check-in opens when the event starts, and booking changes close at the same moment, so the two never overlap.
- **BR-C3:** Check-in is one atomic update: `VALID` becomes `USED` only if the ticket is still `VALID`. If two scanners read the same ticket at once, exactly one succeeds and the others get `409`.
- **BR-C4:** Check-in records `usedAt` and `checkedInById`. `USED` is final. A used ticket cannot be cancelled or reverted.
- **BR-C5:** A scan of an unknown code, or of a code that belongs to another event, returns the same `404` (so codes of other events are never revealed). The event ownership of the ticket is checked **before** its status, so a cancelled ticket of another event also gets the same `404`. A `CANCELLED` or already `USED` ticket of this event returns `409`. A successful scan returns the ticket type so the scanner can show "VIP" or "GENERAL".

### 6.6 Account deletion

- **BR-U1:** A user can delete their own account (`DELETE /users/me`), whatever their role.
- **BR-U2:** An organizer with an upcoming or running `PUBLISHED` event (`endsAt` in the future) cannot delete their account until those events are cancelled or have ended. Cancelling an event affects other people, so it must be a deliberate, separate act. Drafts and ended events do not block deletion. (The check is by role, not `USER`, so it also covers an admin who somehow owns events, such as an organizer who was later made an admin.)
- **BR-U2b:** The only remaining admin cannot delete their account. The check locks the rows of the **other** active admins (`FOR SHARE`), so two admins deleting themselves at the same moment cannot both pass it.
- **BR-U3:** In **one transaction**, deleting:
  - rejects the user's `PENDING` organizer application (BR-A10);
  - cancels the user's upcoming `CONFIRMED` bookings (events that have not started) through the normal cancellation logic: tickets cancelled, each ticket type's `remaining` restored. No refunds are involved, since v1 has no payments.
- **BR-U4:** The account is anonymized in the same transaction: name becomes `Deleted user`, email becomes `deleted-<id>@deleted.invalid`, and the password hash becomes a random value that no password can match. Because the email is replaced, the original email can be registered again as a new account.
- **BR-U5:** `deletedAt` is set. `authenticate` reads the user from the database on every request and rejects users with `deletedAt` set, so this takes effect immediately, including for tokens already issued. Login also rejects deleted users.
- **BR-U6:** Past bookings, tickets, events, and applications are kept unchanged and display the user as "Deleted user".

### 6.7 QR codes

- **BR-Q1:** A ticket's `code` is a cryptographically secure random token of at least 128 bits, unique across all tickets, never sequential and never derived from an id. The implementation uses 16 random bytes encoded as base64url (22 characters).
- **BR-Q2:** The QR image simply encodes the `code`. Whether a ticket is valid is always decided by the server looking up its status, so a cancelled ticket fails even if its QR image still exists on someone's phone.

---

## 7. Concurrency and locking

Bookly protects stock and state with database locks inside transactions.

**Lock order (always the same, to avoid deadlocks):**

1. `OrganizerApplication`
2. `User`
3. `Event`
4. `Booking`
5. `TicketType`

Rows of the same table are locked together in one query with `ORDER BY id`.

**Event lock kinds**

| Lock         | Used by                                                                                       | Why                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `FOR SHARE`  | create booking, add tickets, cancel ticket, cancel booking, account deletion, add ticket type | Many booking changes can run together, but they wait for event changes                |
| `FOR UPDATE` | publish, edit draft event, cancel event, patch and delete ticket type                         | These change the event or its structure, so they wait for bookings and for each other |

**Rules**

- Ticket types touched by a booking change are locked `FOR UPDATE`, and `remaining` is changed with `increment` and `decrement` (never with a number read earlier).
- The Booking row lock protects its tickets. Anyone who changes a booking's tickets takes the Event lock, then the Booking lock first.
- Check-in does not take these locks. It uses one atomic `UPDATE ... WHERE status = 'VALID'`, and time keeps it apart from cancellations (BR-E8, BR-C2).
- Partial unique indexes are the final safety net for "one confirmed booking per user per event" and "one pending application per user".
- Inside `$transaction`, always use `tx`, never the global `prisma`.
- Helpers that need locks (for example `cancelBookingsInTx`) are called only after the caller holds them.

---

## 8. Use cases and endpoints

All list endpoints are paginated (section 3).

| Actor                         | Action                                                     | Endpoint                                                         | Guard                                                                 |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Anyone                        | Register / log in                                          | `POST /auth/register`, `POST /auth/login`                        | none                                                                  |
| Any user                      | View my profile                                            | `GET /users/me`                                                  | `authenticate`                                                        |
| Any user                      | Delete my account                                          | `DELETE /users/me`                                               | `authenticate`                                                        |
| Admin                         | List users (`?role=`)                                      | `GET /users`                                                     | `authenticate`, `authorize("ADMIN")`                                  |
| User                          | Apply to be an organizer                                   | `POST /organizer-applications`                                   | `authenticate`, `authorize("USER")`                                   |
| Any user                      | View own applications                                      | `GET /organizer-applications/mine`                               | `authenticate`                                                        |
| Owner, Admin                  | View one application                                       | `GET /organizer-applications/:applicationId`                     | `authenticate`, `requireOwnership`                                    |
| Admin                         | List applications (`?status=`)                             | `GET /organizer-applications`                                    | `authenticate`, `authorize("ADMIN")`                                  |
| Admin                         | Approve / reject                                           | `POST /organizer-applications/:applicationId/approve`, `/reject` | `authenticate`, `authorize("ADMIN")`                                  |
| Anyone                        | List published events (`?status=` needs login, see BR-E11) | `GET /events`                                                    | optional authentication                                               |
| Organizer                     | List my events (`?status=`)                                | `GET /events/mine`                                               | `authenticate`, `authorize("ORGANIZER")`                              |
| Anyone                        | View one event                                             | `GET /events/:eventId`                                           | optional authentication                                               |
| Organizer                     | Create event                                               | `POST /events`                                                   | `authenticate`, `authorize("ORGANIZER")`                              |
| Owner organizer               | Edit event (draft only)                                    | `PATCH /events/:eventId`                                         | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Owner organizer               | Publish event                                              | `POST /events/:eventId/publish`                                  | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Owner organizer, Admin        | Cancel event                                               | `POST /events/:eventId/cancel`                                   | `authenticate`, `authorize("ORGANIZER", "ADMIN")`, `requireOwnership` |
| Owner organizer               | Add ticket type                                            | `POST /events/:eventId/ticket-types`                             | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Owner organizer               | Edit ticket type                                           | `PATCH /events/:eventId/ticket-types/:ticketTypeId`              | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Owner organizer               | Delete ticket type                                         | `DELETE /events/:eventId/ticket-types/:ticketTypeId`             | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Owner organizer, Admin        | List an event's bookings (`?status=`)                      | `GET /events/:eventId/bookings`                                  | `authenticate`, `authorize("ORGANIZER", "ADMIN")`, `requireOwnership` |
| Any user                      | Book tickets                                               | `POST /events/:eventId/bookings`                                 | `authenticate`                                                        |
| Owner organizer               | Check a ticket in                                          | `POST /events/:eventId/check-ins` (body: `code`)                 | `authenticate`, `authorize("ORGANIZER")`, `requireOwnership`          |
| Admin                         | List all bookings (`?status=`)                             | `GET /bookings`                                                  | `authenticate`, `authorize("ADMIN")`                                  |
| Any user                      | List my bookings (`?status=`)                              | `GET /bookings/mine`                                             | `authenticate`                                                        |
| Owner, Event organizer, Admin | View one booking                                           | `GET /bookings/:bookingId`                                       | `authenticate`, `requireOwnership` with `alsoAllow`                   |
| Owner, Admin                  | View a booking's tickets and QR codes                      | `GET /bookings/:bookingId/tickets`                               | `authenticate`, `requireOwnership`                                    |
| Owner, Admin                  | Add tickets (new totals, increase only)                    | `PATCH /bookings/:bookingId/tickets`                             | `authenticate`, `requireOwnership`                                    |
| Owner, Admin                  | Cancel one ticket                                          | `POST /bookings/:bookingId/tickets/:ticketId/cancel`             | `authenticate`, `requireOwnership`                                    |
| Owner, Admin                  | Cancel a booking                                           | `POST /bookings/:bookingId/cancel`                               | `authenticate`, `requireOwnership`                                    |

**Implementation notes**

- `GET /events/:eventId` uses _optional_ authentication, so a logged-in organizer can still see their own draft (BR-E4) while anonymous visitors get a 404 for it. A broken token on this route still returns `401`.
- `/mine` routes are declared before `/:id` routes, or Express would treat `mine` as an id.
- Check-in is scoped to the event, so `requireOwnership` works on the event. The service then verifies the scanned ticket belongs to that event.
- There is no top-level `/tickets` route. Tickets are always reached through their booking.
- In Express 5 `req.query` is read-only, so query parameters are parsed inside the controller.

---

## 9. Roadmap (after v1)

The plan is in three parts. Each part is about 3 weeks. Inside a part, the order matters because later steps depend on earlier ones. For each technical choice, the options are written down with their trade-offs (naive and production-ready), and the decision is made by the project owner.

### Part 1: make it production-shaped (about 3 weeks)

| Step | What                        | Notes                                                                                                                                                                                                                                           |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Lint and format**         | ESLint + Prettier. About half a day.                                                                                                                                                                                                            |
| 2    | **Docker + docker-compose** | App + Postgres now, Redis later.                                                                                                                                                                                                                |
| 3    | **GitHub Actions**          | Typecheck, lint, and tests (with a Postgres service). Needs steps 1 and 2 to have something to run.                                                                                                                                             |
| 4    | **Security basics**         | `helmet`, CORS, rate limit on `/auth/login` and `/auth/register`, environment validation with Zod. Also, login must take about the same time for an unknown email as for a wrong password, so response time does not reveal which emails exist. |
| 5    | **Observability**           | Structured logs, a request id on every request, and a `GET /health` endpoint.                                                                                                                                                                   |
| 6    | **README**                  | Written last, so it matches reality.                                                                                                                                                                                                            |

Choices in this part:

| Topic         | Naive                  | Production-ready                                         | Trade-off                                                                                |
| ------------- | ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Logging       | `console.log` + morgan | Structured JSON logs (for example pino) with request ids | Naive is zero work but hard to search. Structured needs setup but is searchable.         |
| Rate limiting | In-memory counter      | Redis-backed limiter                                     | In-memory breaks when two servers run. Redis works across servers but adds a dependency. |

### Part 2: Redis, jobs, notifications, payments (about 3 weeks)

| Step | What                         | Notes                                                                                                                               |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Redis + caching**          | First, because BullMQ needs Redis.                                                                                                  |
| 2    | **Background jobs (BullMQ)** | The first job is the stored `COMPLETED` event state (section 10).                                                                   |
| 3    | **Retries**                  | Comes with jobs: backoff and a dead-letter queue.                                                                                   |
| 4    | **Notifications (email)**    | Sent from a job, never inside the request.                                                                                          |
| 5    | **Idempotency**              | Learned right before payments, where it matters most.                                                                               |
| 6    | **Payment gateway**          | Test mode only, with webhooks. It is the biggest topic. If time runs short, cut it down to "create a payment + handle one webhook". |

Choices in this part:

| Topic   | Naive                  | Production-ready                         | Trade-off                                                                                                |
| ------- | ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Caching | Cache in a JS variable | Redis with expiry (TTL) and invalidation | A variable is simple but lost on restart. Redis is shared, but you must decide when to clear stale data. |
| Jobs    | `setInterval`          | BullMQ                                   | `setInterval` dies with the server and runs twice with two servers. BullMQ is reliable but needs Redis.  |

### Part 3 (optional): auth upgrades

1. **Refresh tokens** on top of the current JWT setup.
2. **OAuth2** and **MFA**, which are easier after refresh tokens exist.

---

## 10. Deferred / future work

**Completed-event state via background job** (Part 2, step 2)

- _What:_ Stored `COMPLETED` status, updated automatically when an event ends.
- _Why deferred:_ Needs a job queue (BullMQ). In v1 "past" is derived from `endsAt < now`.
- _What it changes:_ A scheduled job and a `COMPLETED` enum value, and simpler date queries.

**Notifications** (Part 2, step 4)

- _What:_ Emails or push messages for booking confirmation, event cancellation, and application decisions. Sent through background jobs.
- _Related:_ When notifications exist, editing a published event (BR-E5) can be revisited: attendees would be told about changes and could cancel their booking.

**Payments with a real gateway** (Part 2, step 6)

- _What:_ Paid tickets, prices on ticket types, a payment step in the booking flow.
- _What it changes:_ Price fields on `TicketType`, payment records, and a `PENDING_PAYMENT` booking state with expiring reservations. Needs idempotency first (Part 2, step 5).
- _Testing note:_ A fault-injection test (force a failure in the middle of a booking and check that everything rolls back) is left for when payments are added.

**Refunds when tickets are cancelled**

- _What:_ When a paid ticket is cancelled, refund its price.

**Check-in before the event starts**

- _What:_ A configurable window so doors can open before `startsAt`.
- _Why deferred:_ In v1 check-in opens exactly at the start, so it never overlaps with booking changes.

**Organizer-defined ticket types**

- _What:_ Custom names such as "Early Bird" or "Student" instead of a fixed enum.

**Profile updates**

- _What:_ `PATCH /users/me` to change name or password.

**Known limitations**

- Event title, description, and location have no minimum length (BR-E12).
- A user who is approved as organizer cannot apply again, and there is no way to return to the `USER` role in v1.
- Two admins deleting their accounts at the same moment could both pass the "last admin" check.

**Other:** waitlists, recurring events, ticket transfers, search and recommendations, geocoded locations.
