import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listCharactersForUser } from "@/lib/characters";
import { getClassById, getSpeciesById } from "@/lib/content";

export default async function CharactersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const characters = listCharactersForUser(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-amber-100">Your Characters</h1>
        <Link
          href="/characters/new"
          className="rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
        >
          Create Character
        </Link>
      </div>

      {characters.length === 0 ? (
        <p className="mt-6 text-sm text-amber-200/60">
          No characters yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {characters.map((c) => {
            const klass = getClassById(c.classId);
            const sp = getSpeciesById(c.speciesId);
            return (
              <li key={c.id}>
                <Link
                  href={`/characters/${c.id}`}
                  className="block rounded-lg border border-amber-800/30 p-4 hover:border-amber-700/60"
                >
                  <div className="text-amber-100">{c.name}</div>
                  <div className="text-xs text-amber-300/60">
                    Level {c.level} {sp?.name} {klass?.name}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/" className="mt-8 inline-block text-sm text-amber-300 underline">
        Back home
      </Link>
    </main>
  );
}
