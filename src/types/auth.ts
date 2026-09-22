import { UserRole } from "../../prisma/generated/enums";


export interface AuthenticatedUser {
  id: string;
  role: UserRole
}