import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseICS, mergeImported } from '../logic/icsImporter';
import { encode as btoa } from 'base-64';

const KEYS = {
  url: '@vicrasti_ics_url',
  username: '@vicrasti_ics_username',
  password: '@vicrasti_ics_password',
  lastSync: '@vicrasti_ics_last_sync',
};

export async function getIcsConfig() {
  try {
    const [url, username, password, lastSync] = await Promise.all([
      AsyncStorage.getItem(KEYS.url),
      AsyncStorage.getItem(KEYS.username),
      AsyncStorage.getItem(KEYS.password),
      AsyncStorage.getItem(KEYS.lastSync),
    ]);
    return { url: url || '', username: username || '', password: password || '', lastSync: lastSync || '' };
  } catch (_) {
    return { url: '', username: '', password: '', lastSync: '' };
  }
}

export async function saveIcsConfig({ url, username, password }) {
  try {
    if (url !== undefined) await AsyncStorage.setItem(KEYS.url, url.trim());
    if (username !== undefined) await AsyncStorage.setItem(KEYS.username, username.trim());
    if (password !== undefined) await AsyncStorage.setItem(KEYS.password, password);
  } catch (_) {}
}

function normalizeUrl(url) {
  // Si l'utilisateur a collé la page HTML du planning, on tente la version .ics
  let u = url.trim();
  if (u.endsWith('.html')) {
    u = u.replace(/\.html$/, '.ics');
  }
  if (!u.endsWith('.ics') && /\/planning\//.test(u) && !u.includes('?')) {
    u = u + '.ics';
  }
  return u;
}

// Télécharge le flux ICS. Ne fusionne pas : l'appelant applique `merge(todosActuels)`
// pour ne pas écraser des modifications faites pendant le téléchargement.
export async function fetchIcsFromUrl() {
  const config = await getIcsConfig();
  if (!config.url) return { imported: null, error: null };

  const headers = {};
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + btoa(config.username + ':' + config.password);
  }

  try {
    const resp = await fetch(normalizeUrl(config.url), { headers, redirect: 'follow' });
    if (resp.status === 401 || resp.status === 403) {
      return { imported: null, error: 'Identifiants invalides (401/403)' };
    }
    if (!resp.ok) {
      return { imported: null, error: `Erreur serveur (${resp.status})` };
    }
    const icsText = await resp.text();
    if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
      return { imported: null, error: 'Le fichier téléchargé n\'est pas un ICS valide' };
    }
    await AsyncStorage.setItem(KEYS.lastSync, new Date().toISOString());
    return { imported: parseICS(icsText) || [], error: null };
  } catch (e) {
    return { imported: null, error: String(e.message || e) };
  }
}

export const mergeIcsFeed = (existing, imported) => mergeImported(existing, imported, { replaceFuture: true });
