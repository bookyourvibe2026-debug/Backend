import type { IncomingMessage, ServerResponse } from "http";

let dbConnection: Promise<void> | null = null;
let appPromise: Promise<((req: IncomingMessage, res: ServerResponse) => void)> | null = null;

function ensureDatabaseConnection(): Promise<void> {
  if (!dbConnection) {
    dbConnection = import("../src/config/db").then(({ connectDatabase }) => connectDatabase());
  }
  return dbConnection;
}

/** Hard-coded origins that are ALWAYS allowed (no env-var parsing issues on Vercel). */
const HARDCODED_ORIGINS = [
  "http://localhost:3000",
  "https://bookyourvibe.in",
  "https://www.bookyourvibe.in",
  "https://frontend-wedc.vercel.app",
];

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Merge hardcoded + env-var origins (deduplicated)
  return Array.from(new Set([...HARDCODED_ORIGINS, ...fromEnv]));
}

function isAllowedOrigin(origin: string): boolean {
  return getAllowedOrigins().includes(origin);
}

function getPath(req: IncomingMessage): string {
  return req.url ?? "/";
}

function shouldConnectDatabase(req: IncomingMessage): boolean {
  if (req.method === "OPTIONS") return false;
  return getPath(req) !== "/health";
}

async function getApp(): Promise<(req: IncomingMessage, res: ServerResponse) => void> {
  if (!appPromise) {
    appPromise = import("../src/app").then(({ createApp }) => createApp() as unknown as (req: IncomingMessage, res: ServerResponse) => void);
  }
  return appPromise;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;

    if (req.method === "OPTIONS") {
      if (origin && isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Vary", "Origin");
        res.statusCode = 204;
        res.end();
        return;
      }

      res.statusCode = 403;
      res.end("Not allowed by CORS");
      return;
    }

    if (shouldConnectDatabase(req)) {
      await ensureDatabaseConnection();
    }

    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      const onDone = () => resolve();
      res.once("finish", onDone);
      res.once("close", onDone);
      try {
        app(req, res);
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(res, 500, { success: false, message });
  }
}
