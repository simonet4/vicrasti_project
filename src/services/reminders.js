// Rappels planifiés : avant chaque tâche fixe, au début des créneaux de projet,
// brief du matin et bilan du soir. Tout est replanifié à chaque changement des données.
import { Platform } from 'react-native';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { organizeRange } from '../logic/planner';
import { dateAtTime, timeToMinutes, formatDuration } from '../logic/dates';

const CHANNEL_ID = 'reminders';
const PREFIX = 'rem-';
const MAX_REMINDERS = 60;

const NUDGES = [
  'Juste 5 minutes. Le plus dur, c\'est de commencer.',
  'Lance le Pomodoro maintenant, réfléchis après.',
  'Toi dans une heure te remerciera.',
  'Pas besoin d\'être motivé, juste de démarrer.',
  'Une petite étape, tout de suite.',
];
const nudge = (i) => NUDGES[i % NUDGES.length];

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android') return;
  try { await notifee.requestPermission(); } catch (_) {}
}

async function cancelOurTriggers() {
  const ids = await notifee.getTriggerNotificationIds();
  const ours = ids.filter(id => id.startsWith(PREFIX));
  if (ours.length) await notifee.cancelTriggerNotifications(ours);
}

export async function rescheduleReminders(todos, settings) {
  if (Platform.OS !== 'android') return;
  try {
    await cancelOurTriggers();
    if (!settings.remindersEnabled) return;
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Rappels de tâches',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });

    const now = Date.now();
    const lead = Math.max(0, settings.reminderLeadMin || 0);
    const plannerOpts = {
      dayStart: settings.dayStart, dayEnd: settings.dayEnd,
      maxProjectHoursPerDay: settings.maxProjectHoursPerDay,
    };
    const days = organizeRange(todos, 2, plannerOpts);
    const pending = [];

    days.forEach(day => {
      const items = day.items.filter(i => !i.done);

      items.filter(i => i.type === 'FIXED' && i.startTime).forEach((i, idx) => {
        const at = dateAtTime(day.date, i.startTime).getTime() - lead * 60000;
        pending.push({
          id: `${PREFIX}fx-${i.id}`, at,
          title: lead > 0 ? `Dans ${lead} min : ${i.text}` : `C'est l'heure : ${i.text}`,
          body: [`${i.startTime}–${i.endTime || ''}`, i.location].filter(Boolean).join(' · ') || nudge(idx),
        });
      });

      // Un rappel au début de chaque bloc continu de créneaux d'un même projet
      if (settings.slotReminders) {
        const autos = items.filter(i => i.type === 'AUTO');
        autos.forEach((i, idx) => {
          const prev = autos[idx - 1];
          if (prev && prev.parentProjectId === i.parentProjectId && prev.endTime === i.startTime) return;
          let end = i.endTime;
          for (let k = idx + 1; k < autos.length && autos[k].parentProjectId === i.parentProjectId && autos[k].startTime === end; k++) end = autos[k].endTime;
          const step = i.project && Array.isArray(i.project.steps) ? i.project.steps.find(s => !s.done) : null;
          pending.push({
            id: `${PREFIX}slot-${i.id}`,
            at: dateAtTime(day.date, i.startTime).getTime(),
            title: `${i.text} · ${i.startTime}–${end}`,
            body: step ? `Prochaine étape : ${step.text}` : nudge(idx + 1),
          });
        });
      }

      if (settings.morningBriefEnabled) {
        const fixedCount = items.filter(i => i.type === 'FIXED').length;
        const projMin = items.filter(i => i.type === 'AUTO').length * 30;
        const first = items.find(i => i.startTime && timeToMinutes(i.startTime) >= timeToMinutes(settings.morningBriefTime));
        const parts = [];
        if (fixedCount) parts.push(`${fixedCount} tâche${fixedCount > 1 ? 's' : ''}`);
        if (projMin) parts.push(`${formatDuration(projMin)} de projets`);
        pending.push({
          id: `${PREFIX}morning-${day.date}`,
          at: dateAtTime(day.date, settings.morningBriefTime).getTime(),
          title: parts.length ? `Aujourd'hui : ${parts.join(' et ')}` : 'Journée libre. Un petit pas quand même ?',
          body: first ? `Première étape à ${first.startTime} : ${first.text}` : 'Ouvre l\'app et choisis UNE chose à faire.',
        });
      }

      if (settings.eveningReviewEnabled) {
        pending.push({
          id: `${PREFIX}evening-${day.date}`,
          at: dateAtTime(day.date, settings.eveningReviewTime).getTime(),
          title: 'Bilan de la journée',
          body: 'Coche ce que tu as fait et jette un œil à demain. 2 minutes, promis.',
        });
      }
    });

    const toSchedule = pending
      .filter(p => p.at > now + 5000)
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX_REMINDERS);

    for (const p of toSchedule) {
      await notifee.createTriggerNotification(
        {
          id: p.id,
          title: p.title,
          body: p.body,
          android: {
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        },
        { type: TriggerType.TIMESTAMP, timestamp: p.at, alarmManager: { allowWhileIdle: true } },
      );
    }
  } catch (e) {
    console.warn('rescheduleReminders', e);
  }
}
