import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Pressable, StyleSheet, Alert, Platform, StatusBar, Share, Vibration, AppState, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Font from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { getTheme, ThemeContext, type } from './src/styles/globalStyles';
import { Txt } from './src/components/ui';

import TodayScreen from './src/screens/DashboardScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import AIScreen from './src/screens/AIScreen';
import SettingsModal from './src/components/SettingsModal';
import TaskFormModal from './src/components/TaskFormModal';
import { FocusScreen, FocusBar } from './src/components/Focus';
import usePomodoro from './src/hooks/usePomodoro';
import { parseICS, mergeImported } from './src/logic/icsImporter';
import { migrateTodos, isRecurring, isDoneOn, newId, projectInfo } from './src/logic/tasks';
import { todayYmd, toYmd } from './src/logic/dates';
import { dailyActivity, computeStreak, POMODORO_MIN_MINUTES } from './src/logic/stats';
import { fetchIcsFromUrl, getIcsConfig, mergeIcsFeed } from './src/services/icsAutoSync';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './src/services/settings';
import { loadFocusLog, saveFocusLog } from './src/services/focusLog';
import { rescheduleReminders, requestNotificationPermission } from './src/services/reminders';
import { getStoredToken, saveToken } from './src/services/aiService';

const TODOS_KEY = '@vicrasti_todos';

const TABS = [
  { key: 'today', icon: 'sun', label: 'Aujourd\'hui' },
  { key: 'calendar', icon: 'calendar', label: 'Agenda' },
  { key: 'coach', icon: 'message-circle', label: 'Coach' },
  { key: 'progress', icon: 'bar-chart-2', label: 'Progrès' },
];

