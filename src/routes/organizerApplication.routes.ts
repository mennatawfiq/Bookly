import Router from "express";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { applicationIdParamSchema, ApproveApplicationSchema, CreateApplicationSchema, ListApplicationsQuerySchema, RejectApplicationSchema } from "../schemas/organizerApplication.schema";
import { asyncHandler } from "../middlewares/asyncHandler";
import { approveApplication, getApplication, getApplications, getMyApplications, postApplication, rejectApplication } from "../controllers/organizerApplication.controllers";
import prisma from "../lib/prisma";

const router = Router();

router.post("/", authenticate, authorize('USER'), validate(CreateApplicationSchema), asyncHandler(postApplication));

router.get("/mine", authenticate, asyncHandler(getMyApplications));

router.get("/:applicationId", authenticate, validate(applicationIdParamSchema, "params"),
  requireOwnership({ model: prisma.organizerApplication, paramName: "applicationId", ownerField: "userId", resourceName: "Application" }),
  asyncHandler(getApplication)
);

router.get("/", authenticate, authorize('ADMIN'), asyncHandler(getApplications));

router.post("/:applicationId/approve", authenticate, authorize('ADMIN'), validate(applicationIdParamSchema, "params"),
  validate(ApproveApplicationSchema), asyncHandler(approveApplication));

router.post("/:applicationId/reject", authenticate, authorize('ADMIN'), validate(applicationIdParamSchema, "params"),
  validate(RejectApplicationSchema), asyncHandler(rejectApplication));

export default router;