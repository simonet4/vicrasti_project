import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@vicrasti_settings';

export const DEFAULT_SETTINGS = {
  isDarkMode: false,
  showFocus: true,
  // Journée
  dayStart: '08:00',
  dayEnd: '22:00',
  maxProjectHoursPerDay: 6,
  // Pomodoro
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreak: true,
  // Objectif quotidien (pomodoros)
  dailyGoal: 4,
  // Rappels
  remindersEnabled: true,
  reminderLeadMin: 5,
  slotReminders: true,
  morningBriefEnabled: true,
  morningBriefTime: '08:00',
  eveningReviewEnabled: true,
  eveningReviewTime: '21:00',
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // Migration des anciennes clés séparées
    const [theme, focus] = await Promise.all([
      AsyncStorage.getItem('@vicrasti_theme'),
      AsyncStorage.getItem('@vicrasti_showFocus'),
    ]);
    const migrated = { ...DEFAULT_SETTINGS };
    if (theme != null) migrated.isDarkMode = !!JSON.parse(theme);
    if (focus != null) migrated.showFocus = !!JSON.parse(focus);
    return migrated;
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
}
