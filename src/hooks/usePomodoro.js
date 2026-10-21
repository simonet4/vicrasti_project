import { useState, useEffect, useRef, useCallback } from 'react';
import { Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KEYS,
  resumeForegroundPomodoro,
  pauseForegroundPomodoro,
  stopForegroundPomodoro,
  finishForegroundPomodoro,
  setEndMessage,
  onNotificationAction,
} from '../services/pomodoroNotifications';

const META_KEY = '@vicrasti_pomodoro_meta';
// Au-delà, une session terminée app fermée n'enchaîne pas automatiquement sur la pause
const AUTO_CHAIN_MAX_DELAY_MS = 2 * 60 * 1000;

export const MODE_LABELS = { WORK: 'Focus', BREAK: 'Pause', LONG_BREAK: 'Grande pause' };

const titleFor = (mode, task) => (mode === 'WORK' ? (task ? task.text : 'Session de focus') : MODE_LABELS[mode]);

const endMessageFor = (mode) => (mode === 'WORK'
  ? ['Session terminée', 'Bien joué. Ouvre l\'app pour valider ta session et souffler un peu.']
  : ['Fin de la pause', 'On y retourne ? Encore une session et tu seras fier de toi.']);

/*
 Moteur du minuteur. Le temps restant est calculé à partir d'une heure de fin (et non d'un
 compteur), ce qui reste exact en arrière-plan. L'état est persisté pour survivre à la
 fermeture de l'app ; les boutons de la notification écrivent dans le même stockage.
*/
export default function usePomodoro({ settings, onWorkComplete, enabled = true }) {
  const durFor = useCallback((m) => {
    const min = m === 'WORK' ? settings.workMin : m === 'LONG_BREAK' ? settings.longBreakMin : settings.shortBreakMin;
    return Math.max(1, min) * 60;
  }, [settings.workMin, settings.shortBreakMin, settings.longBreakMin]);

  const [mode, setMode] = useState('WORK');
  const [duration, setDuration] = useState(() => durFor('WORK'));
  const [remaining, setRemaining] = useState(() => durFor('WORK'));
  const [isActive, setIsActive] = useState(false);
  const [endTs, setEndTs] = useState(null);
  const [cycle, setCycle] = useState(0);
  const [sessionTask, setSessionTask] = useState(null);
  const [, setTick] = useState(0);

  const stateRef = useRef({});
  stateRef.current = { mode, duration, remaining, isActive, endTs, cycle, sessionTask, settings, onWorkComplete, durFor };
  const completingRef = useRef(false);
  const lastStartRef = useRef(0);

  const secondsLeft = isActive && endTs ? Math.max(0, Math.ceil((endTs - Date.now()) / 1000)) : remaining;
  const isPaused = !isActive && remaining < duration;
  const isRunningOrPaused = isActive || isPaused;

  const persistMeta = async (meta) => {
    try { await AsyncStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {}
  };

  const goIdle = (nextMode, nextCycle) => {
    const secs = stateRef.current.durFor(nextMode);
    setIsActive(false);
    setEndTs(null);
    setMode(nextMode);
    setDuration(secs);
    setRemaining(secs);
    if (nextMode === 'WORK') setSessionTask(null);
    persistMeta({ mode: nextMode, duration: secs, cycle: nextCycle ?? stateRef.current.cycle, task: null });
  };

  const begin = async (nextMode, secs, { cycle: cycleVal, task } = {}) => {
    const end = Date.now() + secs * 1000;
    const sessionT = nextMode === 'WORK' ? (task || null) : stateRef.current.sessionTask;
    completingRef.current = false;
    lastStartRef.current = Date.now();
    setMode(nextMode);
    setDuration(secs);
    setRemaining(secs);
    setEndTs(end);
    setIsActive(true);
    setSessionTask(sessionT);
    try {
      await AsyncStorage.setItem(KEYS.end, String(end));
      await AsyncStorage.removeItem(KEYS.paused);
    } catch (_) {}
    await persistMeta({ mode: nextMode, duration: secs, cycle: cycleVal ?? stateRef.current.cycle, task: sessionT });
    await setEndMessage(...endMessageFor(nextMode));
    await resumeForegroundPomodoro(secs * 1000, titleFor(nextMode, sessionT));
  };

  const complete = async ({ mode: finishedMode, duration: secs, endedAt, cycle: cycleVal, task }) => {
    if (completingRef.current) return;
    completingRef.current = true;
    const s = stateRef.current;
    Vibration.vibrate([0, 400, 200, 400]);
    try { await AsyncStorage.multiRemove([KEYS.end, KEYS.paused]); } catch (_) {}
    await finishForegroundPomodoro();
    const canChain = Date.now() - endedAt < AUTO_CHAIN_MAX_DELAY_MS;
    if (finishedMode === 'WORK') {
      const newCycle = (cycleVal ?? s.cycle) + 1;
      const every = Math.max(1, s.settings.longBreakEvery || 4);
      const nextMode = newCycle % every === 0 ? 'LONG_BREAK' : 'BREAK';
      setCycle(newCycle);
      if (s.onWorkComplete) s.onWorkComplete({ minutes: Math.round(secs / 60), task: task || s.sessionTask || null, endedAt });
      if (s.settings.autoStartBreak && canChain) await begin(nextMode, s.durFor(nextMode), { cycle: newCycle });
      else goIdle(nextMode, newCycle);
    } else {
      goIdle('WORK');
    }
  };

  const pause = async () => {
    const s = stateRef.current;
    const secs = s.endTs ? Math.max(0, Math.ceil((s.endTs - Date.now()) / 1000)) : s.remaining;
    setIsActive(false);
    setEndTs(null);
    setRemaining(secs);
    await pauseForegroundPomodoro(secs, titleFor(s.mode, s.sessionTask));
  };

  const resume = async () => {
    const s = stateRef.current;
    const end = Date.now() + s.remaining * 1000;
    completingRef.current = false;
    lastStartRef.current = Date.now();
    setEndTs(end);
    setIsActive(true);
    try { await AsyncStorage.setItem(KEYS.end, String(end)); } catch (_) {}
    await setEndMessage(...endMessageFor(s.mode));
    await resumeForegroundPomodoro(s.remaining * 1000, titleFor(s.mode, s.sessionTask));
  };

  const stop = async () => {
    goIdle('WORK');
    try { await AsyncStorage.multiRemove([KEYS.end, KEYS.paused]); } catch (_) {}
    await stopForegroundPomodoro();
  };

  // Termine la session maintenant (focus : compte le temps déjà fait ; pause : retour au travail)
  const skip = async () => {
    const s = stateRef.current;
    if (s.mode === 'WORK') {
      const left = s.isActive && s.endTs ? Math.max(0, Math.ceil((s.endTs - Date.now()) / 1000)) : s.remaining;
      const elapsed = s.duration - left;
      if (elapsed < 60) { await stop(); return; }
      await complete({ mode: 'WORK', duration: elapsed, endedAt: Date.now(), cycle: s.cycle, task: s.sessionTask });
    } else {
      try { await AsyncStorage.multiRemove([KEYS.end, KEYS.paused]); } catch (_) {}
      await stopForegroundPomodoro();
      goIdle('WORK');
    }
  };

  const start = (minutes, task) => begin('WORK', Math.round((minutes || stateRef.current.settings.workMin) * 60), { task: task || null });

  const toggle = () => {
    const s = stateRef.current;
    if (s.isActive) pause();
    else if (s.remaining < s.duration) resume();
    else begin(s.mode, s.duration, { task: s.sessionTask });
  };

  // Relit l'état écrit par les boutons de la notification pendant que l'app était en arrière-plan
  const syncFromStorage = async (onMount) => {
    if (Date.now() - lastStartRef.current < 2000) return;
    try {
      const pairs = await AsyncStorage.multiGet([KEYS.end, KEYS.paused, META_KEY]);
      const [endRaw, pausedRaw, metaRaw] = pairs.map(p => p[1]);
      const meta = metaRaw ? JSON.parse(metaRaw) : null;
      if (meta) {
        setMode(meta.mode || 'WORK');
        setDuration(meta.duration || stateRef.current.durFor(meta.mode || 'WORK'));
        setCycle(meta.cycle || 0);
        setSessionTask(meta.task || null);
      }
      if (pausedRaw) {
        const secs = parseInt(pausedRaw, 10);
        if (secs > 0) {
          setIsActive(false);
          setEndTs(null);
          setRemaining(secs);
        }
        return;
      }
      if (endRaw) {
        const end = parseInt(endRaw, 10);
        if (end > Date.now()) {
          setEndTs(end);
          setIsActive(true);
        } else if (meta) {
          await complete({ mode: meta.mode, duration: meta.duration, endedAt: end, cycle: meta.cycle || 0, task: meta.task });
        }
        return;
      }
      if (!onMount && stateRef.current.isActive) goIdle('WORK');
    } catch (_) {}
  };

  // `enabled` attend le chargement des données : une session finie app fermée doit s'ajouter à l'historique chargé
  useEffect(() => {
    if (!enabled) return undefined;
    syncFromStorage(true);
    let unsub = () => {};
    let alive = true;
    onNotificationAction(({ detail }) => {
      const id = detail?.pressAction?.id;
      if (id === 'pause') pause();
      else if (id === 'resume') resume();
      else if (id === 'stop') stop();
    }).then(u => { if (alive) unsub = u; else u(); });
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') syncFromStorage(false); });
    return () => {
      alive = false;
      try { unsub(); } catch (_) {}
      sub.remove();
    };
  }, [enabled]);

  // Tic + détection de fin
  useEffect(() => {
    if (!isActive) return undefined;
    const iv = setInterval(() => {
      setTick(x => x + 1);
      const s = stateRef.current;
      if (s.isActive && s.endTs && Date.now() >= s.endTs) {
        complete({ mode: s.mode, duration: s.duration, endedAt: s.endTs, cycle: s.cycle, task: s.sessionTask });
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isActive]);

  // Réglages modifiés pendant que le minuteur est au repos
  useEffect(() => {
    const s = stateRef.current;
    if (!s.isActive && s.remaining === s.duration) {
      const secs = durFor(s.mode);
      setDuration(secs);
      setRemaining(secs);
    }
  }, [durFor]);

  return {
    mode, isActive, isPaused, isRunningOrPaused, secondsLeft, duration, cycle, sessionTask,
    progress: duration > 0 ? 1 - secondsLeft / duration : 0,
    start, toggle, stop, skip,
  };
}
