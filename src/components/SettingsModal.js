import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch, TextInput } from 'react-native';
import { useTheme, space, radius } from '../styles/globalStyles';
import { Sheet, Txt, ListRow, Divider, Stepper, Button, IconButton, Chip, Icon } from './ui';
import { getIcsConfig, saveIcsConfig } from '../services/icsAutoSync';
import { timeToMinutes, minutesToTime } from '../logic/dates';
import {
  PROVIDERS, detectProvider, testConnection, getModelOverride, saveModelOverride, getProviderOverride, saveProviderOverride,
  getActiveAi,
} from '../services/aiService';

// Défini hors du composant : sinon chaque frappe recrée le groupe et les champs perdent le focus
const Group = ({ title, children, note }) => {
  const t = useTheme();
  return (
    <View style={{ marginTop: space.xl }}>
      <Txt variant="overline" muted style={{ marginBottom: space.sm }}>{title}</Txt>
      <View style={[styles.group, { backgroundColor: t.bg }]}>{children}</View>
      {note ? <Txt variant="small" muted style={{ marginTop: space.sm }}>{note}</Txt> : null}
    </View>
  );
};

const SettingsModal = ({
  visible, onClose, settings, onChangeSettings, onResetData, onSyncIcs, onImportIcsFile, onExport, onImportBackup,
  apiKey, onChangeApiKey,
}) => {
  const t = useTheme();
  const set = (patch) => onChangeSettings(patch);

  const [ics, setIcs] = useState({ url: '', username: '', password: '', lastSync: '' });
  const [showSecret, setShowSecret] = useState({ key: false, pass: false });
  const [syncing, setSyncing] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [modelOverride, setModelOverride] = useState('');
  const [testing, setTesting] = useState(false);
  const [aiTest, setAiTest] = useState(null);
  const [providerOverride, setProviderOverride] = useState('');
  const [active, setActive] = useState(null);
  const provider = detectProvider(apiKey);

  const refreshActive = (key = apiKey) => getActiveAi(key).then(setActive);

  const chooseProvider = async (id) => {
    setProviderOverride(id);
    setAiTest(null);
    setActive(null);
    await saveProviderOverride(id);
  };

  const chooseModel = async (m) => {
    setModelOverride(m);
    setAiTest(null);
    await saveModelOverride(m);
    refreshActive();
  };

  const runAiTest = async () => {
    setTesting(true);
    try {
      setActive(await testConnection(apiKey));
      setAiTest({ ok: true });
    } catch (e) {
      setActive(null);
      setAiTest({ ok: false, error: String(e.message || e) });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    getModelOverride().then(setModelOverride);
    getProviderOverride().then(setProviderOverride);
    refreshActive();
    setAiTest(null);
    getIcsConfig().then(setIcs);
    setShowImport(false);
    setImportText('');
  }, [visible]);

  const updateIcs = (field, value) => {
    setIcs(c => ({ ...c, [field]: value }));
    saveIcsConfig({ [field]: value });
  };

  const sync = async () => {
    if (!ics.url.trim()) { Alert.alert('URL manquante', "Entre l'URL de ton emploi du temps."); return; }
    setSyncing(true);
    try {
      await onSyncIcs(true);
      setIcs(await getIcsConfig());
    } finally {
      setSyncing(false);
    }
  };

  const confirmReset = () => Alert.alert('Tout supprimer ?', 'Toutes les tâches seront effacées. Exporte une sauvegarde avant si besoin.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: onResetData },
  ]);

  const lastSync = ics.lastSync
    ? new Date(ics.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'jamais';

  const toggle = (field) => (
    <Switch value={!!settings[field]} onValueChange={(v) => set({ [field]: v })}
      trackColor={{ true: t.accent, false: t.border }} thumbColor="#FFFFFF" />
  );
  const timeStepper = (field) => {
    const m = timeToMinutes(settings[field]) || 0;
    return <Stepper value={settings[field]} onMinus={() => set({ [field]: minutesToTime(Math.max(0, m - 30)) })} onPlus={() => set({ [field]: minutesToTime(Math.min(23 * 60 + 30, m + 30)) })} />;
  };
  const numStepper = (field, unit, step, min, max) => (
    <Stepper value={`${settings[field]}${unit}`}
      onMinus={() => set({ [field]: Math.max(min, settings[field] - step) })}
      onPlus={() => set({ [field]: Math.min(max, settings[field] + step) })} />
  );

  const sep = <Divider />;
  const input = [styles.input, { backgroundColor: t.surface, color: t.text }];

  return (
    <Sheet visible={visible} onClose={onClose} title="Réglages">
      <Group title="Apparence">
        <ListRow icon="moon" label="Thème sombre" right={toggle('isDarkMode')} />
      </Group>

      <Group title="Coach IA" note="Colle une clé Mistral, Gemini, Claude, OpenAI, Groq, OpenRouter ou Grok : le fournisseur est reconnu et un modèle adapté est choisi automatiquement. La clé reste sur ton téléphone.">
        <View style={styles.secretRow}>
          <TextInput style={[input, { flex: 1 }]} value={apiKey} onChangeText={(v) => { onChangeApiKey(v); setAiTest(null); refreshActive(v); }} placeholder="Clé API"
            placeholderTextColor={t.textFaint} secureTextEntry={!showSecret.key} autoCapitalize="none" autoCorrect={false} />
          <IconButton name={showSecret.key ? 'eye-off' : 'eye'} color={t.textMuted} onPress={() => setShowSecret(s => ({ ...s, key: !s.key }))} />
        </View>
        {apiKey.trim() ? (
          <>
            {/* IA réellement utilisée (connue après le premier appel) ou celle qui sera essayée */}
            <View style={[styles.activeAi, { backgroundColor: active ? t.successSoft : t.surface }]}>
              <Icon name={active ? 'check-circle' : 'help-circle'} size={18} color={active ? t.success : t.textMuted} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Txt variant="small" muted>IA utilisée</Txt>
                <Txt variant="bodyStrong">
                  {active ? active.label : providerOverride ? PROVIDERS[providerOverride].label
                    : provider ? PROVIDERS[provider].label : 'À détecter (Mistral ou Gemini)'}
                </Txt>
                <Txt variant="small" muted>
                  {active ? `${active.model}${active.auto ? ' · choisi automatiquement' : ''}` : 'Touche « Tester la clé » pour vérifier.'}
                </Txt>
              </View>
            </View>

            <Txt variant="small" muted style={styles.subLabel}>Fournisseur</Txt>
            <View style={styles.chips}>
              <Chip label="Auto" selected={!providerOverride} onPress={() => chooseProvider('')} />
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <Chip key={id} label={p.label.replace(/ \(.*\)$/, '')} selected={providerOverride === id} onPress={() => chooseProvider(id)} />
              ))}
            </View>

            <Txt variant="small" muted style={styles.subLabel}>Modèle</Txt>
            {active && active.models.length ? (
              <View style={styles.chips}>
                <Chip label={`Auto · ${active.autoModel}`} selected={!modelOverride} onPress={() => chooseModel('')} />
                {active.models.filter(m => m !== active.autoModel).slice(0, 10).map(m => (
                  <Chip key={m} label={m} selected={modelOverride === m} onPress={() => chooseModel(m)} />
                ))}
              </View>
            ) : null}
            <TextInput style={input} value={modelOverride} onChangeText={chooseModel}
              placeholder={active ? 'Autre modèle (nom exact)' : 'Automatique (ou nom exact du modèle)'} placeholderTextColor={t.textFaint}
              autoCapitalize="none" autoCorrect={false} />

            <View style={{ paddingBottom: space.md }}>
              <Button title="Tester la clé" icon="zap" variant="soft" loading={testing} onPress={runAiTest} />
              {aiTest && !aiTest.ok ? (
                <Txt variant="caption" color={t.danger} style={{ marginTop: space.sm }}>{aiTest.error}</Txt>
              ) : null}
            </View>
          </>
        ) : null}
      </Group>

      <Group title="Journée" note="Plage horaire où l'app peut placer tes sessions de projet.">
        <ListRow icon="sunrise" label="Début" right={timeStepper('dayStart')} />
        {sep}
        <ListRow icon="sunset" label="Fin" right={timeStepper('dayEnd')} />
        {sep}
        <ListRow icon="layers" label="Projets max / jour" right={numStepper('maxProjectHoursPerDay', ' h', 1, 1, 14)} />
      </Group>

      <Group title="Focus" note="Atteindre l'objectif valide ta journée et prolonge ta série.">
        <ListRow icon="target" label="Session" right={numStepper('workMin', ' min', 5, 5, 90)} />
        {sep}
        <ListRow icon="coffee" label="Pause" right={numStepper('shortBreakMin', ' min', 1, 1, 30)} />
        {sep}
        <ListRow icon="coffee" label="Grande pause" right={numStepper('longBreakMin', ' min', 5, 5, 60)} />
        {sep}
        <ListRow icon="repeat" label="Grande pause toutes les" right={numStepper('longBreakEvery', '', 1, 2, 8)} />
        {sep}
        <ListRow icon="play" label="Lancer la pause automatiquement" right={toggle('autoStartBreak')} />
        {sep}
        <ListRow icon="award" label="Objectif quotidien" right={numStepper('dailyGoal', '', 1, 1, 16)} />
      </Group>

      <Group title="Rappels">
        <ListRow icon="bell" label="Activer les rappels" right={toggle('remindersEnabled')} />
        {settings.remindersEnabled ? (
          <>
            {sep}
            <ListRow icon="clock" label="Avant une tâche" right={numStepper('reminderLeadMin', ' min', 5, 0, 60)} />
            {sep}
            <ListRow icon="layers" label="Début des sessions de projet" right={toggle('slotReminders')} />
            {sep}
            <ListRow icon="sun" label="Brief du matin" right={toggle('morningBriefEnabled')} />
            {settings.morningBriefEnabled ? <ListRow label="     Heure" right={timeStepper('morningBriefTime')} /> : null}
            {sep}
            <ListRow icon="moon" label="Bilan du soir" right={toggle('eveningReviewEnabled')} />
            {settings.eveningReviewEnabled ? <ListRow label="     Heure" right={timeStepper('eveningReviewTime')} /> : null}
          </>
        ) : null}
      </Group>

      <Group title="Emploi du temps" note={`Synchronisé au démarrage puis toutes les heures. Dernière sync : ${lastSync}.`}>
        <View style={{ paddingVertical: space.md }}>
          <TextInput style={input} value={ics.url} onChangeText={v => updateIcs('url', v)} placeholder="URL du planning (.ics)"
            placeholderTextColor={t.textFaint} autoCapitalize="none" keyboardType="url" />
          <TextInput style={input} value={ics.username} onChangeText={v => updateIcs('username', v)} placeholder="Identifiant (si requis)"
            placeholderTextColor={t.textFaint} autoCapitalize="none" />
          <View style={styles.secretRow}>
            <TextInput style={[input, { flex: 1 }]} value={ics.password} onChangeText={v => updateIcs('password', v)} placeholder="Mot de passe"
              placeholderTextColor={t.textFaint} secureTextEntry={!showSecret.pass} autoCapitalize="none" />
            <IconButton name={showSecret.pass ? 'eye-off' : 'eye'} color={t.textMuted} onPress={() => setShowSecret(s => ({ ...s, pass: !s.pass }))} />
          </View>
          <View style={styles.row}>
            <Button title="Synchroniser" icon="refresh-cw" variant="soft" loading={syncing} onPress={sync} style={{ flex: 1 }} />
            <Button title="Fichier .ics" icon="upload" variant="secondary" onPress={onImportIcsFile} style={{ flex: 1 }} />
          </View>
        </View>
      </Group>

      <Group title="Sauvegarde">
        <View style={[styles.row, { paddingVertical: space.md }]}>
          <Button title="Exporter" icon="download" variant="secondary" onPress={onExport} style={{ flex: 1 }} />
          <Button title="Restaurer" icon="rotate-ccw" variant="secondary" onPress={() => setShowImport(v => !v)} style={{ flex: 1 }} />
        </View>
        {showImport ? (
          <View style={{ paddingBottom: space.md }}>
            <TextInput style={[input, { minHeight: 90 }]} value={importText} onChangeText={setImportText} multiline textAlignVertical="top"
              placeholder="Colle ici le texte de la sauvegarde" placeholderTextColor={t.textFaint} />
            <Button title="Restaurer cette sauvegarde" onPress={() => onImportBackup(importText)} />
          </View>
        ) : null}
      </Group>

      <View style={{ marginTop: space.xl }}>
        <Button title="Supprimer toutes les tâches" icon="trash-2" variant="danger" onPress={confirmReset} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  input: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 11, fontSize: 15, marginBottom: space.sm },
  secretRow: { flexDirection: 'row', alignItems: 'center', paddingTop: space.md, paddingBottom: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md },
  subLabel: { marginBottom: space.sm },
  activeAi: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md, marginTop: space.sm, marginBottom: space.lg },
});

export default SettingsModal;
