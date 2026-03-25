// JS wrapper for Notifee-based foreground notification (guarded dynamic import)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIF_KEY = '@vicrasti_notifee_id';

async function loadNotifee() {
  try {
    const m = await import('@notifee/react-native');
    return m.default || m;
  } catch (e) {
    console.warn('Notifee not installed or failed to load', e);
    return null;
  }
}

export async function startForegroundPomodoro(remainingMs) {
  const notifee = await loadNotifee();
  if (!notifee) return null;

  try {
    const channelId = await notifee.createChannel({ id: 'pomodoro', name: 'Pomodoro' });

    const display = async () => {
      const id = await notifee.displayNotification({
        title: 'Pomodoro en cours',
        body: `Temps restant: ${Math.ceil(remainingMs/1000)}s`,
        android: {
          channelId,
          ongoing: true,
          smallIcon: 'ic_launcher',
          actions: [
            { title: 'Pause', pressAction: { id: 'pause' } },
            { title: 'Stop', pressAction: { id: 'stop' } }
          ]
        }
      });
      await AsyncStorage.setItem(NOTIF_KEY, id);
      return id;
    };

    // Try to start a proper foreground service if API is available
    if (notifee.createForegroundService) {
      await notifee.createForegroundService(async () => {
        await display();
      }, { id: 'pomodoro-service' });
      // createForegroundService will also display the notification via callback
      const saved = await AsyncStorage.getItem(NOTIF_KEY);
      return saved;
    }

    // fallback: just show ongoing notification
    return await display();
  } catch (e) {
    console.warn('startForegroundPomodoro error', e);
    return null;
  }
}

export async function updateForegroundPomodoro(remainingMs) {
  const notifee = await loadNotifee();
  if (!notifee) return;
  try {
    const id = await AsyncStorage.getItem(NOTIF_KEY);
    // displayNotification will create or update; notifee may replace existing with same id
    await notifee.displayNotification({
      title: 'Pomodoro en cours',
      body: `Temps restant: ${Math.ceil(remainingMs/1000)}s`,
      android: { channelId: 'pomodoro', ongoing: true, smallIcon: 'ic_launcher' }
    });
  } catch (e) { console.warn('updateForegroundPomodoro error', e); }
}

export async function stopForegroundPomodoro() {
  const notifee = await loadNotifee();
  try {
    const id = await AsyncStorage.getItem(NOTIF_KEY);
    if (id && notifee && notifee.cancelNotification) {
      await notifee.cancelNotification(id);
    }
    if (notifee && notifee.stopForegroundService) {
      try { await notifee.stopForegroundService(); } catch(e){}
    }
  } catch (e) { console.warn('stopForegroundPomodoro error', e); }
  try { await AsyncStorage.removeItem(NOTIF_KEY); } catch(e){}
}

export async function onNotificationAction(listener) {
  const notifee = await loadNotifee();
  if (!notifee) return () => {};
  const unsub = notifee.onForegroundEvent(event => {
    if (event && event.type && event.detail) listener(event);
  });
  return unsub;
}
