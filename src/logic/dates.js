// Helpers de dates en heure LOCALE (jamais toISOString pour un jour : ça renvoie l'UTC).

export const pad2 = (n) => String(n).padStart(2, '0');

export const toYmd = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const todayYmd = () => toYmd(new Date());

export const parseYmd = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(x => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (ymd, n) => {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};

// Nombre de jours de a à b (b - a)
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

// Lundi = 0 … Dimanche = 6
export const weekdayIndex = (ymd) => (parseYmd(ymd).getDay() + 6) % 7;

export const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(x => parseInt(x, 10));
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
};

export const minutesToTime = (min) => {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

// "8:5" -> "08:05", valeur invalide -> null
export const normalizeTime = (t) => {
  const m = timeToMinutes(t);
  return m == null ? null : minutesToTime(m);
};

export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

export const dateAtTime = (ymd, time) => {
  const d = parseYmd(ymd);
  const m = timeToMinutes(time) || 0;
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

export const formatDayLabel = (ymd, today = todayYmd()) => {
  const diff = diffDays(today, ymd);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return parseYmd(ymd).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const formatShortDate = (ymd) => {
  if (!ymd) return '—';
  return parseYmd(ymd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const formatDuration = (minutes) => {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${pad2(r)}` : `${h}h`;
};

export const formatHours = (h) => {
  const v = Math.round(h * 10) / 10;
  return `${String(v).replace('.', ',')}h`;
};

// Semaines (lundi → dimanche) couvrant le mois de `date`
export const buildMonthMatrix = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((startDay + daysInMonth) / 7);
  const matrix = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month, 1 - startDay + w * 7 + i);
      week.push({ date: d, inMonth: d.getMonth() === month, ymd: toYmd(d) });
    }
    matrix.push(week);
  }
  return matrix;
};
