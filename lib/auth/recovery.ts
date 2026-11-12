import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_COOKIE = "aems_password_recovery";
export const RECOVERY_SECONDS = 600;
type RecoveryIdentity = {id: string; updated_at?: string};

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`aems:password-recovery:v1:${payload}`).digest("base64url");
}

/** A short-lived, signed proof of email authentication, bound to the current user version. */
export function createRecoveryGrant(user: RecoveryIdentity, secret: string, now = Date.now()) {
  if (!secret || !user.updated_at) throw new Error("Recovery signing configuration unavailable");
  const payload = Buffer.from(JSON.stringify({uid: user.id, version: user.updated_at, exp: now + RECOVERY_SECONDS * 1000})).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyRecoveryGrant(token: string | undefined, user: RecoveryIdentity, secret: string, now = Date.now()) {
  if (!token || !secret || !user.updated_at || token.length > 2048) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signed] = parts;
    const expected = signature(payload, secret);
    if (signed.length !== expected.length || !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.uid === user.id && data.version === user.updated_at && Number.isFinite(data.exp) && data.exp > now && data.exp <= now + RECOVERY_SECONDS * 1000;
  } catch {return false;}
}
