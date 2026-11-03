import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { app } from '../../src/app';
import prisma from '../../src/lib/prisma';
import { cleanTestDatabase } from '../helpers/cleanup';
import { createUser, loginAs, authHeader } from '../helpers/auth';
import { createEvent, createTicketType } from '../helpers/event';
import { cancelBooking, createBooking, createTickets } from '../helpers/booking';

afterEach(async () => {
  await cleanTestDatabase();
});

// local helpers
const HOUR = 60 * 60 * 1000;
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR);

// a published event with a new organizer and one GENERAL ticket type
async function setupEvent(capacity = 100) {
  const organizer = await createUser('ORGANIZER');
  const event = await createEvent(organizer.user.id, 'PUBLISHED');
  const general = await createTicketType(event.id, 'GENERAL', capacity);
  return { organizer, event, general };
}

// sends POST /events/:eventId/bookings
const bookAs = (token: string, eventId: string, tickets: { type: string; count: number }[]) =>
  request(app).post(`/events/${eventId}/bookings`).set(authHeader(token)).send({ tickets });

const cancelBookingAs = (token: string, bookingId: string) =>
  request(app).post(`/bookings/${bookingId}/cancel`).set(authHeader(token));

const cancelTicketAs = (token: string, bookingId: string, ticketId: string) =>
  request(app).post(`/bookings/${bookingId}/tickets/${ticketId}/cancel`).set(authHeader(token));

const patchTicketsAs = (
  token: string,
  bookingId: string,
  tickets: { type: string; count: number }[],
) => request(app).patch(`/bookings/${bookingId}/tickets`).set(authHeader(token)).send({ tickets });

describe('GET /bookings route tests', () => {
  it('an admin sees all bookings with user and event info', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const { event, general } = await setupEvent();
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    await createBooking(buyer1.user.id, event.id, general.id, 2);
    await createBooking(buyer2.user.id, event.id, general.id, 1);
    const response = await request(app).get('/bookings').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.bookings).toHaveLength(2);
    expect(response.body.data.pagination.totalItems).toBe(2);
    expect(response.body.data.bookings[0]).toHaveProperty('user.email');
    expect(response.body.data.bookings[0]).toHaveProperty('event.title');
  });

  it('an admin can filter by status', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const { event, general } = await setupEvent();
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    await createBooking(buyer1.user.id, event.id, general.id, 1);
    const cancelled = await createBooking(buyer2.user.id, event.id, general.id, 1);
    await cancelBooking(cancelled.id, general.id, 1);
    const response = await request(app).get('/bookings?status=CANCELLED').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.bookings).toHaveLength(1);
    expect(response.body.data.bookings[0].status).toBe('CANCELLED');
  });

  it('a normal user should get 403', async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app).get('/bookings').set(authHeader(token));

    expect(response.status).toBe(403);
  });

  it('an organizer should get 403', async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    const response = await request(app).get('/bookings').set(authHeader(token));

    expect(response.status).toBe(403);
  });
});

describe('GET /bookings/mine route tests', () => {
  it('returns only my bookings, including cancelled ones, with ticket counts', async () => {
    const me = await createUser();
    const other = await createUser();
    const token = await loginAs(me.credentials);
    const a = await setupEvent();
    const b = await setupEvent();
    await createBooking(me.user.id, a.event.id, a.general.id, 5);
    const cancelled = await createBooking(me.user.id, b.event.id, b.general.id, 2);
    await cancelBooking(cancelled.id, b.general.id, 2);
    await createBooking(other.user.id, a.event.id, a.general.id, 1);
    const response = await request(app).get('/bookings/mine').set(authHeader(token));

    const items = response.body.data.bookings;
    const confirmedItem = items.find((x: { status: string }) => x.status === 'CONFIRMED');
    const cancelledItem = items.find((x: { status: string }) => x.status === 'CANCELLED');

    expect(response.status).toBe(200);
    expect(items).toHaveLength(2);
    expect(response.body.data.pagination.totalItems).toBe(2);
    expect(confirmedItem.activeTicketsCount).toBe(5);
    expect(confirmedItem.cancelledTicketsCount).toBe(0);
    expect(confirmedItem.event.title).toBe('Cairo Jazz Night');
    expect(cancelledItem.activeTicketsCount).toBe(0);
    expect(cancelledItem.cancelledTicketsCount).toBe(2);
  });

  it('filters my bookings by status', async () => {
    const me = await createUser();
    const token = await loginAs(me.credentials);
    const a = await setupEvent();
    const b = await setupEvent();
    await createBooking(me.user.id, a.event.id, a.general.id, 1);
    const cancelled = await createBooking(me.user.id, b.event.id, b.general.id, 1);
    await cancelBooking(cancelled.id, b.general.id, 1);
    const response = await request(app)
      .get('/bookings/mine?status=CONFIRMED')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.bookings).toHaveLength(1);
    expect(response.body.data.bookings[0].status).toBe('CONFIRMED');
  });

  it('non-authenticated user should get 401', async () => {
    const response = await request(app).get('/bookings/mine');

    expect(response.status).toBe(401);
  });
});

