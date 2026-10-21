import { addDays, diffDays, timeToMinutes } from './dates';
import { completionEvents } from './tasks';

// Une session de travail compte comme "pomodoro" à partir de 15 min
export const POMODORO_MIN_MINUTES = 15;

export function dailyActivity(todos, focusLog) {
  const map = {};
  const get = (d) => map[d] || (map[d] = { tasks: 0, slots: 0, pomodoros: 0, focusMin: 0 });
  completionEvents(todos).forEach(e => {
    if (!e.date) return;
    const a = get(e.date);
    if (e.kind === 'slot') a.slots += 1;
    else a.tasks += 1;
  });
  (focusLog || []).forEach(s => {
    if (!s.date) return;
    const a = get(s.date);
    a.focusMin += s.minutes || 0;
    if ((s.minutes || 0) >= POMODORO_MIN_MINUTES) a.pomodoros += 1;
  });
  return map;
}

// Série = jours consécutifs où l'objectif de pomodoros est atteint.
// Si aujourd'hui n'est pas encore validé, la série d'hier reste "en vie".
export function computeStreak(activity, today, goal) {
  const target = Math.max(1, goal || 1);
  const ok = (d) => ((activity[d] && activity[d].pomodoros) || 0) >= target;
  let current = 0;
  let d = ok(today) ? today : addDays(today, -1);
  while (ok(d)) { current += 1; d = addDays(d, -1); }
  let best = 0;
  let run = 0;
  let prev = null;
  Object.keys(activity).filter(ok).sort().forEach(x => {
    run = prev && diffDays(prev, x) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = x;
  });
  return { current, best: Math.max(best, current), todayDone: ok(today) };
}

export function computeTotals(todos, focusLog) {
  const ev = completionEvents(todos);
  const tasks = ev.filter(e => e.kind === 'task');
  const focusMin = (focusLog || []).reduce((acc, s) => acc + (s.minutes || 0), 0);
  const startHour = (e) => {
    const m = timeToMinutes(e.task && e.task.startTime);
    return m == null ? null : m / 60;
  };
  return {
    tasks: tasks.length,
    projects: ev.filter(e => e.kind === 'project').length,
    slots: ev.filter(e => e.kind === 'slot').length,
    pomodoros: (focusLog || []).filter(s => (s.minutes || 0) >= POMODORO_MIN_MINUTES).length,
    focusMin,
    earlyBird: tasks.filter(e => { const h = startHour(e); return h != null && h < 8; }).length,
    nightOwl: tasks.filter(e => { const h = startHour(e); return h != null && h >= 21; }).length,
  };
}

export function computeXp(totals) {
  return totals.tasks * 10 + totals.slots * 10 + totals.projects * 50 + Math.floor(totals.focusMin / 5) * 2;
}

// Niveau n atteint à 50·n·(n-1) XP : 100, 300, 600, 1000…
export function levelFromXp(xp) {
  let level = 1;
  while (xp >= 50 * level * (level + 1)) level += 1;
  const base = 50 * (level - 1) * level;
  const next = 50 * level * (level + 1);
  return { level, xp, into: xp - base, needed: next - base };
}

const TITLES = [
  'Procrastinateur repenti', 'Apprenti focus', 'Démarreur', 'Concentré', 'Régulier',
  'Machine de guerre', 'Moine du focus', 'Maître du temps', 'Légende',
];
export const levelTitle = (level) => TITLES[Math.min(level - 1, TITLES.length - 1)];

// Totaux des 7 derniers jours (le plus ancien en premier)
export function lastDays(activity, today, n = 7) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ date: d, ...(activity[d] || { tasks: 0, slots: 0, pomodoros: 0, focusMin: 0 }) });
  }
  return out;
}
