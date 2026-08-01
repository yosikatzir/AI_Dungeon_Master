import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { resolveCharacter, canRebuildCharacter, hasActiveMembership } from "@/lib/characters";
import { getAllFeats } from "@/lib/content";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { ABILITY_NAMES } from "@/lib/rules/constants";
import PortraitUpload from "@/components/PortraitUpload";
import CharacterVitals from "@/components/CharacterVitals";
import CharacterIdentityEditor from "@/components/CharacterIdentityEditor";
import DeleteCharacterButton from "@/components/DeleteCharacterButton";

export default async function CharacterSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = Number((await params).id);
  const resolved = resolveCharacter(id);
  if (!resolved || resolved.character.userId !== user.id || resolved.character.isDeleted) notFound();

  const { character, species, klass, subclass, background, items } = resolved;
  const sheet = computeCharacterSheet(resolved);
  const feats = getAllFeats();
  const originFeat = feats.find((f) => character.feats.includes(f.id));
  const rebuildEligible = canRebuildCharacter(character);
  const enrolledInActiveCampaigns = hasActiveMembership(character.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/characters" className="text-sm text-amber-300 underline">
        ← Your characters
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <PortraitUpload characterId={character.id} portraitPath={character.portraitPath} />

        <div className="flex-1">
          <h1 className="font-serif text-3xl text-amber-100">{character.name}</h1>
          <p className="text-amber-200/60">
            Level {character.level} {species.name} {klass.name}
            {subclass ? ` (${subclass.name})` : ""} · {background.name}
            {character.alignment ? ` · ${character.alignment}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            <Stat label="AC" value={sheet.armorClass} />
            <Stat label="Initiative" value={sheet.initiative >= 0 ? `+${sheet.initiative}` : sheet.initiative} />
            <Stat label="Speed" value={`${sheet.speed} ft`} />
            <Stat label="Prof. Bonus" value={`+${sheet.proficiencyBonus}`} />
            <Stat label="Passive Perception" value={sheet.passivePerception} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CharacterVitals
          characterId={character.id}
          hpCurrent={character.hpCurrent}
          hpMax={sheet.hpMax}
          tempHp={character.tempHp}
          inspiration={character.inspiration}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(Object.keys(sheet.abilityModifiers) as (keyof typeof sheet.abilityModifiers)[]).map((a) => (
          <div key={a} className="rounded border border-amber-800/30 p-3 text-center">
            <div className="text-xs text-amber-200/60">{ABILITY_NAMES[a]}</div>
            <div className="text-xl text-amber-100">{character.abilityScores[a]}</div>
            <div className="text-xs text-amber-300/60">
              {sheet.abilityModifiers[a] >= 0 ? "+" : ""}
              {sheet.abilityModifiers[a]}
            </div>
          </div>
        ))}
      </div>

      <Section title="Saving Throws">
        <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
          {(Object.keys(sheet.savingThrows) as (keyof typeof sheet.savingThrows)[]).map((a) => (
            <div key={a} className={sheet.savingThrows[a].proficient ? "text-amber-100" : "text-amber-200/60"}>
              {ABILITY_NAMES[a]}: {sheet.savingThrows[a].bonus >= 0 ? "+" : ""}
              {sheet.savingThrows[a].bonus}
              {sheet.savingThrows[a].proficient && " •"}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Skills">
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {sheet.skills.map((s) => (
            <div key={s.id} className={s.proficient ? "text-amber-100" : "text-amber-200/60"}>
              {s.name} ({ABILITY_NAMES[s.ability].slice(0, 3)}): {s.bonus >= 0 ? "+" : ""}
              {s.bonus}
              {s.expertise ? " ★" : s.proficient ? " •" : ""}
            </div>
          ))}
        </div>
      </Section>

      {sheet.attacks.length > 0 && (
        <Section title="Attacks">
          <div className="flex flex-col gap-1 text-sm">
            {sheet.attacks.map((a) => (
              <div key={a.equipmentId} className="text-amber-100">
                {a.name}: {a.toHit >= 0 ? "+" : ""}
                {a.toHit} to hit, {a.damageDice} {a.damageType}
              </div>
            ))}
          </div>
        </Section>
      )}

      {sheet.spellSlots && (
        <Section title="Spellcasting">
          <p className="text-sm text-amber-200/70">
            Spell save DC {sheet.spellSaveDc} · Spell attack {sheet.spellAttackBonus! >= 0 ? "+" : ""}
            {sheet.spellAttackBonus}
          </p>
          <p className="mt-2 text-sm text-amber-200/70">
            Slots:{" "}
            {sheet.spellSlots.max
              .map((max, i) => (max > 0 ? `L${i + 1}: ${sheet.spellSlots!.used[i + 1] ?? 0}/${max}` : null))
              .filter(Boolean)
              .join(" · ") || "none yet"}
          </p>
          {character.cantripsKnown.length > 0 && (
            <p className="mt-2 text-sm text-amber-200/70">Cantrips: {character.cantripsKnown.join(", ")}</p>
          )}
          {character.spellsKnown.length > 0 && (
            <p className="mt-1 text-sm text-amber-200/70">Spells: {character.spellsKnown.join(", ")}</p>
          )}
        </Section>
      )}

      <Section title="Equipment">
        <p className="text-sm text-amber-200/60">
          Carrying {sheet.weightCarriedLb.toFixed(1)} / {sheet.carryCapacityLb} lb
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-100">
          {items.map((i) => (
            <li key={i.equipmentId}>
              {i.equipment.name} {i.quantity > 1 ? `×${i.quantity}` : ""} {i.equipped ? "(equipped)" : ""}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Features & Traits">
        <ul className="flex flex-col gap-2 text-sm text-amber-200/80">
          {klass.level1Features.map((f) => (
            <li key={f.name}>
              <span className="text-amber-100">{f.name}.</span> {f.description}
            </li>
          ))}
          {species.traits.map((t) => (
            <li key={t.name}>
              <span className="text-amber-100">{t.name}.</span> {t.description}
            </li>
          ))}
          {originFeat && (
            <li>
              <span className="text-amber-100">{originFeat.name} (feat).</span> {originFeat.description}
            </li>
          )}
        </ul>
      </Section>

      {(character.appearance || character.backstory) && (
        <Section title="Appearance & Backstory">
          {character.appearance && <p className="text-sm text-amber-200/70">{character.appearance}</p>}
          {character.backstory && <p className="mt-2 text-sm text-amber-200/70">{character.backstory}</p>}
        </Section>
      )}

      <Section title="Manage">
        <div className="flex flex-col gap-3">
          <CharacterIdentityEditor
            characterId={character.id}
            name={character.name}
            alignment={character.alignment}
            appearance={character.appearance}
            backstory={character.backstory}
          />

          <div className="flex flex-wrap items-center gap-2">
            {rebuildEligible ? (
              <Link
                href={`/characters/${character.id}/edit`}
                className="min-h-[44px] rounded border border-amber-700/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/30"
              >
                Rebuild (change species/class/abilities)
              </Link>
            ) : (
              <p className="text-xs text-amber-200/40">
                {character.level !== 1
                  ? "Only a level 1 character's build can be changed."
                  : "Leave every active campaign to change this character's build."}
              </p>
            )}
          </div>

          <DeleteCharacterButton
            characterId={character.id}
            characterName={character.name}
            enrolledInActiveCampaigns={enrolledInActiveCampaigns}
          />
        </div>
      </Section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-amber-800/30 p-2 text-center">
      <div className="text-xs text-amber-200/60">{label}</div>
      <div className="text-lg text-amber-100">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-amber-800/30 pt-4">
      <h2 className="font-serif text-lg text-amber-100">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}