describe('GET /bookings/:bookingId route tests', () => {
  it('the owner sees the booking with counts grouped by ticket type', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 3);
    const response = await request(app).get(`/bookings/${booking.id}`).set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.booking.id).toBe(booking.id);
    expect(response.body.data.booking.activeTicketsCount).toBe(3);
    expect(response.body.data.booking.activeTicketsByType).toEqual([{ type: 'GENERAL', count: 3 }]);
    expect(response.body.data.booking.event.location).toBe('Cairo Opera House, Zamalek, Cairo');
  });

  it('the organizer of the event can see the booking', async () => {
    const buyer = await createUser();
    const { organizer, event, general } = await setupEvent();
    const token = await loginAs(organizer.credentials);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);
    const response = await request(app).get(`/bookings/${booking.id}`).set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it('an admin can see any booking', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const buyer = await createUser();
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);
    const response = await request(app).get(`/bookings/${booking.id}`).set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it('another user gets 404, same as a missing booking', async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);

    const forbidden = await request(app).get(`/bookings/${booking.id}`).set(authHeader(token));
    const missing = await request(app)
      .get(`/bookings/${crypto.randomUUID()}`)
      .set(authHeader(token));

    expect(forbidden.status).toBe(404);
    expect(forbidden.body.data.message).toBe('Booking not found');
    expect(missing.body).toEqual(forbidden.body);
  });

  it('an organizer of a different event gets 404', async () => {
    const buyer = await createUser();
    const otherOrganizer = await createUser('ORGANIZER');
    const token = await loginAs(otherOrganizer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);
    const response = await request(app).get(`/bookings/${booking.id}`).set(authHeader(token));

    expect(response.status).toBe(404);
  });

  it('an invalid id should get 400', async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app).get('/bookings/not-a-uuid').set(authHeader(token));

    expect(response.status).toBe(400);
  });
});

describe('GET /bookings/:bookingId/tickets route tests', () => {
  it('the owner sees the tickets with their QR codes', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 3);
    const response = await request(app)
      .get(`/bookings/${booking.id}/tickets`)
      .set(authHeader(token));

    const tickets = response.body.data.tickets;

    expect(response.status).toBe(200);
    expect(tickets).toHaveLength(3);
    tickets.forEach((t: { code: string; status: string; type: string }) => {
      expect(t.code).toHaveLength(22);
      expect(t.status).toBe('VALID');
      expect(t.type).toBe('GENERAL');
    });
  });

  it("the event's organizer can see the booking but gets 404 on its tickets", async () => {
    const buyer = await createUser();
    const { organizer, event, general } = await setupEvent();
    const token = await loginAs(organizer.credentials);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);

    const bookingResponse = await request(app)
      .get(`/bookings/${booking.id}`)
      .set(authHeader(token));
    const ticketsResponse = await request(app)
      .get(`/bookings/${booking.id}/tickets`)
      .set(authHeader(token));

    expect(bookingResponse.status).toBe(200);
    expect(ticketsResponse.status).toBe(404);
    expect(ticketsResponse.body.data.message).toBe('Booking not found');
  });

  it('an admin can see the tickets of any booking', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const buyer = await createUser();
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await request(app)
      .get(`/bookings/${booking.id}/tickets`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.tickets).toHaveLength(2);
  });

  it('another user gets 404', async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);
    const response = await request(app)
      .get(`/bookings/${booking.id}/tickets`)
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });
});

