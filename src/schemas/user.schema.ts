import { z } from "zod";
import { UserRole } from "../../prisma/generated/enums";

export const UserSchema = z.object({
  id: z.uuid().meta({ example: "7b0f6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
  name: z.string().meta({ example: "Jane Doe" }),
  email: z.email().meta({ example: "jane@example.com" }),
  role: z.enum(UserRole).meta({ example: "USER" }),
  createdAt: z.iso.datetime().meta({ example: "2026-10-02T09:30:00.000Z" }),
});