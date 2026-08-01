import type { Feat } from "@/lib/rules/types";

export const FEATS: Feat[] = [
  // Origin feats (2024 PHB) — every background grants one of these.
  {
    id: "alert",
    name: "Alert",
    category: "origin",
    prerequisite: null,
    benefits: [
      "+5 bonus to initiative rolls",
      "Can't be surprised while conscious",
      "When you roll initiative, you can swap places with a willing ally within 10 feet",
    ],
    description:
      "Always ready for danger, you gain a +5 bonus to initiative and can't be surprised while conscious.",
  },
  {
    id: "crafter",
    name: "Crafter",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Proficiency with three tools of your choice",
      "20% discount when buying nonmagical items",
      "Crafting time for nonmagical items is reduced by 20%",
    ],
    description:
      "You've learned crafting techniques that make you a more efficient artisan.",
  },
  {
    id: "healer",
    name: "Healer",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Using a Healer's Kit to stabilize a creature also restores 1 HP",
      "As an action, spend one use of a Healer's Kit to let a creature spend and roll a Hit Die, regaining HP equal to the roll plus its Constitution modifier",
    ],
    description: "Your training gives you the skill to mend wounds quickly.",
  },
  {
    id: "lucky",
    name: "Lucky",
    category: "origin",
    prerequisite: null,
    benefits: [
      "You have 3 Luck Points; expend one to give yourself advantage on an attack roll, ability check, or saving throw, or to impose disadvantage on an attack roll against you",
      "Luck Points refresh after a Long Rest",
    ],
    description: "Fate favors you, letting you reroll the odds in your favor.",
  },
  {
    id: "magic_initiate",
    name: "Magic Initiate",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Learn two cantrips and one 1st-level spell from the Cleric, Druid, or Wizard spell list",
      "Can cast the 1st-level spell once without a slot per Long Rest, and again using a spell slot if you have one",
    ],
    description: "A dabbler in the arcane or divine, you've learned a little magic.",
  },
  {
    id: "musician",
    name: "Musician",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Proficiency with three musical instruments of your choice",
      "You and up to 5 friendly creatures within 60 feet who can hear you playing gain a +1d4 bonus on ability checks during a Short or Long Rest",
    ],
    description: "You are trained in the ways of music.",
  },
  {
    id: "savage_attacker",
    name: "Savage Attacker",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Once per turn when you roll damage for a melee weapon attack, you can reroll the weapon's damage dice and use either total",
    ],
    description: "You've trained to deal particularly damaging strikes.",
  },
  {
    id: "skilled",
    name: "Skilled",
    category: "origin",
    prerequisite: null,
    benefits: ["Gain proficiency in any combination of three skills or tools"],
    description: "You have exceptional aptitude in a variety of skills.",
  },
  {
    id: "tavern_brawler",
    name: "Tavern Brawler",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Proficiency with improvised weapons and unarmed strikes",
      "Your unarmed strike deals 1d4 damage",
      "When you hit with an unarmed strike or improvised weapon, you can push the target 5 feet or knock it prone (once per turn)",
    ],
    description: "Accustomed to rough-and-tumble fighting, you know how to turn anything into a weapon.",
  },
  {
    id: "tough",
    name: "Tough",
    category: "origin",
    prerequisite: null,
    benefits: [
      "Your hit point maximum increases by 2 per character level",
      "Whenever you gain a level thereafter, your hit point maximum increases by an additional 2",
    ],
    description: "Your fortitude is extraordinary, granting you a heartier constitution.",
  },

  // A representative set of general feats (unlocked at ASI levels).
  {
    id: "great_weapon_master",
    name: "Great Weapon Master",
    category: "general",
    prerequisite: "Strength 13 or higher",
    benefits: [
      "Before making a melee attack with a heavy weapon you're proficient with, take -5 to the attack roll for +10 damage",
      "Immediately after scoring a critical hit or reducing a creature to 0 HP with a heavy weapon, make one bonus-action melee attack",
    ],
    description: "You've learned to put the weight of a weapon to devastating use.",
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    category: "general",
    prerequisite: "Dexterity 13 or higher",
    benefits: [
      "Attacking at long range doesn't impose disadvantage",
      "Ignore half and three-quarters cover for ranged attacks",
      "Before making a ranged weapon attack you're proficient with, take -5 to the attack roll for +10 damage",
    ],
    description: "You've mastered ranged weapons to a remarkable degree of precision.",
  },
  {
    id: "resilient",
    name: "Resilient",
    category: "general",
    prerequisite: null,
    benefits: [
      "Choose one ability; increase it by 1 (max 20)",
      "Gain proficiency in saving throws with the chosen ability",
    ],
    description: "You have honed your fortitude in a particular ability.",
  },
  {
    id: "mobile",
    name: "Mobile",
    category: "general",
    prerequisite: null,
    benefits: [
      "Your speed increases by 10 feet",
      "Difficult terrain doesn't cost extra movement when Dashing",
      "Making a melee attack against a creature doesn't provoke opportunity attacks from it for the rest of the turn",
    ],
    description: "You are exceptionally speedy and agile.",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    category: "general",
    prerequisite: "Proficiency with a martial weapon",
    benefits: [
      "When you hit a creature with an opportunity attack, its speed becomes 0 for the rest of the turn",
      "Creatures provoke opportunity attacks from you even if they Disengage",
      "When a creature within 5 feet attacks someone other than you, you can use your Reaction to make a melee attack against it",
    ],
    description: "You have mastered techniques to hinder the movement of your foes.",
  },
  {
    id: "polearm_master",
    name: "Polearm Master",
    category: "general",
    prerequisite: null,
    benefits: [
      "When you take the Attack action with a glaive, halberd, quarterstaff, or spear, you can make a bonus-action attack with the opposite end (1d4 bludgeoning)",
      "While wielding one of those weapons, other creatures provoke an opportunity attack from you when they enter your reach",
    ],
    description: "You can keep your enemies at bay with reach weapons.",
  },
  {
    id: "war_caster",
    name: "War Caster",
    category: "general",
    prerequisite: "Ability to cast at least one spell",
    benefits: [
      "Advantage on Constitution saving throws to maintain concentration",
      "Can perform somatic components even with weapons or a shield in hand",
      "Can cast a spell with a casting time of an action as your reaction to an opportunity-attack trigger",
    ],
    description: "You have practiced casting spells in the midst of combat.",
  },
  {
    id: "keen_mind",
    name: "Keen Mind",
    category: "general",
    prerequisite: null,
    benefits: [
      "+1 to Intelligence (max 20)",
      "Always know which way is north and the number of hours until the next sunrise/sunset",
      "Can accurately recall anything you've seen or heard within the past month",
    ],
    description: "You have a mind that can track time, direction, and detail with precision.",
  },

  // Fighting styles (their own feat-like category, chosen by martial classes).
  {
    id: "fighting_style_archery",
    name: "Archery",
    category: "fighting_style",
    prerequisite: null,
    benefits: ["+2 bonus to attack rolls made with ranged weapons"],
    description: "You have particular skill with ranged weapons.",
  },
  {
    id: "fighting_style_defense",
    name: "Defense",
    category: "fighting_style",
    prerequisite: null,
    benefits: ["+1 bonus to AC while wearing armor"],
    description: "You've learned to maximize your armor's protection.",
  },
  {
    id: "fighting_style_dueling",
    name: "Dueling",
    category: "fighting_style",
    prerequisite: null,
    benefits: [
      "+2 damage on attacks with a one-handed melee weapon, provided you're wielding no other weapon",
    ],
    description: "You fight best with a single one-handed weapon.",
  },
  {
    id: "fighting_style_great_weapon_fighting",
    name: "Great Weapon Fighting",
    category: "fighting_style",
    prerequisite: null,
    benefits: [
      "Reroll 1s and 2s on damage dice for two-handed or versatile melee weapons wielded with two hands",
    ],
    description: "You've learned to wield heavy weapons to great effect.",
  },
  {
    id: "fighting_style_protection",
    name: "Protection",
    category: "fighting_style",
    prerequisite: null,
    benefits: [
      "While wielding a shield, use your Reaction to impose disadvantage on an attack against a creature within 5 feet",
    ],
    description: "You use a shield to protect your allies as well as yourself.",
  },
  {
    id: "fighting_style_two_weapon_fighting",
    name: "Two-Weapon Fighting",
    category: "fighting_style",
    prerequisite: null,
    benefits: ["Add your ability modifier to the damage of your off-hand attack"],
    description: "You are skilled at fighting with two weapons at once.",
  },
];

export const FEAT_BY_ID: Record<string, Feat> = Object.fromEntries(
  FEATS.map((f) => [f.id, f]),
);
