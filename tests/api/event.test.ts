import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../../src/app";
import prisma from "../../src/lib/prisma";
import { cleanTestDatabase } from "../helpers/cleanup";
import { createUser, loginAs, authHeader } from "../helpers/auth";
import { createEvent, createTicketType } from "../helpers/event";
import { createBooking, cancelBooking } from "../helpers/booking";

afterEach(async () => {
  await cleanTestDatabase();
});

const HOUR = 60 * 60 * 1000;
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR);
const createRunningEvent = (organizerId: string) =>
  createEvent(organizerId, 'PUBLISHED', fromNow(-1), fromNow(2));

const validBody = {
  title: "Cairo Jazz Night",
  description: "An evening of live jazz with local artists. Doors open at 6 PM.",
  location: "Cairo Opera House, Zamalek, Cairo",
  startsAt: fromNow(24).toISOString(),
  endsAt: fromNow(27).toISOString(),
};

describe("GET /events route tests", () => {

  it("anyone can list published events, and only published ones", async () => {
    const organizer = await createUser('ORGANIZER');
    const published = await createEvent(organizer.user.id, 'PUBLISHED');
    await createEvent(organizer.user.id, 'DRAFT');
    await createEvent(organizer.user.id, 'CANCELLED');
    const response = await request(app).get("/events");

    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(1);
    expect(response.body.data.events[0].id).toBe(published.id);
    expect(response.body.data.pagination.totalItems).toBe(1);
  });

  it("filtering by DRAFT without a token should get 401", async () => {
    const response = await request(app).get("/events?status=DRAFT");

    expect(response.status).toBe(401);
    expect(response.body.data.message).toBe("Authentication required to filter by this status");
  });

  it("an organizer sees only their own drafts", async () => {
    const organizer = await createUser('ORGANIZER');
    const other = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const mine = await createEvent(organizer.user.id, 'DRAFT');
    const notMine = await createEvent(other.user.id, 'DRAFT');
    const response = await request(app)
      .get("/events?status=DRAFT")
      .set(authHeader(token));

    const ids = response.body.data.events.map((e: { id: string }) => e.id);

    expect(response.status).toBe(200);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(notMine.id);
  });

  it("an admin sees everyone's drafts", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const a = await createUser('ORGANIZER');
    const b = await createUser('ORGANIZER');
    await createEvent(a.user.id, 'DRAFT');
    await createEvent(b.user.id, 'DRAFT');
    const response = await request(app)
      .get("/events?status=DRAFT")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(2);
  });

  it("an invalid status should get 400", async () => {
    const response = await request(app).get("/events?status=SUPERMENNA");

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("status");
  });

});

describe("GET /events/mine route tests", () => {

  it("an organizer sees all their events in any status, and not others' events", async () => {
    const organizer = await createUser('ORGANIZER');
    const other = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    await createEvent(organizer.user.id, 'DRAFT');
    await createEvent(organizer.user.id, 'PUBLISHED');
    await createEvent(organizer.user.id, 'CANCELLED');
    await createEvent(other.user.id, 'PUBLISHED');
    const response = await request(app)
      .get("/events/mine")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(3);
    expect(response.body.data.pagination.totalItems).toBe(3);
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/events/mine")
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app).get("/events/mine");

    expect(response.status).toBe(401);
  });

});

