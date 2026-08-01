import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterRecord, canRebuildCharacter } from "@/lib/characters";
import { getAllSpecies, getAllClasses, getAllBackgrounds, getAllFeats, getAllSpells } from "@/lib/content";
import CharacterBuilder from "@/components/CharacterBuilder";

export default async function EditCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = Number((await params).id);
  const record = getCharacterRecord(id);
  if (!record || record.userId !== user.id || record.isDeleted) notFound();
  if (!canRebuildCharacter(record)) redirect(`/characters/${id}`);

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
      mode="rebuild"
      characterId={id}
      initialDetails={{
        name: record.name,
        alignment: record.alignment ?? undefined,
        appearance: record.appearance ?? undefined,
        backstory: record.backstory ?? undefined,
      }}
    />
  );
}
