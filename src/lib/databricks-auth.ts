/**
 * Resolves a bearer token for calling Databricks REST APIs.
 *
 * Two auth modes, checked in order:
 *  1. Personal access token (local development) — DATABRICKS_TOKEN.
 *  2. OAuth machine-to-machine (Databricks Apps runtime) — the platform
 *     injects DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET for the app's
 *     service principal; we exchange them via the client-credentials flow.
 *
 * OAuth tokens are cached in module scope until shortly before expiry.
 */

interface CachedToken {
  value: string;
  expiresAtMs: number;
}

let cachedOAuthToken: CachedToken | null = null;

const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export function getDatabricksHost(): string {
  const host = process.env.DATABRICKS_HOST;
  if (!host) {
    throw new Error("DATABRICKS_HOST is not set");
  }
  // Users paste the URL straight from the browser, which often carries a
  // path or the ?o=<workspace-id> suffix — keep only the origin.
  const withScheme = host.startsWith("http") ? host : `https://${host}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    throw new Error(`DATABRICKS_HOST is not a valid URL: "${host}"`);
  }
}

export async function getDatabricksToken(): Promise<string> {
  const pat = process.env.DATABRICKS_TOKEN;
  if (pat) {
    return pat;
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "No Databricks credentials found: set DATABRICKS_TOKEN (local dev) " +
        "or run inside a Databricks App (OAuth M2M).",
    );
  }

  if (cachedOAuthToken && Date.now() < cachedOAuthToken.expiresAtMs) {
    return cachedOAuthToken.value;
  }

  const response = await fetch(`${getDatabricksHost()}/oidc/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "all-apis" }),
  });
  if (!response.ok) {
    throw new Error(`Databricks OAuth token exchange failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedOAuthToken = {
    value: payload.access_token,
    expiresAtMs: Date.now() + payload.expires_in * 1000 - EXPIRY_SAFETY_MARGIN_MS,
  };
  return cachedOAuthToken.value;
}
