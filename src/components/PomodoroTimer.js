import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
let Notifications = null; // dynamically imported to avoid crash if native module missing
import { getTheme } from '../styles/globalStyles';
import { startForegroundPomodoro, updateForegroundPomodoro, stopForegroundPomodoro } from '../services/pomodoroNotifications';

const PomodoroTimer = ({ isDarkMode }) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60); 
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('WORK'); // 'WORK' ou 'BREAK'
  const notifIdRef = useRef(null);

  useEffect(() => {
    // restore persisted timer if present
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem('@vicrasti_pomodoro_end');
        const notif = await AsyncStorage.getItem('@vicrasti_pomodoro_notif');
        if (raw) {
          const endTs = parseInt(raw, 10);
          const remaining = Math.max(0, Math.round((endTs - Date.now()) / 1000));
          if (remaining > 0) {
            setSecondsLeft(remaining);
            setIsActive(true);
            if (notif) notifIdRef.current = notif;
          } else {
            await AsyncStorage.removeItem('@vicrasti_pomodoro_end');
            await AsyncStorage.removeItem('@vicrasti_pomodoro_notif');
          }
        }
      } catch (e) { console.warn('restore pomodoro', e); }
    };
    // request notification permissions (safe to call repeatedly)
    const askPerm = async () => {
      try {
        if (!Notifications) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (e) { console.warn('notif perm', e); }
    };
    // create Android channel for scheduled notifications (needed for Android)
    const ensureChannel = async () => {
      try {
        if (!Notifications) return;
        if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
          const AndroidImportance = Notifications.AndroidImportance || (Notifications.AndroidNotificationPriority && Notifications.AndroidNotificationPriority.MAX) || 5;
          await Notifications.setNotificationChannelAsync('pomodoro', {
            name: 'Pomodoro',
            importance: AndroidImportance,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250]
          });
        }
      } catch (e) { console.warn('create channel', e); }
    };
    askPerm();
    ensureChannel();
    restore();

    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(secondsLeft => secondsLeft - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      Vibration.vibrate();
      setIsActive(false);
      const nextMode = mode === 'WORK' ? 'BREAK' : 'WORK';
      setMode(nextMode);
      setSecondsLeft(nextMode === 'WORK' ? 25 * 60 : 5 * 60);
      // clear persisted end and cancel notification
      (async () => {
        try {
          await stopForegroundPomodoro();
        } catch (e) { console.warn('cancel foreground notif', e); }
        await AsyncStorage.removeItem('@vicrasti_pomodoro_end');
        await AsyncStorage.removeItem('@vicrasti_pomodoro_notif');
      })();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, mode]);

  const scheduleEndNotification = async (endTs) => {
    if (!Notifications || !Notifications.scheduleNotificationAsync) return null;
    try {
      const content = {
        title: mode === 'WORK' ? 'Session terminée' : 'Pause terminée',
        body: mode === 'WORK' ? "La session Pomodoro est finie." : "La pause est terminée."
      };
      const android = Platform.OS === 'android' ? { channelId: 'pomodoro' } : undefined;
      const id = await Notifications.scheduleNotificationAsync({
        content: { ...content, android },
        trigger: new Date(endTs)
      });
      notifIdRef.current = id;
      await AsyncStorage.setItem('@vicrasti_pomodoro_notif', id);
      return id;
    } catch (e) { console.warn('schedule notif', e); }
  };

  const persistEnd = async (endTs) => {
    try { await AsyncStorage.setItem('@vicrasti_pomodoro_end', String(endTs)); } catch (e) { console.warn('persist end', e); }
  };

  const clearPersist = async () => {
    try {
      const nid = notifIdRef.current || await AsyncStorage.getItem('@vicrasti_pomodoro_notif');
      if (nid && Notifications && Notifications.cancelScheduledNotificationAsync) await Notifications.cancelScheduledNotificationAsync(nid);
    } catch (e) { console.warn('clear notif', e); }
    try { await AsyncStorage.removeItem('@vicrasti_pomodoro_end'); await AsyncStorage.removeItem('@vicrasti_pomodoro_notif'); } catch(e){}
  };

  const formatTime = () => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const theme = getTheme(!!isDarkMode);
  const dynamic = {
    container: [styles.container, { backgroundColor: theme.card, borderColor: mode === 'BREAK' ? theme.success : theme.danger }],
    label: { color: theme.text },
    timer: { color: theme.text }
  };

  const totalSeconds = mode === 'WORK' ? 25 * 60 : 5 * 60;
  const progress = 1 - (secondsLeft / totalSeconds);
  const progressBg = mode === 'BREAK' ? theme.success : theme.primary;

  return (
    <View style={dynamic.container}>
      <Text style={[styles.label, dynamic.label]}>{mode === 'WORK' ? '🔥 Session Focus' : '☕ Pause Café'}</Text>
      <Text style={[styles.timer, dynamic.timer]}>{formatTime()}</Text>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: theme.inputBg }]}>
          <View style={[styles.progressFill, { width: `${Math.min(Math.max(progress, 0), 1) * 100}%`, backgroundColor: progressBg }]} />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={async () => {
            // toggle active
            if (!isActive) {
              // starting: compute end timestamp and persist + schedule notif
              const endTs = Date.now() + secondsLeft * 1000;
              await persistEnd(endTs);
              // start foreground notification (if available)
              try { await startForegroundPomodoro(endTs - Date.now()); } catch(e){console.warn(e)}
              setIsActive(true);
            } else {
              // pausing/stopping
              setIsActive(false);
              await clearPersist();
              try { await stopForegroundPomodoro(); } catch(e){}
            }
          }} style={[styles.btnMain, { backgroundColor: progressBg }]}> 
          <Text style={[styles.btnText, { color: theme.white }]}>{isActive ? 'Pause' : 'Démarrer'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={async () => { setIsActive(false); setSecondsLeft(25*60); setMode('WORK'); await clearPersist(); }} style={styles.btnReset}>
          <Text style={[styles.btnTextSmall, { color: theme.subText }]}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    elevation: 3,
  },
  breakContainer: {},
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
  timer: { fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  btnMain: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginRight: 15, elevation: 2 },
  btnReset: { padding: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  progressContainer: { width: '100%', marginTop: 12 },
  progressBar: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
  btnTextSmall: { fontWeight: 'bold' }
});


export default PomodoroTimer;