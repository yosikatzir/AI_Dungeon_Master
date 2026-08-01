import { cookies } from "next/headers";
import { getIronSession, unsealData, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: number;
  username?: string;
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set in .env.local to at least 32 characters. See .env.example.",
  );
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: "family_table_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Decrypts the session cookie's raw value directly. Socket.IO connections
 * don't go through Next's request pipeline, so `cookies()`/`getSession()`
 * aren't available there — this is the socket server's way to identify who's
 * connecting.
 */
export async function unsealSessionCookie(
  rawCookieValue: string,
): Promise<{ userId: number; username: string } | null> {
  try {
    const data = await unsealData<SessionData>(rawCookieValue, {
      password: sessionOptions.password,
    });
    if (!data.userId || !data.username) return null;
    return { userId: data.userId, username: data.username };
  } catch {
    return null;
  }
}
