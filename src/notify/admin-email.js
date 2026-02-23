function toIsoNow() {
  return new Date().toISOString();
}

function logFallback(payload) {
  console.log("ADMIN_NOTIFY", JSON.stringify(payload));
}

async function sendViaResend(env, payload) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.ADMIN_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    logFallback({ provider: "resend", reason: "missing_config", payload });
    return { sent: false, provider: "resend", fallback: true };
  }

  const from = env.ADMIN_FROM_EMAIL || "Go Grassroots <onboarding@resend.dev>";
  const subject = `[Go Grassroots] Mission completion ${payload.completion_id}`;
  const text = [
    "Mission completion submitted",
    `completion_id: ${payload.completion_id}`,
    `user_id: ${payload.user_id}`,
    `role_slug: ${payload.role_slug}`,
    `town: ${payload.town}`,
    `timestamp: ${payload.timestamp || toIsoNow()}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("ADMIN_NOTIFY_RESEND_ERROR", body);
    logFallback({ provider: "resend", reason: "request_failed", payload });
    return { sent: false, provider: "resend", fallback: true };
  }

  return { sent: true, provider: "resend", fallback: false };
}

export async function notifyAdminMissionCompletion(env, payload) {
  const provider = String(env.EMAIL_PROVIDER || "none").toLowerCase();

  if (provider === "resend") {
    return sendViaResend(env, payload);
  }

  logFallback({ provider, payload });
  return { sent: false, provider: provider || "none", fallback: true };
}
