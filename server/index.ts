import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { runMigrations } from "./migrate";
import { wrapLegacyPasswordHashes } from "./password";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

process.on("unhandledRejection", (reason) => {
  // Log without crashing: a stray rejected promise shouldn't take down the
  // service (Railway stops restarting after 3 failures).
  console.error("[fatal] unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  helmet({
    // CSP only in production — the Vite dev server needs inline scripts for HMR.
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              "default-src": ["'self'"],
              "script-src": ["'self'"],
              // 'unsafe-inline' styles: Radix UI and the fonts stylesheet need it
              "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              "font-src": ["'self'", "https://fonts.gstatic.com"],
              "img-src": ["'self'", "data:", "blob:"],
              // service worker fetches the Google Fonts stylesheet for its runtime cache
              "connect-src": ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
              "worker-src": ["'self'"],
              "manifest-src": ["'self'"],
            },
          }
        : false,
    // COEP would block the cross-origin font/PWA assets
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const logResponseBodies = process.env.NODE_ENV !== "production";

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Response bodies carry the user's entire financial dataset — never write
  // them to production logs. Auth responses are excluded even in dev.
  if (logResponseBodies && !path.startsWith("/api/auth")) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await runMigrations();
  await wrapLegacyPasswordHashes();
  setupAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error(`[error] ${status}`, err.stack || err);

    if (res.headersSent) {
      return;
    }
    // Don't leak internal error details (DB constraint text, driver messages)
    // to clients on unexpected failures.
    const message =
      status < 500 ? err.message || "Request failed" : "Internal Server Error";
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5050", 10);
  httpServer.listen(
    port,
    "0.0.0.0",
    () => {
      log(`serving on port ${port}`);
    },
  );
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
