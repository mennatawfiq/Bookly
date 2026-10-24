import Router from "express";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { applicationIdParamSchema, CreateApplicationSchema } from "../schemas/organizerApplication.schema";
import { asyncHandler } from "../middlewares/asyncHandler";
import { getApplication, getMyApplications, postApplication } from "../controllers/organizerApplication.controllers";
import prisma from "../lib/prisma";

const router = Router();

router.post("/", authenticate, authorize('USER'), validate(CreateApplicationSchema), asyncHandler(postApplication));

router.get("/mine", authenticate, asyncHandler(getMyApplications));

router.get("/:applicationId", authenticate, validate(applicationIdParamSchema, "params"),
  requireOwnership({ model: prisma.organizerApplication, paramName: "applicationId", ownerField: "userId", resourceName: "Application" }),
  asyncHandler(getApplication)
);

// GET / //admin
// POST /:id/approve //admin
// POST /:id/reject //admin

export default router;