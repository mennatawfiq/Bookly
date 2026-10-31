import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../../src/app";
import prisma from "../../src/lib/prisma";
import { cleanTestDatabase } from "../helpers/cleanup";
import { createUser, loginAs, authHeader } from "../helpers/auth";
import { createApplication } from "../helpers/application";

afterEach(async () => {
  await cleanTestDatabase();
});

const DAY = 24 * 60 * 60 * 1000;

const validBody = {
  organizationName: "Cairo Live Events",
  description: "We organize jazz and indie concerts across Cairo every month.",
};

describe("POST /organizer-applications route tests", () => {

  it("allows a USER to apply", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.data.application.status).toBe("PENDING");
    expect(response.body.data.application.organizationName).toBe(validBody.organizationName);
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app)
      .post("/organizer-applications")
      .send(validBody);

    expect(response.status).toBe(401);
    expect(response.body.data.message).toBe("Authentication required");
  });

  it("an organizer should get 403", async () => {
    const account = await createUser('ORGANIZER');
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(403);
  });

  it("a too-short description should get 400", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send({ ...validBody, description: "too short" });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("description");
  });

  it("a user with a pending application can't apply again", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    await createApplication(account.user.id, 'PENDING');
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.data.message).toBe("You already have a pending application");
  });

  it("a user rejected 1 day ago can't apply yet", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    await createApplication(account.user.id, 'REJECTED', new Date(Date.now() - 1 * DAY));
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(409);
  });

  it("a user rejected 4 days ago can apply again", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    await createApplication(account.user.id, 'REJECTED', new Date(Date.now() - 4 * DAY));
    const response = await request(app)
      .post("/organizer-applications")
      .set(authHeader(token))
      .send(validBody);

    expect(response.status).toBe(201);
  });

});

describe("GET /organizer-applications/mine route tests", () => {

  it("returns only my applications", async () => {
    const account = await createUser();
    const other = await createUser();
    const token = await loginAs(account.credentials);
    await createApplication(account.user.id, 'REJECTED', new Date());
    await createApplication(account.user.id, 'PENDING');
    await createApplication(other.user.id, 'PENDING');
    const response = await request(app)
      .get("/organizer-applications/mine")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.applications).toHaveLength(2);
    expect(response.body.data.pagination.totalItems).toBe(2);
  });

  it("non-authenticated user should get 401", async () => {
    const response = await request(app).get("/organizer-applications/mine");

    expect(response.status).toBe(401);
  });

});

describe("GET /organizer-applications/:applicationId route tests", () => {

  it("the owner can see their application", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const application = await createApplication(account.user.id);
    const response = await request(app)
      .get(`/organizer-applications/${application.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.application.id).toBe(application.id);
  });

  it("an admin can see any application", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const applicant = await createUser();
    const application = await createApplication(applicant.user.id);
    const response = await request(app)
      .get(`/organizer-applications/${application.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it("another user gets 404, same as a missing application", async () => {
    const applicant = await createUser();
    const stranger = await createUser();
    const token = await loginAs(stranger.credentials);
    const application = await createApplication(applicant.user.id);

    const forbidden = await request(app)
      .get(`/organizer-applications/${application.id}`)
      .set(authHeader(token));
    const missing = await request(app)
      .get(`/organizer-applications/${crypto.randomUUID()}`)
      .set(authHeader(token));

    expect(forbidden.status).toBe(404);
    expect(forbidden.body.data.message).toBe("Application not found");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(forbidden.body);
  });

  it("an invalid id should get 400", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/organizer-applications/not-a-uuid")
      .set(authHeader(token));

    expect(response.status).toBe(400);
  });

});

describe("GET /organizer-applications route tests", () => {

  it("allows an admin to list all applications", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const a = await createUser();
    const b = await createUser();
    await createApplication(a.user.id);
    await createApplication(b.user.id);
    const response = await request(app)
      .get("/organizer-applications")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.applications).toHaveLength(2);
    expect(response.body.data.applications[0].user).toHaveProperty('email');
  });

  it("filters by status", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const a = await createUser();
    const b = await createUser();
    await createApplication(a.user.id, 'PENDING');
    await createApplication(b.user.id, 'REJECTED', new Date());
    const response = await request(app)
      .get("/organizer-applications?status=PENDING")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.applications).toHaveLength(1);
    expect(response.body.data.applications[0].status).toBe("PENDING");
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const response = await request(app)
      .get("/organizer-applications")
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });

});

describe("POST /organizer-applications/:applicationId/approve route tests", () => {

  it("allows an admin to approve, and the user becomes an organizer", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const applicant = await createUser();
    const application = await createApplication(applicant.user.id);
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/approve`)
      .set(authHeader(token))
      .send({});

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: applicant.user.id } });
    const updatedApplication = await prisma.organizerApplication.findUniqueOrThrow({ where: { id: application.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.application.status).toBe("APPROVED");
    expect(updatedUser.role).toBe("ORGANIZER");
    expect(updatedApplication.reviewedById).toBe(admin.user.id);
    expect(updatedApplication.reviewedAt).not.toBeNull();
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const application = await createApplication(account.user.id);
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/approve`)
      .set(authHeader(token))
      .send({});

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.user.id } });

    expect(response.status).toBe(403);
    expect(user.role).toBe("USER");
  });

  it("an already reviewed application can't be approved", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const applicant = await createUser();
    const application = await createApplication(applicant.user.id, 'REJECTED', new Date());
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/approve`)
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(404);
  });

});

describe("POST /organizer-applications/:applicationId/reject route tests", () => {

  it("allows an admin to reject, and the user stays a USER", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const applicant = await createUser();
    const application = await createApplication(applicant.user.id);
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/reject`)
      .set(authHeader(token))
      .send({ reviewNote: "Not enough details" });

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: applicant.user.id } });

    expect(response.status).toBe(200);
    expect(response.body.data.application.status).toBe("REJECTED");
    expect(response.body.data.application.reviewNote).toBe("Not enough details");
    expect(updatedUser.role).toBe("USER");
  });

  it("rejecting without a reviewNote should get 400", async () => {
    const admin = await createUser('ADMIN');
    const token = await loginAs(admin.credentials);
    const applicant = await createUser();
    const application = await createApplication(applicant.user.id);
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/reject`)
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe("reviewNote");
  });

  it("a normal user should get 403", async () => {
    const account = await createUser();
    const token = await loginAs(account.credentials);
    const application = await createApplication(account.user.id);
    const response = await request(app)
      .post(`/organizer-applications/${application.id}/reject`)
      .set(authHeader(token))
      .send({ reviewNote: "Nice try" });

    expect(response.status).toBe(403);
  });

});