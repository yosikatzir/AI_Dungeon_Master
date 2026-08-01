import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign, getMembership } from "@/lib/campaigns";
import { listCampaignImages } from "@/lib/images";

export default async function CampaignGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaignId = Number((await params).id);
  const campaign = getCampaign(campaignId);
  if (!campaign) notFound();

  const membership = getMembership(campaignId, user.id);
  if (!membership || membership.status !== "active") redirect(`/campaigns/${campaignId}`);

  const images = listCampaignImages(campaignId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/campaigns/${campaignId}`} className="text-sm text-amber-300 underline">
        ← Back to session
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-amber-100">{campaign.name} — Gallery</h1>

      {images.length === 0 ? (
        <p className="mt-6 text-sm text-amber-200/50">
          No images generated yet. Ask the DM to illustrate something, or use the 🎨 button in the
          session.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((img) => (
            <a
              key={img.id}
              href={`/api/images/${img.filePath}`}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-amber-800/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- served from an authenticated internal API route */}
              <img
                src={`/api/images/${img.filePath}`}
                alt={img.prompt}
                className="aspect-square w-full object-cover"
              />
              <p className="p-2 text-xs text-amber-200/60">
                {img.kind} · {new Date(img.createdAt).toLocaleDateString()}
              </p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
