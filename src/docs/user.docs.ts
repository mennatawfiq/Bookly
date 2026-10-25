import { bearerAuth, registry } from "./registry";
import { jsonResponse } from "./helpers";
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from "./jsend.docs";
import { AllUsersSuccess, MeSuccess } from "./components";
import { ListUsersQuerySchema } from "../schemas/user.schema";

registry.registerPath({
  method: "get",
  path: "/users/me",
  tags: ["Users"],
  summary: "Get my profile",
  description: "Returns the profile of the authenticated user. The password hash is never returned. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse("The authenticated user", MeSuccess),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

registry.registerPath({
  method: "get",
  path: "/users",
  tags: ["Users"],
  summary: "List all users",
  description: "Returns all users, newest first, including deleted (anonymized) accounts, which have `deletedAt` set. Use `role` to return only users with that role. Requires the ADMIN role. A page after the last one returns an empty list.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: ListUsersQuerySchema },
  responses: {
    200: jsonResponse("List of users", AllUsersSuccess),
    400: jsonResponse("Invalid role value", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me",
  tags: ["Users"],
  summary: "Delete my account",
  description: "Deletes the authenticated user's account by anonymizing it. The name, email and password are replaced, and the user can no longer log in, including with tokens already issued. Upcoming `CONFIRMED` bookings are cancelled and their tickets are returned to stock. A `PENDING` organizer application is rejected. Past bookings, tickets, events and applications are kept and show the user as \"Deleted user\". An organizer with an upcoming or running published event cannot delete their account until it is cancelled or has ended. The only admin cannot delete their account. Requires authentication.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    204: { description: "Account deleted successfully" },
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    404: jsonResponse("User not found", MessageFailResponse),
    409: jsonResponse("The organizer has an upcoming or running event, or the user is the only admin", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});