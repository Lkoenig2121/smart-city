"use client";

import { CityCanvas } from "@/components/city/CityCanvas";
import { generateCity } from "@/lib/city/generateCity";
import Link from "next/link";
import { useMemo } from "react";

export default function VisionPage() {
  // The finished Modern-age city, on the same land the player starts on.
  const city = useMemo(() => generateCity(), []);

  return (
    <main className="relative h-dvh w-full">
      <CityCanvas initialState={city} readOnly />

      <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0e1726]/90 px-5 py-3 text-slate-100 shadow-xl backdrop-blur">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-amber-300/80">
              Age 6 · Modern
            </p>
            <h1 className="text-lg font-semibold">Riverside</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              What the valley becomes. Same river, same banks — roughly nine thousand
              years later.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-[#1a1206] transition hover:bg-amber-300"
          >
            Back to your camp
          </Link>
        </div>
      </div>
    </main>
  );
}
