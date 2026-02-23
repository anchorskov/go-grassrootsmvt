const SESSION_COOKIE_NAME = "gmvt_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const COOKIE_DOMAIN = "go.grassrootsmvt.org";

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    out[rawName] = rawValue.join("=");
  }
  return out;
}

function getCookieDomainAndSecurity(request) {
  const { hostname } = new URL(request.url);
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return {
    domain: isLocal ? null : COOKIE_DOMAIN,
    secure: !isLocal,
  };
}

function buildSessionCookie(sessionId, request, maxAgeSeconds) {
  const { domain, secure } = getCookieDomainAndSecurity(request);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

export function getSessionIdFromRequest(request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE_NAME] ? decodeURIComponent(cookies[SESSION_COOKIE_NAME]) : null;
}

export async function createSession(env, userId, ttlSeconds = SESSION_TTL_SECONDS) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await env.go_db
    .prepare("INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, userId, expiresAt)
    .run();
  return { sessionId, expiresAt };
}

export async function getSessionUser(request, env) {
  if (!env?.go_db || typeof env.go_db.prepare !== "function") return null;
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const row = await env.go_db
    .prepare(
      "SELECT s.session_id, s.user_id, s.expires_at, u.display_name FROM sessions s JOIN users u ON u.user_id = s.user_id WHERE s.session_id = ? LIMIT 1"
    )
    .bind(sessionId)
    .first();

  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.go_db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
    return null;
  }

  return {
    session_id: row.session_id,
    user_id: row.user_id,
    display_name: row.display_name || null,
    expires_at: row.expires_at,
  };
}

export function setSessionCookie(response, sessionId, request) {
  response.headers.append("set-cookie", buildSessionCookie(sessionId, request, SESSION_TTL_SECONDS));
}

export function clearSessionCookie(response, request) {
  response.headers.append("set-cookie", buildSessionCookie("", request, 0));
}
