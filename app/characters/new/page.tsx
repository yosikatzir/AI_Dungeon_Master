import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllSpecies, getAllClasses, getAllBackgrounds, getAllFeats, getAllSpells } from "@/lib/content";
import CharacterBuilder from "@/components/CharacterBuilder";

export default async function NewCharacterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [species, classes, backgrounds, feats, spells] = [
    getAllSpecies(),
    getAllClasses(),
    getAllBackgrounds(),
    getAllFeats(),
    getAllSpells(),
  ];

  return (
    <CharacterBuilder
      species={species}
      classes={classes}
      backgrounds={backgrounds}
      feats={feats}
      spells={spells}
    />
  );
}
