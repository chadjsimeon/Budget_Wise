import { createHash, randomBytes } from "crypto";

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Only this digest is stored. The token is 256 bits of randomness, so a plain
 * sha256 is enough: a leaked database can't be turned back into usable links.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Base URL for links we email out. In production this never comes from the
 * request: the Host header is attacker-controlled, and a forged one would put
 * a valid token behind a link to someone else's site.
 * Returns undefined when production has no configured base URL.
 */
export function resetLinkBase(
  env: NodeJS.ProcessEnv,
  requestOrigin: string,
): string | undefined {
  const configured = env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  // Set by Railway to the service's public hostname.
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) return `https://${railwayDomain}`;
  if (env.NODE_ENV === "production") return undefined;
  return requestOrigin;
}
