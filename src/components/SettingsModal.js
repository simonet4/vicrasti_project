import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, Platform, Switch, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { globalStyles, getTheme } from '../styles/globalStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsModal = ({ visible, onClose, onResetData, isDarkMode, setIsDarkMode, showFocus, setShowFocus, onAddTasks }) => {
  const triggerReset = () => {
    const msg = "Voulez-vous supprimer toutes les données ?";
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) onResetData();
    } else {
      Alert.alert("CONFIRMATION", msg, [
        { text: "Annuler", style: "cancel" },
        { text: "OUI, RESET", style: "destructive", onPress: onResetData }
      ]);
    }
  };

  const theme = getTheme(!!isDarkMode);

  // AI assistant state
  // placeholder default token; always replace with a real key via UI or environment.
  // you can set `extra.aiToken` in app.config.js / app.json and it will be loaded once.
  const DEFAULT_AI_TOKEN = 'YOUR_API_KEY_HERE';
  // token that was previously hardcoded earlier in development; detect and drop
  const LEGACY_EXAMPLE_TOKEN = 'mP5S37IeVSqPsOJ69TzZZzm1Oyns8Jj5';
  const [aiToken, setAiToken] = useState('');
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [promptText, setPromptText] = useState('Génère des tâches à partir du contexte suivant :');
  const [aiLoading, setAiLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const normalizeToken = (t = '') => {
    let nn = t.trim();
    const hasPrefix = /^MISTRAL_API_KEY\s*=\s*/.test(nn);
    nn = nn.replace(/^MISTRAL_API_KEY\s*=\s*/, '');
    // if the value came with MISTRAL_API_KEY= or looks like a Mistral key,
    // and the api url is still the OpenAI default, auto‑switch to Mistral endpoint
    if ((hasPrefix || /^m[Pp][A-Za-z0-9]{20,}/.test(nn)) && aiUrl === 'https://api.openai.com/v1/chat/completions') {
      // default to a generic Mistral agent endpoint placeholder; user should replace <id>
      const newUrl = 'https://api.mistral.ai/v1/agents/<votre-agent-id>/responses';
      setAiUrl(newUrl);
      saveUrl(newUrl);
    }
    return nn;
  };

  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
          console.warn('AsyncStorage unavailable');
          setAiToken(DEFAULT_AI_TOKEN);
          return;
        }

        // try to load from environment/expo config if provided
        let initial = DEFAULT_AI_TOKEN;
        try {
          const Constants = require('expo-constants').default;
          if (Constants?.manifest?.extra?.aiToken) {
            initial = Constants.manifest.extra.aiToken;
          }
          if (Constants?.manifest?.extra?.aiUrl) {
            setAiUrl(Constants.manifest.extra.aiUrl);
          }
        } catch (_) {}
        // also read saved URL from storage
        try {
          const savedUrl = await AsyncStorage.getItem('@vicrasti_ai_url');
          if (savedUrl) setAiUrl(savedUrl);
        } catch(_) {}

        let t = await AsyncStorage.getItem('@vicrasti_ai_token');
        if (t) {
          // if we previously stored the placeholder or the old hardcoded sample, treat as empty
          if (t === DEFAULT_AI_TOKEN || t === LEGACY_EXAMPLE_TOKEN) {
            await AsyncStorage.removeItem('@vicrasti_ai_token');
            t = '';
          }
          setAiToken(t);
        } else {
          // no token stored yet, seed with default or env value
          t = initial === DEFAULT_AI_TOKEN ? '' : initial;
          if (t) {
            try {
              await AsyncStorage.setItem('@vicrasti_ai_token', t);
            } catch (e) {
              console.warn('failed to persist default ai token', e);
            }
          }
          setAiToken(t);
        }
      } catch (e) {
        console.warn('Error reading/writing ai token', e);
        setAiToken(DEFAULT_AI_TOKEN);
      }
    })();
  }, []);

  const saveToken = async (t) => {
    if (!AsyncStorage || typeof AsyncStorage.setItem !== 'function') return;
    try { await AsyncStorage.setItem('@vicrasti_ai_token', t); } catch (e) { console.warn('saveToken failed', e); }
  };

  const saveUrl = async (u) => {
    if (!AsyncStorage || typeof AsyncStorage.setItem !== 'function') return;
    try { await AsyncStorage.setItem('@vicrasti_ai_url', u); } catch (e) { console.warn('saveUrl failed', e); }
  };

  const handleGenerateTasks = async () => {
    const trimmed = aiToken?.trim();
    if (!trimmed || trimmed === DEFAULT_AI_TOKEN) {
      Alert.alert('Token invalide', "Veuillez fournir un token API personnel valide pour l'IA.");
      return;
    }
    setAiLoading(true);
    try {
      // Build request to OpenAI Chat Completion endpoint
      const system = `You are an assistant that ONLY returns a JSON array of task objects. Each task object must have these keys when relevant: text, type (FIXED|PROJECT), dueDate (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM), totalHours, recurrence (object with type/time/days). Return valid JSON and nothing else.`;
      const user = `${promptText}`;
      const resp = await fetch(aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiToken}`
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 800 })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        if (resp.status === 404) {
          // if using Mistral, it may require agent endpoint rather than model path
          let extra = '';
          if (aiUrl.includes('mistral.ai')) {
            extra = ' (pour Mistral utilisez un endpoint comme /v1/agents/<id>/responses)';
          }
          throw new Error(`AI endpoint not found (404). vérifiez l'URL: ${aiUrl}${extra}`);
        }
        throw new Error(`AI request failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      // extract assistant content
      const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || data.choices?.[0]?.delta?.content;
      if (!content) throw new Error('No content from AI');
      // try to parse JSON from content
      let tasks = null;
      try {
        tasks = JSON.parse(content);
      } catch (e) {
        // try to extract JSON substring
        const m = content.match(/\[\s*\{[\s\S]*\}\s*\]/m);
        if (m) tasks = JSON.parse(m[0]);
        else throw new Error('Unable to parse JSON from AI response');
      }
      if (!Array.isArray(tasks)) throw new Error('AI did not return an array');
      // call parent handler
      if (onAddTasks) onAddTasks(tasks);
      Alert.alert('Succès', `Importé ${tasks.length} tâche(s) depuis l'IA.`);
    } catch (e) {
      console.warn('AI error', e);
      // if the request failed due to invalid api key, clear stored token so user can re-enter
      if (e.message && e.message.includes('invalid_api_key')) {
        try { await AsyncStorage.removeItem('@vicrasti_ai_token'); } catch(_){}
        setAiToken('');
        Alert.alert(
          'Clé invalide',
          'La clé API enregistrée est invalide et a été effacée. ' +
            'Si vous utilisez Mistral, vérifiez que l’URL de l’API est réglée sur un endpoint Mistral (voir champ URL ci‑dessous).'
        );
      } else {
        Alert.alert('Erreur IA', String(e.message || e));
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={[globalStyles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[globalStyles.modalContent, { backgroundColor: theme.modalContent }]}>
          <Text style={[globalStyles.title, { color: theme.text }]}>Paramètres</Text>
          <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }] }>
            <Text style={{color: theme.text}}>Mode Sombre</Text>
            <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
          </View>

          <View style={styles.settingRow}>
            <Text style={{color: theme.text}}>Afficher le mode Focus</Text>
            <Switch value={!!showFocus} onValueChange={setShowFocus} />
          </View>

          <TouchableOpacity onPress={triggerReset} style={[styles.resetBtn, { backgroundColor: theme.danger }]}>
            <Text style={[styles.resetBtnText, { color: theme.white }]}>RÉINITIALISER TOUT</Text>
          </TouchableOpacity>

          {/* AI Assistant */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontWeight: '700', marginBottom: 6, color: theme.text }}>Assistant IA</Text>
            <View style={{ marginBottom: 8 }}>
              <TextInput
                value={aiUrl}
                onChangeText={u => { setAiUrl(u); saveUrl(u); }}
                placeholder="URL de l'API IA"
                style={[globalStyles.input]}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                Ex : https://api.openai.com/v1/chat/completions
                ou https://api.mistral.ai/v1/agents/&lt;votre-agent-id&gt;/responses
              </Text>
            </View>
            <View style={{ position: 'relative', marginBottom: 8 }}>
              <TextInput
                value={aiToken}
                onChangeText={t => {
                  const norm = normalizeToken(t);
                  setAiToken(norm);
                  saveToken(norm);
                }}
                placeholder="API token"
                style={[globalStyles.input, { paddingRight: 50 }]}
                secureTextEntry={!showToken}
              />
              <TouchableOpacity
                onPress={() => setShowToken(v => !v)}
                style={{ position: 'absolute', right: 10, top: 12 }}
              >
                <Text style={{ color: '#555' }}>{showToken ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {(aiToken === DEFAULT_AI_TOKEN || !aiToken) && (
              <Text style={{ color: 'red', marginBottom: 8 }}>
                Aucun token valide n'est enregistré&nbsp;: collez votre clé personnelle dans le champ ci‑dessus
                (ou définissez <Text style={{fontStyle:'italic'}}>extra.aiToken</Text> dans app.config.js).
              </Text>
            )}
            {__DEV__ && (
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
                [debug token: {aiToken || '<vide>'}]
              </Text>
            )}
            {__DEV__ && (
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
                [debug url: {aiUrl}]
              </Text>
            )}
            <TextInput value={promptText} onChangeText={setPromptText} placeholder="Prompt pour l'IA" style={[globalStyles.input, { height: 90 }]} multiline />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={handleGenerateTasks}
                style={[
                  globalStyles.btn,
                  { backgroundColor: theme.primary, flexGrow: 1, marginRight: 4, opacity: aiLoading || !aiToken || aiToken === DEFAULT_AI_TOKEN ? 0.5 : 1 }
                ]}
                disabled={aiLoading || !aiToken || aiToken === DEFAULT_AI_TOKEN}
              >
                {aiLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Générer</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setPromptText('Génère des tâches à partir du contexte suivant :'); }}
                style={[globalStyles.btn, { backgroundColor: '#ddd', flexGrow: 1, marginHorizontal: 4 }]}
              >
                <Text>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setAiToken('');
                  try { await AsyncStorage.removeItem('@vicrasti_ai_token'); } catch(_){ }
                }}
                style={[globalStyles.btn, { backgroundColor: theme.danger, flexGrow: 1, marginLeft: 4 }]}
              >
                <Text style={{ color: '#fff' }}>Effacer</Text>
              </TouchableOpacity>
            </View> {/* end flexDirection row */}
          </View> {/* end AI Assistant section */}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { marginTop: 10 }]}> 
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  resetBtn: { padding: 15, borderRadius: 10, marginTop: 20 },
  resetBtnText: { fontWeight: 'bold', textAlign: 'center' },
  closeBtn: { marginTop: 40, alignSelf: 'center', padding: 10 }
});

export default SettingsModal;
