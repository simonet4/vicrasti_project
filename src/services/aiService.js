import AsyncStorage from '@react-native-async-storage/async-storage';
import { toYmd } from '../logic/dates';
import { newId } from '../logic/tasks';

const KEY_STORAGE = '@vicrasti_ai_key';
const LEGACY_KEY_STORAGE = '@vicrasti_claude_key';
const MODEL_OVERRIDE_STORAGE = '@vicrasti_ai_model';
const MODEL_CACHE_STORAGE = '@vicrasti_ai_model_cache';
const PROVIDER_OVERRIDE_STORAGE = '@vicrasti_ai_provider';

/*
 Fournisseurs pris en charge. Le fournisseur est déduit du format de la clé ; le modèle est
 choisi en interrogeant la liste des modèles du fournisseur (les noms changent souvent),
 selon les préférences ci-dessous : un modèle rapide et peu coûteux suffit pour l'app.
*/
export const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', prefer: [/^claude-opus-5-5$/, /^claude-sonnet/, /^claude-haiku/, /^claude/] },
  gemini: { label: 'Gemini (Google)', prefer: [/^gemini-flash-latest$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash/, /flash/, /gemini/] },
  mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', prefer: [/^mistral-small-latest$/, /^mistral-small/, /^mistral-medium-latest$/, /^mistral-large-latest$/, /^open-mistral/] },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', prefer: [/^gpt-[\d.]+-mini$/, /^gpt-[\d.]+o?-mini$/, /^gpt-4o-mini$/, /mini$/, /^gpt-/] },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', prefer: [/gpt-oss-120b/, /gpt-oss-20b/, /llama.*70b/, /llama/, /qwen/] },
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', prefer: [/gpt-oss.*:free$/, /llama.*:free$/, /:free$/, /^openrouter\/auto$/] },
  xai: { label: 'Grok (xAI)', base: 'https://api.x.ai/v1', prefer: [/grok.*mini/, /^grok/] },
};

// Modèles inutilisables pour du texte (audio, image, embeddings…)
const EXCLUDED_MODELS = /(embed|whisper|tts|audio|realtime|transcribe|image|vision-only|moderation|guard|dall-e|search|ocr|codestral-embed)/i;

// Fournisseur déduit du préfixe de la clé ; null si le format ne suffit pas à trancher
export function detectProvider(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

// Fournisseurs à essayer, dans l'ordre, pour une clé sans préfixe connu
const PROBE_ORDER = ['mistral', 'gemini'];

export async function getStoredToken() {
  try {
    const key = await AsyncStorage.getItem(KEY_STORAGE);
    if (key) return key;
    return (await AsyncStorage.getItem(LEGACY_KEY_STORAGE)) || '';
  } catch (_) { return ''; }
}

export async function saveToken(token) {
  try {
    if (token) await AsyncStorage.setItem(KEY_STORAGE, token.trim());
    else await AsyncStorage.removeItem(KEY_STORAGE);
    await AsyncStorage.multiRemove([LEGACY_KEY_STORAGE, MODEL_CACHE_STORAGE]);
  } catch (_) {}
}

export async function getModelOverride() {
  try { return (await AsyncStorage.getItem(MODEL_OVERRIDE_STORAGE)) || ''; } catch (_) { return ''; }
}

export async function saveModelOverride(model) {
  try {
    if (model && model.trim()) await AsyncStorage.setItem(MODEL_OVERRIDE_STORAGE, model.trim());
    else await AsyncStorage.removeItem(MODEL_OVERRIDE_STORAGE);
  } catch (_) {}
}

async function httpError(resp, provider) {
  let detail = '';
  try {
    const body = await resp.json();
    detail = (body && body.error && (body.error.message || body.error)) || body.message || '';
  } catch (_) {}
  const name = PROVIDERS[provider].label;
  if (resp.status === 401 || resp.status === 403) return new Error(`Clé refusée par ${name}. Vérifie-la dans les réglages.`);
  if (resp.status === 429) return new Error(`${name} : quota atteint, réessaie dans un instant.`);
  if (resp.status >= 500) return new Error(`${name} est indisponible pour le moment, réessaie plus tard.`);
  const err = new Error(`${name} (${resp.status}) : ${String(detail).slice(0, 200)}`);
  err.status = resp.status;
  return err;
}

async function request(url, options, provider) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch (_) {
    throw new Error(`Pas de connexion à ${PROVIDERS[provider].label}.`);
  }
  if (!resp.ok) throw await httpError(resp, provider);
  return resp.json();
}

