import { UserRole } from "../../prisma/generated/enums";


export interface AuthenticatedUser {
  id: string;
  role: UserRole
}

export type OwnableDelegate<T> = {
  findUnique: (args: { where: { id: string } }) => Promise<T | null>;
};

export type RequireOwnershipConfig<T> = {
  model: OwnableDelegate<T>;
  paramName: string;
  ownerField: keyof T;
  resourceName: string;
};