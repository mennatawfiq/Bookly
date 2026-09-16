import Router from "express";
import { register } from "../controllers/auth.controllers";
import { validate } from "../middlewares/validate";
import { registerSchema } from "../validators/auth.validator";

const router = Router();

router.post("/register", validate(registerSchema), register);

// router.post("/login");

export default router;