describe("GET /events/:eventId route tests", () => {

  it("anyone can see a published event with its ticket types", async () => {
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    await createTicketType(event.id, 'GENERAL', 100);
    const response = await request(app).get(`/events/${event.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.event.id).toBe(event.id);
    expect(response.body.data.event.ticketTypes).toHaveLength(1);
    expect(response.body.data.event.ticketTypes[0].remaining).toBe(100);
  });

  it("a draft is hidden from anonymous users, with the same 404 as a missing event", async () => {
    const organizer = await createUser('ORGANIZER');
    const draft = await createEvent(organizer.user.id, 'DRAFT');
    const hidden = await request(app).get(`/events/${draft.id}`);
    const missing = await request(app).get(`/events/${crypto.randomUUID()}`);

    expect(hidden.status).toBe(404);
    expect(hidden.body.data.message).toBe("Event not found");
    expect(missing.body).toEqual(hidden.body);
  });

  it("a draft is hidden from other users, but visible to its owner and to admins", async () => {
    const organizer = await createUser('ORGANIZER');
    const stranger = await createUser();
    const admin = await createUser('ADMIN');
    const draft = await createEvent(organizer.user.id, 'DRAFT');

    const asStranger = await request(app)
      .get(`/events/${draft.id}`)
      .set(authHeader(await loginAs(stranger.credentials)));
    const asOwner = await request(app)
      .get(`/events/${draft.id}`)
      .set(authHeader(await loginAs(organizer.credentials)));
    const asAdmin = await request(app)
      .get(`/events/${draft.id}`)
      .set(authHeader(await loginAs(admin.credentials)));

    expect(asStranger.status).toBe(404);
    expect(asOwner.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });

  it("an invalid id should get 400", async () => {
    const response = await request(app).get("/events/not-a-uuid");

    expect(response.status).toBe(400);
  });

  it("a broken token on this public route should still get 401", async () => {
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const response = await request(app)
      .get(`/events/${event.id}`)
      .set(authHeader('abc'));

    expect(response.status).toBe(401);
  });

});

describe("POST /events route tests", () => {

  it("allows an organizer to create an event, and it starts as a DRAFT", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.data.event.status).toBe("DRAFT");
    expect(response.body.data.event.organizerId).toBe(organizer.user.id);
  });

  it("an admin should get 403", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(403);
  });

  it("ignores status and organizerId sent in the body", async () => {
    const organizer = await createUser('ORGANIZER');
    const other = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send({ ...validBody, status: "PUBLISHED", organizerId: other.user.id });

    expect(response.status).toBe(201);
    expect(response.body.data.event.status).toBe("DRAFT");
    expect(response.body.data.event.organizerId).toBe(organizer.user.id);
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(403);
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app).post("/events").send(validBody);

    expect(response.status).toBe(401);
  });

  it("a startsAt in the past should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send({ ...validBody, startsAt: fromNow(-2).toISOString(), endsAt: fromNow(2).toISOString() });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("startsAt");
  });

  it("an endsAt before startsAt should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send({ ...validBody, endsAt: fromNow(1).toISOString() });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("endsAt");
  });

  it("a missing title should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const { title, ...withoutTitle } = validBody;
    const response = await request(app)
      .post("/events")
      .set(authHeader(token))
      .send(withoutTitle);

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("title");
  });

});

describe("PATCH /events/:eventId route tests", () => {

  it("allows the owner to edit a draft", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({ title: "New title" });

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.event.title).toBe("New title");
    expect(saved.title).toBe("New title");
    expect(saved.location).toBe(event.location); // fields I did not send stay the same
  });

  it("an admin can't edit drafts", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({ title: "Admin edit" });

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(403);
    expect(saved.title).toBe(event.title);
  });

  it("another organizer gets 404 and the event is not changed", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'DRAFT');
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({ title: "Hacked" });

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe("Event not found");
    expect(saved.title).toBe(event.title);
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .patch(`/events/${crypto.randomUUID()}`)
      .set(authHeader(token))
      .send({ title: "x" });

    expect(response.status).toBe(403);
  });

  it("a published event can't be edited", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({ title: "Too late" });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Event cannot be edited");
  });

  it("an empty body should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(400);
  });

  it("an endsAt before the existing startsAt should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT'); // starts in 24h
    const response = await request(app)
      .patch(`/events/${event.id}`)
      .set(authHeader(token))
      .send({ endsAt: fromNow(1).toISOString() });

    expect(response.status).toBe(400);
    expect(response.body.data.message).toBe("endsAt must be after startsAt");
  });

});

describe("POST /events/:eventId/publish route tests", () => {

  it("allows the owner to publish a draft that has a ticket type", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.event.status).toBe("PUBLISHED");
    expect(saved.status).toBe("PUBLISHED");
  });

  it("an event without ticket types can't be published", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Add at least one ticket type before publishing");
  });

  it("an already published event can't be published again", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Only draft events can be published");
  });

  it("a draft whose start date has passed can't be published", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT', fromNow(-2), fromNow(2));
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
  });

  it("another organizer gets 404 and the event stays a draft", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'DRAFT');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe("DRAFT");
  });

  it("an admin should get 403 and the event stays a draft", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/publish`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(403);
    expect(saved.status).toBe("DRAFT");
  });

});

describe("POST /events/:eventId/cancel route tests", () => {

  it("allows the owner to cancel a draft", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(204);
    expect(saved.status).toBe("CANCELLED");
  });

  it("cancels a published event with no bookings", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(204);
    expect(saved.status).toBe("CANCELLED");
  });

  it("cancelling a published event cancels its bookings and tickets and restores stock", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const buyer = await createUser();
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 5);

    const before = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    expect(before.remaining).toBe(95); // sanity check for the setup

    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    const savedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const cancelledTickets = await prisma.ticket.count({ where: { bookingId: booking.id, status: "CANCELLED" } });
    const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });

    expect(response.status).toBe(204);
    expect(savedEvent.status).toBe("CANCELLED");
    expect(savedBooking.status).toBe("CANCELLED");
    expect(cancelledTickets).toBe(5);
    expect(after.remaining).toBe(100);
  });

  it("a cancelled event can't be cancelled again", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'CANCELLED');
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Cancelled events cannot be modified");
  });

  it("an event that already started can't be cancelled", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-1), fromNow(2));
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Event already started");
  });

  it("allows an admin to cancel any event", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    await createTicketType(event.id);
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(204);
    expect(saved.status).toBe("CANCELLED");
  });

  it("another organizer gets 404 and the event is not cancelled", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/cancel`)
      .set(authHeader(token));

    const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe("DRAFT");
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .post(`/events/${crypto.randomUUID()}/cancel`)
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });

});

describe("POST /events/:eventId/ticket-types route tests", () => {

  it("allows the owner to add a ticket type, and remaining starts equal to capacity", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "VIP", capacity: 50 });

    expect(response.status).toBe(201);
    expect(response.body.data.ticketType.type).toBe("VIP");
    expect(response.body.data.ticketType.capacity).toBe(50);
    expect(response.body.data.ticketType.remaining).toBe(50);
  });

  it("an event can't have two ticket types of the same kind", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    await createTicketType(event.id, 'VIP', 50);
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "VIP", capacity: 10 });

    const count = await prisma.ticketType.count({ where: { eventId: event.id } });

    expect(response.status).toBe(409);
    expect(count).toBe(1);
  });

  it("a cancelled event can't receive ticket types", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'CANCELLED');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "GENERAL", capacity: 10 });

    expect(response.status).toBe(409);
  });

  it("an admin should get 403", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "GENERAL", capacity: 10 });

    const count = await prisma.ticketType.count({ where: { eventId: event.id } });

    expect(response.status).toBe(403);
    expect(count).toBe(0);
  });

  it("another organizer gets 404 and nothing is added", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "GENERAL", capacity: 10 });

    const count = await prisma.ticketType.count({ where: { eventId: event.id } });

    expect(response.status).toBe(404);
    expect(count).toBe(0);
  });

  it("a capacity of 0 should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "GENERAL", capacity: 0 });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("capacity");
  });

  it("an unknown ticket kind should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const response = await request(app)
      .post(`/events/${event.id}/ticket-types`)
      .set(authHeader(token))
      .send({ type: "PLATINUM", capacity: 10 });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("type");
  });

});

describe("PATCH /events/:eventId/ticket-types/:ticketTypeId route tests", () => {

  it("raising the capacity raises remaining by the same amount", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer.user.id, event.id, ticketType.id, 10); // remaining = 90
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ capacity: 150 });

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });

    expect(response.status).toBe(200);
    expect(saved.capacity).toBe(150);
    expect(saved.remaining).toBe(140);
  });

  it("the capacity can be lowered down to exactly the booked tickets", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer.user.id, event.id, ticketType.id, 10);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ capacity: 10 });

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });

    expect(response.status).toBe(200);
    expect(saved.remaining).toBe(0);
  });

  it("a capacity lower than the booked tickets should get 409 and nothing changes", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer.user.id, event.id, ticketType.id, 10);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ capacity: 5 });

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });

    expect(response.status).toBe(409);
    expect(saved.capacity).toBe(100);
    expect(saved.remaining).toBe(90);
  });

  it("the kind can change while no tickets are booked", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ type: "VIP" });

    expect(response.status).toBe(200);
    expect(response.body.data.ticketType.type).toBe("VIP");
  });

  it("the kind can't change after tickets were booked", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer.user.id, event.id, ticketType.id, 2);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ type: "VIP" });

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });

    expect(response.status).toBe(409);
    expect(saved.type).toBe("GENERAL");
  });

  it("a ticket type of another event can't be edited through my event's URL", async () => {
    const organizer = await createUser('ORGANIZER');
    const other = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const myEvent = await createEvent(organizer.user.id, 'DRAFT');
    const otherEvent = await createEvent(other.user.id, 'DRAFT');
    const otherType = await createTicketType(otherEvent.id, 'GENERAL', 100);
    const response = await request(app)
      .patch(`/events/${myEvent.id}/ticket-types/${otherType.id}`)
      .set(authHeader(token))
      .send({ capacity: 5 });

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: otherType.id } });

    expect(response.status).toBe(404);
    expect(saved.capacity).toBe(100);
  });

  it("an admin should get 403", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({ capacity: 5 });

    expect(response.status).toBe(403);
  });

  it("an empty body should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id);
    const response = await request(app)
      .patch(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(400);
  });

});

describe("DELETE /events/:eventId/ticket-types/:ticketTypeId route tests", () => {

  it("allows the owner to delete an unused ticket type of a draft", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token));

    const saved = await prisma.ticketType.findUnique({ where: { id: ticketType.id } });

    expect(response.status).toBe(204);
    expect(saved).toBeNull();
  });

  it("a ticket type that has tickets can't be deleted, even if they are cancelled", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createTicketType(event.id, 'VIP', 10); // so it is not the last type
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 2);
    await cancelBooking(booking.id, ticketType.id, 2);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token));

    const saved = await prisma.ticketType.findUnique({ where: { id: ticketType.id } });

    expect(response.status).toBe(409);
    expect(saved).not.toBeNull();
  });

  it("the last ticket type of a published event can't be deleted", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token));

    const saved = await prisma.ticketType.findUnique({ where: { id: ticketType.id } });

    expect(response.status).toBe(409);
    expect(saved).not.toBeNull();
  });

  it("one of two ticket types of a published event can be deleted", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const general = await createTicketType(event.id, 'GENERAL', 100);
    await createTicketType(event.id, 'VIP', 10);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${general.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(204);
  });

  it("another organizer gets 404 and the ticket type stays", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token));

    const saved = await prisma.ticketType.findUnique({ where: { id: ticketType.id } });

    expect(response.status).toBe(404);
    expect(saved).not.toBeNull();
  });

  it("an admin should get 403 and the ticket type stays", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    const ticketType = await createTicketType(event.id);
    const response = await request(app)
      .delete(`/events/${event.id}/ticket-types/${ticketType.id}`)
      .set(authHeader(token));

    const saved = await prisma.ticketType.findUnique({ where: { id: ticketType.id } });

    expect(response.status).toBe(403);
    expect(saved).not.toBeNull();
  });

});

describe("GET /events/:eventId/bookings route tests", () => {

  it("the owner sees the bookings of the event with ticket counts, including cancelled ones", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer1.user.id, event.id, ticketType.id, 5);
    const cancelled = await createBooking(buyer2.user.id, event.id, ticketType.id, 3);
    await cancelBooking(cancelled.id, ticketType.id, 3);
    const response = await request(app)
      .get(`/events/${event.id}/bookings`)
      .set(authHeader(token));

    const confirmed = response.body.data.bookings.find((b: { status: string }) => b.status === "CONFIRMED");
    const cancelledItem = response.body.data.bookings.find((b: { status: string }) => b.status === "CANCELLED");

    expect(response.status).toBe(200);
    expect(response.body.data.bookings).toHaveLength(2);
    expect(confirmed.activeTicketsCount).toBe(5);
    expect(confirmed.cancelledTicketsCount).toBe(0);
    expect(confirmed.user.email).toBe(buyer1.user.email);
    expect(cancelledItem.activeTicketsCount).toBe(0);
    expect(cancelledItem.cancelledTicketsCount).toBe(3);
  });

  it("filters by status", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    await createBooking(buyer1.user.id, event.id, ticketType.id, 1);
    const cancelled = await createBooking(buyer2.user.id, event.id, ticketType.id, 1);
    await cancelBooking(cancelled.id, ticketType.id, 1);
    const response = await request(app)
      .get(`/events/${event.id}/bookings?status=CANCELLED`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.bookings).toHaveLength(1);
    expect(response.body.data.bookings[0].status).toBe("CANCELLED");
  });

  it("an admin can see the bookings of any event", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const response = await request(app)
      .get(`/events/${event.id}/bookings`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it("another organizer gets 404", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const token = await loginAs(stranger.credentials);
    const event = await createEvent(owner.user.id, 'PUBLISHED');
    const response = await request(app)
      .get(`/events/${event.id}/bookings`)
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get(`/events/${crypto.randomUUID()}/bookings`)
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });

});

describe("POST /events/:eventId/check-ins route tests", () => {

  it("checks a valid ticket in during the event, and records who and when", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const ticketType = await createTicketType(event.id, 'VIP', 10);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.type).toBe("VIP");
    expect(saved.status).toBe("USED");
    expect(saved.usedAt).not.toBeNull();
    expect(saved.checkedInById).toBe(organizer.user.id);
  });

  it("scanning the same ticket twice should get 409", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });
    const second = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    expect(second.status).toBe(409);
  });

  it("two scanners reading the same ticket at the same time: exactly one succeeds", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const scan = () => request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    const responses = await Promise.all([scan(), scan(), scan()]);
    const statuses = responses.map((r) => r.status).sort();

    expect(statuses).toEqual([200, 409, 409]);
  });

  it("a cancelled ticket should get 409", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    await cancelBooking(booking.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Ticket is not valid");
  });

  it("a code that doesn't exist should get 404", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: crypto.randomBytes(16).toString("base64url") });

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe("Ticket not found");
  });

  it("a code with invalid characters should get 400", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createRunningEvent(organizer.user.id);
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: "not valid!!" });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("code");
  });

  it("a ticket of another event gets 404 and stays VALID", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const myEvent = await createRunningEvent(organizer.user.id);
    const otherEvent = await createRunningEvent(organizer.user.id);
    const otherType = await createTicketType(otherEvent.id);
    const booking = await createBooking(buyer.user.id, otherEvent.id, otherType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${myEvent.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe("VALID");
  });

  it("a CANCELLED ticket of another event gets the same 404, not a hint", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const myEvent = await createRunningEvent(organizer.user.id);
    const otherEvent = await createRunningEvent(organizer.user.id);
    const otherType = await createTicketType(otherEvent.id);
    const booking = await createBooking(buyer.user.id, otherEvent.id, otherType.id, 1);
    await cancelBooking(booking.id, otherType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${myEvent.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe("Ticket not found");
  });

  it("check-in before the event starts should get 409", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(1), fromNow(3));
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Event has not started yet");
  });

  it("check-in after the event ended should get 409", async () => {
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-3), fromNow(-1));
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Event has ended");
  });

  it("check-in for a cancelled event should get 409", async () => {
    const organizer = await createUser('ORGANIZER');
    const token = await loginAs(organizer.credentials);
    const event = await createEvent(organizer.user.id, 'CANCELLED', fromNow(-1), fromNow(2));
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: crypto.randomBytes(16).toString("base64url") });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("Event is not published");
  });

  it("an admin should get 403 and the ticket stays VALID", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const organizer = await createUser('ORGANIZER');
    const buyer = await createUser();
    const event = await createRunningEvent(organizer.user.id);
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(403);
    expect(saved.status).toBe("VALID");
  });

  it("another organizer gets 404 and the ticket stays VALID", async () => {
    const owner = await createUser('ORGANIZER');
    const stranger = await createUser('ORGANIZER');
    const buyer = await createUser();
    const token = await loginAs(stranger.credentials);
    const event = await createRunningEvent(owner.user.id);
    const ticketType = await createTicketType(event.id);
    const booking = await createBooking(buyer.user.id, event.id, ticketType.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await request(app)
      .post(`/events/${event.id}/check-ins`)
      .set(authHeader(token))
      .send({ code: ticket.code });

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe("VALID");
  });

});