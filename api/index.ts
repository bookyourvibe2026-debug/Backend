import type { IncomingMessage, ServerResponse } from "http";

let dbConnection: Promise<void> | null = null;
let appPromise: Promise<((req: IncomingMessage, res: ServerResponse) => void)> | null = null;

function ensureDatabaseConnection(): Promise<void> {
  if (!dbConnection) {
    dbConnection = import("../src/config/db").then(({ connectDatabase }) => connectDatabase());
  }
  return dbConnection;
}

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  return getAllowedOrigins().includes(origin);
}

async function getApp(): Promise<(req: IncomingMessage, res: ServerResponse) => void> {
  if (!appPromise) {
    appPromise = import("../src/app").then(({ createApp }) => createApp() as unknown as (req: IncomingMessage, res: ServerResponse) => void);
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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

  await ensureDatabaseConnection();

  const app = await getApp();
  app(req, res);
}