describe('POST /events/:eventId/bookings route tests', () => {
  it('books tickets of two types in one booking', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const vip = await createTicketType(event.id, 'VIP', 10);
    const response = await bookAs(token, event.id, [
      { type: 'GENERAL', count: 3 },
      { type: 'VIP', count: 2 },
    ]);

    const savedGeneral = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    const savedVip = await prisma.ticketType.findUniqueOrThrow({ where: { id: vip.id } });
    const ticketCount = await prisma.ticket.count({
      where: { booking: { userId: buyer.user.id }, status: 'VALID' },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.booking.status).toBe('CONFIRMED');
    expect(response.body.data.booking.activeTicketsCount).toBe(5);
    expect(response.body.data.booking.activeTicketsByType).toHaveLength(2);
    expect(savedGeneral.remaining).toBe(97);
    expect(savedVip.remaining).toBe(8);
    expect(ticketCount).toBe(5);
  });

  it('every ticket gets its own random code', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent();
    await bookAs(token, event.id, [{ type: 'GENERAL', count: 5 }]);
    const tickets = await prisma.ticket.findMany({ where: { booking: { userId: buyer.user.id } } });

    const codes = tickets.map((t) => t.code);

    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
    codes.forEach((code) => expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/));
  });

  it('10 tickets in one booking is allowed', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent();
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 10 }]);

    expect(response.status).toBe(201);
    expect(response.body.data.booking.activeTicketsCount).toBe(10);
  });

  it('11 tickets in total should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent();
    await createTicketType(event.id, 'VIP', 10);
    const response = await bookAs(token, event.id, [
      { type: 'GENERAL', count: 6 },
      { type: 'VIP', count: 5 },
    ]);

    const bookings = await prisma.booking.count();

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('tickets');
    expect(bookings).toBe(0);
  });

  it('the same ticket type twice in the list should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent();
    const response = await bookAs(token, event.id, [
      { type: 'GENERAL', count: 1 },
      { type: 'GENERAL', count: 2 },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].message).toBe('Each ticket type can appear only once');
  });

  it('a count of 0 should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent();
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 0 }]);

    expect(response.status).toBe(400);
  });

  it("a ticket type the event doesn't offer should get 400", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event } = await setupEvent(); // only GENERAL
    const response = await bookAs(token, event.id, [{ type: 'VIP', count: 1 }]);

    expect(response.status).toBe(400);
    expect(response.body.data.message).toBe(
      "This event doesn't have all the required ticket types",
    );
  });

  it('asking for more than the remaining stock should get 409 and nothing changes', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(3);
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 4 }]);

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    const bookings = await prisma.booking.count();

    expect(response.status).toBe(409);
    expect(saved.remaining).toBe(3);
    expect(bookings).toBe(0);
  });

  it('a booking is all or nothing: if one type is short, nothing changes', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const vip = await createTicketType(event.id, 'VIP', 2);
    const response = await bookAs(token, event.id, [
      { type: 'GENERAL', count: 3 },
      { type: 'VIP', count: 5 },
    ]);

    const savedGeneral = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    const savedVip = await prisma.ticketType.findUniqueOrThrow({ where: { id: vip.id } });
    const bookings = await prisma.booking.count();
    const tickets = await prisma.ticket.count();

    expect(response.status).toBe(409);
    expect(response.body.data.message).toContain('VIP');
    expect(savedGeneral.remaining).toBe(100);
    expect(savedVip.remaining).toBe(2);
    expect(bookings).toBe(0);
    expect(tickets).toBe(0);
  });

  it('can book exactly the remaining stock, and the next booking gets 409', async () => {
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    const token1 = await loginAs(buyer1.credentials);
    const token2 = await loginAs(buyer2.credentials);
    const { event, general } = await setupEvent(3);
    const first = await bookAs(token1, event.id, [{ type: 'GENERAL', count: 3 }]);
    const second = await bookAs(token2, event.id, [{ type: 'GENERAL', count: 1 }]);

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(first.status).toBe(201);
    expect(saved.remaining).toBe(0);
    expect(second.status).toBe(409);
    expect(second.body.data.message).toContain('exceeds the remaining capacity');
  });

  it("a user with a CONFIRMED booking can't book the same event again", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 1 }]);

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe(
      'A user can have at most one confirmed booking for an event',
    );
    expect(saved.remaining).toBe(98);
  });

  it('a user can book again after cancelling their booking', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const old = await createBooking(buyer.user.id, event.id, general.id, 2);
    await cancelBooking(old.id, general.id, 2);
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 1 }]);

    const bookings = await prisma.booking.findMany({ where: { userId: buyer.user.id } });

    expect(response.status).toBe(201);
    expect(bookings).toHaveLength(2);
  });

  it('the database itself refuses a second CONFIRMED booking for the same user and event', async () => {
    const buyer = await createUser();
    const { event, general } = await setupEvent();
    await createBooking(buyer.user.id, event.id, general.id, 1);

    await expect(createBooking(buyer.user.id, event.id, general.id, 1)).rejects.toThrow();

    const count = await prisma.booking.count({
      where: { userId: buyer.user.id, eventId: event.id },
    });

    expect(count).toBe(1);
  });

  it("a draft event can't be booked", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'DRAFT');
    await createTicketType(event.id);
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 1 }]);

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Only published events can have bookings');
  });

  it("an event that already started can't be booked", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-1), fromNow(2));
    await createTicketType(event.id);
    const response = await bookAs(token, event.id, [{ type: 'GENERAL', count: 1 }]);

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Event already started');
  });

  it('an unknown event should get 404', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const response = await bookAs(token, crypto.randomUUID(), [{ type: 'GENERAL', count: 1 }]);

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe('Event not found');
  });

  it('non-authenticated user should get 401', async () => {
    const { event } = await setupEvent();
    const response = await request(app)
      .post(`/events/${event.id}/bookings`)
      .send({ tickets: [{ type: 'GENERAL', count: 1 }] });

    expect(response.status).toBe(401);
  });

  it('the same user sending two bookings at the same time gets one 201 and one 409', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const responses = await Promise.all([
      bookAs(token, event.id, [{ type: 'GENERAL', count: 2 }]),
      bookAs(token, event.id, [{ type: 'GENERAL', count: 2 }]),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    const confirmed = await prisma.booking.count({
      where: { userId: buyer.user.id, eventId: event.id, status: 'CONFIRMED' },
    });
    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(statuses).toEqual([201, 409]);
    expect(confirmed).toBe(1);
    expect(saved.remaining).toBe(98);
  });

  it('five users racing for three spots: exactly three succeed', async () => {
    const { event, general } = await setupEvent(3);
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      const buyer = await createUser();
      tokens.push(await loginAs(buyer.credentials));
    }
    const responses = await Promise.all(
      tokens.map((token) => bookAs(token, event.id, [{ type: 'GENERAL', count: 1 }])),
    );

    const succeeded = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status === 409);
    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    const tickets = await prisma.ticket.count({
      where: { ticketTypeId: general.id, status: 'VALID' },
    });

    expect(succeeded).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    expect(saved.remaining).toBe(0);
    expect(tickets).toBe(3);
  });
});

