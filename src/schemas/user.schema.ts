import { z } from "zod";
import { UserRole } from "../../prisma/generated/enums";

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(UserRole),
  createdAt: z.iso.datetime(),
});