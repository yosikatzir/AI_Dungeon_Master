import type { Equipment } from "@/lib/rules/types";

function weapon(
  id: string,
  name: string,
  costGp: number,
  weight: number,
  weaponType: "simple" | "martial",
  range: "melee" | "ranged",
  dice: string,
  damageType: string,
  properties: string[],
  versatileDamage?: string,
): Equipment {
  return {
    id,
    name,
    category: "weapon",
    costGp,
    weight,
    weapon: {
      weaponType,
      range,
      properties,
      damage: { dice, type: damageType },
      versatileDamage,
    },
    description: `${weaponType === "simple" ? "Simple" : "Martial"} ${range} weapon.`,
  };
}

function armor(
  id: string,
  name: string,
  costGp: number,
  weight: number,
  armorType: "light" | "medium" | "heavy" | "shield",
  baseAc: number,
  dexBonus: boolean,
  maxDexBonus: number | null,
  strengthRequirement: number | null,
  stealthDisadvantage: boolean,
): Equipment {
  return {
    id,
    name,
    category: "armor",
    costGp,
    weight,
    armor: {
      armorType,
      baseAc,
      dexBonus,
      maxDexBonus,
      strengthRequirement,
      stealthDisadvantage,
    },
    description: `${armorType[0].toUpperCase()}${armorType.slice(1)} armor.`,
  };
}

function gear(
  id: string,
  name: string,
  costGp: number,
  weight: number,
  description: string,
  category: "gear" | "tool" = "gear",
): Equipment {
  return { id, name, category, costGp, weight, description };
}

function pack(
  id: string,
  name: string,
  costGp: number,
  weight: number,
  contents: { equipmentId: string; quantity: number }[],
): Equipment {
  return {
    id,
    name,
    category: "pack",
    costGp,
    weight,
    pack: { contents },
    description: `Standard adventuring pack: ${name}.`,
  };
}

