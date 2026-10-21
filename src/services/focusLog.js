import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@vicrasti_focus_log';
const MAX_ENTRIES = 3000;

export async function loadFocusLog() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export async function saveFocusLog(list) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRIES))); } catch (_) {}
}
