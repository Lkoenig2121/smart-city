import type { CityClock } from "@/lib/city/types";
import { OFFICE_TASK_COUNT, officeRank } from "./player";

export type OfficeTaskKind = "email" | "approve";

export interface EmailTask {
  kind: "email";
  id: string;
  title: string;
  pay: number;
  xp: number;
  from: string;
  subject: string;
  body: string;
  choices: string[];
  correct: number;
}

export interface ApproveTask {
  kind: "approve";
  id: string;
  title: string;
  pay: number;
  xp: number;
  body: string;
  action: string;
}

export type OfficeTask = EmailTask | ApproveTask;

const EMAILS: Omit<EmailTask, "id" | "pay" | "xp" | "kind" | "title">[] = [
  {
    from: "ops@riverside.tech",
    subject: "Client call moved to 2:00",
    body: "Harbor Logistics asked to push the status call. Confirm 2:00 and copy the project lead.",
    choices: ["Confirm 2:00 and copy the project lead.", "Ignore the email."],
    correct: 0,
  },
  {
    from: "hr@riverside.tech",
    subject: "Badge photo reminder",
    body: "Please send intern desks a reminder that badge photos are due Friday.",
    choices: ["Send the Friday reminder to intern desks.", "Delete the message."],
    correct: 0,
  },
  {
    from: "legal@riverside.tech",
    subject: "NDA language",
    body: "A vendor changed section 4. Flag it for legal — do not rewrite it yourself.",
    choices: ["Flag section 4 for legal.", "Rewrite the contract yourself."],
    correct: 0,
  },
  {
    from: "sales@riverside.tech",
    subject: "Quote for Harbor House",
    body: "They want the revised hosting quote sent before lunch.",
    choices: ["Send the revised quote.", "Wait until next week."],
    correct: 0,
  },
  {
    from: "facilities@riverside.tech",
    subject: "AC complaint on 12",
    body: "Two desks on 12 are overheating. Log a ticket with building services.",
    choices: ["Log the ticket with building services.", "Tell them to open a window."],
    correct: 0,
  },
];

const REPORTS: { title: string; body: string; action: string }[] = [
  { title: "Sign the occupancy report", body: "The weekly occupancy report is ready for the 4th floor.", action: "Approve and send" },
  { title: "Approve Harbor invoices", body: "Harbor invoices are matched and waiting on your sign-off.", action: "Approve invoices" },
  { title: "Sign intern timesheets", body: "The intern timesheet batch is complete.", action: "Sign timesheets" },
  { title: "File the visitor log", body: "Front desk scanned today's visitor badges.", action: "File the log" },
  { title: "Clear the print queue", body: "The 8th-floor printer is holding a payroll packet.", action: "Release the job" },
  { title: "Confirm the lunch order", body: "Catering needs a headcount for the 1:00 standup.", action: "Confirm headcount" },
  { title: "Update the project board", body: "Move the Beacon Plaza cards to 'in review'.", action: "Update the board" },
  { title: "Send the parking notice", body: "Garage B closes at six for restriping.", action: "Send notice" },
  { title: "Archive yesterday's notes", body: "Standup notes from yesterday still sit in Drafts.", action: "Archive notes" },
  { title: "Check the server status", body: "Nightly backup finished with no errors.", action: "Mark as reviewed" },
];

export function officeTasksForDay(clock: CityClock, xp: number, batch = 0): OfficeTask[] {
  const rank = officeRank(xp);
  const pay = rank.taskPay;
  const xpEach = 40 + OFFICE_RANKS_XP[rank.id];
  const day = `${clock.year}-${clock.dayOfYear}`;
  const round = Math.max(0, Math.floor(batch));
  const tasks: OfficeTask[] = [];
  for (let i = 0; i < OFFICE_TASK_COUNT; i++) {
    if (i % 2 === 0) {
      const mail = EMAILS[(Math.floor(i / 2) + round) % EMAILS.length] ?? EMAILS[0];
      tasks.push({
        kind: "email",
        id: `${day}-b${round}-task-${i}`,
        title: mail.subject,
        pay,
        xp: xpEach,
        ...mail,
      });
    } else {
      const report = REPORTS[(Math.floor(i / 2) + round * 3) % REPORTS.length] ?? REPORTS[0];
      tasks.push({
        kind: "approve",
        id: `${day}-b${round}-task-${i}`,
        title: report.title,
        pay,
        xp: xpEach,
        body: report.body,
        action: report.action,
      });
    }
  }
  return tasks;
}

const OFFICE_RANKS_XP = {
  intern: 0,
  junior: 15,
  senior: 30,
  manager: 45,
  executive: 60,
};
