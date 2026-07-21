import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rateLimit.middleware";
import routes from "./routes";
import { ApiError } from "./utils/ApiError";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

/** Always-allowed origins — hardcoded so Vercel env-var parsing can never break them. */
const ALLOWED_ORIGINS = Array.from(new Set([
  "http://localhost:3001",
  "https://bookyourvibe.in",
  "https://www.bookyourvibe.in",
  "https://frontend-wedc.vercel.app",
  ...env.corsOrigins, // still picks up anything extra from the env var
]));

  const corsOptions = {
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "Not allowed by CORS"));
    },
    credentials: true,
  };

  app.use(helmet({ hsts: env.isProduction }));
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(compression());
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(globalRateLimiter);

  app.use(env.API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Safety net for Vercel: if the platform ever loads this module as a serverless
// entrypoint (it shouldn't — all traffic is rewritten to /api/index), a valid
// function default export prevents the "default export must be a function or
// server" crash. Nothing routes here, so it is only ever validated, never invoked.
export default createApp;