const authHeaders = (provider, key) => {
  if (provider === 'anthropic') {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // La clé appartient à l'utilisateur et reste sur son appareil (nécessaire pour la version web)
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  if (provider === 'gemini') return { 'x-goog-api-key': key };
  return { Authorization: `Bearer ${key}` };
};

async function listModels(provider, key) {
  const headers = authHeaders(provider, key);
  if (provider === 'gemini') {
    const data = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers }, provider);
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
  }
  const url = provider === 'anthropic' ? 'https://api.anthropic.com/v1/models?limit=100' : `${PROVIDERS[provider].base}/models`;
  const data = await request(url, { headers }, provider);
  return (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean);
}

// Modèles de texte du fournisseur, les plus récents en premier
const usableModels = (ids) => ids
  .filter(id => !EXCLUDED_MODELS.test(id))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

// Choisit un modèle dans la liste du fournisseur selon l'ordre de préférence
export function pickModel(provider, ids) {
  // Pour un même motif, la version la plus récente (tri décroissant) gagne
  const sorted = usableModels(ids);
  for (const re of PROVIDERS[provider].prefer) {
    const hit = sorted.find(id => re.test(id) && !/preview|exp|lite|nano/i.test(id)) || sorted.find(id => re.test(id));
    if (hit) return hit;
  }
  return sorted[0] || null;
}

export async function getProviderOverride() {
  try {
    const p = await AsyncStorage.getItem(PROVIDER_OVERRIDE_STORAGE);
    return p && PROVIDERS[p] ? p : '';
  } catch (_) { return ''; }
}

export async function saveProviderOverride(provider) {
  try {
    if (provider && PROVIDERS[provider]) await AsyncStorage.setItem(PROVIDER_OVERRIDE_STORAGE, provider);
    else await AsyncStorage.removeItem(PROVIDER_OVERRIDE_STORAGE);
    await AsyncStorage.removeItem(MODEL_CACHE_STORAGE);
  } catch (_) {}
}

// Liste des modèles du premier fournisseur qui accepte la clé
async function probeProviders(key, candidates) {
  let lastError = null;
  for (const provider of candidates) {
    try {
      return { provider, ids: await listModels(provider, key) };
    } catch (e) {
      lastError = e;
    }
  }
  if (candidates.length > 1) throw new Error('Clé refusée par Mistral et Gemini. Vérifie-la, ou choisis le fournisseur dans les réglages.');
  throw lastError;
}

/*
 Fournisseur + modèle à utiliser pour cette clé. Ordre : fournisseur imposé dans les réglages,
 préfixe de la clé, sinon essai successif (PROBE_ORDER). Le résultat est mis en cache.
*/
export async function resolveModel(key) {
  if (!String(key || '').trim()) throw new Error('Clé API manquante');
  const forced = (await getProviderOverride()) || detectProvider(key);
  const overrideModel = await getModelOverride();
  const tail = String(key).slice(-6);
  try {
    const raw = await AsyncStorage.getItem(MODEL_CACHE_STORAGE);
    const cache = raw ? JSON.parse(raw) : null;
    if (cache && cache.tail === tail && cache.model && (!forced || cache.provider === forced)) {
      return { provider: cache.provider, model: overrideModel || cache.model };
    }
  } catch (_) {}
  const { provider, ids } = await probeProviders(key, forced ? [forced] : PROBE_ORDER);
  const autoModel = pickModel(provider, ids);
  const model = overrideModel || autoModel;
  if (!model) throw new Error(`Aucun modèle de texte disponible chez ${PROVIDERS[provider].label}.`);
  const models = usableModels(ids).slice(0, 40);
  try { await AsyncStorage.setItem(MODEL_CACHE_STORAGE, JSON.stringify({ provider, tail, model: autoModel || model, models })); } catch (_) {}
  return { provider, model, autoModel: autoModel || model, models };
}

// IA actuellement utilisée pour cette clé, sans appel réseau (null tant que la clé n'a pas servi)
export async function getActiveAi(key) {
  if (!String(key || '').trim()) return null;
  try {
    const raw = await AsyncStorage.getItem(MODEL_CACHE_STORAGE);
    const cache = raw ? JSON.parse(raw) : null;
    if (!cache || cache.tail !== String(key).slice(-6) || !PROVIDERS[cache.provider]) return null;
    const override = await getModelOverride();
    return {
      provider: cache.provider, label: PROVIDERS[cache.provider].label,
      model: override || cache.model, autoModel: cache.model, models: cache.models || [], auto: !override,
    };
  } catch (_) { return null; }
}

