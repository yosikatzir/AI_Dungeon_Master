import type { Species } from "@/lib/rules/types";

export const SPECIES: Species[] = [
  {
    id: "human",
    name: "Human",
    size: "Medium",
    speed: 30,
    traits: [
      {
        name: "Resourceful",
        description: "You gain Heroic Inspiration whenever you finish a Long Rest.",
      },
      {
        name: "Skillful",
        description: "You gain proficiency in one skill of your choice.",
      },
      {
        name: "Versatile",
        description: "You gain an Origin feat of your choice.",
      },
    ],
    description: "Humans are the most adaptable and ambitious people among the common folk.",
  },
  {
    id: "elf",
    name: "Elf",
    size: "Medium",
    speed: 30,
    traits: [
      { name: "Darkvision", description: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fey Ancestry", description: "Advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Keen Senses", description: "Proficiency in the Insight, Perception, or Survival skill (your choice)." },
      { name: "Trance", description: "You don't need to sleep; instead you meditate for 4 hours a day to gain the benefit of a Long Rest." },
    ],
    description: "Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.",
  },
  {
    id: "dwarf",
    name: "Dwarf",
    size: "Medium",
    speed: 30,
    traits: [
      { name: "Darkvision", description: "You can see in dim light within 120 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Dwarven Resilience", description: "Resistance to poison damage, and advantage on saving throws against being poisoned." },
      { name: "Dwarven Toughness", description: "Your hit point maximum increases by 1, and by 1 again whenever you gain a level." },
      { name: "Stonecunning", description: "As a bonus action, gain tremorsense out to 60 feet for 10 minutes (limited uses) when in contact with stone; expertise on History checks about stonework." },
    ],
    description: "Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.",
  },
  {
    id: "halfling",
    name: "Halfling",
    size: "Small",
    speed: 30,
    traits: [
      { name: "Brave", description: "Advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", description: "You can move through the space of any creature that is a size larger than you." },
      { name: "Luck", description: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll and must use the new roll." },
      { name: "Naturally Stealthy", description: "You can take the Hide action even when you are obscured only by a creature at least one size larger than you." },
    ],
    description: "Halflings are affable and courageous folk, small in stature but big-hearted.",
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    size: "Medium",
    speed: 30,
    traits: [
      { name: "Draconic Ancestry", description: "Choose a damage type (acid, cold, fire, lightning, or poison) associated with a type of dragon." },
      { name: "Breath Weapon", description: "As an action, exhale destructive energy in a 15-foot cone (or 30-foot line for some ancestries); creatures make a DC 8+CON mod+proficiency bonus save, taking damage that scales with level." },
      { name: "Damage Resistance", description: "Resistance to the damage type associated with your Draconic Ancestry." },
      { name: "Darkvision", description: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
    ],
    description: "Born of dragons, dragonborn walk proudly through a world that greets them with fear and suspicion.",
  },
  {
    id: "gnome",
    name: "Gnome",
    size: "Small",
    speed: 30,
    traits: [
      { name: "Darkvision", description: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Gnomish Cunning", description: "Advantage on Intelligence, Wisdom, and Charisma saving throws against spells and magical effects." },
      { name: "Gnomish Lineage", description: "Choose Forest or Rock lineage, granting a cantrip (Minor Illusion or Mending) and a related minor benefit." },
    ],
    description: "Gnomes are small, energetic people with a natural gift for invention and illusion.",
  },
  {
    id: "orc",
    name: "Orc",
    size: "Medium",
    speed: 30,
    traits: [
      { name: "Adrenaline Rush", description: "As a bonus action, Dash and gain temporary hit points equal to your proficiency bonus; usable a number of times per Long Rest equal to your proficiency bonus (min 1)." },
      { name: "Darkvision", description: "You can see in dim light within 120 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Relentless Endurance", description: "When reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once per Long Rest." },
    ],
    description: "Orcs are a fierce, proud people, as physically powerful as they are quick to feel.",
  },
  {
    id: "tiefling",
    name: "Tiefling",
    size: "Medium",
    speed: 30,
    traits: [
      { name: "Darkvision", description: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fiendish Legacy", description: "Choose Abyssal, Chthonic, or Infernal legacy, granting a resistance and access to the Thaumaturgy cantrip plus higher-level spells as you gain levels." },
      { name: "Otherworldly Presence", description: "You know the Thaumaturgy cantrip." },
    ],
    description: "Tieflings carry the legacy of an infernal bargain struck generations ago, marked by their fiendish heritage.",
  },
  {
    id: "goliath",
    name: "Goliath",
    size: "Medium",
    speed: 35,
    traits: [
      { name: "Giant Ancestry", description: "Choose a benefit tied to a giant lineage (e.g. Cloud's Jaunt teleport, Stone's Endurance damage reduction); usable a number of times per Long Rest equal to your proficiency bonus." },
      { name: "Large Form", description: "Starting at level 5, you can grow to Large size for a short time as a bonus action, a limited number of times per Long Rest." },
      { name: "Powerful Build", description: "Advantage on checks made to escape a grapple; you count as one size larger when determining carrying capacity." },
    ],
    description: "Goliaths are wanderers descended from giants, valuing personal strength and competition.",
  },
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(
  SPECIES.map((s) => [s.id, s]),
);
