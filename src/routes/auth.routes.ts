import Router from "express";
import { register } from "../controllers/auth.controllers";
import { validate } from "../middlewares/validate";
import { registerSchema } from "../validators/auth.validator";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.post("/register", validate(registerSchema), asyncHandler(register));

// router.post("/login");

export default router;

