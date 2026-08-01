import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listActiveCampaigns, getCampaignMembers } from "@/lib/campaigns";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaigns = listActiveCampaigns();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-amber-100">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
        >
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-6 text-sm text-amber-200/60">
          No campaigns yet. Start one to begin an adventure.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {campaigns.map((c) => {
            const members = getCampaignMembers(c.id).filter((m) => m.status === "active");
            const isMember = members.some((m) => m.userId === user.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="block rounded-lg border border-amber-800/30 p-4 hover:border-amber-700/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-amber-100">{c.name}</div>
                    {isMember && (
                      <span className="text-xs text-amber-400">enrolled</span>
                    )}
                  </div>
                  <div className="text-xs text-amber-300/60">
                    {c.mode === "surprise" ? "DM surprise" : "Guided"} ·{" "}
                    {members.length} member{members.length === 1 ? "" : "s"}
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