async function forgetCachedModel() {
  try { await AsyncStorage.removeItem(MODEL_CACHE_STORAGE); } catch (_) {}
}

// Vérifie la clé (et le modèle) ; renvoie la même forme que getActiveAi
export async function testConnection(key) {
  await forgetCachedModel();
  const { provider } = await resolveModel(key);
  await complete(key, { system: 'Réponds uniquement "OK".', user: 'Test', maxTokens: 300 });
  return { ...(await getActiveAi(key)), provider, label: PROVIDERS[provider].label };
}

/*
 Appel unique, quel que soit le fournisseur. `schema` : schéma JSON attendu (structured outputs
 chez Claude, mode JSON ailleurs). Renvoie le texte de la réponse.
*/
async function complete(key, { system, user, schema, maxTokens = 4000, effort = 'medium' }) {
  const { provider, model } = await resolveModel(key);
  const headers = { 'content-type': 'application/json', ...authHeaders(provider, key) };

  if (provider === 'anthropic') {
    const data = await request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { ...headers, 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({
        model,
        // Opus réfléchit toujours avant de répondre : budget large pour ne pas tronquer le JSON
        max_tokens: Math.max(maxTokens, 16000),
        system,
        messages: [{ role: 'user', content: user }],
        output_config: schema ? { effort, format: { type: 'json_schema', schema } } : { effort },
        // En cas de refus par les filtres de sécurité, l'API relance sur un modèle de secours
        fallbacks: 'default',
      }),
    }, provider);
    if (data.stop_reason === 'refusal') throw new Error('Claude a refusé cette demande.');
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }

  if (provider === 'gemini') {
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        // Les modèles qui « réfléchissent » consomment aussi ce budget : on reste large
        generationConfig: { maxOutputTokens: Math.max(maxTokens, 8192), temperature: 0.5, ...(schema ? { responseMimeType: 'application/json' } : {}) },
      }),
    }, provider);
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini n\'a pas répondu (contenu bloqué ou vide).');
    return text;
  }

  // API compatibles OpenAI (Mistral, OpenAI, Groq, OpenRouter, xAI)
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    ...(provider === 'openai' ? { max_completion_tokens: Math.max(maxTokens, 4000) } : { max_tokens: maxTokens, temperature: 0.5 }),
  };
  const url = `${PROVIDERS[provider].base}/chat/completions`;
  let data;
  try {
    data = await request(url, { method: 'POST', headers, body: JSON.stringify(schema ? { ...body, response_format: { type: 'json_object' } } : body) }, provider);
  } catch (e) {
    // Certains modèles n'acceptent pas le mode JSON : on réessaie sans (le prompt impose déjà le format)
    if (!schema || e.status !== 400) throw e;
    data = await request(url, { method: 'POST', headers, body: JSON.stringify(body) }, provider);
  }
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = Array.isArray(content) ? content.map(c => c.text || '').join('') : String(content || '');
  if (!text.trim()) throw new Error('Pas de réponse de l\'IA.');
  return text.trim();
}

// Extrait un tableau d'une réponse JSON : tableau brut, { [key]: [...] }, ou JSON entouré de texte
function parseJsonArray(content, key) {
  let parsed;
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const obj = cleaned.match(/\{[\s\S]*\}/);
    const arr = cleaned.match(/\[[\s\S]*\]/);
    try { parsed = JSON.parse(obj ? obj[0] : arr[0]); } catch (__) {
      throw new Error('L\'IA n\'a pas renvoyé un format valide, réessaie.');
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed[key])) return parsed[key];
  const firstArray = parsed && Object.values(parsed).find(Array.isArray);
  if (firstArray) return firstArray;
  throw new Error('L\'IA n\'a pas renvoyé une liste, réessaie.');
}

function todayContext() {
  const today = new Date();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `La date d'aujourd'hui est ${days[today.getDay()]} ${toYmd(today)}, il est ${today.getHours()}h${String(today.getMinutes()).padStart(2, '0')}.`;
}

const TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['FIXED', 'PROJECT'] },
          dueDate: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          totalHours: { type: 'number' },
          deadline: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'type'],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
};

const STEPS_SCHEMA = {
  type: 'object',
  properties: { steps: { type: 'array', items: { type: 'string' } } },
  required: ['steps'],
  additionalProperties: false,
};

