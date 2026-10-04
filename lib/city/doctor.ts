import {
  awardXp,
  dayKey,
  earnCash,
  readPlayer,
  writePlayer,
  type DoctorCareer,
  type DoctorCase,
  type DoctorShift,
  type PlayerState,
} from "./player";
import type { Building, CityState } from "./types";
import { venueRole } from "./venues";

export type { DoctorCareer, DoctorCase, DoctorShift };

export const DOCTOR_RANKS = [
  { id: "intern", label: "Medical Intern", xp: 0, payMult: 1 },
  { id: "resident", label: "Resident", xp: 100, payMult: 1.4 },
  { id: "attending", label: "Attending Physician", xp: 300, payMult: 2 },
  { id: "chief", label: "Chief of Medicine", xp: 700, payMult: 3 },
] as const;

export type DoctorRankId = (typeof DOCTOR_RANKS)[number]["id"];

export type Department =
  | "er"
  | "imaging"
  | "surgery"
  | "cardiology"
  | "pediatrics"
  | "general"
  | "neurology"
  | "orthopedics"
  | "icu";

export interface HospitalLevel {
  name: string;
  short: string;
  dept: Department | null;
  beds: number;
}

/** Elevator stops, bottom to top. Bed counts must match the interior layouts. */
export const HOSPITAL_LEVELS: HospitalLevel[] = [
  { name: "Lobby & Emergency Reception", short: "Lobby", dept: null, beds: 0 },
  { name: "Emergency Room", short: "ER", dept: "er", beds: 6 },
  { name: "Radiology & Imaging", short: "Imaging", dept: "imaging", beds: 2 },
  { name: "Surgery", short: "Surgery", dept: "surgery", beds: 2 },
  { name: "Cardiology", short: "Cardio", dept: "cardiology", beds: 8 },
  { name: "Pediatrics", short: "Peds", dept: "pediatrics", beds: 8 },
  { name: "General Medicine", short: "Medicine", dept: "general", beds: 8 },
  { name: "Neurology", short: "Neuro", dept: "neurology", beds: 8 },
  { name: "Orthopedics", short: "Ortho", dept: "orthopedics", beds: 8 },
  { name: "Intensive Care Unit", short: "ICU", dept: "icu", beds: 8 },
  { name: "Roof Helipad", short: "Roof", dept: null, beds: 0 },
];

export const HOSPITAL_DESK_FLOOR = 0;

export interface Vitals {
  hr: number;
  bp: string;
  temp: number;
  spo2: number;
}

export interface Condition {
  id: string;
  diagnosis: string;
  dept: Department;
  minRank: DoctorRankId;
  pay: number;
  xp: number;
  complaint: string;
  symptoms: string[];
  vitals: Vitals;
  treatment: string;
  wrongTreatments: [string, string];
}

