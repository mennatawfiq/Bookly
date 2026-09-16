import Router from "express";

const router = Router();

router.post("/register", (req, res) => {
  res.json({ message: "one user created" });
});

router.post("/login", (req, res) => {
  res.json({ message: "one user created" });
});

export default router;

