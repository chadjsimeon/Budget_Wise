import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createHash } from "crypto";
import type { Express } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
    }
  }
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "budget-wise-secret-key-change-in-production",
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const hashedPassword = hashPassword(password);
        if (user.password !== hashedPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, { id: user.id, username: user.username });
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, { id: user.id, username: user.username });
    } catch (error) {
      done(error);
    }
  });
}
