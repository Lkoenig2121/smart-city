import { formatDaily, formatMoney, kindEmoji, kindLabel } from "@/lib/simulation/buildings/buildings";
import { isResidential } from "@/lib/simulation/buildings/buildingLogic";
import { weatherEmoji } from "@/lib/simulation/weather/weather";
import type { Building, CityEvent, CityWeather, Tool } from "@/lib/city/types";
import { formatDollars } from "@/lib/city/player";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "inspect", label: "Inspect", hint: "Select a building" },
  { id: "road", label: "Roads", hint: "Lay asphalt" },
  { id: "house", label: "Homes", hint: "Place a house" },
  { id: "apartment", label: "Flats", hint: "Place apartments" },
  { id: "hotel", label: "Hotel", hint: "Place a hotel · $320K · click an existing hotel to add 4 floors · $80K" },
  { id: "shop", label: "Shops", hint: "Place a business" },
  { id: "office", label: "Offices", hint: "Place an office" },
  { id: "stadium", label: "Stadium", hint: "Ravens Ballpark · $750K · 5,000 people, road, parking" },
  { id: "park", label: "Parks", hint: "Grow a park tile" },
  { id: "sand", label: "Sand", hint: "Paint a beach" },
  { id: "parking", label: "Parking", hint: "Paint a parking lot" },
  { id: "tree", label: "Trees", hint: "Plant a tree" },
  { id: "bulldoze", label: "Clear", hint: "Remove a tile" },
];

interface HudProps {
  cityName: string;
  population: number;
  treasury: number;
  day: string;
  date: string;
  time: string;
  phase: string;
  weather: CityWeather;
  events: CityEvent[];
  tool: Tool;
  selected: Building | null;
  hoverLabel: string;
  streetLife: number;
  wallet: number;
  careerLabel: string;
  onTool: (tool: Tool) => void;
  onClose: () => void;
  onEnterStreet: () => void;
  onEnterStation?: () => void;
}

export function CityHud({
  cityName,
  population,
  treasury,
  day,
  date,
  time,
  phase,
  weather,
  events,
  tool,
  selected,
  hoverLabel,
  streetLife,
  wallet,
  careerLabel,
  onTool,
  onClose,
  onEnterStreet,
  onEnterStation,
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
            <p className="text-lg font-semibold leading-tight text-white">
              {cityName}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#101826]/72 px-3 py-2 text-sm text-white/90 shadow-2xl backdrop-blur-md">
            <Stat label="Population" value={population.toLocaleString()} />
            <span className="h-8 w-px bg-white/10" />
            <Stat label="Out now" value={streetLife.toLocaleString()} />
            <span className="h-8 w-px bg-white/10" />
            <Stat label="Treasury" value={formatMoney(treasury)} />
            <span className="h-8 w-px bg-white/10" />
            <Stat label={careerLabel ? `You · ${careerLabel}` : "You"} value={formatDollars(wallet)} />
            <span className="h-8 w-px bg-white/10" />
            <Stat label={`${day} · ${date}`} value={`${time} · ${phase}`} />
            <span className="h-8 w-px bg-white/10" />
            <Stat
              label={weather.label}
              value={`${weatherEmoji(weather.kind)} ${weather.tempF}°`}
            />
          </div>

          <button
            type="button"
            onClick={onEnterStreet}
            title="Walk the streets in first person"
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400 to-emerald-500 px-3.5 py-3 text-sm font-semibold text-[#0a1a22] shadow-2xl transition hover:from-sky-300 hover:to-emerald-400"
          >
            <span className="text-base leading-none">👣</span>
            Street View
          </button>
        </div>
      </header>

      {events.length ? (
        <div className="pointer-events-none absolute left-4 top-24 z-20 w-[min(22rem,calc(100vw-2rem))] space-y-1.5">
          {events.slice(0, 4).map((event) => (
            <div
              key={event.id}
              className="pointer-events-auto rounded-xl border border-white/10 bg-[#101826]/78 px-3 py-2 text-sm text-white shadow-2xl backdrop-blur-md"
            >
              <p className="font-medium leading-snug">
                <span className="mr-1.5">{event.icon}</span>
                {event.headline}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">{event.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

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
            Scroll to zoom · Drag or WASD/arrows to pan · Click to{" "}
            {TOOLS.find((t) => t.id === tool)?.hint.toLowerCase()}
            {hoverLabel ? ` · ${hoverLabel}` : ""}
          </p>
        </div>
      </div>

      {selected ? (
        <aside className="absolute right-4 top-24 z-20 w-80 rounded-2xl border border-white/10 bg-[#101826]/82 p-4 text-white shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold leading-tight">
                {selected.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mb-3 text-sm text-white/70">
            {kindEmoji(selected)} {kindLabel(selected)}
            <span className="ml-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
              {selected.constructionLeft && selected.constructionLeft > 0
                ? `Building ${Math.ceil(selected.constructionLeft)}s`
                : selected.stats.status}
            </span>
          </p>
          <div className="space-y-2 text-sm">
            <Info
              icon={isResidential(selected) ? "👥" : "👥"}
              label={isResidential(selected) ? "Residents" : "Employees"}
              value={
                isResidential(selected)
                  ? `${selected.stats.residents.toLocaleString()} / ${selected.stats.capacity}`
                  : selected.stats.jobs
                    ? `${selected.stats.employees.toLocaleString()} / ${selected.stats.jobs.toLocaleString()}`
                    : selected.stats.employees.toLocaleString()
              }
            />
            <Info icon="💰" label="Economic output" value={formatDaily(selected.stats.revenue)} />
            <Meter icon="⚡" label="Energy" value={selected.stats.energy} />
            <Meter icon="🚗" label="Parking" value={selected.stats.parking} />
            <Meter icon="😊" label="Satisfaction" value={selected.stats.happiness} />
          </div>
          {selected.stats.extra ? (
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm text-white/70">
              {Object.entries(selected.stats.extra)
                .filter(([key]) => !HIDDEN_EXTRA.has(key))
                .map(([key, value]) => (
                  <p key={key} className="flex justify-between capitalize">
                    <span>{key}</span>
                    <span className="text-white">{value}</span>
                  </p>
                ))}
            </div>
          ) : null}
          {selected.kind === "subway_station" ? (
            <button
              type="button"
              onClick={onEnterStation}
              className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2.5 text-sm font-semibold text-[#1a1206]"
            >
              Enter station
            </button>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px] px-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

const HIDDEN_EXTRA = new Set([
  "station",
  "venue",
  "lodging",
  "waterfront",
]);

function Info({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
      <p className="text-white/70">
        <span className="mr-1.5">{icon}</span>
        {label}
      </p>
      <p className="font-medium text-white">{value}</p>
    </div>
  );
}

function Meter({ icon, label, value }: { icon: string; label: string; value: number }) {
  const tone =
    value >= 80 ? "bg-emerald-400" : value >= 55 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-white/70">
          <span className="mr-1.5">{icon}</span>
          {label}
        </p>
        <p className="font-medium text-white">{Math.round(value)}%</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
