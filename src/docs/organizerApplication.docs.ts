import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { CreateApplicationRequest, CreateApplicationSuccess, MyApplicationsSuccess } from "./components";

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


registry.registerPath({
  method: "get",
  path: "/organizer-applications/mine",
  tags: ["Organizer Applications"],
  summary: "List my applications",
  description: "Returns all organizer applications of the authenticated user, newest first, including approved and rejected ones. `reviewNote` is the admin's reason, and it is `null` until the application is reviewed. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  // request: { // later: pagination and limiting
  // },
  responses: {
    200: jsonResponse("List of your applications", MyApplicationsSuccess),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});