export const CONDITIONS: Condition[] = [
  {
    id: "flu",
    diagnosis: "Influenza",
    dept: "general",
    minRank: "intern",
    pay: 60,
    xp: 12,
    complaint: "Achy all over and can't stop shivering.",
    symptoms: ["Fever for two days", "Body aches", "Dry cough", "Fatigue"],
    vitals: { hr: 98, bp: "118/76", temp: 39.1, spo2: 97 },
    treatment: "Rest, fluids and antivirals",
    wrongTreatments: ["Emergency surgery", "Cast the arm"],
  },
  {
    id: "sprain",
    diagnosis: "Ankle sprain",
    dept: "orthopedics",
    minRank: "intern",
    pay: 55,
    xp: 10,
    complaint: "Rolled my ankle stepping off the curb.",
    symptoms: ["Swollen ankle", "Bruising on the outside", "Can bear some weight", "X-ray: no fracture"],
    vitals: { hr: 82, bp: "122/80", temp: 36.8, spo2: 99 },
    treatment: "Rest, ice, compression and elevation",
    wrongTreatments: ["Antibiotics", "Insulin drip"],
  },
  {
    id: "dehydration",
    diagnosis: "Dehydration",
    dept: "er",
    minRank: "intern",
    pay: 60,
    xp: 12,
    complaint: "Dizzy after a long run in the heat.",
    symptoms: ["Dry mouth", "Dark urine", "Light-headed when standing", "Muscle cramps"],
    vitals: { hr: 112, bp: "98/62", temp: 37.6, spo2: 98 },
    treatment: "IV fluids and electrolytes",
    wrongTreatments: ["Blood thinners", "Splint the leg"],
  },
  {
    id: "food_poisoning",
    diagnosis: "Food poisoning",
    dept: "general",
    minRank: "intern",
    pay: 65,
    xp: 12,
    complaint: "Sick since last night's seafood takeout.",
    symptoms: ["Nausea and vomiting", "Stomach cramps", "Diarrhea", "Started 6 hours after eating"],
    vitals: { hr: 96, bp: "112/72", temp: 37.9, spo2: 98 },
    treatment: "Anti-nausea medicine and oral fluids",
    wrongTreatments: ["Appendectomy", "Nebulizer"],
  },
  {
    id: "asthma",
    diagnosis: "Asthma attack",
    dept: "pediatrics",
    minRank: "intern",
    pay: 70,
    xp: 14,
    complaint: "Can't catch their breath after soccer practice.",
    symptoms: ["Wheezing", "Tight chest", "Short of breath", "History of asthma"],
    vitals: { hr: 118, bp: "110/70", temp: 36.9, spo2: 92 },
    treatment: "Bronchodilator nebulizer",
    wrongTreatments: ["Antibiotics", "Ice pack and rest"],
  },
  {
    id: "migraine",
    diagnosis: "Migraine",
    dept: "neurology",
    minRank: "intern",
    pay: 65,
    xp: 12,
    complaint: "Pounding headache, the lights hurt.",
    symptoms: ["One-sided throbbing headache", "Sensitive to light", "Nausea", "Saw zig-zag lines before it started"],
    vitals: { hr: 84, bp: "126/82", temp: 36.7, spo2: 99 },
    treatment: "Dark room, pain relief and anti-nausea",
    wrongTreatments: ["Emergency CT-guided surgery", "Cast the wrist"],
  },
  {
    id: "fracture",
    diagnosis: "Broken wrist",
    dept: "orthopedics",
    minRank: "resident",
    pay: 110,
    xp: 22,
    complaint: "Fell off a skateboard and landed on my hand.",
    symptoms: ["Wrist deformity", "Severe pain on movement", "Swelling", "X-ray: distal radius fracture"],
    vitals: { hr: 92, bp: "128/84", temp: 36.8, spo2: 99 },
    treatment: "Set the bone and apply a cast",
    wrongTreatments: ["Rest and fluids", "Antivirals"],
  },
  {
    id: "concussion",
    diagnosis: "Concussion",
    dept: "neurology",
    minRank: "resident",
    pay: 110,
    xp: 22,
    complaint: "Took a hit to the head during a game.",
    symptoms: ["Brief blackout", "Confusion", "Headache", "CT scan: no bleeding"],
    vitals: { hr: 78, bp: "124/80", temp: 36.7, spo2: 99 },
    treatment: "Observation and cognitive rest",
    wrongTreatments: ["Set the bone and cast", "Antibiotics"],
  },
  {
    id: "anaphylaxis",
    diagnosis: "Anaphylaxis",
    dept: "er",
    minRank: "resident",
    pay: 130,
    xp: 26,
    complaint: "Ate something with peanuts — my throat is closing.",
    symptoms: ["Hives across the chest", "Swollen lips", "Wheezing", "Known peanut allergy"],
    vitals: { hr: 128, bp: "86/52", temp: 37.0, spo2: 90 },
    treatment: "Epinephrine injection",
    wrongTreatments: ["Rest and ice", "Cast the arm"],
  },
  {
    id: "kidney_stone",
    diagnosis: "Kidney stone",
    dept: "imaging",
    minRank: "resident",
    pay: 120,
    xp: 24,
    complaint: "Sharp pain in my side that comes in waves.",
    symptoms: ["Flank pain radiating to groin", "Blood in urine", "Restless, can't sit still", "CT: 4 mm stone"],
    vitals: { hr: 104, bp: "138/88", temp: 37.2, spo2: 98 },
    treatment: "Pain control, fluids and stone passage",
    wrongTreatments: ["Epinephrine injection", "Nebulizer"],
  },
  {
    id: "appendicitis",
    diagnosis: "Appendicitis",
    dept: "surgery",
    minRank: "resident",
    pay: 180,
    xp: 34,
    complaint: "Stomach pain that moved down to the right.",
    symptoms: ["Pain in lower-right abdomen", "Pain worse when pressure is released", "Low fever", "Lost appetite"],
    vitals: { hr: 102, bp: "122/78", temp: 38.2, spo2: 98 },
    treatment: "Appendectomy",
    wrongTreatments: ["Anti-nausea and send home", "Bronchodilator"],
  },
  {
    id: "pneumonia",
    diagnosis: "Pneumonia",
    dept: "icu",
    minRank: "attending",
    pay: 200,
    xp: 38,
    complaint: "Coughing for a week, now struggling to breathe.",
    symptoms: ["Productive cough", "High fever", "Crackles in the right lung", "Chest X-ray: consolidation"],
    vitals: { hr: 116, bp: "104/66", temp: 39.6, spo2: 89 },
    treatment: "IV antibiotics and oxygen",
    wrongTreatments: ["Antivirals only and send home", "Cast and sling"],
  },
  {
    id: "hyperglycemia",
    diagnosis: "Diabetic ketoacidosis",
    dept: "icu",
    minRank: "attending",
    pay: 210,
    xp: 40,
    complaint: "Very thirsty, confused, breath smells fruity.",
    symptoms: ["Extreme thirst", "Frequent urination", "Fruity breath", "Blood sugar: 520 mg/dL"],
    vitals: { hr: 120, bp: "100/64", temp: 37.1, spo2: 97 },
    treatment: "Insulin drip and IV fluids",
    wrongTreatments: ["Glucose tablets", "Epinephrine injection"],
  },
  {
    id: "heart_attack",
    diagnosis: "Heart attack",
    dept: "cardiology",
    minRank: "attending",
    pay: 260,
    xp: 50,
    complaint: "Crushing chest pain running down my left arm.",
    symptoms: ["Chest pressure for 40 minutes", "Pain into left arm and jaw", "Sweating", "ECG: ST elevation"],
    vitals: { hr: 110, bp: "150/96", temp: 36.9, spo2: 94 },
    treatment: "Aspirin and emergency cardiac catheterization",
    wrongTreatments: ["Antacids and send home", "Ice pack and rest"],
  },
];

