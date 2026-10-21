import { toYmd, diffDays, weekdayIndex, normalizeTime } from './dates';

/*
 Modèle de données (tableau `todos` persisté) :
 - FIXED     : créneau précis. { dueDate, startTime, endTime, recurrence, done, doneAt,
               doneDates (récurrentes), skipDates (occurrences supprimées), location, teacher, source, uid }
 - PROJECT   : volume d'heures à planifier. { totalHours (restantes), initialHours, deadline,
               steps: [{ id, text, done }], quick (tâche rapide), done, doneAt }
 - AUTO_DONE : marqueur d'un créneau de projet de 30 min validé. { parentId, date, time, doneAt }
*/

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const isRecurring = (t) => !!(t && t.recurrence && t.recurrence.type && t.recurrence.type !== 'none');

export const occursOn = (t, ymd) => {
  if (!t || t.type !== 'FIXED') return false;
  if (Array.isArray(t.skipDates) && t.skipDates.includes(ymd)) return false;
  if (!isRecurring(t)) return t.dueDate === ymd;
  if (t.dueDate && ymd < t.dueDate) return false;
  if (t.recurrence.until && ymd > t.recurrence.until) return false;
  if (t.recurrence.type === 'daily') return true;
  if (t.recurrence.type === 'weekly') {
    const days = Array.isArray(t.recurrence.days) && t.recurrence.days.length
      ? t.recurrence.days
      : (t.dueDate ? [weekdayIndex(t.dueDate)] : []);
    return days.includes(weekdayIndex(ymd));
  }
  return false;
};

export const isDoneOn = (t, ymd) => (isRecurring(t) ? (t.doneDates || []).includes(ymd) : !!t.done);

// Occurrences des tâches fixes pour un jour donné (récurrences incluses)
export const getFixedForDay = (todos, ymd) => (todos || [])
  .filter(t => occursOn(t, ymd))
  .map(t => ({
    id: isRecurring(t) ? `${t.id}@${ymd}` : t.id,
    taskId: t.id,
    type: 'FIXED',
    text: t.text,
    date: ymd,
    startTime: normalizeTime(t.startTime) || normalizeTime(t.recurrence && t.recurrence.time),
    endTime: normalizeTime(t.endTime),
    done: isDoneOn(t, ymd),
    recurring: isRecurring(t),
    location: t.location,
    teacher: t.teacher,
    source: t.source,
    task: t,
  }));

export const isImported = (t) => t && t.source === 'ics';

// Tâches fixes ponctuelles non faites dans le passé (les cours importés sont exclus)
export const getOverdue = (todos, today, maxDays = 30) => (todos || [])
  .filter(t => t.type === 'FIXED' && !isRecurring(t) && !t.done && !isImported(t)
    && t.dueDate && t.dueDate < today && diffDays(t.dueDate, today) <= maxDays)
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

export const getActiveProjects = (todos) => (todos || []).filter(t => t.type === 'PROJECT' && !t.done);

export const projectInfo = (p, today) => {
  const remaining = Math.max(0, parseFloat(p.totalHours) || 0);
  const initial = Math.max(parseFloat(p.initialHours) || 0, remaining);
  const doneHours = initial - remaining;
  const daysLeft = p.deadline ? diffDays(today, p.deadline) + 1 : null; // aujourd'hui inclus
  const perDay = daysLeft == null ? null : remaining / Math.max(1, daysLeft);
  let risk = 'ok';
  if (daysLeft != null && daysLeft <= 0 && remaining > 0) risk = 'late';
  else if (perDay != null && perDay > 4) risk = 'high';
  else if (perDay != null && perDay > 2) risk = 'medium';
  const steps = Array.isArray(p.steps) ? p.steps : [];
  const nextStep = steps.find(s => !s.done) || null;
  return {
    remaining, initial, doneHours,
    progress: initial > 0 ? doneHours / initial : 0,
    daysLeft, perDay, risk, nextStep,
    stepsDone: steps.filter(s => s.done).length,
    stepsTotal: steps.length,
  };
};

// Dates (YYYY-MM-DD) de toutes les complétions connues, pour la série et les stats
export const completionEvents = (todos) => {
  const events = [];
  (todos || []).forEach(t => {
    if (t.type === 'AUTO_DONE') {
      events.push({ date: t.date || (t.doneAt ? toYmd(new Date(t.doneAt)) : null), kind: 'slot', task: t });
    } else if (isRecurring(t)) {
      (t.doneDates || []).forEach(d => events.push({ date: d, kind: 'task', task: t }));
    } else if (t.done) {
      events.push({ date: t.doneAt ? toYmd(new Date(t.doneAt)) : null, kind: t.type === 'PROJECT' ? 'project' : 'task', task: t });
    }
  });
  return events;
};

// Remet les anciennes données au format actuel (heures "8:00", dates manquantes, etc.)
export const migrateTodos = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map(t => {
    const n = { ...t };
    if (!n.id) n.id = newId();
    if (n.type === 'FIXED') {
      if (n.startTime) n.startTime = normalizeTime(n.startTime) || n.startTime;
      if (n.endTime) n.endTime = normalizeTime(n.endTime) || n.endTime;
      if (!n.source && n.teacher !== undefined && n.priority === 1) n.source = 'ics';
      if (isRecurring(n) && !Array.isArray(n.doneDates)) n.doneDates = [];
    }
    if (n.type === 'PROJECT') {
      if (n.initialHours == null) n.initialHours = n.totalHours;
      if (!Array.isArray(n.steps)) n.steps = [];
    }
    if (n.type === 'AUTO_DONE' && !n.date && typeof n.id === 'string') {
      const m = n.id.match(/(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/);
      if (m) { n.date = m[1]; n.time = m[2]; }
    }
    return n;
  });
};

export const sortByTime = (a, b) => {
  const sa = a.startTime || '';
  const sb = b.startTime || '';
  if (!sa && sb) return -1;
  if (sa && !sb) return 1;
  return sa.localeCompare(sb);
};
