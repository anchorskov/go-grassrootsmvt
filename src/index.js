/* src/index.js */

import {
  createSession,
  getSessionIdFromRequest,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
} from "./auth/session.js";
import {
  getRegistrationOptions,
  consumeChallenge,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
} from "./auth/webauthn.js";
import { notifyAdminMissionCompletion } from "./notify/admin-email.js";

const ROLES = [
  { name: "Hand", slug: "hand", minTier: 1 },
  { name: "Specialist", slug: "specialist", minTier: 1 },
  { name: "Dispatcher", slug: "dispatcher", minTier: 1 },
  { name: "Scout", slug: "scout", minTier: 2 },
  { name: "Land Man", slug: "land-man", minTier: 2 },
  { name: "Support", slug: "support", minTier: 3 },
  { name: "Foreman", slug: "foreman", minTier: 4 },
  { name: "Campaign Lead", slug: "campaign-lead", minTier: 5 },
];
const HELP_MESSAGE_MAX_LEN = 2000;

function htmlPage(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 16px; line-height: 1.35; }
    .wrap { max-width: 820px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    p { margin: 10px 0; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 14px; }
    @media (min-width: 640px) { .grid { grid-template-columns: 1fr 1fr; } }
    a.btn, button.btn {
      display: block; text-decoration: none; text-align: center;
      padding: 12px 14px; border-radius: 10px;
      border: 1px solid #ddd; color: #111; background: #fff;
      font-weight: 600; cursor: pointer;
    }
    a.btn:hover, button.btn:hover { background: #f6f6f6; }
    .card { border: 1px solid #eee; border-radius: 12px; padding: 14px; background: #fff; }
    .small { font-size: 14px; color: #444; }
    label { display:block; font-weight:600; margin-top: 10px; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 10px; box-sizing: border-box; }
    textarea { min-height: 110px; }
    .row { display:flex; gap: 10px; flex-wrap: wrap; }
    .row > * { flex: 1 1 220px; }
    .toplinks { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .error { color: #b00020; }
    .ok { color: #106d2d; }
  </style>
</head>
<body>
  <div class="wrap">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getRoleBySlug(roleSlug) {
  return ROLES.find((r) => r.slug === roleSlug) || null;
}

function isRoleAllowedForTier(roleSlug, tier) {
  const role = getRoleBySlug(roleSlug);
  if (!role) return false;
  return tier >= role.minTier;
}

function formatTierLabel(tier) {
  if (tier <= 0) return "Visitor";
  return `Tier ${tier}`;
}

async function getViewerContext(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) {
    return { sessionUser: null, tier: 0, tierLabel: "Visitor" };
  }

  let tier = 1;
  try {
    const row = await env.go_db
      .prepare("SELECT COALESCE(tier, 1) AS tier FROM users WHERE user_id = ? LIMIT 1")
      .bind(sessionUser.user_id)
      .first();
    if (row && Number.isFinite(Number(row.tier))) {
      tier = Number(row.tier);
    }
  } catch {
    tier = 1;
  }

  return {
    sessionUser,
    tier,
    tierLabel: formatTierLabel(tier),
  };
}

function rolesHtml(viewerTier, viewerTierLabel) {
  const roleButtons = ROLES.map((r) => {
    const locked = viewerTier < r.minTier;
    if (locked) {
      return `<div class="card">
        <p><strong>${r.name}</strong> <span class="small error">Locked</span></p>
        <button class="btn" type="button" disabled aria-disabled="true">Locked at ${viewerTierLabel}</button>
        <p class="small">Requires Tier ${r.minTier}. <a href="/unlock?role=${encodeURIComponent(r.slug)}">How to unlock</a></p>
      </div>`;
    }
    return `<a class="btn" href="/mission?role=${encodeURIComponent(r.slug)}">${r.name}</a>`;
  }).join("");

  return htmlPage(
    "Choose your role | go.grassrootsmvt.org",
    `<h1>Choose your role</h1>
     <p>No one joins and gets lost. Everyone gets a mission. Current access: <strong>${escapeHtml(viewerTierLabel)}</strong>.</p>
     <div class="grid">${roleButtons}</div>
     <div class="toplinks">
       <a class="btn" href="/">Home</a>
       <a class="btn" href="/help">Need support</a>
     </div>`
  );
}

function helpHtml() {
  return htmlPage(
    "Support | go.grassrootsmvt.org",
    `<h1>Support</h1>
     <div class="card">
       <p><strong>No one joins and gets lost.</strong> If something blocks progress, send a note and we respond.</p>
       <p class="small">This form posts to <code>/api/help</code>.</p>

       <form method="post" action="/api/help">
         <div class="row">
           <div>
             <label for="name">Name</label>
             <input id="name" name="name" autocomplete="name" />
           </div>
           <div>
             <label for="town">Town</label>
             <input id="town" name="town" />
           </div>
         </div>

         <label for="message">What is blocking progress</label>
         <textarea id="message" name="message" required></textarea>

         <div style="margin-top: 12px;">
           <button class="btn" type="submit">Send</button>
         </div>
       </form>
     </div>

     <div class="toplinks">
       <a class="btn" href="/roles">Choose role</a>
       <a class="btn" href="/">Home</a>
     </div>`
  );
}

function missionHtml(role, mission) {
  const safeRoleSlug = encodeURIComponent(role.role_slug);
  const safeMissionId = encodeURIComponent(mission.mission_id);
  return htmlPage(
    `Mission | ${role.role_name}`,
    `<h1>Mission 1</h1>
     <p class="small">Role: <strong>${escapeHtml(role.role_name)}</strong></p>

     <div class="card">
       <p><strong>${escapeHtml(mission.title)}</strong></p>
       <p>${escapeHtml(mission.instructions)}</p>
       <div style="margin-top: 12px;">
         <a class="btn" href="/log?role=${safeRoleSlug}&mission=${safeMissionId}">Log Win</a>
       </div>
     </div>

     <div class="toplinks">
       <a class="btn" href="/roles">Back to roles</a>
       <a class="btn" href="/help">Need support</a>
     </div>`
  );
}

function logHtml(roleSlug, missionId, user) {
  return htmlPage(
    "Log Mission Win | go.grassrootsmvt.org",
    `<h1>Log Win</h1>
     <p class="small">Signed in as ${escapeHtml(user.display_name || user.user_id)}</p>
     <div class="card">
       <form method="post" action="/api/missions/complete">
         <input type="hidden" name="role_slug" value="${escapeHtml(roleSlug)}" />
         <input type="hidden" name="mission_id" value="${escapeHtml(missionId)}" />

         <label for="town">Town</label>
         <input id="town" name="town" required />

         <label for="contact_count">Contact count (optional)</label>
         <input id="contact_count" name="contact_count" inputmode="numeric" pattern="[0-9]*" />

         <label for="notes">Notes (optional)</label>
         <textarea id="notes" name="notes"></textarea>

         <div style="margin-top: 12px;">
           <button class="btn" type="submit">Submit win</button>
         </div>
       </form>
     </div>
     <div class="toplinks">
       <a class="btn" href="/mission?role=${encodeURIComponent(roleSlug)}">Back to mission</a>
       <a class="btn" href="/api/auth/logout" onclick="event.preventDefault();fetch('/api/auth/logout',{method:'POST'}).then(()=>location.href='/roles');">Logout</a>
     </div>`
  );
}

function roleLockedHtml(roleSlug, viewerTierLabel) {
  const role = getRoleBySlug(roleSlug);
  const roleName = role ? role.name : roleSlug;
  return htmlPage(
    "Role Locked | go.grassrootsmvt.org",
    `<h1>Role locked</h1>
     <div class="card">
       <p><strong>${escapeHtml(roleName)}</strong> is locked at your current level (${escapeHtml(viewerTierLabel)}).</p>
       <p>Use the unlock flow to move this role into your active lane.</p>
     </div>
     <div class="toplinks">
       <a class="btn" href="/unlock?role=${encodeURIComponent(roleSlug)}">How to unlock</a>
       <a class="btn" href="/roles">Back to roles</a>
     </div>`,
  );
}

function unlockHtml(roleSlug, viewerTierLabel, isLoggedIn) {
  const role = getRoleBySlug(roleSlug);
  const roleName = role ? role.name : roleSlug;
  const requiredTier = role ? role.minTier : null;
  const steps = isLoggedIn
    ? "Complete wins consistently, then request promotion from a Foreman or Campaign Lead."
    : "Create an account and complete Mission 1 to begin your progression.";

  return htmlPage(
    "Unlock Role | go.grassrootsmvt.org",
    `<h1>Unlock role access</h1>
     <div class="card">
       <p>Access expands by level as you prove reliable execution.</p>
       <p>Current level: <strong>${escapeHtml(viewerTierLabel)}</strong></p>
       <p>Requested role: <strong>${escapeHtml(roleName)}</strong>${requiredTier ? ` (Tier ${requiredTier})` : ""}</p>
       <p>${escapeHtml(steps)}</p>
       <p class="small">Operational path: finish assigned wins, keep logs complete, and request tier review when ready.</p>
     </div>
     <div class="toplinks">
       ${isLoggedIn ? "" : `<a class="btn" href="/login">Login</a>`}
       <a class="btn" href="/roles">Back to roles</a>
       <a class="btn" href="/help">Need support</a>
     </div>`,
  );
}

function adminHtml() {
  return htmlPage(
    "Admin Tier Management | go.grassrootsmvt.org",
    `<h1>Admin: Tier Management</h1>
     <div class="card">
       <p>Tier 5 only. Promote or adjust volunteer tier access.</p>
       <form method="post" action="/api/admin/tier/set">
         <label for="email">Email (optional if using user_id)</label>
         <input id="email" name="email" type="email" />

         <label for="user_id">User ID (optional if using email)</label>
         <input id="user_id" name="user_id" />

         <label for="tier">New tier (1-5)</label>
         <input id="tier" name="tier" type="number" min="1" max="5" required />

         <label for="note">Note</label>
         <textarea id="note" name="note"></textarea>

         <div style="margin-top: 12px;">
           <button class="btn" type="submit">Set tier</button>
         </div>
       </form>
     </div>
     <div class="toplinks">
       <a class="btn" href="/roles">Back to roles</a>
       <a class="btn" href="/help">Need support</a>
     </div>`,
  );
}

function adminForbiddenHtml() {
  return htmlPage(
    "Admin Forbidden | go.grassrootsmvt.org",
    `<h1>Admin access denied</h1>
     <div class="card">
       <p>This page requires Tier 5 access.</p>
     </div>
     <div class="toplinks">
       <a class="btn" href="/roles">Back to roles</a>
     </div>`,
  );
}

function loginHtml(nextPath) {
  return htmlPage(
    "Passkey Login | go.grassrootsmvt.org",
    `<h1>Sign in</h1>
     <div class="card">
       <p>Use your passkey to continue.</p>
       <button id="loginBtn" class="btn" type="button">Sign in with passkey</button>
       <p id="status" class="small"></p>
       <p class="small">No passkey yet? <a href="/register?next=${encodeURIComponent(nextPath)}">Register</a></p>
     </div>
     <script>
      const nextPath = ${JSON.stringify(nextPath)};
      const statusEl = document.getElementById('status');
      const b64ToBuf = (v) => Uint8Array.from(atob(v.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(v.length/4)*4,'=')), c => c.charCodeAt(0));
      const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');

      async function login() {
        statusEl.textContent = 'Preparing login...';
        const optRes = await fetch('/api/auth/webauthn/login/options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({})
        });
        const optData = await optRes.json();
        if (!optRes.ok) throw new Error(optData.error || 'Failed to start login');

        const publicKey = optData.options;
        publicKey.challenge = b64ToBuf(publicKey.challenge);
        if (Array.isArray(publicKey.allowCredentials)) {
          publicKey.allowCredentials = publicKey.allowCredentials.map((c) => ({ ...c, id: b64ToBuf(c.id) }));
        }

        statusEl.textContent = 'Waiting for passkey...';
        const cred = await navigator.credentials.get({ publicKey });
        const payload = {
          challenge_id: optData.challenge_id,
          next: nextPath,
          response: {
            id: cred.id,
            rawId: bufToB64(cred.rawId),
            type: cred.type,
            response: {
              authenticatorData: bufToB64(cred.response.authenticatorData),
              clientDataJSON: bufToB64(cred.response.clientDataJSON),
              signature: bufToB64(cred.response.signature),
              userHandle: cred.response.userHandle ? bufToB64(cred.response.userHandle) : null,
            },
          },
        };

        const verifyRes = await fetch('/api/auth/webauthn/login/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.ok) throw new Error(verifyData.error || 'Login failed');

        location.href = verifyData.next || '/roles';
      }

      document.getElementById('loginBtn').addEventListener('click', () => {
        login().catch((err) => {
          statusEl.textContent = err.message;
          statusEl.className = 'small error';
        });
      });
     </script>`
  );
}

function registerHtml(nextPath) {
  return htmlPage(
    "Passkey Register | go.grassrootsmvt.org",
    `<h1>Create passkey</h1>
     <div class="card">
       <label for="displayName">Display name</label>
       <input id="displayName" autocomplete="name" placeholder="Your name" />
       <div style="margin-top: 12px;">
         <button id="registerBtn" class="btn" type="button">Register passkey</button>
       </div>
       <p id="status" class="small"></p>
       <p class="small"><a href="/login?next=${encodeURIComponent(nextPath)}">Back to login</a></p>
     </div>
     <script>
      const nextPath = ${JSON.stringify(nextPath)};
      const statusEl = document.getElementById('status');
      const b64ToBuf = (v) => Uint8Array.from(atob(v.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(v.length/4)*4,'=')), c => c.charCodeAt(0));
      const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');

      async function registerPasskey() {
        const displayName = document.getElementById('displayName').value.trim();
        if (!displayName) {
          throw new Error('Display name is required');
        }

        statusEl.textContent = 'Preparing registration...';
        const optRes = await fetch('/api/auth/webauthn/register/options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ display_name: displayName }),
        });
        const optData = await optRes.json();
        if (!optRes.ok) throw new Error(optData.error || 'Failed to start registration');

        const publicKey = optData.options;
        publicKey.challenge = b64ToBuf(publicKey.challenge);
        publicKey.user.id = b64ToBuf(publicKey.user.id);
        if (Array.isArray(publicKey.excludeCredentials)) {
          publicKey.excludeCredentials = publicKey.excludeCredentials.map((c) => ({ ...c, id: b64ToBuf(c.id) }));
        }

        statusEl.textContent = 'Waiting for passkey...';
        const cred = await navigator.credentials.create({ publicKey });
        const payload = {
          challenge_id: optData.challenge_id,
          display_name: displayName,
          next: nextPath,
          response: {
            id: cred.id,
            rawId: bufToB64(cred.rawId),
            type: cred.type,
            response: {
              clientDataJSON: bufToB64(cred.response.clientDataJSON),
              attestationObject: bufToB64(cred.response.attestationObject),
              transports: typeof cred.response.getTransports === 'function' ? cred.response.getTransports() : [],
            },
          },
        };

        const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.ok) throw new Error(verifyData.error || 'Registration failed');

        location.href = verifyData.next || '/roles';
      }

      document.getElementById('registerBtn').addEventListener('click', () => {
        registerPasskey().catch((err) => {
          statusEl.textContent = err.message;
          statusEl.className = 'small error';
        });
      });
     </script>`
  );
}

function redirectToLogin(url) {
  const next = `${url.pathname}${url.search}`;
  const location = `/login?next=${encodeURIComponent(next)}`;
  return Response.redirect(new URL(location, url.origin), 302);
}

async function parseJsonRequest(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function parseBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await parseJsonRequest(request)) || {};
  }
  try {
    const form = await request.formData();
    return {
      email: String(form.get("email") || "").trim(),
      user_id: String(form.get("user_id") || "").trim(),
      tier: String(form.get("tier") || "").trim(),
      note: String(form.get("note") || "").trim(),
    };
  } catch {
    return null;
  }
}

async function serveAsset(request, env, ctx) {
  if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return env.ASSETS.fetch(request, ctx);
  }
  return fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && path === "/roles") {
      const viewer = await getViewerContext(request, env);
      return new Response(rolesHtml(viewer.tier, viewer.tierLabel), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/help") {
      return new Response(helpHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/mission") {
      const role = (url.searchParams.get("role") || "").trim().toLowerCase();
      if (!role) {
        return new Response("Missing role slug.", { status: 400 });
      }

      const viewer = await getViewerContext(request, env);
      if (getRoleBySlug(role) && !isRoleAllowedForTier(role, viewer.tier)) {
        return new Response(roleLockedHtml(role, viewer.tierLabel), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (!env || !env.go_db || typeof env.go_db.prepare !== "function") {
        return new Response("Database binding go_db is not configured.", { status: 500 });
      }

      const roleRow = await env.go_db
        .prepare("SELECT role_slug, role_name FROM roles WHERE role_slug = ? AND is_active = 1 LIMIT 1")
        .bind(role)
        .first();

      if (!roleRow) {
        return new Response("Role not found.", { status: 404 });
      }

      const missionRow = await env.go_db
        .prepare(
          "SELECT mission_id, role_slug, mission_order, title, instructions FROM missions WHERE role_slug = ? AND mission_order = 1 AND is_active = 1 LIMIT 1"
        )
        .bind(role)
        .first();

      if (!missionRow) {
        return new Response("Mission not found.", { status: 404 });
      }

      return new Response(missionHtml(roleRow, missionRow), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/log") {
      const sessionUser = await getSessionUser(request, env);
      if (!sessionUser) {
        return redirectToLogin(url);
      }

      const viewer = await getViewerContext(request, env);

      const role = (url.searchParams.get("role") || "").trim().toLowerCase();
      const missionId = (url.searchParams.get("mission") || "").trim();
      if (!role || !missionId) {
        return new Response("Missing role or mission.", { status: 400 });
      }
      if (getRoleBySlug(role) && !isRoleAllowedForTier(role, viewer.tier)) {
        return new Response(roleLockedHtml(role, viewer.tierLabel), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return new Response(logHtml(role, missionId, sessionUser), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/unlock") {
      const role = (url.searchParams.get("role") || "").trim().toLowerCase();
      const viewer = await getViewerContext(request, env);
      return new Response(unlockHtml(role, viewer.tierLabel, Boolean(viewer.sessionUser)), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/login") {
      const nextPath = url.searchParams.get("next") || "/roles";
      return new Response(loginHtml(nextPath), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/register") {
      const nextPath = url.searchParams.get("next") || "/roles";
      return new Response(registerHtml(nextPath), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && path === "/admin") {
      const sessionUser = await getSessionUser(request, env);
      if (!sessionUser) return redirectToLogin(url);
      const viewer = await getViewerContext(request, env);
      if (viewer.tier !== 5) {
        return new Response(adminForbiddenHtml(), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response(adminHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/api/help") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      }
      if (!env || !env.go_db || typeof env.go_db.prepare !== "function") {
        return jsonResponse({ ok: false, error: "Database binding go_db is not configured" }, 500);
      }

      let form;
      try {
        form = await request.formData();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid form data" }, 400);
      }

      const name = String(form.get("name") || "").trim();
      const town = String(form.get("town") || "").trim();
      const message = String(form.get("message") || "").trim();

      if (!message) {
        return jsonResponse({ ok: false, error: "Message is required" }, 400);
      }

      if (message.length > HELP_MESSAGE_MAX_LEN) {
        return jsonResponse({ ok: false, error: `Message must be ${HELP_MESSAGE_MAX_LEN} characters or fewer` }, 400);
      }

      const helpId = crypto.randomUUID();
      await env.go_db
        .prepare("INSERT INTO help_requests (help_id, name, town, message, status) VALUES (?, ?, ?, ?, 'new')")
        .bind(helpId, name || null, town || null, message)
        .run();

      return jsonResponse({ ok: true, help_id: helpId });
    }

    if (path === "/api/missions/complete") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      }
      const sessionUser = await getSessionUser(request, env);
      if (!sessionUser) {
        return jsonResponse({ ok: false, error: "Authentication required" }, 401);
      }

      let form;
      try {
        form = await request.formData();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid form data" }, 400);
      }

      const roleSlug = String(form.get("role_slug") || "").trim().toLowerCase();
      const missionId = String(form.get("mission_id") || "").trim();
      const town = String(form.get("town") || "").trim();
      const notes = String(form.get("notes") || "").trim();
      const rawContactCount = String(form.get("contact_count") || "").trim();

      if (!roleSlug || !missionId || !town) {
        return jsonResponse({ ok: false, error: "role_slug, mission_id, and town are required" }, 400);
      }

      const roleRow = await env.go_db
        .prepare("SELECT role_slug FROM roles WHERE role_slug = ? AND is_active = 1 LIMIT 1")
        .bind(roleSlug)
        .first();
      if (!roleRow) {
        return jsonResponse({ ok: false, error: "Invalid role_slug" }, 400);
      }

      const missionRow = await env.go_db
        .prepare("SELECT mission_id FROM missions WHERE mission_id = ? AND role_slug = ? AND is_active = 1 LIMIT 1")
        .bind(missionId, roleSlug)
        .first();
      if (!missionRow) {
        return jsonResponse({ ok: false, error: "Invalid mission_id for role" }, 400);
      }

      const contactCount = rawContactCount ? Number.parseInt(rawContactCount, 10) : null;
      if (rawContactCount && Number.isNaN(contactCount)) {
        return jsonResponse({ ok: false, error: "contact_count must be a number" }, 400);
      }

      const completionId = crypto.randomUUID();
      await env.go_db
        .prepare(
          "INSERT INTO mission_completions (completion_id, user_id, role_slug, mission_id, town, notes, contact_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          completionId,
          sessionUser.user_id,
          roleSlug,
          missionId,
          town,
          notes || null,
          contactCount
        )
        .run();

      const timestamp = new Date().toISOString();
      ctx.waitUntil(
        notifyAdminMissionCompletion(env, {
          completion_id: completionId,
          user_id: sessionUser.user_id,
          role_slug: roleSlug,
          town,
          timestamp,
        })
      );

      return jsonResponse({ ok: true, completion_id: completionId });
    }

    if (path === "/api/auth/webauthn/register/options") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env?.go_db) return jsonResponse({ ok: false, error: "Database binding go_db is not configured" }, 500);

      const body = await parseJsonRequest(request);
      const displayName = String(body?.display_name || "").trim();
      if (!displayName) return jsonResponse({ ok: false, error: "display_name is required" }, 400);

      const result = await getRegistrationOptions(request, env, displayName);
      return jsonResponse({ ok: true, challenge_id: result.challengeId, options: result.options });
    }

    if (path === "/api/auth/webauthn/register/verify") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env?.go_db) return jsonResponse({ ok: false, error: "Database binding go_db is not configured" }, 500);

      const body = await parseJsonRequest(request);
      if (!body?.challenge_id || !body?.response) return jsonResponse({ ok: false, error: "challenge_id and response are required" }, 400);

      const challenge = await consumeChallenge(env, body.challenge_id, "register");
      if (!challenge) return jsonResponse({ ok: false, error: "Invalid or expired challenge" }, 400);

      const displayName = String(body.display_name || "").trim() || "Volunteer";
      const verified = await verifyRegistration(request, env, challenge, body.response, displayName);
      if (!verified.verified) return jsonResponse({ ok: false, error: "Registration verification failed" }, 400);

      const { sessionId } = await createSession(env, verified.userId);
      const nextPath = String(body.next || "/roles");
      const response = jsonResponse({ ok: true, next: nextPath });
      setSessionCookie(response, sessionId, request);
      return response;
    }

    if (path === "/api/auth/webauthn/login/options") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env?.go_db) return jsonResponse({ ok: false, error: "Database binding go_db is not configured" }, 500);

      const result = await getAuthenticationOptions(request, env);
      return jsonResponse({ ok: true, challenge_id: result.challengeId, options: result.options });
    }

    if (path === "/api/auth/webauthn/login/verify") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env?.go_db) return jsonResponse({ ok: false, error: "Database binding go_db is not configured" }, 500);

      const body = await parseJsonRequest(request);
      if (!body?.challenge_id || !body?.response) return jsonResponse({ ok: false, error: "challenge_id and response are required" }, 400);

      const challenge = await consumeChallenge(env, body.challenge_id, "login");
      if (!challenge) return jsonResponse({ ok: false, error: "Invalid or expired challenge" }, 400);

      const verified = await verifyAuthentication(request, env, challenge, body.response);
      if (!verified.verified) return jsonResponse({ ok: false, error: verified.error || "Authentication failed" }, 401);

      const { sessionId } = await createSession(env, verified.userId);
      const nextPath = String(body.next || "/roles");
      const response = jsonResponse({ ok: true, next: nextPath });
      setSessionCookie(response, sessionId, request);
      return response;
    }

    if (path === "/api/auth/logout") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      const sessionId = getSessionIdFromRequest(request);
      if (sessionId && env?.go_db) {
        await env.go_db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
      }
      const response = jsonResponse({ ok: true });
      clearSessionCookie(response, request);
      return response;
    }

    if (path === "/api/admin/tier/set") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      const sessionUser = await getSessionUser(request, env);
      if (!sessionUser) return jsonResponse({ ok: false, error: "Authentication required" }, 401);
      const viewer = await getViewerContext(request, env);
      if (viewer.tier !== 5) return jsonResponse({ ok: false, error: "Tier 5 required" }, 403);

      const body = await parseBody(request);
      if (!body) return jsonResponse({ ok: false, error: "Invalid body" }, 400);

      const email = String(body.email || "").trim();
      const userId = String(body.user_id || "").trim();
      const note = String(body.note || "").trim();
      const newTier = Number.parseInt(String(body.tier || ""), 10);

      if (!Number.isInteger(newTier) || newTier < 1 || newTier > 5) {
        return jsonResponse({ ok: false, error: "tier must be an integer between 1 and 5" }, 400);
      }
      if (!email && !userId) {
        return jsonResponse({ ok: false, error: "email or user_id is required" }, 400);
      }

      let target = null;
      if (email) {
        target = await env.go_db
          .prepare("SELECT user_id, COALESCE(tier, 1) AS tier FROM users WHERE email = ? LIMIT 1")
          .bind(email)
          .first();
      } else {
        target = await env.go_db
          .prepare("SELECT user_id, COALESCE(tier, 1) AS tier FROM users WHERE user_id = ? LIMIT 1")
          .bind(userId)
          .first();
      }

      if (!target) {
        return jsonResponse({ ok: false, error: "Target user not found" }, 404);
      }

      const oldTier = Number.parseInt(String(target.tier), 10) || 1;
      const now = new Date().toISOString();
      await env.go_db
        .prepare(
          "UPDATE users SET tier = ?, tier_granted_by = ?, tier_granted_at = ?, tier_note = ? WHERE user_id = ?"
        )
        .bind(newTier, sessionUser.user_id, now, note || null, target.user_id)
        .run();

      try {
        await env.go_db
          .prepare(
            "INSERT INTO tier_changes (change_id, target_user_id, old_tier, new_tier, granted_by_user_id, note) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .bind(crypto.randomUUID(), target.user_id, oldTier, newTier, sessionUser.user_id, note || null)
          .run();
      } catch {
        // Optional audit table; continue if unavailable.
      }

      return jsonResponse({ ok: true });
    }

    if (path === "/api/admin/bootstrap-tier5") {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      const configuredAdminKey = String(env.ADMIN_KEY || "");
      if (!configuredAdminKey || configuredAdminKey === "set-via-secret-not-here") {
        return jsonResponse({ ok: false, error: "ADMIN_KEY not configured" }, 403);
      }
      const providedAdminKey = request.headers.get("X-ADMIN-KEY") || "";
      if (providedAdminKey !== configuredAdminKey) {
        return jsonResponse({ ok: false, error: "Forbidden" }, 403);
      }

      const body = await parseBody(request);
      if (!body) return jsonResponse({ ok: false, error: "Invalid body" }, 400);
      const email = String(body.email || "").trim();
      const userIdInput = String(body.user_id || "").trim();
      if (!email && !userIdInput) {
        return jsonResponse({ ok: false, error: "email or user_id is required" }, 400);
      }

      const now = new Date().toISOString();
      if (userIdInput) {
        await env.go_db
          .prepare(
            "INSERT INTO users (user_id, tier, tier_granted_by, tier_granted_at, tier_note) VALUES (?, 5, 'bootstrap', ?, 'Emergency bootstrap') ON CONFLICT(user_id) DO UPDATE SET tier = 5, tier_granted_by = 'bootstrap', tier_granted_at = excluded.tier_granted_at, tier_note = 'Emergency bootstrap'"
          )
          .bind(userIdInput, now)
          .run();
        return jsonResponse({ ok: true, user_id: userIdInput });
      }

      const existing = await env.go_db
        .prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1")
        .bind(email)
        .first();

      if (existing) {
        await env.go_db
          .prepare(
            "UPDATE users SET tier = 5, tier_granted_by = 'bootstrap', tier_granted_at = ?, tier_note = 'Emergency bootstrap' WHERE user_id = ?"
          )
          .bind(now, existing.user_id)
          .run();
        return jsonResponse({ ok: true, user_id: existing.user_id });
      }

      const newUserId = crypto.randomUUID();
      await env.go_db
        .prepare(
          "INSERT INTO users (user_id, email, tier, tier_granted_by, tier_granted_at, tier_note) VALUES (?, ?, 5, 'bootstrap', ?, 'Emergency bootstrap')"
        )
        .bind(newUserId, email, now)
        .run();
      return jsonResponse({ ok: true, user_id: newUserId });
    }

    return serveAsset(request, env, ctx);
  },
};
