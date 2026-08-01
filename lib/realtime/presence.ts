// In-memory only — fine for a single self-hosted process (see README); the
// AI context builder (lib/ai/context.ts) also reads this to know who's
// actually present this session, so it lives in its own module rather than
// inline in socketServer.ts to avoid a circular import between the two.
const presence = new Map<number, Map<number, Set<string>>>();

export function getCampaignPresence(campaignId: number): Map<number, Set<string>> {
  let campaignPresence = presence.get(campaignId);
  if (!campaignPresence) {
    campaignPresence = new Map();
    presence.set(campaignId, campaignPresence);
  }
  return campaignPresence;
}

export function getOnlineUserIds(campaignId: number): number[] {
  return Array.from((presence.get(campaignId) ?? new Map()).keys());
}
