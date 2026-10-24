import Router from "express";
import { authenticate, authorize } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/asyncHandler";
import { getMe, getUsers } from "../controllers/user.controllers";

const router = Router();

router.get("/", authenticate, authorize("ADMIN"), asyncHandler(getUsers));

router.get("/me", authenticate, asyncHandler(getMe));


export default router;

// DELETE /useres/me
// PATCH /users/me // change name or password