describe('POST /bookings/:bookingId/cancel route tests', () => {
  it('the owner cancels a booking: tickets are cancelled and the stock of every type is restored', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const vip = await createTicketType(event.id, 'VIP', 10);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 3);
    await createTickets(booking.id, vip.id, 2);

    const before = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    expect(before.remaining).toBe(97); // sanity check for the setup

    const response = await cancelBookingAs(token, booking.id);

    const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const cancelledTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'CANCELLED' },
    });
    const savedGeneral = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });
    const savedVip = await prisma.ticketType.findUniqueOrThrow({ where: { id: vip.id } });

    expect(response.status).toBe(204);
    expect(savedBooking.status).toBe('CANCELLED');
    expect(savedBooking.cancelledAt).not.toBeNull();
    expect(validTickets).toBe(0);
    expect(cancelledTickets).toBe(5);
    expect(savedGeneral.remaining).toBe(100);
    expect(savedVip.remaining).toBe(10);
  });

  it('an admin can cancel any booking', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const buyer = await createUser();
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await cancelBookingAs(token, booking.id);

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    expect(response.status).toBe(204);
    expect(saved.status).toBe('CANCELLED');
  });

  it('another user gets 404 and the booking is not changed', async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await cancelBookingAs(token, booking.id);

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe('CONFIRMED');
    expect(savedType.remaining).toBe(98);
  });

  it("the event's organizer can't cancel a booking of their event", async () => {
    const buyer = await createUser();
    const { organizer, event, general } = await setupEvent();
    const token = await loginAs(organizer.credentials);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await cancelBookingAs(token, booking.id);

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe('CONFIRMED');
  });

  it('an already cancelled booking should get 409 and the stock is not restored twice', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    await cancelBooking(booking.id, general.id, 2); // remaining is back to 100
    const response = await cancelBookingAs(token, booking.id);

    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Booking is already cancelled');
    expect(saved.remaining).toBe(100); // not 102
  });

  it("a booking of an event that already started can't be cancelled", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-1), fromNow(2));
    const general = await createTicketType(event.id, 'GENERAL', 100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await cancelBookingAs(token, booking.id);

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Event already started');
    expect(saved.status).toBe('CONFIRMED');
  });

  it('an unknown booking should get 404', async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await cancelBookingAs(token, crypto.randomUUID());

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe('Booking not found');
  });

  it('non-authenticated user should get 401', async () => {
    const response = await request(app).post(`/bookings/${crypto.randomUUID()}/cancel`);

    expect(response.status).toBe(401);
  });

  it('cancelling the same booking twice at the same time: one 204, one 409, and the stock is restored once', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 4);
    const responses = await Promise.all([
      cancelBookingAs(token, booking.id),
      cancelBookingAs(token, booking.id),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    const saved = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(statuses).toEqual([204, 409]);
    expect(saved.remaining).toBe(100); // not 104
  });
});

