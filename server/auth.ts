import { randomBytes } from "crypto";
import passport from "passport";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express } from "express";
import { storage } from "./storage";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
    }
  }
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (isProduction && !sessionSecret) {
    throw new Error(
      "SESSION_SECRET must be set in production (generate one with: openssl rand -hex 32)",
    );
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || "budget-wise-dev-secret",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    cookie: {
      secure: isProduction ? "auto" : false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, { id: user.id, email: user.email });
    } catch (error) {
      done(error);
    }
  });
}
