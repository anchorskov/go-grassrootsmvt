let _swa;
async function loadSimpleWebAuthn() {
  if (_swa) return _swa;
  const server = await import("@simplewebauthn/server");
  const helpers = await import("@simplewebauthn/server/helpers");
  _swa = {
    generateAuthenticationOptions: server.generateAuthenticationOptions,
    generateRegistrationOptions: server.generateRegistrationOptions,
    verifyAuthenticationResponse: server.verifyAuthenticationResponse,
    verifyRegistrationResponse: server.verifyRegistrationResponse,
    isoBase64URL: helpers.isoBase64URL,
  };
  return _swa;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getRpId(request, env) {
  return env.WEBAUTHN_RP_ID || new URL(request.url).hostname;
}

function getExpectedOrigin(request, env) {
  if (env.WEBAUTHN_ORIGIN) return env.WEBAUTHN_ORIGIN;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function normalizeTransports(transports) {
  if (!Array.isArray(transports)) return null;
  const items = transports.filter(Boolean);
  return items.length ? items.join(",") : null;
}

async function saveChallenge(env, challenge, purpose, userId = null) {
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  await env.go_db
    .prepare(
      "INSERT INTO auth_challenges (challenge_id, user_id, challenge, purpose, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(challengeId, userId, challenge, purpose, expiresAt)
    .run();
  return challengeId;
}

export async function consumeChallenge(env, challengeId, purpose) {
  const row = await env.go_db
    .prepare("SELECT challenge_id, user_id, challenge, purpose, expires_at FROM auth_challenges WHERE challenge_id = ? LIMIT 1")
    .bind(challengeId)
    .first();

  if (!row || row.purpose !== purpose) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.go_db.prepare("DELETE FROM auth_challenges WHERE challenge_id = ?").bind(challengeId).run();
    return null;
  }

  await env.go_db.prepare("DELETE FROM auth_challenges WHERE challenge_id = ?").bind(challengeId).run();
  return row;
}

export async function getRegistrationOptions(request, env, displayName) {
  const { generateRegistrationOptions } = await loadSimpleWebAuthn();
  const userId = crypto.randomUUID();
  const rpID = getRpId(request, env);
  const options = await generateRegistrationOptions({
    rpID,
    rpName: env.WEBAUTHN_RP_NAME || "go.grassrootsmvt.org",
    userID: userId,
    userName: displayName,
    userDisplayName: displayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const challengeId = await saveChallenge(env, options.challenge, "register", userId);
  return { challengeId, userId, options };
}

export async function verifyRegistration(request, env, challengeRow, response, displayName) {
  const { verifyRegistrationResponse, isoBase64URL } = await loadSimpleWebAuthn();
  const expectedOrigin = getExpectedOrigin(request, env);
  const expectedRPID = getRpId(request, env);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const credentialId = response.id;
  const publicKeyBytes =
    verification.registrationInfo.credential?.publicKey || verification.registrationInfo.credentialPublicKey;
  const counter = verification.registrationInfo.credential?.counter ?? verification.registrationInfo.counter ?? 0;

  const publicKey = isoBase64URL.fromBuffer(publicKeyBytes);
  const transports = normalizeTransports(response.response?.transports);

  await env.go_db
    .prepare("INSERT OR IGNORE INTO users (user_id, display_name) VALUES (?, ?)")
    .bind(challengeRow.user_id, displayName)
    .run();

  await env.go_db
    .prepare(
      "INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?) ON CONFLICT(credential_id) DO UPDATE SET user_id=excluded.user_id, public_key=excluded.public_key, counter=excluded.counter, transports=excluded.transports"
    )
    .bind(credentialId, challengeRow.user_id, publicKey, counter, transports)
    .run();

  return {
    verified: true,
    userId: challengeRow.user_id,
  };
}

export async function getAuthenticationOptions(request, env) {
  const { generateAuthenticationOptions } = await loadSimpleWebAuthn();
  const rpID = getRpId(request, env);
  const rows = await env.go_db
    .prepare("SELECT credential_id, transports FROM webauthn_credentials ORDER BY created_at DESC")
    .all();

  const allowCredentials = (rows?.results || []).map((row) => ({
    id: row.credential_id,
    transports: row.transports ? row.transports.split(",").filter(Boolean) : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials,
  });

  const challengeId = await saveChallenge(env, options.challenge, "login", null);
  return { challengeId, options };
}

export async function verifyAuthentication(request, env, challengeRow, response) {
  const { verifyAuthenticationResponse, isoBase64URL } = await loadSimpleWebAuthn();
  const credential = await env.go_db
    .prepare("SELECT credential_id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE credential_id = ? LIMIT 1")
    .bind(response.id)
    .first();

  if (!credential) {
    return { verified: false, error: "Unknown credential" };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: getExpectedOrigin(request, env),
    expectedRPID: getRpId(request, env),
    authenticator: {
      credentialID: isoBase64URL.toBuffer(credential.credential_id),
      credentialPublicKey: isoBase64URL.toBuffer(credential.public_key),
      counter: credential.counter,
      transports: credential.transports ? credential.transports.split(",").filter(Boolean) : undefined,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    return { verified: false, error: "Authentication verification failed" };
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? credential.counter;
  await env.go_db
    .prepare("UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?")
    .bind(newCounter, credential.credential_id)
    .run();

  return {
    verified: true,
    userId: credential.user_id,
  };
}
