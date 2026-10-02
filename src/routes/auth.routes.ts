import Router from "express";
import { register, login } from "../controllers/auth.controllers";
import { validate } from "../middlewares/validate";
import { registerSchema, loginSchema } from "../schemas/auth.schema";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.post("/register", validate(registerSchema), asyncHandler(register));

router.post("/login", validate(loginSchema), asyncHandler(login));

export default router;

