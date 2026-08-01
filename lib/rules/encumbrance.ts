/** 2024 PHB: carrying capacity = Strength score × 15 lb. */
export function carryCapacity(strengthScore: number): number {
  return strengthScore * 15;
}

/** Encumbered at >5× STR score carried; heavily encumbered at >10× (which also exceeds capacity). */
export function encumbranceLevel(
  strengthScore: number,
  weightCarried: number,
): "none" | "encumbered" | "heavily_encumbered" {
  if (weightCarried > strengthScore * 10) return "heavily_encumbered";
  if (weightCarried > strengthScore * 5) return "encumbered";
  return "none";
}