// `context` : texte décrivant l'agenda existant, pour éviter les conflits
export async function generateTasks(prompt, token, context = '') {
  const system = `Tu es un assistant de productivité pour quelqu'un qui veut arrêter de procrastiner. ${todayContext()}
Utilise cette date comme référence pour "demain", "cette semaine", "lundi prochain", etc.
${context ? `Agenda déjà occupé (ne crée pas de créneau qui chevauche) :\n${context}\n` : ''}
Règles :
- Préfère des tâches concrètes, commençant par un verbe d'action.
- Un gros travail sans horaire précis = "PROJECT" avec une estimation réaliste d'heures (l'app le répartira automatiquement) et une deadline.
- Un rendez-vous ou un créneau horaire précis = "FIXED" avec dueDate (YYYY-MM-DD), startTime et endTime (HH:MM).
- Pour un PROJECT, donne 3 à 8 micro-étapes concrètes dans "steps", la première faisable en moins de 5 minutes.
Réponds UNIQUEMENT avec un objet JSON de la forme {"tasks": [{"text", "type", "dueDate", "startTime", "endTime", "totalHours", "deadline", "steps"}]}.`;

  const tasks = parseJsonArray(await complete(token, { system, user: prompt, schema: TASKS_SCHEMA }), 'tasks');
  return tasks.filter(t => t && t.text).map(t => {
    const isProject = t.type === 'PROJECT';
    const hours = parseFloat(t.totalHours);
    return {
      id: newId(),
      text: String(t.text),
      type: isProject ? 'PROJECT' : 'FIXED',
      done: false,
      dueDate: isProject ? null : (t.dueDate || toYmd(new Date())),
      startTime: isProject ? null : (t.startTime || null),
      endTime: isProject ? null : (t.endTime || null),
      recurrence: null,
      totalHours: isProject ? String(isNaN(hours) ? 1 : hours) : '0',
      initialHours: isProject ? String(isNaN(hours) ? 1 : hours) : undefined,
      deadline: isProject ? (t.deadline || null) : null,
      steps: isProject && Array.isArray(t.steps)
        ? t.steps.filter(Boolean).map(s => ({ id: newId(), text: String(typeof s === 'string' ? s : s.text || ''), done: false }))
        : undefined,
    };
  });
}

// Découpe un projet en micro-étapes actionnables
export async function generateSteps(project, token, extra = '') {
  const system = `Tu aides quelqu'un qui procrastine à démarrer. ${todayContext()}
Découpe le projet en 5 à 12 micro-étapes concrètes, dans l'ordre, chacune faisable en moins de 25 minutes.
La PREMIÈRE étape doit être ridiculement facile (moins de 2 minutes, ex : "Ouvrir le document et écrire le titre").
Chaque étape commence par un verbe d'action. Pas d'étape vague comme "Travailler sur…".
Réponds UNIQUEMENT avec un objet JSON de la forme {"steps": ["…", "…"]}.`;
  const user = `Projet : ${project.text}
Heures estimées restantes : ${project.totalHours || '?'}
Deadline : ${project.deadline || 'aucune'}
${(project.steps || []).length ? `Étapes déjà existantes : ${project.steps.map(s => s.text).join(' ; ')}` : ''}
${extra ? `Précisions : ${extra}` : ''}`;
  return parseJsonArray(await complete(token, { system, user, schema: STEPS_SCHEMA }), 'steps')
    .map(s => String(typeof s === 'string' ? s : (s && s.text) || '').trim())
    .filter(Boolean)
    .map(text => ({ id: newId(), text, done: false }));
}

// Coach anti-procrastination : réponse courte en texte libre
export async function askCoach(token, agenda, feeling = '') {
  const system = `Tu es un coach anti-procrastination bienveillant mais direct, qui tutoie. ${todayContext()}
Tu connais les techniques : règle des 2 minutes, "juste 5 minutes", découpage en micro-étapes, Pomodoro, réduire la friction, implémentation d'intention ("à 14h je fais X à tel endroit").
Réponds en français, en 120 mots maximum, avec :
1. Une phrase qui reconnaît ce que ressent la personne (si elle l'a dit).
2. LA chose à faire maintenant, ultra concrète, en une ligne commençant par "Maintenant :".
3. Deux ou trois conseils courts adaptés à son agenda.
Pas de blabla, pas de liste interminable, pas de markdown.`;
  const user = `Mon agenda :\n${agenda || '(vide)'}\n\n${feeling ? `Ce que je ressens / ce qui me bloque : ${feeling}` : 'Par quoi je commence ?'}`;
  return complete(token, { system, user, effort: 'low', maxTokens: 1500 });
}
