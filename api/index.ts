import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../src/app";
import { connectDatabase } from "../src/config/db";

// Build the Express app once per warm lambda instance.
const app = createApp() as unknown as (req: IncomingMessage, res: ServerResponse) => void;

// Cache the DB connection across warm invocations. On failure we reset the
// cache so the next request can retry instead of being stuck with a rejected promise.
let dbConnection: Promise<void> | null = null;

function ensureDatabaseConnection(): Promise<void> {
  if (!dbConnection) {
    dbConnection = connectDatabase().catch((err) => {
      dbConnection = null;
      throw err;
    });
  }
  return dbConnection;
}

function getPath(req: IncomingMessage): string {
  return req.url ?? "/";
}

function shouldConnectDatabase(req: IncomingMessage): boolean {
  if (req.method === "OPTIONS") return false;
  return getPath(req) !== "/health";
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (shouldConnectDatabase(req)) {
      await ensureDatabaseConnection();
    }

    // CORS + OPTIONS are handled inside the Express app (see src/app.ts),
    // so we simply hand the request off to it.
    app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(res, 500, { success: false, message });
  }
}
