import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getAllConfig, setConfig } from "../db/queries";

const router = Router();
router.use(requireAuth);

// GET /api/config
router.get("/", (req, res) => {
  const config = getAllConfig(req.session.userId!);
  res.json({ config });
});

// PATCH /api/config
router.patch("/", (req, res) => {
  const updates = req.body as Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    setConfig(req.session.userId!, key, value);
  }
  const config = getAllConfig(req.session.userId!);
  res.json({ config });
});

export default router;
