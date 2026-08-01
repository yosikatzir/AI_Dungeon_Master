"use client";

export interface TurnEntry {
  characterId: number;
  name: string;
  initiative: number;
}

export interface CombatStateProps {
  active: boolean;
  turnOrder: TurnEntry[];
  currentTurnIndex: number;
}

export default function InitiativeTracker({
  combat,
  onRollInitiative,
  onNextTurn,
  onEndCombat,
}: {
  combat: CombatStateProps;
  onRollInitiative: () => void;
  onNextTurn: () => void;
  onEndCombat: () => void;
}) {
  return (
    <div className="rounded border border-amber-800/30 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-amber-200/50">Initiative</h3>
        {combat.active ? (
          <button onClick={onEndCombat} className="text-xs text-red-300 underline">
            End combat
          </button>
        ) : (
          <button onClick={onRollInitiative} className="text-xs text-amber-300 underline">
            Roll initiative
          </button>
        )}
      </div>

      {combat.active && combat.turnOrder.length > 0 && (
        <>
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {combat.turnOrder.map((entry, i) => (
              <li
                key={entry.characterId}
                className={`flex justify-between rounded px-2 py-1 ${
                  i === combat.currentTurnIndex ? "bg-amber-800/40 text-amber-100" : "text-amber-200/70"
                }`}
              >
                <span>{entry.name}</span>
                <span>{entry.initiative}</span>
              </li>
            ))}
          </ol>
          <button
            onClick={onNextTurn}
            className="mt-2 w-full rounded border border-amber-700/40 py-1 text-xs text-amber-200 hover:bg-amber-900/30"
          >
            Next Turn
          </button>
        </>
      )}
    </div>
  );
}
