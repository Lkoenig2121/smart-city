"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/city/calendar";
import type { CityClock } from "@/lib/city/types";
import { BALLCLUBS, GAME_END_MINUTE, SERIES_HOST_CITY, leagueStatus } from "@/lib/city/stadium";

/** Closable league table + World Series tracker, shown under the player card. */
export function LeaguePanel({ clock, cityId }: { clock: CityClock; cityId: string }) {
  const [open, setOpen] = useState(true);
  const { year, dayOfYear, minuteOfDay, dayIndex } = clock;
  const afterFinal = minuteOfDay >= GAME_END_MINUTE;
  const status = useMemo(
    () => leagueStatus({ year, dayOfYear, dayIndex, minuteOfDay: afterFinal ? GAME_END_MINUTE : 0 }),
    [year, dayOfYear, dayIndex, afterFinal],
  );
  const host = BALLCLUBS[SERIES_HOST_CITY].parkName;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-[#0e1520]/85 px-3 py-1.5 text-[0.7rem] font-semibold text-sky-100 backdrop-blur hover:bg-[#16202e]"
      >
        ⚾ League standings
      </button>
    );
  }

  const series = status.series;
  let footer: string;
  if (status.phase === "preseason") {
    footer = `Opening Day Apr 1${status.champion ? ` · Defending champs: ${status.champion.fullName}` : ""}`;
  } else if (status.phase === "regular") {
    footer = `Season ends Oct 24 · Top 2 meet in a best-of-7 World Series at ${host}`;
  } else if (status.phase === "complete" && status.champion && series) {
    const high = Math.max(series.topWins, series.secondWins);
    const low = Math.min(series.topWins, series.secondWins);
    footer = `🏆 ${status.champion.fullName} win the World Series ${high}–${low}`;
  } else if (series) {
    const a = series.topSeed.club.shortName;
    const b = series.secondSeed.club.shortName;
    const score =
      series.topWins === series.secondWins
        ? `tied ${series.topWins}–${series.secondWins}`
        : series.topWins > series.secondWins
          ? `${a} lead ${series.topWins}–${series.secondWins}`
          : `${b} lead ${series.secondWins}–${series.topWins}`;
    const when =
      series.nextDoy === clock.dayOfYear
        ? "tonight"
        : series.nextDoy !== null
          ? formatDate(clock.year, series.nextDoy)
          : "";
    footer =
      status.phase === "break"
        ? `World Series: ${a} vs ${b} · Game 1 ${when} at ${host}`
        : `World Series ${score} · Game ${series.nextGame} ${when} at ${host}`;
  } else {
    footer = "";
  }

  const finalists = new Set(series ? [series.topSeed.cityId, series.secondSeed.cityId] : []);

  return (
    <div className="w-68 rounded-xl border border-white/10 bg-[#0e1520]/85 px-3 py-2.5 text-white backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-sky-300">
          {status.phase === "series" || status.phase === "break"
            ? "World Series"
            : status.phase === "complete"
              ? "Final standings"
              : "League standings"}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close league standings"
          className="rounded px-1.5 text-sm leading-none text-white/50 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
      <table className="mt-1.5 w-full text-[0.72rem]">
        <thead>
          <tr className="text-[0.6rem] uppercase tracking-wider text-white/45">
            <th className="w-4 text-left font-medium">#</th>
            <th className="text-left font-medium">Team</th>
            <th className="text-right font-medium">W-L</th>
            <th className="w-10 text-right font-medium">GB</th>
          </tr>
        </thead>
        <tbody>
          {status.standings.map((row, i) => {
            const home = row.cityId === cityId;
            const berth = finalists.size ? finalists.has(row.cityId) : i < 2 && row.wins + row.losses > 0;
            return (
              <tr key={row.cityId} className={home ? "text-amber-200" : "text-white/90"}>
                <td className="py-0.5 text-white/45">{i + 1}</td>
                <td className="py-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.club.accent }} />
                    <span className={home ? "font-semibold" : ""}>{row.club.fullName}</span>
                    {berth ? <span className="text-[0.6rem] text-amber-300">★</span> : null}
                  </span>
                </td>
                <td className="py-0.5 text-right tabular-nums">
                  {row.wins}-{row.losses}
                </td>
                <td className="py-0.5 text-right tabular-nums text-white/60">
                  {row.gamesBack === 0 ? "—" : row.gamesBack.toFixed(1).replace(".0", "")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer ? <p className="mt-1.5 text-[0.65rem] leading-snug text-sky-100/75">{footer}</p> : null}
    </div>
  );
}
