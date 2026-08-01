import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listAllCharactersWithOwner } from "@/lib/characters";
import { getDiceBias } from "@/lib/engine/bias";
import AdminDiceBiasPanel from "@/components/AdminDiceBiasPanel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const characters = listAllCharactersWithOwner().map((c) => ({
    id: c.id,
    name: c.name,
    ownerUsername: c.ownerUsername,
    bias: getDiceBias(c.id),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-serif text-3xl text-amber-100">Admin settings</h1>
        <p className="mt-1 text-amber-200/70">Signed in as {user.username}.</p>
      </div>

      <section>
        <h2 className="font-serif text-lg text-amber-100">Dice bias</h2>
        <p className="mt-1 text-sm text-amber-200/50">
          Applies invisibly inside the roll — the displayed die is the post-bias
          value, indistinguishable from luck. Never shown to players.
        </p>
        <div className="mt-3">
          <AdminDiceBiasPanel characters={characters} />
        </div>
      </section>

      <Link href="/" className="text-sm text-amber-300 underline">
        Back home
      </Link>
    </main>
  );
}
