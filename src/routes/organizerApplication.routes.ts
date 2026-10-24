import Router from "express";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { CreateApplicationSchema } from "../schemas/organizerApplication.schema";
import { asyncHandler } from "../middlewares/asyncHandler";
import { getMyApplications, postApplication } from "../controllers/organizerApplication.controllers";

const router = Router();

router.post("/", authenticate, authorize('USER'), validate(CreateApplicationSchema), asyncHandler(postApplication));

router.get("/mine", authenticate, asyncHandler(getMyApplications));

// GET /:id
// GET / //admin
// POST /:id/approve //admin
// POST /:id/reject //admin

export default router;