export const EQUIPMENT: Equipment[] = [
  // Simple melee weapons
  weapon("club", "Club", 0.1, 2, "simple", "melee", "1d4", "bludgeoning", ["light"]),
  weapon("dagger", "Dagger", 2, 1, "simple", "melee", "1d4", "piercing", [
    "finesse",
    "light",
    "thrown (range 20/60)",
  ]),
  weapon("greatclub", "Greatclub", 0.2, 10, "simple", "melee", "1d8", "bludgeoning", [
    "two-handed",
  ]),
  weapon("handaxe", "Handaxe", 5, 2, "simple", "melee", "1d6", "slashing", [
    "light",
    "thrown (range 20/60)",
  ]),
  weapon("javelin", "Javelin", 0.5, 2, "simple", "melee", "1d6", "piercing", [
    "thrown (range 30/120)",
  ]),
  weapon("light_hammer", "Light Hammer", 2, 2, "simple", "melee", "1d4", "bludgeoning", [
    "light",
    "thrown (range 20/60)",
  ]),
  weapon("mace", "Mace", 5, 4, "simple", "melee", "1d6", "bludgeoning", []),
  weapon("quarterstaff", "Quarterstaff", 0.2, 4, "simple", "melee", "1d6", "bludgeoning", [
    "versatile",
  ], "1d8"),
  weapon("sickle", "Sickle", 1, 2, "simple", "melee", "1d4", "slashing", ["light"]),
  weapon("spear", "Spear", 1, 3, "simple", "melee", "1d6", "piercing", [
    "thrown (range 20/60)",
    "versatile",
  ], "1d8"),

  // Simple ranged weapons
  weapon("dart", "Dart", 0.05, 0.25, "simple", "ranged", "1d4", "piercing", [
    "finesse",
    "thrown (range 20/60)",
  ]),
  weapon("light_crossbow", "Light Crossbow", 25, 5, "simple", "ranged", "1d8", "piercing", [
    "ammunition (range 80/320)",
    "loading",
    "two-handed",
  ]),
  weapon("shortbow", "Shortbow", 25, 2, "simple", "ranged", "1d6", "piercing", [
    "ammunition (range 80/320)",
    "two-handed",
  ]),
  weapon("sling", "Sling", 0.1, 0, "simple", "ranged", "1d4", "bludgeoning", [
    "ammunition (range 30/120)",
  ]),

  // Martial melee weapons
  weapon("battleaxe", "Battleaxe", 10, 4, "martial", "melee", "1d8", "slashing", [
    "versatile",
  ], "1d10"),
  weapon("flail", "Flail", 10, 2, "martial", "melee", "1d8", "bludgeoning", []),
  weapon("glaive", "Glaive", 20, 6, "martial", "melee", "1d10", "slashing", [
    "heavy",
    "reach",
    "two-handed",
  ]),
  weapon("greataxe", "Greataxe", 30, 7, "martial", "melee", "1d12", "slashing", [
    "heavy",
    "two-handed",
  ]),
  weapon("greatsword", "Greatsword", 50, 6, "martial", "melee", "2d6", "slashing", [
    "heavy",
    "two-handed",
  ]),
  weapon("halberd", "Halberd", 20, 6, "martial", "melee", "1d10", "slashing", [
    "heavy",
    "reach",
    "two-handed",
  ]),
  weapon("lance", "Lance", 10, 6, "martial", "melee", "1d10", "piercing", [
    "reach",
    "special (two-handed unless mounted)",
  ]),
  weapon("longsword", "Longsword", 15, 3, "martial", "melee", "1d8", "slashing", [
    "versatile",
  ], "1d10"),
  weapon("maul", "Maul", 10, 10, "martial", "melee", "2d6", "bludgeoning", [
    "heavy",
    "two-handed",
  ]),
  weapon("morningstar", "Morningstar", 15, 4, "martial", "melee", "1d8", "piercing", []),
  weapon("pike", "Pike", 5, 18, "martial", "melee", "1d10", "piercing", [
    "heavy",
    "reach",
    "two-handed",
  ]),
  weapon("rapier", "Rapier", 25, 2, "martial", "melee", "1d8", "piercing", ["finesse"]),
  weapon("scimitar", "Scimitar", 25, 3, "martial", "melee", "1d6", "slashing", [
    "finesse",
    "light",
  ]),
  weapon("shortsword", "Shortsword", 10, 2, "martial", "melee", "1d6", "piercing", [
    "finesse",
    "light",
  ]),
  weapon("trident", "Trident", 5, 4, "martial", "melee", "1d6", "piercing", [
    "thrown (range 20/60)",
    "versatile",
  ], "1d8"),
  weapon("war_pick", "War Pick", 5, 2, "martial", "melee", "1d8", "piercing", []),
  weapon("warhammer", "Warhammer", 15, 2, "martial", "melee", "1d8", "bludgeoning", [
    "versatile",
  ], "1d10"),
  weapon("whip", "Whip", 2, 3, "martial", "melee", "1d4", "slashing", ["finesse", "reach"]),

  // Martial ranged weapons
  weapon("blowgun", "Blowgun", 10, 1, "martial", "ranged", "1", "piercing", [
    "ammunition (range 25/100)",
    "loading",
  ]),
  weapon("hand_crossbow", "Hand Crossbow", 75, 3, "martial", "ranged", "1d6", "piercing", [
    "ammunition (range 30/120)",
    "light",
    "loading",
  ]),
  weapon("heavy_crossbow", "Heavy Crossbow", 50, 18, "martial", "ranged", "1d10", "piercing", [
    "ammunition (range 100/400)",
    "heavy",
    "loading",
    "two-handed",
  ]),
  weapon("longbow", "Longbow", 50, 2, "martial", "ranged", "1d8", "piercing", [
    "ammunition (range 150/600)",
    "heavy",
    "two-handed",
  ]),

  // Armor
  armor("padded", "Padded Armor", 5, 8, "light", 11, true, null, null, true),
  armor("leather", "Leather Armor", 10, 10, "light", 11, true, null, null, false),
  armor("studded_leather", "Studded Leather Armor", 45, 13, "light", 12, true, null, null, false),
  armor("hide", "Hide Armor", 10, 12, "medium", 12, true, 2, null, false),
  armor("chain_shirt", "Chain Shirt", 50, 20, "medium", 13, true, 2, null, false),
  armor("scale_mail", "Scale Mail", 50, 45, "medium", 14, true, 2, null, true),
  armor("breastplate", "Breastplate", 400, 20, "medium", 14, true, 2, null, false),
  armor("half_plate", "Half Plate Armor", 750, 40, "medium", 15, true, 2, null, true),
  armor("ring_mail", "Ring Mail", 30, 40, "heavy", 14, false, 0, null, true),
  armor("chain_mail", "Chain Mail", 75, 55, "heavy", 16, false, 0, 13, true),
  armor("splint", "Splint Armor", 200, 60, "heavy", 17, false, 0, 15, true),
  armor("plate", "Plate Armor", 1500, 65, "heavy", 18, false, 0, 15, true),
  armor("shield", "Shield", 10, 6, "shield", 2, false, 0, null, false),

  // Adventuring gear
  gear("backpack", "Backpack", 2, 5, "Holds 1 cubic foot / 30 lb of gear."),
  gear("bedroll", "Bedroll", 1, 7, "A basic bedroll for sleeping outdoors."),
  gear("mess_kit", "Mess Kit", 0.2, 1, "A tin cup, small pot, and utensils."),
  gear("tinderbox", "Tinderbox", 0.5, 1, "Flint, fire steel, and tinder for starting fires."),
  gear("torch", "Torch", 0.01, 1, "Burns for 1 hour, shedding bright light in a 20-ft radius."),
  gear("rations", "Rations (1 day)", 0.5, 2, "Dry food sufficient to sustain a person for one day."),
  gear("waterskin", "Waterskin", 0.2, 5, "Holds 4 pints of liquid."),
  gear("rope_hempen", "Rope, Hempen (50 feet)", 1, 10, "Has 2 hit points and can be burst with a DC 17 Strength check."),
  gear("rope_silk", "Rope, Silk (50 feet)", 10, 5, "Has 2 hit points and can be burst with a DC 17 Strength check."),
  gear("lantern_hooded", "Lantern, Hooded", 5, 2, "Casts bright light in a 30-ft radius; burns 1 pint of oil per 6 hours."),
  gear("oil_flask", "Oil (flask)", 0.1, 1, "Can be used as fuel or thrown as an improvised weapon."),
  gear("healers_kit", "Healer's Kit", 5, 3, "Has 10 uses. Stabilize a creature at 0 HP without a check."),
  gear("holy_symbol", "Holy Symbol", 5, 0, "A divine focus used to cast cleric and paladin spells."),
  gear("component_pouch", "Component Pouch", 25, 2, "A pouch of material spell components, usable as an arcane focus."),
  gear("arcane_focus_crystal", "Arcane Focus (Crystal)", 10, 1, "A focus for casting arcane spells."),
  gear("druidic_focus_sprig", "Druidic Focus (Sprig of Mistletoe)", 1, 0, "A focus for casting druid spells."),
  gear("thieves_tools", "Thieves' Tools", 25, 1, "Proficiency lets you pick locks and disarm traps.", "tool"),
  gear("crowbar", "Crowbar", 2, 5, "Grants advantage on Strength checks where leverage helps."),
  gear("grappling_hook", "Grappling Hook", 2, 4, "Can be attached to rope and thrown to catch a ledge."),
  gear("climbers_kit", "Climber's Kit", 25, 12, "Special pitons, boot tips, gloves, and a harness for climbing."),
  gear("spellbook", "Spellbook", 50, 3, "A wizard records spells here as they are learned."),
  gear("instrument_lute", "Musical Instrument (Lute)", 35, 2, "A bardic musical instrument.", "tool"),
  gear("herbalism_kit", "Herbalism Kit", 5, 3, "Used to craft potions of healing and identify plants.", "tool"),
  gear("playing_card_set", "Playing Card Set", 0.5, 0, "A deck of cards used for gaming.", "tool"),
  gear("disguise_kit", "Disguise Kit", 25, 3, "Cosmetics, hair dye, and props for disguises.", "tool"),
  gear("forgery_kit", "Forgery Kit", 15, 5, "Tools for duplicating seals and handwriting.", "tool"),
  gear("navigators_tools", "Navigator's Tools", 25, 2, "Tools for charting a course at sea.", "tool"),
  gear("poisoners_kit", "Poisoner's Kit", 50, 2, "Tools for handling and applying poison safely.", "tool"),
  gear("smiths_tools", "Smith's Tools", 20, 8, "Tools for forging and repairing metal items.", "tool"),
  gear("travelers_clothes", "Traveler's Clothes", 2, 4, "A sturdy set of clothes made for travel."),
  gear("calligraphers_supplies", "Calligrapher's Supplies", 10, 5, "Tools for fine writing and illumination.", "tool"),

  // Equipment packs
  pack("burglars_pack", "Burglar's Pack", 16, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "bedroll", quantity: 1 },
    { equipmentId: "rations", quantity: 5 },
    { equipmentId: "waterskin", quantity: 1 },
    { equipmentId: "rope_hempen", quantity: 1 },
    { equipmentId: "lantern_hooded", quantity: 1 },
    { equipmentId: "oil_flask", quantity: 2 },
  ]),
  pack("diplomats_pack", "Diplomat's Pack", 39, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "rations", quantity: 5 },
    { equipmentId: "mess_kit", quantity: 1 },
  ]),
  pack("dungeoneers_pack", "Dungeoneer's Pack", 12, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "bedroll", quantity: 1 },
    { equipmentId: "rations", quantity: 10 },
    { equipmentId: "waterskin", quantity: 1 },
    { equipmentId: "rope_hempen", quantity: 1 },
    { equipmentId: "torch", quantity: 10 },
    { equipmentId: "tinderbox", quantity: 1 },
  ]),
  pack("entertainers_pack", "Entertainer's Pack", 40, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "bedroll", quantity: 1 },
    { equipmentId: "rations", quantity: 5 },
    { equipmentId: "waterskin", quantity: 1 },
  ]),
  pack("explorers_pack", "Explorer's Pack", 10, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "bedroll", quantity: 1 },
    { equipmentId: "mess_kit", quantity: 1 },
    { equipmentId: "rations", quantity: 10 },
    { equipmentId: "waterskin", quantity: 1 },
    { equipmentId: "rope_hempen", quantity: 1 },
    { equipmentId: "tinderbox", quantity: 1 },
  ]),
  pack("priests_pack", "Priest's Pack", 33, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "bedroll", quantity: 1 },
    { equipmentId: "rations", quantity: 10 },
    { equipmentId: "waterskin", quantity: 1 },
    { equipmentId: "tinderbox", quantity: 1 },
  ]),
  pack("scholars_pack", "Scholar's Pack", 40, 0, [
    { equipmentId: "backpack", quantity: 1 },
    { equipmentId: "rations", quantity: 5 },
    { equipmentId: "waterskin", quantity: 1 },
  ]),
];

export const EQUIPMENT_BY_ID: Record<string, Equipment> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
);