describe('POST /bookings/:bookingId/tickets/:ticketId/cancel route tests', () => {
  it('cancels one ticket: the stock goes up by one and the booking stays CONFIRMED', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 3);
    const tickets = await prisma.ticket.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
    });
    const response = await cancelTicketAs(token, booking.id, tickets[0]!.id);

    const savedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0]!.id } });
    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(204);
    expect(savedTicket.status).toBe('CANCELLED');
    expect(savedTicket.cancelledAt).not.toBeNull();
    expect(validTickets).toBe(2);
    expect(savedBooking.status).toBe('CONFIRMED');
    expect(savedType.remaining).toBe(98); // 100 - 3 + 1
  });

  it('cancelling the last ticket cancels the booking', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await cancelTicketAs(token, booking.id, ticket.id);

    const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(204);
    expect(savedBooking.status).toBe('CANCELLED');
    expect(savedBooking.cancelledAt).not.toBeNull();
    expect(savedType.remaining).toBe(100);
  });

  it('an already cancelled ticket should get 409 and the stock is not restored twice', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const first = await cancelTicketAs(token, booking.id, ticket.id);
    const second = await cancelTicketAs(token, booking.id, ticket.id);

    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(first.status).toBe(204);
    expect(second.status).toBe(409);
    expect(second.body.data.message).toBe('Only valid tickets can be cancelled');
    expect(savedType.remaining).toBe(99); // 100 - 2 + 1, not 100
  });

  it("a ticket of another booking can't be cancelled through my booking's URL", async () => {
    const me = await createUser();
    const other = await createUser();
    const token = await loginAs(me.credentials);
    const { event, general } = await setupEvent(100);
    const myBooking = await createBooking(me.user.id, event.id, general.id, 1);
    const otherBooking = await createBooking(other.user.id, event.id, general.id, 1);
    const otherTicket = await prisma.ticket.findFirstOrThrow({
      where: { bookingId: otherBooking.id },
    });
    const response = await cancelTicketAs(token, myBooking.id, otherTicket.id);

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: otherTicket.id } });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(404);
    expect(response.body.data.message).toBe('Ticket not found');
    expect(saved.status).toBe('VALID');
    expect(savedType.remaining).toBe(98);
  });

  it('another user gets 404 and the ticket stays VALID', async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await cancelTicketAs(token, booking.id, ticket.id);

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(404);
    expect(saved.status).toBe('VALID');
  });

  it('an admin can cancel a ticket of any booking', async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const buyer = await createUser();
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await cancelTicketAs(token, booking.id, ticket.id);

    expect(response.status).toBe(204);
  });

  it("a ticket of an event that already started can't be cancelled", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-1), fromNow(2));
    const general = await createTicketType(event.id, 'GENERAL', 100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { bookingId: booking.id } });
    const response = await cancelTicketAs(token, booking.id, ticket.id);

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Event already started');
    expect(saved.status).toBe('VALID');
  });

  it('an unknown ticket should get 404, and an invalid ticket id should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 1);

    const unknown = await cancelTicketAs(token, booking.id, crypto.randomUUID());
    const invalid = await cancelTicketAs(token, booking.id, 'not-a-uuid');

    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(400);
  });

  it('cancelling the last two tickets at the same time cancels the booking', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const tickets = await prisma.ticket.findMany({ where: { bookingId: booking.id } });
    const responses = await Promise.all(
      tickets.map((t) => cancelTicketAs(token, booking.id, t.id)),
    );

    const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(responses.map((r) => r.status)).toEqual([204, 204]);
    expect(validTickets).toBe(0);
    expect(savedBooking.status).toBe('CANCELLED'); // a CONFIRMED booking must never have 0 tickets
    expect(savedType.remaining).toBe(100);
  });
});

