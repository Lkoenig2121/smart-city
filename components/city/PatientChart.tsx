"use client";

import {
  chartChoices,
  conditionFor,
  pageNextPatient,
  treatPatient,
  type TreatmentResult,
  type Vitals,
} from "@/lib/city/doctor";
import { formatDollars, type DoctorCase, type PlayerState } from "@/lib/city/player";
import type { CityState } from "@/lib/city/types";
import { useMemo, useState } from "react";

interface Props {
  doctorCase: DoctorCase;
  state: CityState;
  onPlayerChange?: (player: PlayerState) => void;
  onClose: () => void;
}

type Step = "chart" | "treat" | "done";
type Tone = "ok" | "warn" | "bad";

function toneOf(kind: keyof Vitals, vitals: Vitals): Tone {
  if (kind === "hr") return vitals.hr >= 120 || vitals.hr < 50 ? "bad" : vitals.hr >= 100 ? "warn" : "ok";
  if (kind === "spo2") return vitals.spo2 < 92 ? "bad" : vitals.spo2 < 95 ? "warn" : "ok";
  if (kind === "temp") return vitals.temp >= 38.5 ? "bad" : vitals.temp >= 37.8 ? "warn" : "ok";
  const systolic = Number(vitals.bp.split("/")[0]);
  if (!Number.isFinite(systolic)) return "ok";
  return systolic >= 160 || systolic < 90 ? "bad" : systolic >= 140 ? "warn" : "ok";
}

const TONE = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
};

