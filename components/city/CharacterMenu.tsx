"use client";

import { CharacterPreview } from "./CharacterPreview";
import {
  CLOTHING,
  clothingById,
  type ClothSlot,
} from "@/lib/city/clothing";
import { characterProgress } from "@/lib/city/progression";
import { ABILITIES, SKILL_PATHS, skillProgress, type SkillPath } from "@/lib/city/skills";
import { abilityUnlocked, characterStats, type LifeState } from "@/lib/city/character";
import { LEVEL_REWARDS } from "@/lib/city/rewards";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import { onPoliceDuty } from "@/lib/city/police";
import {
  deleteOutfit,
  equipOwned,
  saveCurrentOutfit,
  unequipSlot,
  wearOutfit,
} from "@/lib/city/wardrobe";
import { equipHeld } from "@/lib/city/bag";
import { bagList } from "@/lib/city/consumables";
import { useMemo, useState } from "react";

export type CharacterTab = "outfit" | "skills" | "inventory";

const TABS: { id: CharacterTab; label: string; key: string }[] = [
  { id: "outfit", label: "Outfit", key: "1" },
  { id: "skills", label: "Skills", key: "2" },
  { id: "inventory", label: "Inventory", key: "3" },
];

const SLOTS: { id: ClothSlot; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "upper", label: "Upper body" },
  { id: "lower", label: "Lower body" },
  { id: "feet", label: "Footwear" },
  { id: "accessory", label: "Accessories" },
];

interface Props {
  player: PlayerState;
  tab: CharacterTab;
  onTab: (tab: CharacterTab) => void;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
}

