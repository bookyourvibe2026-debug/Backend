import type { IncomingMessage, ServerResponse } from "http";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

// The Express app and DB connection are loaded lazily (inside the handler) so
// that a misconfigured env or an unreachable database can NEVER crash the whole
// function at cold-start. The health check below stays alive no matter what.
let cachedApp: NodeHandler | null = null;
let dbConnection: Promise<void> | null = null;

function loadApp(): NodeHandler {
  if (!cachedApp) {
    const { createApp } = require("../src/app") as typeof import("../src/app");
    cachedApp = createApp() as unknown as NodeHandler;
  }
  return cachedApp;
}

function ensureDatabaseConnection(): Promise<void> {
  if (!dbConnection) {
    const { connectDatabase } = require("../src/config/db") as typeof import("../src/config/db");
    dbConnection = connectDatabase().catch((err) => {
      // Reset so the next request retries instead of being stuck on a rejected promise.
      dbConnection = null;
      throw err;
    });
  }
  return dbConnection;
}

function getPath(req: IncomingMessage): string {
  const url = req.url ?? "/";
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

function getDatabaseState(): string {
  try {
    const mongoose = require("mongoose");
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    return states[mongoose.connection?.readyState] ?? "unknown";
  } catch {
    return "unavailable";
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = getPath(req);

  // ---- Always-alive health/status endpoint -------------------------------
  // Responds instantly on `/` and `/health` without touching the DB, so you
  // can always confirm the backend is up (and see the DB connection state).
  if (req.method === "GET" && (path === "/" || path === "/health")) {
    sendJson(res, 200, {
      success: true,
      status: "ok",
      service: "byv-backend",
      database: getDatabaseState(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ---- Everything else goes to the Express app ---------------------------
  try {
    if (req.method !== "OPTIONS") {
      await ensureDatabaseConnection();
    }
    // CORS + OPTIONS are handled inside the Express app (see src/app.ts).
    const app = loadApp();
    app(req, res);
  } catch (error) {
    // Turn opaque FUNCTION_INVOCATION_FAILED crashes into a readable JSON error
    // so you can see exactly what the backend is facing.
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(res, 500, { success: false, error: message, database: getDatabaseState() });
  }
}
