import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme, space, radius } from '../styles/globalStyles';
import {
  Txt, Button, Card, Chip, Segmented, IconButton, Divider, EmptyState,
} from '../components/ui';
import { generateTasks, generateSteps, askCoach } from '../services/aiService';
import { organizeDay } from '../logic/planner';
import { getFixedForDay, getOverdue, getActiveProjects, projectInfo } from '../logic/tasks';
import { todayYmd, addDays, formatShortDate, formatHours } from '../logic/dates';

const MODES = [
  { key: 'coach', label: 'Débloquer' },
  { key: 'create', label: 'Planifier' },
  { key: 'split', label: 'Découper' },
];

const FEELINGS = ['Pas motivé', 'Trop de choses', 'Je ne sais pas par où commencer', 'Fatigué', 'Peur de mal faire'];

// Agenda des 7 prochains jours, pour éviter les conflits lors de la création
const busyContext = (todos) => {
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(todayYmd(), i);
    getFixedForDay(todos, d).filter(x => x.startTime).forEach(x => lines.push(`${d} ${x.startTime}-${x.endTime || '?'} ${x.text}`));
  }
  return lines.slice(0, 60).join('\n');
};

// Résumé de la journée envoyé au coach
const coachContext = (todos, settings, activity) => {
  const today = todayYmd();
  const { schedule } = organizeDay(todos, today, settings);
  const lines = schedule.map(i => `${i.startTime || '—'}-${i.endTime || ''} ${i.type === 'AUTO' ? '[projet] ' : ''}${i.text}${i.done ? ' (fait)' : ''}`);
  const overdue = getOverdue(todos, today).map(o => `- ${o.text} (prévu le ${formatShortDate(o.dueDate)})`);
  const projects = getActiveProjects(todos).filter(p => !p.quick).map(p => {
    const info = projectInfo(p, today);
    return `- ${p.text} : ${formatHours(info.remaining)} restantes${p.deadline ? `, deadline ${p.deadline}` : ''}${info.nextStep ? `, prochaine étape « ${info.nextStep.text} »` : ''}`;
  });
  return [
    `Planning du jour :\n${lines.join('\n') || '(rien)'}`,
    overdue.length ? `En retard :\n${overdue.join('\n')}` : '',
    projects.length ? `Projets :\n${projects.join('\n')}` : '',
    `Sessions de focus faites aujourd'hui : ${(activity && activity.pomodoros) || 0}/${settings.dailyGoal}`,
  ].filter(Boolean).join('\n\n');
};

