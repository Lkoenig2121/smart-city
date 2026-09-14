"use client";

import { completeShiftTask, dayKey, endOfficeShift, formatDollars, OFFICE_TASK_MINUTES, officeRank, readPlayer, type PlayerState } from "@/lib/city/player";
import { officeTasksForDay, type OfficeTask } from "@/lib/city/officeWork";
import type { CityState } from "@/lib/city/types";
import { formatClock, skipCityMinutes } from "@/lib/simulation/city/cityTick";
import { useEffect, useMemo, useState } from "react";

interface Props {
  state: CityState;
  onClose: () => void;
  onPlayerChange: (player: PlayerState) => void;
}

export function OfficeComputer({ state, onClose, onPlayerChange }: Props) {
  const clock = formatClock(state);
  const [player, setPlayer] = useState(readPlayer);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const tasks = useMemo(
    () => officeTasksForDay(state.clock, player.career?.xp ?? 0),
    [state.clock.year, state.clock.dayOfYear, player.career?.xp],
  );
  const rank = officeRank(player.career?.xp ?? 0);
  const completed = player.shift?.completedTaskIds ?? [];
  const nextTask = tasks.find((task) => !completed.includes(task.id)) ?? null;
  const active = tasks.find((task) => task.id === openId) ?? nextTask;
  const stillOn = Boolean(player.shift);
  const todayDone = player.career?.lastShiftDay === dayKey(state.clock) && !stillOn;
  const allDone = completed.length >= tasks.length || todayDone;

  useEffect(() => {
    if (!openId && nextTask) setOpenId(nextTask.id);
  }, [openId, nextTask]);

  const refresh = (next: PlayerState) => {
    setPlayer(next);
    onPlayerChange(next);
  };

  const finish = (task: OfficeTask) => {
    const result = completeShiftTask(task.id, task.pay, task.xp, task.title, state);
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    skipCityMinutes(state, OFFICE_TASK_MINUTES);
    setNote(`${task.title} · +${formatDollars(task.pay)} · +${OFFICE_TASK_MINUTES} min`);
    setOpenId(null);
    refresh(readPlayer());
  };

  const clockOut = () => {
    if (!readPlayer().shift) {
      onClose();
      return;
    }
    const result = endOfficeShift(state);
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    refresh(result);
    onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-[#071018]/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-[min(42rem,calc(100vh-2rem))] w-[min(52rem,calc(100%-1.5rem))] flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.85rem] bg-gradient-to-b from-[#4a4e55] via-[#2a2d32] to-[#141618] p-[13px] pb-4 pt-3 shadow-[0_28px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/20">
          <div className="mb-2 flex items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6b7078]" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.05rem] bg-[#101826]">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1422] px-4 py-2.5">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                  Riverside Technologies
                </p>
                <p className="text-sm font-semibold text-white">Employee Dashboard</p>
              </div>
              <div className="text-right">
                <p className="text-[0.65rem] tabular-nums text-amber-200/90">
                  {clock.day} · {clock.time}
                </p>
                <p className="text-[0.65rem] text-slate-400">{rank.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-3 text-center">
              <Stat label="Pay / task" value={formatDollars(rank.taskPay)} />
              <Stat label="Shift earnings" value={formatDollars(player.shift?.taskEarnings ?? 0)} />
              <Stat label="Tasks" value={`${completed.length} / ${tasks.length}`} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                {tasks.map((task) => (
                  <span
                    key={task.id}
                    className={`h-2 w-2 rounded-full ${
                      completed.includes(task.id)
                        ? "bg-amber-400"
                        : task.id === active?.id
                          ? "bg-sky-300"
                          : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
              {allDone ? (
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">
                    {completed.length >= tasks.length ? "Assignments complete" : "Office hours are over"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {completed.length >= tasks.length
                      ? "Clock out whenever you're ready. Pay is already in your wallet."
                      : "The workday ended at 10:00 PM. Pay for finished tasks is already in your wallet."}
                  </p>
                  {note ? <p className="mt-2 text-sm text-sky-200">{note}</p> : null}
                  <button
                    type="button"
                    onClick={clockOut}
                    className="mt-4 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
                  >
                    Clock out
                  </button>
                </div>
              ) : active ? (
                <TaskBody task={active} onComplete={() => finish(active)} />
              ) : null}
            </div>
            <div className="flex justify-end border-t border-white/10 px-4 py-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Lock screen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TaskBody({
  task,
  onComplete,
}: {
  task: OfficeTask;
  onComplete: () => void;
}) {
  return (
    <div>
      <p className="text-lg font-semibold text-white">{task.title}</p>
      <p className="text-[0.7rem] text-amber-200/90">
        {formatDollars(task.pay)} · +{OFFICE_TASK_MINUTES} minutes
      </p>
      {task.kind === "email" ? <EmailTaskView task={task} onComplete={onComplete} /> : null}
      {task.kind === "approve" ? <ApproveTaskView task={task} onComplete={onComplete} /> : null}
    </div>
  );
}

function EmailTaskView({ task, onComplete }: { task: Extract<OfficeTask, { kind: "email" }>; onComplete: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
      <p className="text-[0.7rem] text-slate-400">From {task.from}</p>
      <p className="text-sm font-semibold text-white">{task.subject}</p>
      <p className="mt-2 text-sm text-slate-300">{task.body}</p>
      <button
        type="button"
        onClick={onComplete}
        className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
      >
        {task.choices[task.correct]} · {formatDollars(task.pay)}
      </button>
    </div>
  );
}

function ApproveTaskView({
  task,
  onComplete,
}: {
  task: Extract<OfficeTask, { kind: "approve" }>;
  onComplete: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
      <p className="text-sm text-slate-300">{task.body}</p>
      <button
        type="button"
        onClick={onComplete}
        className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
      >
        {task.action} · {formatDollars(task.pay)}
      </button>
    </div>
  );
}
