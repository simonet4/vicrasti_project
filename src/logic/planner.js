import { toYmd, addDays, diffDays, timeToMinutes, minutesToTime, nowMinutes, formatDuration } from './dates';
import { getFixedForDay, getActiveProjects, sortByTime } from './tasks';

const SLOT = 30;

export const DEFAULT_PLANNER = { dayStart: '08:00', dayEnd: '22:00', maxProjectHoursPerDay: 6 };

export const slotId = (projectId, ymd, time) => `auto-${projectId}-${ymd}-${time}`;

/*
 Planifie un jour : tâches fixes (récurrences incluses), créneaux de projet déjà validés,
 puis remplit le temps libre avec des créneaux de 30 min. Chaque projet reçoit un quota
 quotidien = travail restant / jours restants, pour lisser l'effort jusqu'à la deadline
 au lieu de remplir la journée avec un seul projet. `remainingSlots` est décrémenté
 pour que la simulation des jours suivants tienne compte du travail déjà prévu.
*/
function planOneDay(todos, ymd, remainingSlots, opts) {
  const { now, today } = opts;
  const allById = new Map(todos.filter(t => t.type === 'PROJECT').map(p => [p.id, p]));
  const fixed = getFixedForDay(todos, ymd);
  const doneSlots = todos.filter(t => t.type === 'AUTO_DONE' && t.date === ymd && t.time);

  const items = [...fixed];
  const busy = fixed
    .filter(f => f.startTime && f.endTime)
    .map(f => [timeToMinutes(f.startTime), timeToMinutes(f.endTime)]);

  const doneByProject = {};
  doneSlots.forEach(d => {
    const parent = allById.get(d.parentId);
    const s = timeToMinutes(d.time);
    doneByProject[d.parentId] = (doneByProject[d.parentId] || 0) + 1;
    items.push({
      id: d.id, type: 'AUTO', parentProjectId: d.parentId, date: ymd,
      text: parent ? parent.text : 'Projet', project: parent || null, quick: !!(parent && parent.quick),
      startTime: d.time, endTime: minutesToTime(s + SLOT), done: true,
    });
    busy.push([s, s + SLOT]);
  });

  const warnings = [];
  const issues = [];
  if (ymd < today) return { items: items.sort(sortByTime), warnings, issues };

  const candidates = getActiveProjects(todos).map(p => {
    const rem = remainingSlots.get(p.id) || 0;
    const doneHere = doneByProject[p.id] || 0;
    const daysLeft = p.deadline ? diffDays(ymd, p.deadline) + 1 : null;
    let quota;
    if (p.quick) quota = rem;
    else if (daysLeft == null) quota = Math.min(rem, 2);
    else if (daysLeft <= 0) quota = rem;
    else quota = Math.ceil((rem + doneHere) / daysLeft) - doneHere;
    quota = Math.max(0, Math.min(rem, quota));
    let urgency = daysLeft == null ? 0.1 : (rem + doneHere) / 2 / Math.max(1, daysLeft);
    if (daysLeft != null && daysLeft <= 0) urgency += 500;
    if (p.quick) urgency += 1000;
    return { p, quota, urgency, daysLeft };
  }).filter(c => c.quota > 0).sort((a, b) => b.urgency - a.urgency);

  let cap = Math.max(0, Math.round(opts.maxProjectHoursPerDay * 2) - doneSlots.length);
  const startMin = timeToMinutes(opts.dayStart) ?? 8 * 60;
  const endMin = timeToMinutes(opts.dayEnd) ?? 22 * 60;
  let first = startMin;
  if (ymd === today) first = Math.max(startMin, Math.floor(nowMinutes(now) / SLOT) * SLOT);

  for (let m = first; m + SLOT <= endMin && cap > 0; m += SLOT) {
    if (busy.some(([s, e]) => s < m + SLOT && e > m)) continue;
    const c = candidates.find(x => x.quota > 0);
    if (!c) break;
    const time = minutesToTime(m);
    items.push({
      id: slotId(c.p.id, ymd, time), type: 'AUTO', parentProjectId: c.p.id, date: ymd,
      text: c.p.text, project: c.p, quick: !!c.p.quick,
      startTime: time, endTime: minutesToTime(m + SLOT), done: false,
    });
    c.quota -= 1;
    cap -= 1;
    remainingSlots.set(c.p.id, (remainingSlots.get(c.p.id) || 0) - 1);
  }

  candidates.forEach(c => {
    if (c.daysLeft != null && c.daysLeft <= 0 && !c.p.quick) {
      warnings.push(`« ${c.p.text} » a dépassé sa deadline.`);
      issues.push({ kind: 'late', project: c.p });
    }
    if (c.quota > 0) {
      warnings.push(`Pas assez de temps libre pour « ${c.p.text} » : ${formatDuration(c.quota * SLOT)} non planifiées.`);
      issues.push({ kind: 'overflow', project: c.p, minutes: c.quota * SLOT });
    }
  });

  return { items: items.sort(sortByTime), warnings, issues };
}

// Planifie `count` jours consécutifs à partir d'aujourd'hui (simulation cohérente entre les jours)
export function organizeRange(todos, count, options = {}) {
  const safe = Array.isArray(todos) ? todos : [];
  const now = options.now || new Date();
  const today = toYmd(now);
  const opts = { ...DEFAULT_PLANNER, ...options, now, today };
  const remainingSlots = new Map(
    getActiveProjects(safe).map(p => [p.id, Math.round((parseFloat(p.totalHours) || 0) * 2)])
  );
  const days = [];
  for (let i = 0; i < count; i++) {
    const ymd = addDays(today, i);
    days.push({ date: ymd, ...planOneDay(safe, ymd, remainingSlots, opts) });
  }
  return days;
}

export function organizeDay(todos, ymd, options = {}) {
  const safe = Array.isArray(todos) ? todos : [];
  const now = options.now || new Date();
  const today = toYmd(now);
  const opts = { ...DEFAULT_PLANNER, ...options, now, today };
  if (ymd <= today) {
    const remainingSlots = new Map(
      getActiveProjects(safe).map(p => [p.id, Math.round((parseFloat(p.totalHours) || 0) * 2)])
    );
    const { items, warnings, issues } = planOneDay(safe, ymd, remainingSlots, opts);
    return { schedule: items, warnings, issues };
  }
  const span = Math.min(diffDays(today, ymd), 90);
  const days = organizeRange(safe, span + 1, { ...options, now });
  const last = days[days.length - 1];
  return { schedule: last.items, warnings: last.warnings, issues: last.issues };
}

// Élément en cours et prochain élément non fait d'un planning du jour
export function getNowAndNext(schedule, now = new Date()) {
  const nm = nowMinutes(now);
  const timed = (schedule || []).filter(i => i.startTime && i.endTime && !i.done);
  const current = timed.find(i => timeToMinutes(i.startTime) <= nm && nm < timeToMinutes(i.endTime)) || null;
  const next = timed.find(i => timeToMinutes(i.startTime) > nm && (!current || i.id !== current.id)) || null;
  return { current, next };
}
