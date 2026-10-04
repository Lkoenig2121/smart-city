"use client";

import {
  chartChoices,
  conditionFor,
  pageNextPatient,
  treatPatient,
  type TreatmentResult,
} from "@/lib/city/doctor";
import { formatDollars, readPlayer, type DoctorCase, type PlayerState } from "@/lib/city/player";
import type { CityState } from "@/lib/city/types";
import { useMemo, useState } from "react";

interface Props {
  doctorCase: DoctorCase;
  state: CityState;
  onPlayerChange?: (player: PlayerState) => void;
  onClose: () => void;
}

type Step = "chart" | "treat" | "done";

export function PatientChart({ doctorCase, state, onPlayerChange, onClose }: Props) {
  const choices = useMemo(() => chartChoices(doctorCase), [doctorCase]);
  const [step, setStep] = useState<Step>("chart");
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<string | null>(null);
  const [result, setResult] = useState<TreatmentResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const condition = conditionFor(doctorCase.conditionId);

  const submitDiagnosis = () => {
    if (!diagnosis) {
      setNote("Pick a diagnosis first.");
      return;
    }
    setNote(null);
    setStep("treat");
  };

  const submitTreatment = () => {
    if (!diagnosis || !treatment) {
      setNote("Pick a treatment.");
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
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (step === "done") onClose();
      }}
    >
      <div
        className="w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-teal-300/35 bg-[#0d181a]/95 p-5 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-teal-300">Patient chart</p>
        <p className="mt-1 text-lg font-semibold text-white">
          {doctorCase.patientName}
          <span className="ml-2 text-sm font-normal text-slate-400">· {doctorCase.age} yrs</span>
        </p>
        <p className="text-xs text-teal-200/80">
          {doctorCase.bedLabel} · {doctorCase.floorName}
        </p>

        {step !== "done" ? (
          <>
            <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-sm italic text-slate-200">
              &ldquo;{condition?.complaint ?? "Not feeling well."}&rdquo;
            </p>
            <ul className="mt-3 space-y-1 text-left text-sm text-slate-200">
              {(condition?.symptoms ?? []).map((symptom) => (
                <li key={symptom} className="rounded-lg bg-white/5 px-3 py-1.5">
                  {symptom}
                </li>
              ))}
            </ul>
            {condition ? (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[0.7rem]">
                <Vital label="HR" value={`${condition.vitals.hr}`} />
                <Vital label="BP" value={condition.vitals.bp} />
                <Vital label="Temp" value={`${condition.vitals.temp}°`} />
                <Vital label="SpO₂" value={`${condition.vitals.spo2}%`} />
              </div>
            ) : null}
          </>
        ) : null}

        {step === "chart" ? (
          <>
            <p className="mt-4 text-left text-[0.65rem] uppercase tracking-wide text-slate-400">Diagnosis</p>
            <div className="mt-1 space-y-1.5">
              {choices.diagnoses.map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={diagnosis === option}
                  onClick={() => setDiagnosis(option)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={submitDiagnosis}
              className="mt-4 w-full rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-[#0a181a]"
            >
              Confirm diagnosis
            </button>
          </>
        ) : null}

        {step === "treat" ? (
          <>
            <p className="mt-3 text-sm text-teal-100">
              Diagnosis: <span className="font-semibold">{diagnosis}</span>
            </p>
            <p className="mt-3 text-left text-[0.65rem] uppercase tracking-wide text-slate-400">Treatment</p>
            <div className="mt-1 space-y-1.5">
              {choices.treatments.map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={treatment === option}
                  onClick={() => setTreatment(option)}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("chart")}
                className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitTreatment}
                className="flex-1 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-[#0a181a]"
              >
                Treat patient
              </button>
            </div>
          </>
        ) : null}

        {step === "done" && result ? (
          <>
            <p
              className={`mt-4 text-sm ${
                result.rightTreatment
                  ? "text-emerald-200"
                  : result.rightDiagnosis
                    ? "text-amber-200"
                    : "text-rose-200"
              }`}
            >
              {result.message}
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatDollars(result.pay)}
              {result.xp > 0 ? ` · +${result.xp} XP` : " · no XP"}
            </p>
            {result.rankUp ? (
              <p className="mt-1 text-sm font-semibold text-amber-200">Promoted to {result.rankUp}!</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={pageNext}
                className="w-full rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-[#0a181a]"
              >
                Page next patient
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                Close chart
              </button>
            </div>
          </>
        ) : null}

        {note ? <p className="mt-3 text-sm text-amber-200">{note}</p> : null}
        {step !== "done" ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-[0.65rem] text-slate-500 hover:text-slate-300"
          >
            Step away (Esc)
          </button>
        ) : null}
        {readPlayer().doctorShift ? null : (
          <p className="mt-2 text-[0.65rem] text-rose-300">You are not clocked in.</p>
        )}
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/35 px-1 py-1.5">
      <p className="text-[0.55rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-teal-100">{value}</p>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
        selected
          ? "bg-teal-400/25 text-teal-50 ring-1 ring-teal-300/60"
          : "bg-white/5 text-slate-200 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