export function PatientChart({ doctorCase, state, onPlayerChange, onClose }: Props) {
  const choices = useMemo(() => chartChoices(doctorCase), [doctorCase]);
  const [step, setStep] = useState<Step>("chart");
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<string | null>(null);
  const [result, setResult] = useState<TreatmentResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const condition = conditionFor(doctorCase.conditionId);
  const mrn = doctorCase.id.slice(-6).toUpperCase();

  const submitDiagnosis = () => {
    if (!diagnosis) {
      setNote("Choose a diagnosis before writing orders.");
      return;
    }
    setNote(null);
    setStep("treat");
  };

  const submitTreatment = () => {
    if (!diagnosis || !treatment) {
      setNote("Choose a treatment.");
      return;
    }
    const next = treatPatient(state, diagnosis, treatment);
    if (typeof next === "string") {
      setNote(next);
      return;
    }
    setResult(next.result);
    onPlayerChange?.(next.player);
    setStep("done");
  };

  const pageNext = () => {
    const next = pageNextPatient();
    if (typeof next === "string") {
      setNote(next);
      return;
    }
    onPlayerChange?.(next);
    onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center p-3 sm:p-6"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (step === "done") onClose();
      }}
    >
      <div
        className="flex max-h-[min(40rem,calc(100%-1rem))] w-[min(58rem,calc(100%-0.5rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#f3f6f7] text-[#14343a] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 bg-[#14343a] px-5 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-3xl font-black leading-none text-[#c0392b]">
              +
            </span>
            <div>
              <p className="text-[0.6rem] uppercase tracking-[0.28em] text-teal-200">Bedside chart</p>
              <p className="text-lg font-semibold leading-tight">{doctorCase.patientName}</p>
            </div>
          </div>
          <div className="text-right text-xs text-white/70">
            <p>
              {doctorCase.age} yrs · MRN {mrn}
            </p>
            <p className="text-teal-100">{doctorCase.bedLabel}</p>
            <p>{doctorCase.floorName}</p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[17rem_1fr]">
          <aside className="bg-[#0e1c22] p-4 text-white">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-teal-200">Monitor</p>
            {condition ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Readout label="HR" value={`${condition.vitals.hr}`} unit="bpm" tone={toneOf("hr", condition.vitals)} />
                <Readout label="BP" value={condition.vitals.bp} unit="mmHg" tone={toneOf("bp", condition.vitals)} />
                <Readout label="Temp" value={`${condition.vitals.temp}`} unit="°C" tone={toneOf("temp", condition.vitals)} />
                <Readout label="SpO₂" value={`${condition.vitals.spo2}`} unit="%" tone={toneOf("spo2", condition.vitals)} />
              </div>
            ) : null}
            <p className="mt-4 text-[0.6rem] uppercase tracking-[0.22em] text-white/40">Chief complaint</p>
            <p className="mt-1 text-sm italic text-white/90">&ldquo;{condition?.complaint ?? "Not feeling well."}&rdquo;</p>
            <ul className="mt-3 space-y-1.5 text-sm text-white/80">
              {(condition?.symptoms ?? []).map((symptom) => (
                <li key={symptom} className="border-l-2 border-teal-400/70 pl-2">
                  {symptom}
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex flex-col p-4">
            {step === "done" && result ? (
              <Result result={result} onPage={pageNext} onClose={onClose} />
            ) : step === "treat" ? (
              <>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#7d8f96]">Orders</p>
                <p className="mt-1 text-sm text-[#3d5560]">
                  Working diagnosis <span className="font-semibold text-[#14343a]">{diagnosis}</span>
                </p>
                <div className="mt-3 space-y-2">
                  {choices.treatments.map((option) => (
                    <Choice key={option} label={option} selected={treatment === option} onClick={() => setTreatment(option)} />
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("chart")}
                    className="rounded-xl border border-[#c5d4d8] bg-white px-4 py-2.5 text-sm font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitTreatment}
                    className="flex-1 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Sign orders
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#7d8f96]">Differential</p>
                <p className="mt-1 text-sm text-[#3d5560]">Pick the diagnosis that fits the complaint and the monitor.</p>
                <div className="mt-3 space-y-2">
                  {choices.diagnoses.map((option) => (
                    <Choice key={option} label={option} selected={diagnosis === option} onClick={() => setDiagnosis(option)} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={submitDiagnosis}
                  className="mt-4 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Confirm diagnosis
                </button>
              </>
            )}
            {note ? <p className="mt-3 text-sm font-medium text-[#9b2c3a]">{note}</p> : null}
            {step !== "done" ? (
              <button type="button" onClick={onClose} className="mt-3 text-left text-xs text-[#7d8f96] hover:text-[#14343a]">
                Step away · Esc
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: Tone }) {
  return (
    <div className="rounded-xl bg-black/40 px-2 py-2">
      <p className="text-[0.55rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className={`font-mono text-lg font-semibold leading-none ${TONE[tone]}`}>{value}</p>
      <p className="mt-1 text-[0.55rem] text-white/35">{unit}</p>
    </div>
  );
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${
        selected ? "bg-[#0f766e] text-white" : "bg-white text-[#14343a] ring-1 ring-[#d5e0e4] hover:bg-[#e7f3f1]"
      }`}
    >
      {label}
    </button>
  );
}

function Result({
  result,
  onPage,
  onClose,
}: {
  result: TreatmentResult;
  onPage: () => void;
  onClose: () => void;
}) {
  const stamp = result.rightTreatment ? "Correct" : result.rightDiagnosis ? "Partial" : "Missed";
  const stampClass = result.rightTreatment
    ? "border-emerald-600 text-emerald-700"
    : result.rightDiagnosis
      ? "border-amber-600 text-amber-700"
      : "border-rose-600 text-rose-700";
  return (
    <div>
      <p className={`inline-block -rotate-2 rounded-md border-4 px-3 py-1 text-2xl font-black uppercase tracking-wide ${stampClass}`}>
        {stamp}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[#3d5560]">{result.message}</p>
      <p className="mt-3 text-lg font-semibold">
        {formatDollars(result.pay)}
        <span className="ml-2 text-sm font-medium text-[#3d5560]">{result.xp > 0 ? `+${result.xp} XP` : "No XP"}</span>
      </p>
      {result.rankUp ? <p className="mt-1 text-sm font-semibold text-[#9b2c3a]">Promoted to {result.rankUp}</p> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onPage} className="flex-1 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white">
          Page next patient
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#c5d4d8] bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Close chart
        </button>
      </div>
    </div>
  );
}
