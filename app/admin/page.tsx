import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="font-serif text-3xl text-amber-100">Admin settings</h1>
      <p className="text-amber-200/70">
        Signed in as {user.username}. Per-character dice-bias controls and
        other admin tools arrive in a later phase.
      </p>
      <Link href="/" className="text-sm text-amber-300 underline">
        Back home
      </Link>
    </main>
  );
}
