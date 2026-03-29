import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getDb } from "./db/schema";

import authRouter from "./routes/auth";
import albumsRouter from "./routes/albums";
import picksRouter from "./routes/picks";
import configRouter from "./routes/config";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Initialize DB
getDb();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/albums", albumsRouter);
app.use("/api/picks", picksRouter);
app.use("/api/config", configRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Crate server running on http://localhost:${PORT}`);
});

export default app;
