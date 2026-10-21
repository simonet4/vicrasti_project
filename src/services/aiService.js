import AsyncStorage from '@react-native-async-storage/async-storage';
import { toYmd } from '../logic/dates';
import { newId } from '../logic/tasks';

const TOKEN_KEY = '@vicrasti_claude_key';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5-5';

export async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY) || '';
  } catch (_) { return ''; }
}

export async function saveToken(token) {
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token.trim());
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

function todayContext() {
  const today = new Date();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `La date d'aujourd'hui est ${days[today.getDay()]} ${toYmd(today)}, il est ${today.getHours()}h${String(today.getMinutes()).padStart(2, '0')}.`;
}

// Appel HTTP direct : le SDK officiel importe des modules Node absents de React Native.
// `format` : schéma JSON imposé à la réponse (structured outputs)
async function callClaude(token, { system, user, effort = 'medium', maxTokens = 16000, format }) {
  if (!token) throw new Error('Clé API manquante');
  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
        // En cas de refus par les filtres de sécurité, l'API relance sur un modèle de secours
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        // La clé appartient à l'utilisateur et reste sur son appareil (nécessaire pour la version web)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: format ? { effort, format: { type: 'json_schema', schema: format } } : { effort },
        fallbacks: 'default',
      }),
    });
  } catch (_) {
    throw new Error('Pas de connexion à l\'API Claude');
  }
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json())?.error?.message || ''; } catch (_) {}
    if (resp.status === 401) throw new Error('Clé API invalide');
    if (resp.status === 403) throw new Error('Clé API sans accès à ce modèle');
    if (resp.status === 429) throw new Error('Trop de requêtes, réessaie dans un instant');
    if (resp.status === 529 || resp.status >= 500) throw new Error('API Claude surchargée, réessaie dans un instant');
    throw new Error(`Erreur API (${resp.status}) : ${detail.slice(0, 200)}`);
  }
  const response = await resp.json();
  if (response.stop_reason === 'refusal') throw new Error('Claude a refusé cette demande.');
  if (response.stop_reason === 'max_tokens') throw new Error('Réponse trop longue, simplifie la demande.');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) throw new Error('Pas de réponse de l\'IA');
  return text;
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
- Pour un PROJECT, donne 3 à 8 micro-étapes concrètes dans "steps", la première faisable en moins de 5 minutes.`;

  const json = JSON.parse(await callClaude(token, { system, user: prompt, format: TASKS_SCHEMA }));
  return (json.tasks || []).map(t => {
    const isProject = t.type === 'PROJECT';
    const hours = parseFloat(t.totalHours);
    return {
      id: newId(),
      text: t.text || 'Tâche',
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
        ? t.steps.filter(Boolean).map(s => ({ id: newId(), text: String(s), done: false }))
        : undefined,
    };
  });
}

// Découpe un projet en micro-étapes actionnables
export async function generateSteps(project, token, extra = '') {
  const system = `Tu aides quelqu'un qui procrastine à démarrer. ${todayContext()}
Découpe le projet en 5 à 12 micro-étapes concrètes, dans l'ordre, chacune faisable en moins de 25 minutes.
La PREMIÈRE étape doit être ridiculement facile (moins de 2 minutes, ex : "Ouvrir le document et écrire le titre").
Chaque étape commence par un verbe d'action. Pas d'étape vague comme "Travailler sur…".`;
  const user = `Projet : ${project.text}
Heures estimées restantes : ${project.totalHours || '?'}
Deadline : ${project.deadline || 'aucune'}
${(project.steps || []).length ? `Étapes déjà existantes : ${project.steps.map(s => s.text).join(' ; ')}` : ''}
${extra ? `Précisions : ${extra}` : ''}`;
  const json = JSON.parse(await callClaude(token, { system, user, format: STEPS_SCHEMA }));
  return (json.steps || [])
    .map(s => String(s).trim())
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
  return callClaude(token, { system, user, effort: 'low', maxTokens: 4000 });
}