export function CharacterMenu({ player, tab, onTab, onPlayer, onClose }: Props) {
  const life = player.life;
  const progress = characterProgress(life.xp);
  const stats = characterStats(life);
  const next = LEVEL_REWARDS.find((item) => item.level === progress.level + 1);

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-[min(56rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#10141c]/95 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Character</p>
            <p className="text-lg font-semibold text-white">
              Level {progress.level}
              <span className="ml-2 text-sm font-medium text-slate-400">
                {progress.need ? `${progress.into} / ${progress.need} XP` : "Max"}
              </span>
            </p>
          </div>
          <p className="text-sm text-sky-100/80">Wallet {formatDollars(player.wallet)}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close · Esc
          </button>
        </header>
        <div className="h-1 bg-white/10">
          <div className="h-full bg-amber-400" style={{ width: `${progress.pct}%` }} />
        </div>
        <nav className="flex gap-1 border-b border-white/10 px-4 py-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === item.id ? "bg-amber-400 text-[#1a1206]" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
              <span className="ml-1 text-[0.65rem] opacity-60">{item.key}</span>
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "outfit" ? (
            <OutfitPane player={player} life={life} onPlayer={onPlayer} />
          ) : tab === "skills" ? (
            <SkillsPane life={life} nextName={next?.name ?? null} />
          ) : (
            <InventoryPane life={life} onPlayer={onPlayer} />
          )}
        </div>
        <p className="border-t border-white/10 px-5 py-2 text-[0.65rem] text-slate-500">
          Walk {Math.round(stats.walk * 100)}% · Run {Math.round(stats.run * 100)}% · Shop −
          {Math.round(stats.discount * 100)}% · I toggles this menu
        </p>
      </div>
    </div>
  );
}

function OutfitPane({
  player,
  life,
  onPlayer,
}: {
  player: PlayerState;
  life: LifeState;
  onPlayer: (player: PlayerState) => void;
}) {
  const [name, setName] = useState("New look");
  const locked = onPoliceDuty(player);
  const apply = (result: PlayerState | string) => {
    if (typeof result !== "string") onPlayer(result);
  };
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(18rem,20rem)_1fr]">
      <CharacterPreview slots={life.equipped} />
      <div className="space-y-3">
        {locked ? (
          <p className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
            On police duty — civilian outfit changes are locked until you end your shift.
          </p>
        ) : null}
        {SLOTS.map((slot) => {
          const id = life.equipped[slot.id];
          const item = clothingById(id ?? "");
          const options = CLOTHING.filter((piece) => piece.slot === slot.id && life.owned.includes(piece.id));
          return (
            <label key={slot.id} className="block text-sm text-slate-300">
              {slot.label}
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                value={id ?? ""}
                disabled={locked}
                onChange={(event) => {
                  const next = event.target.value;
                  apply(next ? equipOwned(next) : unequipSlot(slot.id));
                }}
              >
                <option value="">Empty</option>
                {options.map((piece) => (
                  <option key={piece.id} value={piece.id}>
                    {piece.name}
                  </option>
                ))}
              </select>
              {item ? <span className="mt-0.5 block text-[0.7rem] text-slate-500">{item.description}</span> : null}
            </label>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {life.outfits.map((outfit) => (
            <div key={outfit.id} className="group relative">
              <button
                type="button"
                disabled={locked}
                onClick={() => apply(wearOutfit(outfit.id))}
                className="rounded-lg bg-white/10 py-1.5 pl-3 pr-7 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40"
              >
                {outfit.name}
              </button>
              <button
                type="button"
                title={`Delete ${outfit.name}`}
                aria-label={`Delete ${outfit.name}`}
                disabled={locked}
                onClick={(event) => {
                  event.stopPropagation();
                  apply(deleteOutfit(outfit.id));
                }}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[0.65rem] leading-none text-white/80 ring-1 ring-white/20 group-hover:flex hover:bg-rose-500 hover:text-white disabled:hidden"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            disabled={locked}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
            placeholder="Outfit name"
          />
          <button
            type="button"
            disabled={locked}
            onClick={() => apply(saveCurrentOutfit(name))}
            className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-[#1a1206] disabled:opacity-40"
          >
            Save outfit
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsPane({ life, nextName }: { life: LifeState; nextName: string | null }) {
  const [path, setPath] = useState<SkillPath>("athletics");
  const progress = characterProgress(life.xp);
  const skill = skillProgress(life.skills[path]);
  const nodes = ABILITIES.filter((item) => item.path === path);
  return (
    <div>
      <p className="text-sm text-slate-300">
        Character level {progress.level}
        {nextName ? ` · next: ${nextName}` : " · maxed"}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SKILL_PATHS.map((item) => {
          const p = skillProgress(life.skills[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPath(item.id)}
              className={`rounded-lg px-3 py-2 text-left text-xs ${
                path === item.id ? "bg-amber-400 text-[#1a1206]" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <span className="block font-semibold">{item.name}</span>
              <span className="opacity-80">Lv {p.level}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-slate-400">{SKILL_PATHS.find((item) => item.id === path)?.blurb}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-sky-300" style={{ width: `${skill.pct}%` }} />
      </div>
      <p className="mt-1 text-[0.7rem] text-slate-500">
        {skill.need ? `${skill.into} / ${skill.need} skill XP` : "Path maxed"}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {nodes.map((ability) => {
          const open = abilityUnlocked(life, ability.id);
          return (
            <div
              key={ability.id}
              className={`rounded-xl border px-3 py-2 ${
                open ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-black/25"
              }`}
            >
              <p className="text-sm font-semibold text-white">{ability.name}</p>
              <p className="text-[0.65rem] uppercase tracking-wider text-slate-400">
                {ability.kind} · {open ? "unlocked" : `skill ${ability.skillLevel}`}
              </p>
              <p className="mt-1 text-xs text-slate-300">{ability.description}</p>
              {!open && ability.requires?.length ? (
                <p className="mt-1 text-[0.65rem] text-slate-500">Needs {ability.requires.join(", ")}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryPane({ life, onPlayer }: { life: LifeState; onPlayer: (player: PlayerState) => void }) {
  const groups = useMemo(() => {
    const clothing = life.owned.map((id) => clothingById(id)).filter(Boolean);
    return {
      clothing: clothing.filter((item) => item && item.category === "clothing"),
      accessories: clothing.filter((item) => item && item.category === "accessories"),
    };
  }, [life.owned]);
  const snacks = useMemo(() => bagList(life.bag ?? {}), [life.bag]);
  return (
    <div className="space-y-4">
      {(["clothing", "accessories"] as const).map((group) => (
        <div key={group}>
          <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300/80">{group}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups[group].map((item) =>
              item ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const next = equipOwned(item.id);
                    if (typeof next !== "string") onPlayer(next);
                  }}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-amber-300/40"
                >
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-[0.7rem] text-slate-400">{item.description}</p>
                  <p className="mt-1 text-[0.65rem] text-amber-200/80">
                    {item.slot}
                    {life.equipped[item.slot] === item.id ? " · equipped" : " · click to wear"}
                  </p>
                </button>
              ) : null,
            )}
          </div>
        </div>
      ))}
      {!life.owned.length ? <p className="text-sm text-slate-400">Your inventory is empty.</p> : null}
      <div>
        <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300/80">Tools</p>
        <p className="text-xs text-slate-400">
          Technical abilities unlock repair and craft tools. They stay on the Skills tab until you use a workbench.
        </p>
      </div>
      <div>
        <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300/80">Consumables</p>
        {snacks.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {snacks.map((item) => {
              const count = life.bag[item.id] ?? 0;
              const equipped = life.held === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const next = equipHeld(item.id);
                    if (typeof next !== "string") onPlayer(next);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left ${
                    equipped ? "border-amber-300/50 bg-amber-400/10" : "border-white/10 bg-black/30 hover:border-amber-300/40"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-[0.7rem] text-slate-400">{item.detail}</p>
                  <p className="mt-1 text-[0.65rem] text-amber-200/80">
                    {item.kind}
                    {count > 1 ? ` · ×${count}` : ""}
                    {equipped ? ` · equipped · click in view to ${item.kind === "drink" ? "drink" : "eat"}` : " · click to hold"}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Buy drinks and food at the roof-deck cabana, then equip them here.</p>
        )}
      </div>
      <div>
        <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300/80">Special items</p>
        <p className="text-xs text-slate-400">Hotel keys and transit passes stay with their buildings.</p>
      </div>
    </div>
  );
}