describe('PATCH /bookings/:bookingId/tickets route tests', () => {
  it('raising a count adds new tickets and keeps the old ones', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const oldTickets = await prisma.ticket.findMany({ where: { bookingId: booking.id } });
    const oldCodes = oldTickets.map((t) => t.code);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 5 }]);

    const newTickets = await prisma.ticket.findMany({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const codes = newTickets.map((t) => t.code);
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.booking.activeTicketsCount).toBe(5);
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
    expect(codes).toEqual(expect.arrayContaining(oldCodes));
    expect(savedType.remaining).toBe(95);
  });

  it('a type that is not in the booking yet can be added', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const vip = await createTicketType(event.id, 'VIP', 10);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'VIP', count: 3 }]);

    const savedVip = await prisma.ticketType.findUniqueOrThrow({ where: { id: vip.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.booking.activeTicketsCount).toBe(5);
    expect(response.body.data.booking.activeTicketsByType).toEqual(
      expect.arrayContaining([
        { type: 'GENERAL', count: 2 },
        { type: 'VIP', count: 3 },
      ]),
    );
    expect(savedVip.remaining).toBe(7);
  });

  it('sending the same request twice changes nothing the second time', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const first = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 5 }]); // sending count not delta gave us idempotency, which is tested here
    const second = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 5 }]);

    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(validTickets).toBe(5);
    expect(savedType.remaining).toBe(95);
  });

  it('a count lower than the tickets held should get 409 and nothing changes', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 5);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 3 }]);

    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Use cancel-ticket to reduce tickets of type GENERAL');
    expect(validTickets).toBe(5);
  });

  it('asking for more than the remaining stock should get 409 and nothing changes', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(4);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2); // remaining = 2
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 5 }]);

    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const savedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: general.id } });

    expect(response.status).toBe(409);
    expect(response.body.data.message).toContain('exceeds the remaining capacity');
    expect(validTickets).toBe(2);
    expect(savedType.remaining).toBe(2);
  });

  it('adding tickets that would pass 10 in total should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const vip = await createTicketType(event.id, 'VIP', 10);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 8);
    // the body itself has only 5 tickets, so it passes the schema. 8 + 5 = 13 breaks the rule in the service
    const response = await patchTicketsAs(token, booking.id, [{ type: 'VIP', count: 5 }]);

    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });
    const savedVip = await prisma.ticketType.findUniqueOrThrow({ where: { id: vip.id } });

    expect(response.status).toBe(400);
    expect(response.body.data.message).toBe('A booking can have at most 10 tickets');
    expect(validTickets).toBe(8);
    expect(savedVip.remaining).toBe(10);
  });

  it('a booking can grow to exactly 10 tickets', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 8);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 10 }]);

    expect(response.status).toBe(200);
    expect(response.body.data.booking.activeTicketsCount).toBe(10);
  });

  it("a ticket type the event doesn't offer should get 400", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(); // only GENERAL
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'VIP', count: 1 }]);

    expect(response.status).toBe(400);
    expect(response.body.data.message).toBe(
      "This event doesn't have all the required ticket types",
    );
  });

  it('an empty list of tickets should get 400', async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, []);

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('tickets');
  });

  it("a cancelled booking can't be changed", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent();
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    await cancelBooking(booking.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 4 }]);

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Booking is already cancelled');
  });

  it("a booking of an event that already started can't be changed", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED', fromNow(-1), fromNow(2));
    const general = await createTicketType(event.id, 'GENERAL', 100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 4 }]);

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe('Event already started');
  });

  it('another user gets 404 and nothing changes', async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const { event, general } = await setupEvent(100);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 2);
    const response = await patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 4 }]);

    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });

    expect(response.status).toBe(404);
    expect(validTickets).toBe(2);
  });

  it("two changes at the same time can't push the booking over 10 tickets", async () => {
    const buyer = await createUser();
    const token = await loginAs(buyer.credentials);
    const { event, general } = await setupEvent(100);
    await createTicketType(event.id, 'VIP', 10);
    const booking = await createBooking(buyer.user.id, event.id, general.id, 5);
    // alone, each request is fine (5 + 3 = 8). Together they would make 11
    const responses = await Promise.all([
      patchTicketsAs(token, booking.id, [{ type: 'GENERAL', count: 8 }]),
      patchTicketsAs(token, booking.id, [{ type: 'VIP', count: 3 }]),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    const validTickets = await prisma.ticket.count({
      where: { bookingId: booking.id, status: 'VALID' },
    });

    expect(statuses).toEqual([200, 400]);
    expect(validTickets).toBe(8);
  });
});
