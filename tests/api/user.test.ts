import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { cleanTestDatabase } from "../helpers/cleanup";
import { createUser, loginAs, authHeader, deleteUser } from "../helpers/auth";
import { createEvent, createTicketType } from "../helpers/event";
import prisma from "../../src/lib/prisma";
import { cancelBooking, createBooking } from "../helpers/booking";

afterEach(async () => {
  await cleanTestDatabase();
});

describe("GET /users/me route tests", () => {

  it("allows an authenticated user to get their profile", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.user.id).toBe(account.user.id);
    expect(response.body.data.user.email).toBe(account.user.email);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app)
      .get("/users/me")

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Authentication required");
  });

  it("a broken token should get 401", async () => {
    const token = 'abc';
    const response = await request(app)
      .get("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Invalid or expired token");
  });

  it("a deleted account should get 401", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    await deleteUser(account.user.id);
    const response = await request(app)
      .get("/users/me")
      .set(authHeader(token));
    const deleted = await prisma.user.findUnique({ where: { id: account.user.id } });

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("User not found");
    expect(deleted?.deletedAt).not.toBeNull();
  });

});

describe("DELETE /users/me route tests", () => {

  it("allows an authenticated user to delete their profile", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));
    const deleted = await prisma.user.findUnique({ where: { id: account.user.id } });

    expect(response.status).toBe(204);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("an authenticated user with 'CONFIRMED' bookings for upcomming events can delete their account but the booking should be cancelled and tickets stock should be updated", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const organizer = await createUser('ORGANIZER');
    const event = await createEvent(organizer.user.id, 'PUBLISHED');
    const ticketType = await createTicketType(event.id, 'GENERAL', 100);
    const booking = await createBooking(account.user.id, event.id, ticketType.id, 10);
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(204);
    // verify booking cancellation
    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updatedBooking.status).toBe("CANCELLED");

    // verify stock restoration
    const updatedTicketType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketType.id },
    });
    expect(updatedTicketType.remaining).toBe(100);
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app)
      .delete("/users/me");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Authentication required");
  });

  it("a broken token should get 401", async () => {
    const token = 'abc';
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Invalid or expired token");
  });

  it("an orgainzer having an upcoming events can't delete their account", async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    await createEvent(account.user.id, 'PUBLISHED');
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("You can't delete your account while having upcoming or running events");
  });

  it("an orgainzer having ended-events can delete their account", async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    const HOUR = 60 * 60 * 1000;
    await createEvent(account.user.id, 'PUBLISHED', new Date(Date.now() - 3 * HOUR), new Date(Date.now() - 2 * HOUR));
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(204);
  });

  it("an orgainzer having drafted events can delete their account", async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    await createEvent(account.user.id, 'DRAFT');
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));
    const deleted = await prisma.user.findUnique({ where: { id: account.user.id } });

    expect(response.status).toBe(204);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("the last admin in the system can't delete their account", async () => {
    const account = await createUser('ADMIN');
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("You are the only system admin");
  });

  it("the before last admin can delete their account", async () => {
    const account = await createUser('ADMIN');
    const token = await loginAs(account.credentials);
    await createUser('ADMIN');
    const response = await request(app)
      .delete("/users/me")
      .set(authHeader(token));
    const deleted = await prisma.user.findUnique({ where: { id: account.user.id } });

    expect(response.status).toBe(204);
    expect(deleted?.deletedAt).not.toBeNull();
  });

});

describe("GET /users route tests", () => {

  it("allows an admin to list users", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    await createUser();
    await createUser('ORGANIZER');
    const response = await request(app)
      .get("/users")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    // admin + 2 other users
    expect(response.body.data.users).toHaveLength(3);
    expect(response.body.data.pagination.totalItems).toBe(3);
    response.body.data.users.forEach((u: object) => {
      expect(u).not.toHaveProperty('passwordHash');
    });
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app)
      .get("/users");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Authentication required");
  });

  it("a broken token should get 401", async () => {
    const token = 'abc';
    const response = await request(app)
      .get("/users")
      .set(authHeader(token));

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Invalid or expired token");
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/users")
      .set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("You do not have permission to perform this action");
  });

  it("an organizer should get 403", async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/users")
      .set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("You do not have permission to perform this action");
  });

  it("filters users by role", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    await createUser('ORGANIZER');
    await createUser('ORGANIZER');
    await createUser();
    const response = await request(app)
      .get("/users?role=ORGANIZER")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(2);
    expect(response.body.data.pagination.totalItems).toBe(2);
    response.body.data.users.forEach((u: { role: string }) => {
      expect(u.role).toBe("ORGANIZER");
    });
  });

  it("an invalid role value should get 400", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const response = await request(app)
      .get("/users?role=SUPERMAN")
      .set(authHeader(token));

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expect(response.body.data.message).toBe("Validation failed.");
    expect(response.body.data.errors[0].field).toBe("role");
  });

  it("paginates the users list", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    await createUser();
    await createUser();
    // 3 users in total

    const page1 = await request(app)
      .get("/users?page=1&limit=2")
      .set(authHeader(token));

    expect(page1.status).toBe(200);
    expect(page1.body.data.users).toHaveLength(2);
    expect(page1.body.data.pagination).toMatchObject({
      page: 1, limit: 2, totalItems: 3, totalPages: 2,
      hasNextPage: true, hasPreviousPage: false,
    });

    const page2 = await request(app)
      .get("/users?page=2&limit=2")
      .set(authHeader(token));

    expect(page2.body.data.users).toHaveLength(1);
    expect(page2.body.data.pagination).toMatchObject({
      hasNextPage: false, hasPreviousPage: true,
    });
  });

  it("a page after the last one returns an empty list", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const response = await request(app)
      .get("/users?page=5&limit=10")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.users).toEqual([]);
  });

  it("includes deleted (anonymized) users with deletedAt set", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const account = await createUser();
    await deleteUser(account.user.id);
    const response = await request(app)
      .get("/users")
      .set(authHeader(token));

    const deleted = response.body.data.users.find((u: { id: string }) => u.id === account.user.id);

    expect(response.status).toBe(200);
    expect(deleted).toBeDefined();
    expect(deleted.name).toBe("Deleted user");
    expect(deleted.deletedAt).not.toBeNull();
  });

});