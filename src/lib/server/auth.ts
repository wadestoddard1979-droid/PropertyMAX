import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { allowDemoLogin, isSupabaseConfigured } from "./config";
import { readStore } from "./db";
import { getAnonClient, getServiceClient } from "./supabase/client";
import type { Role, SessionUser } from "../types";

const COOKIE = "propertmax_session";
const SUPABASE_ACCESS = "propertmax_sb_access";
const SECRET =
  process.env.PROPERTYMAX_SESSION_SECRET ||
  "propertmax-pilot-dev-secret-change-me";

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function encodeSession(user: SessionUser) {
  const body = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionUser | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function sessionFromStoreUserId(
  id: string,
  orgId?: string | null,
  mfaVerified = false,
): Promise<SessionUser | null> {
  const store = await readStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  const memberships = (store.memberships || []).filter((m) => m.userId === id);
  // Prefer PropertMax (org-pilot) when no explicit org is requested — Beachy
  // white-label only applies when the session org is org-beachy.
  const resolvedOrg =
    orgId && memberships.some((m) => m.orgId === orgId)
      ? orgId
      : memberships.find((m) => m.orgId === "org-pilot")?.orgId ||
        memberships[0]?.orgId ||
        user.orgIds?.find((o) => o === "org-pilot") ||
        user.orgIds?.[0] ||
        "org-pilot";
  const membership = memberships.find((m) => m.orgId === resolvedOrg);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership?.role || user.role,
    orgId: resolvedOrg,
    mfaVerified,
  };
}

async function getSupabaseSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;
  const jar = await cookies();
  const access = jar.get(SUPABASE_ACCESS)?.value;
  if (!access) return null;
  const sb = getAnonClient();
  const { data, error } = await sb.auth.getUser(access);
  if (error || !data.user) return null;

  const admin = getServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (profile) {
    return sessionFromStoreUserId(profile.id);
  }

  // Fallback: match by email to pilot profiles
  if (data.user.email) {
    const store = await readStore();
    const user = store.users.find(
      (u) => u.email.toLowerCase() === data.user.email!.toLowerCase(),
    );
    if (user) {
      await admin
        .from("profiles")
        .update({ auth_user_id: data.user.id })
        .eq("id", user.id);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }
  }
  return null;
}

export async function getSession(): Promise<SessionUser | null> {
  const supabaseUser = await getSupabaseSessionUser();
  if (supabaseUser) return supabaseUser;

  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const session = decodeSession(raw);
  if (!session) return null;
  // Preserve org + MFA flags from cookie while refreshing role/name from store
  return sessionFromStoreUserId(
    session.id,
    session.orgId,
    Boolean(session.mfaVerified),
  );
}

export async function requireSession(roles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Not authenticated", 401);
  }
  if (roles && !roles.includes(session.role)) {
    throw new AuthError("Forbidden for this role", 403);
  }
  return session;
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function setSupabaseAccessCookie(accessToken: string) {
  const jar = await cookies();
  jar.set(SUPABASE_ACCESS, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(SUPABASE_ACCESS);
}

/**
 * Login adapter: prefer Supabase Auth when configured; always allow
 * pilot demo passwords when ALLOW_DEMO_LOGIN is enabled (default).
 */
export async function loginWithPassword(
  email: string,
  password: string,
  orgId?: string,
): Promise<{ user: SessionUser; via: "supabase" | "demo" }> {
  const normalized = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const sb = getAnonClient();
      const { data, error } = await sb.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (!error && data.session?.access_token && data.user) {
        await setSupabaseAccessCookie(data.session.access_token);
        const session = await getSupabaseSessionUser();
        if (session) {
          const enriched =
            (await sessionFromStoreUserId(session.id, orgId, false)) || session;
          await setSessionCookie(enriched);
          return { user: enriched, via: "supabase" };
        }
      }
    } catch (err) {
      console.warn("Supabase Auth login failed; trying demo fallback", err);
    }
  }

  if (!allowDemoLogin()) {
    throw new AuthError("Invalid credentials", 401);
  }

  const store = await readStore();
  const user = store.users.find(
    (u) =>
      u.email.toLowerCase() === normalized && u.password === password,
  );
  if (!user) {
    throw new AuthError("Invalid credentials", 401);
  }
  const session = await sessionFromStoreUserId(user.id, orgId, false);
  if (!session) throw new AuthError("Invalid credentials", 401);
  await setSessionCookie(session);
  return { user: session, via: "demo" };
}

/** Demo MFA — code 123456 marks session verified for sensitive actions. */
export async function verifyMfaDemo(code: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated", 401);
  if (code.trim() !== "123456") {
    throw new AuthError("Invalid MFA code (demo code is 123456)", 400);
  }
  const next = { ...session, mfaVerified: true };
  await setSessionCookie(next);
  return next;
}

export async function switchOrg(orgId: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated", 401);
  const next = await sessionFromStoreUserId(
    session.id,
    orgId,
    Boolean(session.mfaVerified),
  );
  if (!next || next.orgId !== orgId) {
    throw new AuthError("Not a member of that organization", 403);
  }
  await setSessionCookie(next);
  return next;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonError(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Server error" }, { status: 500 });
}