const FIRST = ["Ava", "Liam", "Noah", "Mia", "Lucas", "Zoe", "Omar", "Ines", "Hana", "Theo", "Rosa", "Kai", "Nora", "Felix", "Amara", "Diego"];
const LAST = ["Patel", "Kowalski", "Nguyen", "Okoro", "Silva", "Bauer", "Haddad", "Larsen", "Moreau", "Tanaka", "Reyes", "Byrne"];

export function emptyDoctorCareer(): DoctorCareer {
  return { xp: 0, patientsTreated: 0, perfectCases: 0, totalEarnings: 0 };
}

export function doctorRank(xp: number) {
  let rank: (typeof DOCTOR_RANKS)[number] = DOCTOR_RANKS[0];
  for (const next of DOCTOR_RANKS) if (xp >= next.xp) rank = next;
  return rank;
}

export function nextDoctorRank(xp: number) {
  const index = DOCTOR_RANKS.findIndex((rank) => rank.id === doctorRank(xp).id);
  return DOCTOR_RANKS[index + 1] ?? null;
}

function rankIndex(id: DoctorRankId) {
  return DOCTOR_RANKS.findIndex((rank) => rank.id === id);
}

export function conditionFor(id: string) {
  return CONDITIONS.find((c) => c.id === id) ?? null;
}

export function isHospital(building: Building) {
  return building.kind === "hospital" || venueRole(building) === "hospital";
}

export function onDoctorDuty(player: PlayerState) {
  return Boolean(player.doctorShift);
}

/** Conditions the current rank is trusted with. */
export function availableConditions(player: PlayerState) {
  const current = rankIndex(doctorRank(player.doctorCareer?.xp ?? 0).id);
  return CONDITIONS.filter((c) => rankIndex(c.minRank) <= current);
}

export function lockedConditions(player: PlayerState) {
  const current = rankIndex(doctorRank(player.doctorCareer?.xp ?? 0).id);
  return CONDITIONS.filter((c) => rankIndex(c.minRank) > current);
}

export function floorForDept(dept: Department) {
  return HOSPITAL_LEVELS.findIndex((level) => level.dept === dept);
}

export function startDoctorShift(building: Building, state: CityState): PlayerState | string {
  if (!isHospital(building)) return "Clock in at a hospital.";
  const player = readPlayer();
  if (player.shift) return "Clock out of your office job first.";
  if (player.policeShift) return "End your police shift first.";
  if (player.doctorShift) return "You are already on shift.";
  if (!player.doctorCareer) player.doctorCareer = emptyDoctorCareer();
  player.doctorShift = {
    hospitalId: building.id,
    hospitalName: building.name,
    dayKey: dayKey(state.clock),
    startMinute: state.clock.minuteOfDay,
    patients: 0,
    earnings: 0,
    xpEarned: 0,
  };
  player.doctorCase = null;
  writePlayer(player);
  return player;
}

export interface DoctorShiftSummary {
  rankLabel: string;
  patients: number;
  moneyEarned: number;
  xpEarned: number;
  durationMinutes: number;
}

export function endDoctorShift(state: CityState): { player: PlayerState; summary: DoctorShiftSummary } | string {
  const player = readPlayer();
  const shift = player.doctorShift;
  if (!shift) return "You are not on shift.";
  const summary: DoctorShiftSummary = {
    rankLabel: doctorRank(player.doctorCareer?.xp ?? 0).label,
    patients: shift.patients,
    moneyEarned: shift.earnings,
    xpEarned: shift.xpEarned,
    durationMinutes: Math.max(0, state.clock.minuteOfDay - shift.startMinute),
  };
  player.doctorShift = null;
  player.doctorCase = null;
  writePlayer(player);
  return { player, summary };
}

