import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { username, password } = parsed.data;

  const user = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;

  const invalid = () =>
    NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  if (!user) return invalid();

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return invalid();

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();

  return NextResponse.json({ ok: true, username: user.username });
}
