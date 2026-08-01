import { getSession } from "@/lib/session";
import { ADMIN_USERNAME } from "@/lib/config";

export interface CurrentUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId || !session.username) return null;
  return {
    id: session.userId,
    username: session.username,
    isAdmin: session.username === ADMIN_USERNAME,
  };
}
