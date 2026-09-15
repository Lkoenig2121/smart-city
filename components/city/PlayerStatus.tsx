"use client";

import {
  formatDollars,
  BANK_RATE_LABEL,
  nextOfficeRank,
  OFFICE_TASK_COUNT,
  officeRank,
  readPlayer,
  totalBalance,
  type PlayerState,
} from "@/lib/city/player";
import { characterProgress } from "@/lib/city/progression";

interface Props {
  player?: PlayerState;
}

export function PlayerStatus({ player = readPlayer() }: Props) {
  const rank = player.career ? officeRank(player.career.xp) : null;
  const next = player.career ? nextOfficeRank(player.career.xp) : null;
  const xpInto = player.career && rank ? player.career.xp - rank.xp : 0;
  const xpSpan = next && rank ? next.xp - rank.xp : 1;
  const life = characterProgress(player.life.xp);
  const shift = player.shift
    ? `On the clock · ${player.shift.completedTaskIds.length}/${OFFICE_TASK_COUNT}`
    : player.career
      ? "Off the clock"
      : "Unemployed";

  return (
    <div className="rounded-xl border border-white/10 bg-black/45 px-3.5 py-2 backdrop-blur">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-300/80">You</p>
      <p className="text-sm font-semibold tabular-nums text-white">{formatDollars(totalBalance(player))}</p>
      <p className="text-[0.7rem] text-sky-100/80">
        Wallet {formatDollars(player.wallet)} · Bank {formatDollars(player.bank)}
        {player.bank > 0 ? ` · ${BANK_RATE_LABEL}` : ""}
      </p>
      <p className="text-[0.7rem] text-white">
        Level {life.level}
        <span className="text-slate-400">
          {life.need ? ` · ${life.into}/${life.need} XP · I inventory` : " · max · I inventory"}
        </span>
      </p>
      <p className="text-[0.7rem] text-slate-300">
        {player.career ? `Office · ${rank?.label}` : "No job yet"} · {shift}
      </p>
      {player.ledger[0] ? (
        <p className="mt-0.5 truncate text-[0.65rem] text-slate-400">
          {player.ledger[0].kind === "earn" ? "+" : player.ledger[0].kind === "spend" ? "−" : ""}
          {formatDollars(player.ledger[0].amount)} · {player.ledger[0].description}
        </p>
      ) : null}
      {player.career && next ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${Math.max(8, Math.min(100, (xpInto / xpSpan) * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
