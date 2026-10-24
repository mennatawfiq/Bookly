import { z } from "zod";
import { ApplicationStatus } from "../../prisma/generated/enums";

export const CreateApplicationSchema = z.object({
  organizationName: z.string().trim().min(2).max(100).meta({ example: "Cairo Live Events" }),
  description: z.string().trim().min(20).max(1000).meta({
    example: "We organize jazz and indie concerts across Cairo every month.",
  })
});

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

export const ApplicationSchema = CreateApplicationSchema.extend({
  id: z.uuid().meta({ example: "1356e24a-d2da-4f15-80dd-89f0bbbfbc19" }),
  status: z.enum(ApplicationStatus).meta({ example: 'PENDING' }),
  createdAt: z.iso.datetime({ offset: true }).meta({ example: "2026-10-05T10:00:00.000Z" }),
});

export const ApplicationItemSchema = ApplicationSchema.extend({
  reviewNote: z.string().nullable().meta({ example: null }),
  reviewedAt: z.iso.datetime().nullable().meta({ example: null }),
});

export const applicationIdParamSchema = z.object({
  applicationId: z.uuid().meta({
    description: "The unique identifier of the application",
    example: "1356e24a-d2da-4f15-80dd-89f0bbbfbc19",
  }),
});

export const ListApplicationsQuerySchema = z.object({
  status: z.enum(ApplicationStatus).optional().meta({
    description: "Only return applications with this status",
    example: "PENDING",
  }),
});

export type ListApplicationsQuery = z.infer<typeof ListApplicationsQuerySchema>;

export const AdminApplicationItemSchema = ApplicationItemSchema.extend({
  user: z.object({
    id: z.uuid().meta({ example: "7b0f6c1e-3d2a-4a57-9c1e-2f4a8e6d1b90" }),
    name: z.string().meta({ example: "Jane Doe" }),
    email: z.email().meta({ example: "jane@example.com" }),
  }),
});

export const ApproveApplicationSchema = z.object({
  reviewNote: z.string().trim().min(2).max(1000).optional().meta({ example: "Meets all requirements" })
});

export type ApproveApplication = z.infer<typeof ApproveApplicationSchema>;

export const RejectApplicationSchema = z.object({
  reviewNote: z.string().trim().min(2).max(1000).meta({ example: "Does not meet all requirements" })
});

export type RejectApplication = z.infer<typeof RejectApplicationSchema>;
