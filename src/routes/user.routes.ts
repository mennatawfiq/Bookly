import Router from "express";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll users" });
});

// router.get("/:userId", authenticate);

router.post("/", (req, res) => {
  res.json({ message: "one user created" });
});

export default router;

