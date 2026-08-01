import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign, getCampaignMembers, listRecentMessages } from "@/lib/campaigns";
import { listCharactersForUser } from "@/lib/characters";
import CampaignRoom from "@/components/CampaignRoom";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaignId = Number((await params).id);
  const campaign = getCampaign(campaignId);
  if (!campaign) notFound();

  const members = getCampaignMembers(campaignId);
  const messages = listRecentMessages(campaignId);
  const myCharacters = listCharactersForUser(user.id);
  const myMembership = members.find((m) => m.userId === user.id) ?? null;

  return (
    <CampaignRoom
      campaign={campaign}
      initialMembers={members}
      initialMessages={messages}
      myCharacters={myCharacters.map((c) => ({ id: c.id, name: c.name }))}
      myUserId={user.id}
      myUsername={user.username}
      myMembership={myMembership}
    />
  );
}
