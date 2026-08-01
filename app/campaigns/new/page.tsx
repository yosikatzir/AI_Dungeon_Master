import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import NewCampaignForm from "@/components/NewCampaignForm";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <NewCampaignForm />;
}
