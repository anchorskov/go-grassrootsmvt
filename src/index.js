/* src/index.js */

const ROLES = [
  { name: "Hand", slug: "hand" },
  { name: "Specialist", slug: "specialist" },
  { name: "Dispatcher", slug: "dispatcher" },
  { name: "Scout", slug: "scout" },
  { name: "Land Man", slug: "land-man" },
  { name: "Support", slug: "support" },
  { name: "Foreman", slug: "foreman" },
  { name: "Campaign Lead", slug: "campaign-lead" },
];

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
      font-weight: 600;
    }
    a.btn:hover { background: #f6f6f6; }
    .card { border: 1px solid #eee; border-radius: 12px; padding: 14px; background: #fff; }
    .small { font-size: 14px; color: #444; }
    label { display:block; font-weight:600; margin-top: 10px; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 10px; }
    textarea { min-height: 110px; }
    .row { display:flex; gap: 10px; flex-wrap: wrap; }
    .row > * { flex: 1 1 220px; }
    .toplinks { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function rolesHtml() {
  const roleButtons = ROLES.map(
    (r) => `<a class="btn" href="/mission?role=${encodeURIComponent(r.slug)}">${r.name}</a>`
  ).join("");

  return htmlPage(
    "Choose your role | go.grassrootsmvt.org",
    `<h1>Choose your role</h1>
     <p>No one joins and gets lost. Everyone gets a mission.</p>
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
       <p class="small">This form posts to <code>/api/help</code>. We will wire the endpoint next.</p>

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

function missionPlaceholderHtml(roleSlug) {
  const role = ROLES.find((r) => r.slug === roleSlug);
  const roleName = role ? role.name : "Unknown role";

  return htmlPage(
    `Mission | ${roleName}`,
    `<h1>Mission 1</h1>
     <p class="small">Role: <strong>${roleName}</strong></p>

     <div class="card">
       <p><strong>Placeholder page.</strong> Next we will render the real Mission 1 cards and a Log Win button.</p>
       <p>Return to <a href="/roles">roles</a> to pick another role.</p>
     </div>

     <div class="toplinks">
       <a class="btn" href="/roles">Back to roles</a>
       <a class="btn" href="/help">Need support</a>
     </div>`
  );
}

async function serveAsset(request, env, ctx) {
  // In Cloudflare Workers with Assets, env.ASSETS.fetch serves /public content.
  if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return env.ASSETS.fetch(request, ctx);
  }
  // Fallback: basic fetch, useful in some local contexts.
  return fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // UI routes
    if (request.method === "GET" && path === "/roles") {
      return new Response(rolesHtml(), {
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
      return new Response(missionPlaceholderHtml(role), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // API stub so /help form can post without a 404 for now
    if (path === "/api/help") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ ok: true, next: "We will store this in D1 next." }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // Everything else, serve static assets (including / which is public/index.html)
    return serveAsset(request, env, ctx);
  },
};
