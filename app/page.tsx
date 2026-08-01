import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <div>
        <h1 className="font-serif text-3xl text-amber-100">Family Table</h1>
        <p className="mt-2 text-amber-200/70">
          Welcome back, {user.username}
          {user.isAdmin ? " (admin)" : ""}.
        </p>
      </div>

      <p className="text-sm text-amber-200/50">
        Build a character, then jump into a campaign.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/characters"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
        >
          Your Characters
        </Link>
        <Link
          href="/campaigns"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
        >
          Campaigns
        </Link>
        {user.isAdmin && (
          <Link
            href="/admin"
            className="rounded-md border border-amber-700/50 px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/30"
          >
            Admin settings
          </Link>
        )}
        <LogoutButton />
      </div>
    </main>
  );
}
