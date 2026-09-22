"use client";

import {
  FURNISHINGS,
  clearFurnishSlot,
  clearRoomStylePreview,
  equipFurnishing,
  furnishById,
  setRoomStylePreview,
  type FurnishItem,
  type FurnishSlot,
  type RoomLoadout,
} from "@/lib/city/furnishings";
import type { PlayerState } from "@/lib/city/player";
import { useMemo, useState } from "react";

const SLOTS: { id: FurnishSlot; label: string }[] = [
  { id: "floor", label: "Floor" },
  { id: "bed", label: "Bed" },
  { id: "tv", label: "TV" },
  { id: "console", label: "Console" },
];

function loadoutKey(slot: FurnishSlot): keyof RoomLoadout {
  if (slot === "floor") return "floorId";
  if (slot === "bed") return "bedId";
  if (slot === "tv") return "tvId";
  return "consoleId";
}

function equippedForSlot(player: PlayerState, slot: FurnishSlot): string | null {
  return player.equippedFurnish[loadoutKey(slot)];
}

/**
 * In-room customizer: equip pieces you already own from the mall.
 * Unowned catalog rows can be selected to preview the look only.
 * Purchases stay at Harbor Mall furniture shops.
 */
export function RoomCustomize({
  player,
  onPlayer,
  onApplied,
  onClose,
}: {
  player: PlayerState;
  onPlayer: (player: PlayerState) => void;
  /** Called after a change that should rebuild the 3D room. */
  onApplied: () => void;
  onClose: () => void;
}) {
  const [slot, setSlot] = useState<FurnishSlot>("floor");
  const [note, setNote] = useState<string | null>(null);
  /** Catalog id or "stock" while observing; null follows permanent equip. */
  const [observeId, setObserveId] = useState<string | "stock" | null>(null);

  const catalogInSlot = useMemo(
    () => FURNISHINGS.filter((item) => item.slot === slot),
    [slot],
  );
  const equippedId = equippedForSlot(player, slot);
  const selectedId = observeId ?? equippedId ?? (slot === "floor" || slot === "bed" ? "stock" : null);

  const previewSlot = (itemId: string | null) => {
    setRoomStylePreview({ [loadoutKey(slot)]: itemId });
    onApplied();
  };

  const finishClose = () => {
    clearRoomStylePreview();
    onApplied();
    onClose();
  };

  const apply = (result: PlayerState | string, ok: string) => {
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    clearRoomStylePreview();
    setObserveId(null);
    onPlayer(result);
    setNote(ok);
    onApplied();
  };

  const selectStock = () => {
    setObserveId("stock");
    setNote("Previewing stock look · not saved until you use it.");
    previewSlot(null);
  };

  const selectItem = (item: FurnishItem) => {
    const owned = player.ownedFurnishings.includes(item.id);
    setObserveId(item.id);
    setNote(
      owned
        ? `Viewing ${item.name}.`
        : `Previewing ${item.name} · buy at Harbor Mall to keep it.`,
    );
    previewSlot(item.id);
  };

  const swatch = (item: FurnishItem | null, stock: boolean) => {
    if (stock) {
      return slot === "floor" ? "#cfc4b4" : slot === "bed" ? "#f4f1ea" : "#1a2434";
    }
    if (!item) return "#1a2434";
    if (item.slot === "floor") return item.floorColor ?? "#888";
    if (item.slot === "bed") return item.bedColor ?? "#f4f1ea";
    return "linear-gradient(160deg, #1a2434, #0c121c)";
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex justify-end p-3 sm:p-4">
      <div className="pointer-events-auto flex max-h-[min(44rem,calc(100vh-1.5rem))] w-[min(24rem,calc(100%-0.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/35 bg-[#12161e]/92 shadow-2xl backdrop-blur-md">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              Room
            </p>
            <p className="text-lg font-semibold text-white">Customize</p>
            <p className="text-sm text-sky-100/75">
              Preview any look · keep only what you own
            </p>
          </div>
          <button
            type="button"
            onClick={finishClose}
            className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close · Esc
          </button>
        </header>

        <div className="flex gap-1 border-b border-white/10 px-3 pt-3">
          {SLOTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                clearRoomStylePreview();
                setSlot(item.id);
                setObserveId(null);
                setNote(null);
                onApplied();
              }}
              className={`rounded-t-lg px-2.5 py-2 text-xs font-semibold ${
                slot === item.id
                  ? "bg-amber-400/20 text-amber-100"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {slot === "floor" || slot === "bed" ? (
            <div
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                selectedId === "stock"
                  ? "border-amber-300/50 bg-amber-400/15"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <button
                type="button"
                onClick={selectStock}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-lg border border-white/15"
                  style={{ background: swatch(null, true) }}
                />
                <span>
                  <p className="text-sm font-semibold text-white">
                    {slot === "floor" ? "Stock carpet" : "Stock linens"}
                  </p>
                  <p className="text-[0.65rem] text-slate-400">
                    Default hotel / apartment {slot === "floor" ? "floor" : "bedding"}
                  </p>
                  {!equippedId && observeId !== "stock" ? (
                    <p className="mt-0.5 text-[0.65rem] text-amber-100/80">Equipped</p>
                  ) : null}
                  {observeId === "stock" && equippedId ? (
                    <p className="mt-0.5 text-[0.65rem] text-sky-200/80">Preview only</p>
                  ) : null}
                </span>
              </button>
              {equippedId ? (
                <button
                  type="button"
                  onClick={() =>
                    apply(
                      clearFurnishSlot(slot),
                      slot === "floor"
                        ? "Restored the stock floor."
                        : "Restored the stock bed linens.",
                    )
                  }
                  className="shrink-0 rounded-lg bg-sky-400 px-3 py-1.5 text-xs font-semibold text-[#0a1220]"
                >
                  Use
                </button>
              ) : (
                <span className="shrink-0 px-2 text-[0.65rem] text-amber-100/70">In use</span>
              )}
            </div>
          ) : null}

          {catalogInSlot.map((item) => {
            const owned = player.ownedFurnishings.includes(item.id);
            const equipped = equippedId === item.id;
            const observing = selectedId === item.id;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  observing
                    ? "border-amber-300/50 bg-amber-400/15"
                    : "border-white/10 bg-black/25"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectItem(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/15 text-[0.55rem] font-semibold text-white/80"
                    style={{ background: swatch(item, false) }}
                  >
                    {item.slot === "tv" ? "TV" : item.slot === "console" ? "PS" : null}
                  </span>
                  <span className="min-w-0">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-[0.65rem] text-slate-400">{item.description}</p>
                    {equipped && observeId == null ? (
                      <p className="mt-0.5 text-[0.65rem] text-amber-100/80">Equipped</p>
                    ) : null}
                    {observing && !equipped ? (
                      <p className="mt-0.5 text-[0.65rem] text-sky-200/80">
                        {owned ? "Selected" : "Preview only · not owned"}
                      </p>
                    ) : null}
                  </span>
                </button>
                {owned ? (
                  <button
                    type="button"
                    disabled={equipped && observeId == null}
                    onClick={() =>
                      apply(equipFurnishing(item.id), `Equipped ${item.name}.`)
                    }
                    className="shrink-0 rounded-lg bg-sky-400 px-3 py-1.5 text-xs font-semibold text-[#0a1220] disabled:opacity-40"
                  >
                    {equipped && observeId == null ? "In use" : "Use"}
                  </button>
                ) : (
                  <span className="shrink-0 max-w-[4.5rem] text-right text-[0.6rem] leading-tight text-slate-500">
                    Buy at mall
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {note ? (
          <p className="border-t border-white/10 px-4 py-2 text-sm text-amber-200">
            {note}
          </p>
        ) : (
          <p className="border-t border-white/10 px-4 py-2 text-[0.65rem] text-slate-500">
            Select any item to preview in the room. Only owned pieces can be kept.
            {equippedId
              ? ` Saved: ${furnishById(equippedId)?.name ?? "custom"}`
              : " Saved: stock look"}
          </p>
        )}
      </div>
    </div>
  );
}
