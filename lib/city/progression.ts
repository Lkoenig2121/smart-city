/** Character XP needed to go from `level` to `level + 1`. Easy to retune. */
export function xpToNextLevel(level: number) {
  if (level < 1) return 100;
  if (level >= 100) return 0;
  return 100 + 50 * (level - 1);
}

export function characterProgress(xp: number) {
  const total = Math.max(0, Math.round(xp));
  let level = 1;
  let spent = 0;
  while (level < 100) {
    const need = xpToNextLevel(level);
    if (spent + need > total) break;
    spent += need;
    level += 1;
  }
  const into = total - spent;
  const need = xpToNextLevel(level);
  return { level, xp: total, into, need, pct: need <= 0 ? 100 : Math.min(100, (into / need) * 100) };
}

export function totalXpForLevel(level: number) {
  let sum = 0;
  for (let n = 1; n < Math.max(1, Math.min(100, level)); n++) sum += xpToNextLevel(n);
  return sum;
}
