import { z } from "zod";
import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { CreateApplicationRequest, CreateApplicationSuccess } from "./components";

registry.registerPath({
  method: "post",
  path: "/organizer-applications",
  tags: ["Organizer Applications"],
  summary: "Create an organizer application",
  description: "Creates an organizer application for the authenticated user. Only users with the `USER` role can apply. A user can have only one `PENDING` application, and after a rejection must wait 3 days before applying again. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateApplicationRequest } }
    }
  },
  responses: {
    201: jsonResponse("The created application", CreateApplicationSuccess),
    400: jsonResponse("Validation failed", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not a USER", MessageFailResponse),
    409: jsonResponse("pending application exists, or the cooldown has not passed", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});