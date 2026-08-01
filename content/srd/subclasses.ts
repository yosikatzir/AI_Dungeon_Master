import type { Subclass } from "@/lib/rules/types";

export const SUBCLASSES: Subclass[] = [
  {
    id: "path_of_the_berserker",
    classId: "barbarian",
    name: "Path of the Berserker",
    description: "A path of pure, controlled fury.",
    features: [
      { level: 3, name: "Frenzy", description: "While raging, make a single melee weapon attack as a bonus action each turn; taking frenzied exhaustion when the rage ends." },
    ],
  },
  {
    id: "college_of_lore",
    classId: "bard",
    name: "College of Lore",
    description: "Bards who collect knowledge and stories from across the realms.",
    features: [
      { level: 3, name: "Bonus Proficiencies", description: "Gain proficiency in three skills of your choice." },
      { level: 3, name: "Cutting Words", description: "Use Bardic Inspiration reactively to subtract from an enemy's attack, check, or damage roll." },
    ],
  },
  {
    id: "life_domain",
    classId: "cleric",
    name: "Life Domain",
    description: "Clerics devoted to the vibrant positive energy that sustains life.",
    features: [
      { level: 3, name: "Disciple of Life", description: "Your healing spells restore additional hit points." },
    ],
  },
  {
    id: "circle_of_the_land",
    classId: "druid",
    name: "Circle of the Land",
    description: "Druids bonded to the magic of a particular kind of landscape.",
    features: [
      { level: 3, name: "Natural Recovery", description: "Recover some expended spell slots during a Short Rest." },
    ],
  },
  {
    id: "champion",
    classId: "fighter",
    name: "Champion",
    description: "Fighters who focus on raw physical excellence honed to deadly perfection.",
    features: [
      { level: 3, name: "Improved Critical", description: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
    ],
  },
  {
    id: "warrior_of_the_open_hand",
    classId: "monk",
    name: "Warrior of the Open Hand",
    description: "Monks who master unarmed combat to seize control of every exchange.",
    features: [
      { level: 3, name: "Open Hand Technique", description: "When you hit with a Martial Arts attack, impose an extra effect: knock prone, push 15 feet, or prevent Reactions." },
    ],
  },
  {
    id: "oath_of_devotion",
    classId: "paladin",
    name: "Oath of Devotion",
    description: "Paladins bound to the loftiest ideals of justice, virtue, and order.",
    features: [
      { level: 3, name: "Sacred Weapon", description: "As an action, imbue a weapon with positive energy, adding your Charisma modifier to attack rolls and making it magical." },
    ],
  },
  {
    id: "hunter",
    classId: "ranger",
    name: "Hunter",
    description: "Rangers who master specialized tactics for hunting the deadliest of prey.",
    features: [
      { level: 3, name: "Hunter's Prey", description: "Choose a combat technique such as Colossus Slayer or Horde Breaker." },
    ],
  },
  {
    id: "thief",
    classId: "rogue",
    name: "Thief",
    description: "Rogues who hone skills at infiltration, larceny, and the use of tools of the trade.",
    features: [
      { level: 3, name: "Fast Hands", description: "Use your Cunning Action bonus action to make a Sleight of Hand check, use thieves' tools, or take the Use an Object action." },
    ],
  },
  {
    id: "draconic_bloodline",
    classId: "sorcerer",
    name: "Draconic Bloodline",
    description: "Sorcerers whose magic springs from draconic ancestry.",
    features: [
      { level: 3, name: "Draconic Resilience", description: "Your hit point maximum increases, and your AC equals 10 + Dexterity modifier + Charisma modifier when unarmored." },
    ],
  },
  {
    id: "the_fiend",
    classId: "warlock",
    name: "The Fiend",
    description: "A patron from the lower planes, focused on fire and the corruption of souls.",
    features: [
      { level: 1, name: "Dark One's Blessing", description: "When you reduce a hostile creature to 0 hit points, gain temporary hit points." },
    ],
  },
  {
    id: "school_of_evocation",
    classId: "wizard",
    name: "School of Evocation",
    description: "Wizards who focus on spells that create powerful elemental effects.",
    features: [
      { level: 3, name: "Sculpt Spells", description: "Choose allies to automatically succeed on saves and take no damage from your evocation spells." },
    ],
  },
];

export const SUBCLASS_BY_ID: Record<string, Subclass> = Object.fromEntries(
  SUBCLASSES.map((s) => [s.id, s]),
);