/** Assigns the next patient: a condition for your rank, on its department's floor. */
export function pageNextPatient(random: () => number = Math.random): PlayerState | string {
  const player = readPlayer();
  if (!player.doctorShift) return "Clock in at the reception desk first.";
  if (player.doctorCase) return `${player.doctorCase.patientName} is still waiting for you.`;
  const pool = availableConditions(player);
  const condition = pool[Math.floor(random() * pool.length)] ?? CONDITIONS[0];
  const floor = floorForDept(condition.dept);
  const level = HOSPITAL_LEVELS[floor];
  const bed = Math.floor(random() * level.beds);
  const kid = condition.dept === "pediatrics";
  const age = kid ? 4 + Math.floor(random() * 11) : 18 + Math.floor(random() * 68);
  const mult = doctorRank(player.doctorCareer?.xp ?? 0).payMult;
  player.doctorCase = {
    id: `pt-${Date.now().toString(36)}-${Math.floor(random() * 1e6).toString(36)}`,
    conditionId: condition.id,
    patientName: `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]}`,
    age,
    floor,
    bed,
    floorName: level.name,
    bedLabel: `${level.short} bed ${bed + 1}`,
    reward: Math.round(condition.pay * mult),
    xp: condition.xp,
  };
  writePlayer(player);
  return player;
}

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stable per-case answer choices (same order every time the chart opens). */
export function chartChoices(doctorCase: DoctorCase) {
  const condition = conditionFor(doctorCase.conditionId) ?? CONDITIONS[0];
  const random = seeded(doctorCase.id);
  const others = shuffled(
    CONDITIONS.filter((c) => c.id !== condition.id),
    random,
  )
    .slice(0, 3)
    .map((c) => c.diagnosis);
  return {
    condition,
    diagnoses: shuffled([condition.diagnosis, ...others], random),
    treatments: shuffled([condition.treatment, ...condition.wrongTreatments], random),
  };
}

export interface TreatmentResult {
  patientName: string;
  diagnosis: string;
  treatment: string;
  rightDiagnosis: boolean;
  rightTreatment: boolean;
  pay: number;
  xp: number;
  rankUp: string | null;
  message: string;
}

/** Wrong diagnosis: 25% pay, no XP. Right diagnosis, wrong treatment: 50% pay, half XP. */
export function treatPatient(
  state: CityState,
  diagnosis: string,
  treatment: string,
): { player: PlayerState; result: TreatmentResult } | string {
  const player = readPlayer();
  const current = player.doctorCase;
  if (!current) return "No patient assigned.";
  if (!player.doctorShift) return "You are not on shift.";
  const condition = conditionFor(current.conditionId);
  if (!condition) return "Unknown condition.";
  if (!player.doctorCareer) player.doctorCareer = emptyDoctorCareer();

  const rightDiagnosis = diagnosis === condition.diagnosis;
  const rightTreatment = rightDiagnosis && treatment === condition.treatment;
  const pay = Math.round(current.reward * (rightTreatment ? 1 : rightDiagnosis ? 0.5 : 0.25));
  const xp = rightTreatment ? current.xp : rightDiagnosis ? Math.round(current.xp / 2) : 0;

  const before = doctorRank(player.doctorCareer.xp);
  player.doctorCareer.xp += xp;
  player.doctorCareer.patientsTreated += 1;
  player.doctorCareer.totalEarnings += pay;
  if (rightTreatment) player.doctorCareer.perfectCases += 1;
  player.doctorShift.patients += 1;
  player.doctorShift.earnings += pay;
  player.doctorShift.xpEarned += xp;
  player.doctorCase = null;
  writePlayer(player);
  const after = doctorRank(player.doctorCareer.xp);

  earnCash(pay, state.clock, `Hospital · ${condition.diagnosis}`);
  if (xp > 0) awardXp(Math.round(xp * 0.6), `doctor:${current.id}`, "career");

  const message = rightTreatment
    ? `${current.patientName} is recovering well. Textbook care, doctor.`
    : rightDiagnosis
      ? `Right call on ${condition.diagnosis}, but the standard treatment is "${condition.treatment}". The attending stepped in.`
      : `That wasn't ${diagnosis}. ${current.patientName} had ${condition.diagnosis}; a colleague took over the case.`;

  return {
    player: readPlayer(),
    result: {
      patientName: current.patientName,
      diagnosis,
      treatment,
      rightDiagnosis,
      rightTreatment,
      pay,
      xp,
      rankUp: after.id !== before.id ? after.label : null,
      message,
    },
  };
}
