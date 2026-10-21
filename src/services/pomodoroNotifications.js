// Notification persistante du Pomodoro (chronomètre + boutons) et alerte de fin de session,
// qui sonne même si l'application est en arrière-plan.
import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  EventType,
  AndroidForegroundServiceType,
  TriggerType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNEL_ID = 'pomodoro_timer';
const ALERT_CHANNEL_ID = 'pomodoro_alerts';
const NOTIF_ID = 'pomodoro_timer';
const END_ALERT_ID = 'pomodoro_end';

export const KEYS = {
  end: '@vicrasti_pomodoro_end',
  paused: '@vicrasti_pomodoro_paused',
  title: '@vicrasti_pomodoro_title',
  endMsg: '@vicrasti_pomodoro_endmsg',
};

const isAndroid = Platform.OS === 'android';
const DEFAULT_TITLE = 'Session de focus';

if (isAndroid) {
  notifee.registerForegroundService(() => new Promise(() => {}));

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    // Fin de session app fermée : on coupe le service, l'app comptabilisera la session à sa réouverture
    if (type === EventType.DELIVERED && detail?.notification?.id === END_ALERT_ID) {
      try { await notifee.stopForegroundService(); } catch (_) {}
      try { await notifee.cancelNotification(NOTIF_ID); } catch (_) {}
      return;
    }
    if (type !== EventType.ACTION_PRESS) return;
    const actionId = detail?.pressAction?.id;
    const title = (await AsyncStorage.getItem(KEYS.title)) || DEFAULT_TITLE;
    if (actionId === 'stop') {
      await stopForegroundPomodoro();
      try { await AsyncStorage.multiRemove([KEYS.end, KEYS.paused]); } catch (_) {}
    }
    if (actionId === 'pause') {
      const raw = await AsyncStorage.getItem(KEYS.end);
      const secs = raw ? Math.max(0, Math.ceil((parseInt(raw, 10) - Date.now()) / 1000)) : 0;
      await pauseForegroundPomodoro(secs, title);
    }
    if (actionId === 'resume') {
      const pausedRaw = await AsyncStorage.getItem(KEYS.paused);
      const secs = pausedRaw ? parseInt(pausedRaw, 10) : 0;
      if (secs > 0) {
        await AsyncStorage.setItem(KEYS.end, String(Date.now() + secs * 1000));
        await resumeForegroundPomodoro(secs * 1000, title);
      }
    }
  });
}

async function ensureChannels() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Session de focus',
    importance: AndroidImportance.LOW,
    vibration: false,
  });
  await notifee.createChannel({
    id: ALERT_CHANNEL_ID,
    name: 'Fin de session',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
  });
}

const fmt = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

function runningPayload(remainingMs, title) {
  return {
    id: NOTIF_ID,
    title: title || DEFAULT_TITLE,
    body: '',
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE],
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: 'ic_launcher',
      showChronometer: true,
      chronometerDirection: 'down',
      timestamp: Date.now() + remainingMs,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Pause', pressAction: { id: 'pause' } },
        { title: 'Arrêter', pressAction: { id: 'stop' } },
      ],
    },
  };
}

async function scheduleEndAlert(endTs) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.endMsg);
    const msg = raw ? JSON.parse(raw) : { title: 'Session terminée', body: 'Reviens dans l\'app.' };
    await notifee.createTriggerNotification(
      {
        id: END_ALERT_ID,
        title: msg.title,
        body: msg.body,
        android: {
          channelId: ALERT_CHANNEL_ID,
          smallIcon: 'ic_launcher',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default', launchActivity: 'default' },
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: endTs, alarmManager: { allowWhileIdle: true } },
    );
  } catch (_) {}
}

async function cancelEndAlert() {
  try { await notifee.cancelTriggerNotification(END_ALERT_ID); } catch (_) {}
  try { await notifee.cancelNotification(END_ALERT_ID); } catch (_) {}
}

// Message affiché à la fin de la session en cours (ex: "Pause méritée !")
export async function setEndMessage(title, body) {
  try { await AsyncStorage.setItem(KEYS.endMsg, JSON.stringify({ title, body })); } catch (_) {}
}

export async function resumeForegroundPomodoro(remainingMs, title) {
  if (!isAndroid) return;
  try { await notifee.requestPermission(); } catch (_) {}
  try {
    await ensureChannels();
    if (title) await AsyncStorage.setItem(KEYS.title, title);
    await AsyncStorage.removeItem(KEYS.paused);
    await notifee.displayNotification(runningPayload(remainingMs, title));
    await cancelEndAlert();
    await scheduleEndAlert(Date.now() + remainingMs);
  } catch (_) {}
}

export const startForegroundPomodoro = resumeForegroundPomodoro;

export async function pauseForegroundPomodoro(remainingSecs, title) {
  try {
    await AsyncStorage.setItem(KEYS.paused, String(remainingSecs));
    await AsyncStorage.removeItem(KEYS.end);
  } catch (_) {}
  if (!isAndroid) return;
  try {
    await ensureChannels();
    await cancelEndAlert();
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: 'En pause',
      body: `${title || 'Pomodoro'} — ${fmt(remainingSecs)} restantes`,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE],
        ongoing: true,
        onlyAlertOnce: true,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          { title: 'Reprendre', pressAction: { id: 'resume' } },
          { title: 'Arrêter', pressAction: { id: 'stop' } },
        ],
      },
    });
  } catch (_) {}
}

export async function stopForegroundPomodoro() {
  try { await AsyncStorage.removeItem(KEYS.paused); } catch (_) {}
  if (!isAndroid) return;
  await cancelEndAlert();
  try { await notifee.stopForegroundService(); } catch (_) {}
  try { await notifee.cancelNotification(NOTIF_ID); } catch (_) {}
}

// Session terminée app ouverte : on retire le service sans annuler l'alerte qui vient de sonner
export async function finishForegroundPomodoro() {
  if (!isAndroid) return;
  try { await notifee.stopForegroundService(); } catch (_) {}
  try { await notifee.cancelNotification(NOTIF_ID); } catch (_) {}
  try { await notifee.cancelTriggerNotification(END_ALERT_ID); } catch (_) {}
}

export async function onNotificationAction(listener) {
  if (!isAndroid) return () => {};
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) listener({ detail });
  });
}
