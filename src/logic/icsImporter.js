import ical from 'ical.js';
import { toYmd, pad2, todayYmd } from './dates';
import { newId } from './tasks';

const hm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const parseICS = (fileData) => {
  try {
    const jcalData = ical.parse(fileData);
    const comp = new ical.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map(event => {
      let summary = event.getFirstPropertyValue('summary') || 'Sans titre';
      // Nettoyage : supprime "Indisponibilité -" s'il est présent
      summary = String(summary).replace(/^Indisponibilité\s*-\s*/, '');

      const location = event.getFirstPropertyValue('location') || '';
      const description = event.getFirstPropertyValue('description') || '';

      // Nom de l'enseignant : souvent "NOM Prénom" dans la description
      const teacherMatch = String(description).match(/[A-Z]{2,}\s+[A-Z][a-z]+/);
      const teacher = teacherMatch ? teacherMatch[0] : '';

      const dtstart = event.getFirstPropertyValue('dtstart');
      const dtend = event.getFirstPropertyValue('dtend') || dtstart;
      const startDate = dtstart.toJSDate();
      const endDate = dtend.toJSDate();
      const allDay = !!dtstart.isDate;

      return {
        id: newId(),
        uid: event.getFirstPropertyValue('uid') || null,
        source: 'ics',
        text: summary,
        type: 'FIXED',
        done: false,
        dueDate: toYmd(startDate),
        startTime: allDay ? null : hm(startDate),
        endTime: allDay ? null : hm(endDate),
        recurrence: null,
        location: String(location),
        teacher,
      };
    });
  } catch (e) {
    console.error('Erreur parsing ICS:', e);
    return [];
  }
};

const icsKey = (t) => `${t.uid || t.text}|${t.dueDate}|${t.startTime || ''}`;
const legacyKey = (t) => `${t.text}|${t.dueDate}|${t.startTime || ''}`;

/*
 Fusionne des événements importés avec les tâches existantes.
 `replaceFuture` (synchro d'un flux complet) : les cours futurs importés précédemment
 et absents du flux (annulés / déplacés) sont retirés, sauf s'ils ont été cochés.
*/
export function mergeImported(existing, imported, { replaceFuture = false } = {}) {
  const today = todayYmd();
  const importedKeys = new Set(imported.map(icsKey));
  let removed = 0;
  let kept = existing || [];
  if (replaceFuture) {
    kept = kept.filter(t => {
      const stale = t.type === 'FIXED' && t.source === 'ics' && t.dueDate >= today && !t.done && !importedKeys.has(icsKey(t));
      if (stale) removed += 1;
      return !stale;
    });
  }
  const seen = new Set();
  kept.filter(t => t.type === 'FIXED').forEach(t => { seen.add(icsKey(t)); seen.add(legacyKey(t)); });
  const toAdd = [];
  let skipped = 0;
  imported.forEach(imp => {
    if (seen.has(icsKey(imp)) || seen.has(legacyKey(imp))) { skipped += 1; return; }
    seen.add(icsKey(imp));
    seen.add(legacyKey(imp));
    toAdd.push(imp);
  });
  return { todos: [...kept, ...toAdd], added: toAdd.length, skipped, removed };
}
