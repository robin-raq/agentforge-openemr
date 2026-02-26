import express from "express";
import cors from "cors";
import path from "path";
import { chat } from "./agent";
import { PORT, getLangfuseCallbacks, initLangfuse, warnInsecureTls } from "./config";

function getOpenEmrOrigins(): string | undefined {
  const val = process.env.OPENEMR_ORIGINS;
  if (!val || val.trim() === "") return undefined;
  return val.trim();
}

function getAllowedOrigins(): string[] {
  const val = process.env.ALLOWED_ORIGINS;
  if (!val || val.trim() === "") return [];
  return val.split(",").map((o) => o.trim()).filter(Boolean);
}

type HistoryEntry = { role: "user" | "assistant"; content: string };

const MAX_SESSIONS = 1000;
const MAX_HISTORY_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const sessionHistory: Map<string, { entries: HistoryEntry[]; lastAccess: number }> = new Map();
const rateLimitMap: Record<string, { count: number; resetAt: number }> = {};

export function getSessionHistory(sessionId: string): HistoryEntry[] {
  const session = sessionHistory.get(sessionId);
  if (!session) return [];
  return session.entries.slice(-MAX_HISTORY_LENGTH);
}

export function setSessionHistory(sessionId: string, entries: HistoryEntry[]): void {
  sessionHistory.set(sessionId, {
    entries: entries.slice(-MAX_HISTORY_LENGTH),
    lastAccess: Date.now(),
  });
}

export function getSessionCount(): number {
  return sessionHistory.size;
}

export function evictOldSessions(): void {
  if (sessionHistory.size <= MAX_SESSIONS) return;
  const sorted = [...sessionHistory.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess
  );
  const toRemove = sorted.slice(0, sessionHistory.size - MAX_SESSIONS);
  for (const [key] of toRemove) {
    sessionHistory.delete(key);
  }
}

function rateLimit(sessionId: string): boolean {
  const now = Date.now();
  if (!rateLimitMap[sessionId] || now > rateLimitMap[sessionId].resetAt) {
    rateLimitMap[sessionId] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return true;
  }
  rateLimitMap[sessionId].count++;
  return rateLimitMap[sessionId].count <= RATE_LIMIT_PER_MINUTE;
}

export function createApp(): express.Express {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length > 0) {
    app.use(cors({ origin: allowedOrigins, credentials: true }));
  }
  app.use(express.json({ limit: "50kb" }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    const openEmrOrigins = getOpenEmrOrigins();
    const framePolicy = openEmrOrigins
      ? `frame-ancestors ${openEmrOrigins}`
      : "frame-ancestors 'none'";
    if (!openEmrOrigins) {
      res.setHeader("X-Frame-Options", "DENY");
    }
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; ${framePolicy}`
    );
    next();
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, session_id, patient_id } = req.body;
      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "message is required" });
        return;
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({
          error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
        });
        return;
      }

      const sessionId = session_id || `session-${Date.now()}`;

      if (!rateLimit(sessionId)) {
        res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
        return;
      }

      let effectiveMessage = message;
      if (patient_id && typeof patient_id === "string" && patient_id.trim() !== "") {
        effectiveMessage = `[Context: Currently viewing patient ${patient_id.trim()}]\n\n${message}`;
      }

      const history = getSessionHistory(sessionId);
      const callbacks = getLangfuseCallbacks(sessionId);

      const result = await chat(effectiveMessage, sessionId, history, callbacks);

      // Flush Langfuse traces before responding
      for (const cb of callbacks) {
        if (cb && typeof (cb as any).flushAsync === "function") {
          await (cb as any).flushAsync();
        }
      }

      // chat() mutates history with user + assistant messages
      setSessionHistory(sessionId, history);
      evictOldSessions();

      res.json({
        response: result.response,
        tool_calls: result.toolCalls,
        verification_flags: result.safetyAlerts,
      });
    } catch (err) {
      console.error("Chat error:", err);
      res.status(500).json({
        error: "An error occurred processing your request. Please try again.",
      });
    }
  });

  // Feedback endpoint
  app.post("/api/feedback", (req, res) => {
    const { session_id, message_index, rating, comment } = req.body;
    if (!session_id || typeof session_id !== "string") {
      res.status(400).json({ error: "session_id is required" });
      return;
    }
    if (!sessionHistory.has(session_id)) {
      res.status(404).json({ error: "Unknown session" });
      return;
    }
    console.log("Feedback received:", { session_id, message_index, rating, comment });
    res.json({ status: "ok" });
  });

  app.use(express.static(path.join(__dirname, "../public")));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  });

  return app;
}

// Only start listening when run directly (not imported by tests)
if (!process.env.VITEST) {
  warnInsecureTls();
  initLangfuse();
  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpenEMR Clinical Query Agent running on http://localhost:${PORT}`);
  });
}