// Barre de navigation Android masquée : elle réapparaît temporairement en glissant depuis le bas
const hideNavigationBar = () => {
  if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [todos, setTodos] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [focusLog, setFocusLog] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [planningDate, setPlanningDate] = useState(todayYmd());
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ visible: false, task: null, date: null, type: 'QUICK' });
  const [focusVisible, setFocusVisible] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);

  const todosRef = useRef(todos);
  const focusLogRef = useRef(focusLog);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastTodayRef = useRef(todayYmd());

  // Mise à jour synchrone + persistance : les callbacks différés (alertes, minuteur) voient toujours la dernière version
  const updateTodos = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(todosRef.current) : updater;
    todosRef.current = next;
    setTodos(next);
    AsyncStorage.setItem(TODOS_KEY, JSON.stringify(next)).catch(() => {});
    return next;
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateFocusLog = useCallback((next) => {
    focusLogRef.current = next;
    setFocusLog(next);
    saveFocusLog(next);
  }, []);

  const changeApiKey = useCallback((value) => {
    setApiKey(value);
    saveToken(value);
  }, []);

  // ── Chargement ──
  useEffect(() => {
    hideNavigationBar();
    (async () => {
      try { await Font.loadAsync(Feather.font); } catch (_) {}
      try {
        const raw = await AsyncStorage.getItem(TODOS_KEY);
        const list = migrateTodos(raw ? JSON.parse(raw) : []);
        todosRef.current = list;
        setTodos(list);
      } catch (_) {}
      setSettings(await loadSettings());
      const log = await loadFocusLog();
      focusLogRef.current = log;
      setFocusLog(log);
      setApiKey(await getStoredToken());
      setReady(true);
      requestNotificationPermission();
    })();
  }, []);

  // ── Synchro ICS ──
  const syncIcs = useCallback(async (manual = false) => {
    const config = await getIcsConfig();
    if (!config.url) return;
    const { imported, error } = await fetchIcsFromUrl();
    if (error) {
      if (manual) Alert.alert('Synchronisation', error);
      return;
    }
    if (!imported) return;
    const res = mergeIcsFeed(todosRef.current, imported);
    if (res.added || res.removed) updateTodos(res.todos);
    if (manual) Alert.alert('Synchronisation', `${res.added} ajouté(s) · ${res.removed} retiré(s) · ${res.skipped} inchangé(s)`);
  }, [updateTodos]);

  useEffect(() => {
    if (!ready) return undefined;
    const startupTimer = setTimeout(() => { syncIcs().catch(() => {}); }, 5000);
    const interval = setInterval(() => { syncIcs().catch(() => {}); }, 60 * 60 * 1000);
    return () => { clearTimeout(startupTimer); clearInterval(interval); };
  }, [ready, syncIcs]);

  // ── Rappels (replanifiés à chaque changement) ──
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => rescheduleReminders(todos, settings), 1500);
    return () => clearTimeout(timer);
  }, [todos, settings, ready]);

  // Retour au premier plan : nouveau jour ? on recale le planning et les rappels
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      hideNavigationBar();
      const today = todayYmd();
      if (today !== lastTodayRef.current) {
        setPlanningDate(d => (d === lastTodayRef.current ? today : d));
        lastTodayRef.current = today;
      }
      rescheduleReminders(todosRef.current, settingsRef.current);
    });
    return () => sub.remove();
  }, []);

  // ── Actions sur les tâches ──
  const toggleItem = useCallback((item) => {
    if (!item) return;
    if (item.type === 'AUTO') {
      const wasDone = todosRef.current.some(x => x.type === 'AUTO_DONE' && x.id === item.id);
      let finished = null;
      updateTodos(prev => {
        if (wasDone) {
          return prev.filter(x => x.id !== item.id).map(x => (x.id === item.parentProjectId
            ? { ...x, totalHours: String((parseFloat(x.totalHours) || 0) + 0.5), done: false, doneAt: null }
            : x));
        }
        const now = new Date().toISOString();
        const next = prev.map(x => {
          if (x.id !== item.parentProjectId) return x;
          const rem = Math.max(0, (parseFloat(x.totalHours) || 0) - 0.5);
          if (rem <= 0) finished = x;
          return { ...x, totalHours: String(rem), done: rem <= 0, doneAt: rem <= 0 ? now : x.doneAt };
        });
        const marker = { id: item.id, type: 'AUTO_DONE', parentId: item.parentProjectId, date: item.date || todayYmd(), time: item.startTime, done: true, doneAt: now };
        return [...next, marker];
      });
      if (!wasDone) Vibration.vibrate(30);
      if (finished && !finished.quick) Alert.alert('Projet terminé', `« ${finished.text} » est bouclé. Bravo.`);
      return;
    }
    const taskId = item.taskId || (item.task && item.task.id) || item.id;
    const date = item.date || todayYmd();
    let nowDone = false;
    updateTodos(prev => prev.map(x => {
      if (x.id !== taskId) return x;
      if (isRecurring(x)) {
        const list = x.doneDates || [];
        nowDone = !list.includes(date);
        return { ...x, doneDates: nowDone ? [...list, date] : list.filter(d => d !== date) };
      }
      nowDone = !x.done;
      return { ...x, done: nowDone, doneAt: nowDone ? new Date().toISOString() : null };
    }));
    if (nowDone) Vibration.vibrate(30);
  }, [updateTodos]);

  const isItemDone = (item) => {
    if (!item) return true;
    if (item.type === 'AUTO') return todosRef.current.some(x => x.type === 'AUTO_DONE' && x.id === item.id);
    const task = todosRef.current.find(x => x.id === (item.taskId || item.id));
    return !task || isDoneOn(task, item.date || todayYmd());
  };

  const deleteItem = useCallback((item, scope) => {
    if (item.type === 'AUTO') {
      const pid = item.parentProjectId;
      const project = todosRef.current.find(x => x.id === pid);
      if (project && project.quick) { updateTodos(prev => prev.filter(x => x.id !== pid)); return; }
      Alert.alert('Supprimer le projet ?', `« ${project ? project.text : item.text} » et toutes ses sessions à venir.`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => updateTodos(prev => prev.filter(x => x.id !== pid)) },
      ]);
      return;
    }
    const taskId = item.taskId || (item.task && item.task.id) || item.id;
    if (scope === 'occurrence') {
      updateTodos(prev => prev.map(x => (x.id === taskId ? { ...x, skipDates: [...(x.skipDates || []), item.date] } : x)));
      return;
    }
    if (item.recurring) {
      Alert.alert('Supprimer la série ?', `Toutes les occurrences de « ${item.text} ».`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => updateTodos(prev => prev.filter(x => x.id !== taskId)) },
      ]);
      return;
    }
    updateTodos(prev => prev.filter(x => x.id !== taskId));
  }, [updateTodos]);

  const rescheduleTask = useCallback((task, ymd) => {
    updateTodos(prev => prev.map(x => (x.id === task.id ? { ...x, dueDate: ymd, done: false, doneAt: null } : x)));
  }, [updateTodos]);

  const toggleStep = useCallback((projectId, stepId) => {
    updateTodos(prev => prev.map(x => (x.id === projectId
      ? { ...x, steps: (x.steps || []).map(s => (s.id === stepId ? { ...s, done: !s.done } : s)) }
      : x)));
    Vibration.vibrate(20);
  }, [updateTodos]);

  const setProjectSteps = useCallback((projectId, steps) => {
    updateTodos(prev => prev.map(x => (x.id === projectId ? { ...x, steps } : x)));
  }, [updateTodos]);

  const saveTask = useCallback((task) => {
    updateTodos(prev => (prev.some(x => x.id === task.id) ? prev.map(x => (x.id === task.id ? task : x)) : [task, ...prev]));
    setForm(f => ({ ...f, visible: false }));
  }, [updateTodos]);

  const addTasksFromAI = useCallback((newTasks) => {
    if (!Array.isArray(newTasks) || !newTasks.length) return;
    updateTodos(prev => [...migrateTodos(newTasks), ...prev]);
  }, [updateTodos]);

  const handleImportICS = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const content = await (await fetch(result.assets[0].uri)).text();
      if (!content.includes('BEGIN:VCALENDAR')) {
        Alert.alert('Fichier invalide', 'Ce fichier n\'est pas un calendrier .ics.');
        return;
      }
      const res = mergeImported(todosRef.current, parseICS(content));
      updateTodos(res.todos);
      Alert.alert('Import terminé', `${res.added} événement(s) importé(s).${res.skipped ? ` ${res.skipped} doublon(s) ignoré(s).` : ''}`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de lire le fichier.');
    }
  };

  // ── Focus ──
  const handleWorkComplete = useCallback(({ minutes, task, endedAt }) => {
    if (!minutes) return;
    const end = new Date(endedAt || Date.now());
    const entry = {
      id: newId(), at: end.toISOString(), date: toYmd(end), minutes,
      taskId: task ? task.id : null, taskText: task ? task.text : null,
    };
    const log = [...focusLogRef.current, entry];
    updateFocusLog(log);
    const goal = settingsRef.current.dailyGoal;
    const countToday = log.filter(s => s.date === entry.date && s.minutes >= POMODORO_MIN_MINUTES).length;
    const goalMsg = minutes >= POMODORO_MIN_MINUTES && countToday === goal ? '\n\nObjectif du jour atteint : journée validée.' : '';
    if (task && !isItemDone(task)) {
      const question = task.type === 'AUTO' ? 'Valider cette session de projet ?' : 'C\'est terminé ?';
      Alert.alert('Session terminée', `${minutes} min sur « ${task.text} ».${goalMsg}\n\n${question}`, [
        { text: 'Pas encore', style: 'cancel' },
        { text: 'Oui', onPress: () => toggleItem(task) },
      ]);
    } else if (goalMsg) {
      Alert.alert('Bravo', goalMsg.trim());
    }
  }, [toggleItem, updateFocusLog]);

  const pomo = usePomodoro({ settings, onWorkComplete: handleWorkComplete, enabled: ready });

  const toFocusTask = (item) => (item ? {
    id: item.id, text: item.text, type: item.type, parentProjectId: item.parentProjectId,
    taskId: item.taskId || (item.task && item.task.id) || item.id, date: item.date || todayYmd(), startTime: item.startTime,
  } : null);

  const startFocus = useCallback((item, minutes) => {
    const task = toFocusTask(item);
    setPendingTask(task);
    pomo.start(minutes, task);
    setFocusVisible(true);
  }, [pomo]);

  const openFocus = useCallback((item) => {
    if (!pomo.isRunningOrPaused) setPendingTask(toFocusTask(item));
    setFocusVisible(true);
  }, [pomo]);

  // Prochaine étape du projet en cours de focus, affichée sur l'écran Focus
  const focusTaskForStep = pomo.isRunningOrPaused ? pomo.sessionTask : pendingTask;
  const focusProject = focusTaskForStep && focusTaskForStep.parentProjectId
    ? todos.find(x => x.id === focusTaskForStep.parentProjectId) : null;
  const focusStep = focusProject ? projectInfo(focusProject, todayYmd()).nextStep : null;

  // ── Sauvegarde ──
  const exportBackup = async () => {
    const data = {
      app: 'vicrasti', version: 2, exportedAt: new Date().toISOString(),
      todos: todosRef.current, focusLog: focusLogRef.current, settings: settingsRef.current,
    };
    try {
      await Share.share({ title: 'Sauvegarde Vicrasti', message: JSON.stringify(data) });
    } catch (e) {
      Alert.alert('Erreur', String(e.message || e));
    }
  };

  const importBackup = (text) => {
    let data;
    try {
      data = JSON.parse(String(text || '').trim());
      if (!data || !Array.isArray(data.todos)) throw new Error('format');
    } catch (_) {
      Alert.alert('Sauvegarde invalide', 'Colle le texte complet obtenu avec « Exporter ».');
      return;
    }
    Alert.alert('Restaurer ?', `${data.todos.length} tâches et ${(data.focusLog || []).length} sessions. Les données actuelles seront remplacées.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Restaurer', style: 'destructive', onPress: () => {
          updateTodos(migrateTodos(data.todos));
          if (Array.isArray(data.focusLog)) updateFocusLog(data.focusLog);
          if (data.settings) updateSettings(data.settings);
          setShowSettings(false);
        },
      },
    ]);
  };

  // ── Dérivés ──
  const today = todayYmd();
  const activity = useMemo(() => dailyActivity(todos, focusLog), [todos, focusLog]);
  const streak = useMemo(() => computeStreak(activity, today, settings.dailyGoal), [activity, today, settings.dailyGoal]);
  const todayActivity = activity[today];
  const theme = useMemo(() => getTheme(!!settings.isDarkMode), [settings.isDarkMode]);
  const topInset = insets.top;

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'today':
        return (
          <TodayScreen
            todos={todos}
            settings={settings}
            streak={streak}
            todayActivity={todayActivity}
            focusTaskId={pomo.isRunningOrPaused && pomo.sessionTask ? pomo.sessionTask.id : null}
            selectedDate={planningDate}
            onChangeDate={setPlanningDate}
            onAdd={(date) => setForm({ visible: true, task: null, date, type: 'QUICK' })}
            onOpenSettings={() => setShowSettings(true)}
            onOpenFocus={openFocus}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onEdit={(task) => task && setForm({ visible: true, task, date: null, type: task.type })}
            onStartFocus={startFocus}
            onReschedule={rescheduleTask}
            onToggleStep={toggleStep}
          />
        );
      case 'calendar':
        return (
          <CalendarScreen
            tasks={todos}
            onToggle={toggleItem}
            onOpenDay={(ymd) => { setPlanningDate(ymd); setActiveTab('today'); }}
          />
        );
      case 'coach':
        return (
          <AIScreen
            apiKey={apiKey}
            todos={todos}
            settings={settings}
            todayActivity={todayActivity}
            onAddTasks={addTasksFromAI}
            onSetProjectSteps={setProjectSteps}
            onOpenSettings={() => setShowSettings(true)}
          />
        );
      case 'progress':
        return <AchievementsScreen todos={todos} focusLog={focusLog} settings={settings} />;
      default:
        return null;
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: topInset }}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

        <View style={{ flex: 1 }}>
          <ErrorBoundary>{renderScreen()}</ErrorBoundary>
        </View>

        {!focusVisible ? <FocusBar pomo={pomo} onOpen={() => setFocusVisible(true)} /> : null}

        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const color = active ? theme.accent : theme.textFaint;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabItem}>
                <Feather name={tab.icon} size={21} color={color} />
                <Txt variant="small" color={color} style={[styles.tabLabel, active && { fontWeight: '700' }]}>{tab.label}</Txt>
              </Pressable>
            );
          })}
        </View>

        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onChangeSettings={updateSettings}
          onResetData={() => updateTodos([])}
          onSyncIcs={syncIcs}
          onImportIcsFile={handleImportICS}
          onExport={exportBackup}
          onImportBackup={importBackup}
          apiKey={apiKey}
          onChangeApiKey={changeApiKey}
        />

        <TaskFormModal
          visible={form.visible}
          task={form.task}
          defaultDate={form.date}
          defaultType={form.type}
          todos={todos}
          onSave={saveTask}
          onClose={() => setForm(f => ({ ...f, visible: false }))}
        />

        <FocusScreen
          visible={focusVisible}
          onClose={() => setFocusVisible(false)}
          pomo={pomo}
          settings={settings}
          pendingTask={pendingTask}
          nextStep={focusStep}
          onToggleStep={() => focusProject && focusStep && toggleStep(focusProject.id, focusStep.id)}
        />
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLabel: { ...type.small, marginTop: 3 },
});
