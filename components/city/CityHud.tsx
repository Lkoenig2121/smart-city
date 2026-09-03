import { formatMoney, kindLabel } from "@/lib/simulation/buildings/buildings";
import type { Building, Tool } from "@/lib/city/types";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "inspect", label: "Inspect", hint: "Select a building" },
  { id: "road", label: "Roads", hint: "Lay asphalt" },
  { id: "house", label: "Homes", hint: "Place a house" },
  { id: "apartment", label: "Flats", hint: "Place apartments" },
  { id: "shop", label: "Shops", hint: "Place a business" },
  { id: "office", label: "Offices", hint: "Place an office" },
  { id: "park", label: "Parks", hint: "Grow a park tile" },
  { id: "tree", label: "Trees", hint: "Plant a tree" },
  { id: "bulldoze", label: "Clear", hint: "Remove a tile" },
];

interface HudProps {
  cityName: string;
  population: number;
  treasury: number;
  day: string;
  time: string;
  phase: string;
  tool: Tool;
  selected: Building | null;
  hoverLabel: string;
  onTool: (tool: Tool) => void;
  onClose: () => void;
}

export function CityHud({
  cityName,
  population,
  treasury,
  day,
  time,
  phase,
  tool,
  selected,
  hoverLabel,
  onTool,
  onClose,
}: HudProps) {
  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101826]/72 px-4 py-3 shadow-2xl backdrop-blur-md">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-300 to-emerald-500 text-lg font-semibold text-[#102033]">
            ⌂
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">
              SmartCity
            </p>
            <p className="text-lg font-semibold leading-tight text-white">{cityName}</p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#101826]/72 px-3 py-2 text-sm text-white/90 shadow-2xl backdrop-blur-md">
          <Stat label="Population" value={population.toLocaleString()} />
          <span className="h-8 w-px bg-white/10" />
          <Stat label="Treasury" value={formatMoney(treasury)} />
          <span className="h-8 w-px bg-white/10" />
          <Stat label={day} value={`${time} · ${phase}`} />
        </div>
      </header>

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[min(920px,94vw)] -translate-x-1/2">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#101826]/78 p-2 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {TOOLS.map((item) => {
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() => onTool(item.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white text-[#132033]"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="pt-1 text-center text-[11px] text-white/45">
            Scroll to zoom · Drag to pan · Click to {TOOLS.find((t) => t.id === tool)?.hint.toLowerCase()}
            {hoverLabel ? ` · ${hoverLabel}` : ""}
          </p>
        </div>
      </div>

      {selected ? (
        <aside className="absolute right-4 top-24 z-20 w-80 rounded-2xl border border-white/10 bg-[#101826]/82 p-4 text-white shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-sky-200/70">
                {kindLabel(selected.kind)}
              </p>
              <h2 className="text-xl font-semibold leading-tight">{selected.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info
              label={selected.stats.capacity && selected.kind !== "shop" ? "People" : "Staff"}
              value={
                selected.kind === "house" || selected.kind === "apartment"
                  ? `${selected.stats.residents}/${selected.stats.capacity}`
                  : `${selected.stats.employees}`
              }
            />
            <Info label="Happiness" value={`${selected.stats.happiness}%`} />
            <Info
              label={selected.stats.revenue ? "Revenue" : "Value"}
              value={formatMoney(selected.stats.revenue || selected.stats.propertyValue)}
            />
            <Info label="Status" value={selected.stats.status === "open" ? "Open" : selected.stats.status} />
          </div>
          {selected.stats.extra ? (
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm text-white/70">
              {Object.entries(selected.stats.extra).map(([key, value]) => (
                <p key={key} className="flex justify-between capitalize">
                  <span>{key}</span>
                  <span className="text-white">{value}</span>
                </p>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px] px-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
