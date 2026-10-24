import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { ApplicationIdParam, CreateApplicationRequest, CreateApplicationSuccess, MyApplicationsSuccess, MyApplicationSuccess } from "./components";

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

registry.registerPath({
  method: "get",
  path: "/organizer-applications/{applicationId}",
  tags: ["Organizer Applications"],
  summary: "Get an application",
  description: "Returns one organizer application, including the admin's `reviewNote` once it is reviewed. Allowed for the user who created it and for admins. Anyone else gets a 404, the same as when the application does not exist. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: ApplicationIdParam },
  responses: {
    200: jsonResponse("The application", MyApplicationSuccess),
    400: jsonResponse("Invalid applicationId", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("Application not found, or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});