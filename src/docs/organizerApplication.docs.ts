import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { AllApplicationsSuccess, ApplicationIdParam, ApproveApplicationRequest, CreateApplicationRequest, CreateApplicationSuccess, MyApplicationsSuccess, ApplicationSuccess, RejectApplicationRequest } from "./components";
import { ListApplicationsQuerySchema } from "../schemas/organizerApplication.schema";

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
    409: jsonResponse("Pending application exists, or the cooldown has not passed", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  }
});

registry.registerPath({
  method: "get",
  path: "/organizer-applications/mine",
  tags: ["Organizer Applications"],
  summary: "List my applications",
  description: "Returns all organizer applications of the authenticated user, newest first, including approved and rejected ones. `reviewNote` is the admin's reason, and it is `null` until the application is reviewed. Requires authentication. A page after the last one returns an empty list.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: ListApplicationsQuerySchema },
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
    200: jsonResponse("The application", ApplicationSuccess),
    400: jsonResponse("Invalid applicationId", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("Application not found, or you are not allowed to see it", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

registry.registerPath({
  method: "get",
  path: "/organizer-applications",
  tags: ["Organizer Applications"],
  summary: "List all applications",
  description: "Returns all organizer applications, newest first, with the name and email of the applicant. Use `status` to return only `PENDING`, `APPROVED` or `REJECTED` applications. Requires the ADMIN role. A page after the last one returns an empty list.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: ListApplicationsQuerySchema },
  responses: {
    200: jsonResponse("List of applications", AllApplicationsSuccess),
    400: jsonResponse("Invalid status value", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

registry.registerPath({
  method: "post",
  path: "/organizer-applications/{applicationId}/approve",
  tags: ["Organizer Applications"],
  summary: "Approve an application",
  description: "Approves a `PENDING` organizer application. In one transaction, the application becomes `APPROVED`, the reviewing admin and the review time are recorded, and the applicant's role changes to `ORGANIZER`. `reviewNote` is optional. A reviewed application cannot be changed again. Requires the ADMIN role.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: ApplicationIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: ApproveApplicationRequest } },
    },
  },
  responses: {
    200: jsonResponse("The approved application", ApplicationSuccess),
    400: jsonResponse("Validation failed", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    404: jsonResponse("Application not found, or the applicant's account was deleted", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

registry.registerPath({
  method: "post",
  path: "/organizer-applications/{applicationId}/reject",
  tags: ["Organizer Applications"],
  summary: "Reject an application",
  description: "Rejects a `PENDING` organizer application. `reviewNote` is required, and the applicant can read it. The rejection time starts the 3-day period after which the user can apply again. A reviewed application cannot be changed again. Requires the ADMIN role.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: ApplicationIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: RejectApplicationRequest } },
    },
  },
  responses: {
    200: jsonResponse("The rejected application", ApplicationSuccess),
    400: jsonResponse("Validation failed, for example a missing `reviewNote`", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    404: jsonResponse("Application not found", MessageFailResponse),
    409: jsonResponse("The application is not `PENDING`", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});