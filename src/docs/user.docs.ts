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
  description: "Returns all users, newest first, including deleted (anonymized) accounts, which have `deletedAt` set. Use `role` to return only users with that role. Requires the ADMIN role.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: ListUsersQuerySchema },
  // later: pagination and limiting
  responses: {
    200: jsonResponse("List of users", AllUsersSuccess),
    400: jsonResponse("Invalid role value", ValidationFailResponse),
    401: jsonResponse("Missing, invalid, or expired token", MessageFailResponse),
    403: jsonResponse("Not an ADMIN", MessageFailResponse),
    500: jsonResponse("Internal server error", ServerErrorResponse),
  },
});