const AIScreen = ({ apiKey, todos, settings, todayActivity, onAddTasks, onSetProjectSteps, onOpenSettings }) => {
  const t = useTheme();
  const [mode, setMode] = useState('coach');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feeling, setFeeling] = useState('');
  const [projectId, setProjectId] = useState(null);
  const [steps, setSteps] = useState(null);

  const projects = getActiveProjects(todos).filter(p => !p.quick);
  const selectedProject = projects.find(p => p.id === projectId) || null;

  const run = async (fn) => {
    setLoading(true);
    try { await fn(); } catch (e) { Alert.alert('Erreur', String(e.message || e)); } finally { setLoading(false); }
  };

  const handleCoach = () => run(async () => {
    setAnswer('');
    const res = await askCoach(apiKey, coachContext(todos, settings, todayActivity), [feeling, prompt.trim()].filter(Boolean).join('. '));
    setAnswer(res.trim());
  });

  const handleCreate = () => {
    if (!prompt.trim()) { Alert.alert('Demande vide', 'Décris ce que tu dois faire.'); return; }
    run(async () => {
      setPreview(null);
      setPreview(await generateTasks(prompt.trim(), apiKey, busyContext(todos)));
    });
  };

  const handleSplit = () => {
    if (!selectedProject) { Alert.alert('Choisis un projet', 'Sélectionne le projet à découper.'); return; }
    run(async () => {
      setSteps(null);
      setSteps(await generateSteps(selectedProject, apiKey, prompt.trim()));
    });
  };

  const confirmCreate = () => {
    if (!preview || !preview.length) return;
    onAddTasks(preview);
    Alert.alert('Ajouté', `${preview.length} élément${preview.length > 1 ? 's' : ''} ajouté${preview.length > 1 ? 's' : ''} au planning.`);
    setPreview(null);
    setPrompt('');
  };

  const confirmSteps = (replace) => {
    if (!steps || !selectedProject) return;
    const existing = replace ? (selectedProject.steps || []).filter(s => s.done) : (selectedProject.steps || []);
    onSetProjectSteps(selectedProject.id, [...existing, ...steps]);
    Alert.alert('Ajouté', `${steps.length} étapes ajoutées à « ${selectedProject.text} ».`);
    setSteps(null);
    setPrompt('');
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Txt variant="display">Coach</Txt>
        <Txt muted style={{ marginTop: 2, marginBottom: space.lg }}>Ton assistant pour passer à l'action, avec l'IA de ton choix.</Txt>

        {!apiKey ? (
          <Card>
            <EmptyState icon="key" title="Connecte une IA" text="Ajoute une clé API dans les réglages : Mistral, Gemini, Claude, OpenAI, Groq…">
              <Button title="Ouvrir les réglages" icon="settings" variant="soft" onPress={onOpenSettings} style={{ marginTop: space.lg }} />
            </EmptyState>
          </Card>
        ) : (
          <>
            <Segmented options={MODES} value={mode} onChange={(k) => { setMode(k); setPrompt(''); }} />

            {mode === 'coach' && (
              <View style={styles.block}>
                <Txt variant="heading">Qu'est-ce qui te bloque ?</Txt>
                <View style={styles.chips}>
                  {FEELINGS.map(f => <Chip key={f} label={f} selected={feeling === f} onPress={() => setFeeling(feeling === f ? '' : f)} />)}
                </View>
                <TextInput style={[input, styles.area]} value={prompt} onChangeText={setPrompt} multiline textAlignVertical="top"
                  placeholder="Optionnel : je dois réviser mais je scrolle depuis une heure…" placeholderTextColor={t.textFaint} />
                <Button title="Par quoi je commence ?" icon="compass" loading={loading} onPress={handleCoach} size="lg" />
                {answer ? (
                  <Card style={{ marginTop: space.lg, backgroundColor: t.accentSoft }}>
                    <Txt style={{ lineHeight: 23 }}>{answer}</Txt>
                  </Card>
                ) : null}
              </View>
            )}

            {mode === 'create' && (
              <View style={styles.block}>
                <Txt variant="heading">Qu'as-tu à faire ?</Txt>
                <Txt variant="caption" muted style={{ marginTop: 2 }}>J'en fais des tâches et des projets, sans chevaucher ton agenda.</Txt>
                <TextInput style={[input, styles.area, { marginTop: space.md }]} value={prompt} onChangeText={setPrompt} multiline textAlignVertical="top"
                  placeholder="Exam de maths le 10, dossier de stage vendredi (environ 6h), sport mardi et jeudi à 18h…" placeholderTextColor={t.textFaint} />
                <Button title="Générer" icon="zap" loading={loading} onPress={handleCreate} size="lg" />

                {preview && preview.length > 0 && (
                  <>
                    <Card padded={false} style={{ marginTop: space.lg }}>
                      {preview.map((p, i) => (
                        <View key={p.id}>
                          {i > 0 ? <Divider inset={space.lg} /> : null}
                          <View style={styles.previewRow}>
                            <View style={{ flex: 1 }}>
                              <Txt variant="overline" color={p.type === 'PROJECT' ? t.accent : t.textMuted}>{p.type === 'PROJECT' ? 'Projet' : 'Créneau'}</Txt>
                              <Txt variant="bodyStrong" style={{ marginTop: 2 }}>{p.text}</Txt>
                              <Txt variant="small" muted>
                                {p.type === 'FIXED'
                                  ? `${formatShortDate(p.dueDate)} · ${p.startTime || '—'}–${p.endTime || '—'}`
                                  : `${formatHours(parseFloat(p.totalHours))} · deadline ${p.deadline ? formatShortDate(p.deadline) : 'aucune'}${p.steps && p.steps.length ? ` · ${p.steps.length} étapes` : ''}`}
                              </Txt>
                            </View>
                            <IconButton name="x" size={16} diameter={32} color={t.textFaint} onPress={() => setPreview(preview.filter(x => x.id !== p.id))} />
                          </View>
                        </View>
                      ))}
                    </Card>
                    <View style={styles.actions}>
                      <Button title="Tout ajouter" icon="check" onPress={confirmCreate} style={{ flex: 1 }} />
                      <Button title="Annuler" variant="secondary" onPress={() => setPreview(null)} style={{ flex: 1 }} />
                    </View>
                  </>
                )}
              </View>
            )}

            {mode === 'split' && (
              <View style={styles.block}>
                <Txt variant="heading">Découpe un projet en micro-étapes</Txt>
                {projects.length === 0 ? (
                  <Txt muted style={{ marginTop: space.sm }}>Aucun projet en cours. Crée-en un depuis Aujourd'hui.</Txt>
                ) : (
                  <>
                    <View style={styles.chips}>
                      {projects.map(p => <Chip key={p.id} label={p.text} selected={projectId === p.id} onPress={() => { setProjectId(p.id); setSteps(null); }} />)}
                    </View>
                    <TextInput style={input} value={prompt} onChangeText={setPrompt}
                      placeholder="Optionnel : consignes, ce qui est déjà fait…" placeholderTextColor={t.textFaint} />
                    <Button title="Découper" icon="list" loading={loading} onPress={handleSplit} size="lg" />
                  </>
                )}

                {steps && steps.length > 0 && (
                  <>
                    <Card padded={false} style={{ marginTop: space.lg }}>
                      {steps.map((s, i) => (
                        <View key={s.id}>
                          {i > 0 ? <Divider inset={space.lg} /> : null}
                          <View style={styles.previewRow}>
                            <Txt variant="caption" faint style={{ width: 22 }}>{i + 1}</Txt>
                            <Txt style={{ flex: 1 }}>{s.text}</Txt>
                            <IconButton name="x" size={16} diameter={32} color={t.textFaint} onPress={() => setSteps(steps.filter(x => x.id !== s.id))} />
                          </View>
                        </View>
                      ))}
                    </Card>
                    <View style={styles.actions}>
                      <Button title="Ajouter" icon="plus" onPress={() => confirmSteps(false)} style={{ flex: 1 }} />
                      {selectedProject && (selectedProject.steps || []).some(s => !s.done) ? (
                        <Button title="Remplacer" variant="secondary" onPress={() => confirmSteps(true)} style={{ flex: 1 }} />
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 80 },
  block: { marginTop: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  input: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, marginBottom: space.md },
  area: { minHeight: 96 },
  previewRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});

export default AIScreen;
