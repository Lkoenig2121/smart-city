const HAIR = ["#1c1410", "#3b2416", "#6b4423", "#c4a15a", "#8a3a28", "#9a9590"];

function hashId(id: string, salt: number) {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function citizenHairColor(id: string) {
  return HAIR[hashId(id, 17) % HAIR.length];
}

/** 0 short crop, 1 medium, 2 longer. */
export function citizenHairStyle(id: string) {
  return hashId(id, 41) % 3;
}
