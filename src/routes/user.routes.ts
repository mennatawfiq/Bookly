import Router from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll users" });
});

router.get("/:userId", (req, res) => {
  res.json({ userId: req.params.userId });
});

router.post("/", (req, res) => {
  res.json({ message: "one user created" });
});

export default router;

