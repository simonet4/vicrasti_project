import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, Pressable } from 'react-native';
import { useTheme, space, radius, type } from '../styles/globalStyles';
import {
  Sheet, Txt, Button, Segmented, Chip, ListRow, Divider, Stepper, Check, IconButton, SectionHeader,
} from './ui';
import DatePickerModal from './DatePickerModal';
import TimePickerModal from './TimePickerModal';
import {
  todayYmd, addDays, timeToMinutes, minutesToTime, formatDayLabel, formatShortDate, weekdayIndex, formatHours,
} from '../logic/dates';
import { newId, occursOn } from '../logic/tasks';
import { generateSteps, getStoredToken } from '../services/aiService';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DURATIONS = [15, 30, 60, 90, 120];
const TYPES = [
  { key: 'QUICK', label: 'Rapide' },
  { key: 'FIXED', label: 'Créneau' },
  { key: 'PROJECT', label: 'Projet' },
];
const HELP = {
  QUICK: 'Une petite tâche de 30 min, placée dans ton prochain moment libre.',
  FIXED: 'Un horaire précis : cours, rendez-vous, sport…',
  PROJECT: 'Un volume de travail, réparti en sessions de 30 min jusqu\'à la deadline.',
};

const emptyForm = (date, type) => ({
  type: type || 'QUICK',
  text: '',
  date: date || todayYmd(),
  start: '09:00',
  end: '10:00',
  location: '',
  recurrence: { type: 'none', days: [] },
  totalHours: 2,
  deadline: addDays(date || todayYmd(), 7),
  steps: [],
});

const formFromTask = (t) => ({
  type: t.type === 'PROJECT' && t.quick ? 'QUICK' : t.type,
  text: t.text || '',
  date: t.dueDate || (t.quick ? t.deadline : null) || todayYmd(),
  start: t.startTime || '09:00',
  end: t.endTime || t.startTime || '10:00',
  location: t.location || '',
  recurrence: t.recurrence && t.recurrence.type ? { days: [], ...t.recurrence } : { type: 'none', days: [] },
  totalHours: parseFloat(t.totalHours) || 2,
  deadline: t.deadline || null,
  steps: Array.isArray(t.steps) ? t.steps : [],
});

const formatDuration = (d) => (d < 60 ? `${d} min` : `${Math.floor(d / 60)}h${d % 60 ? String(d % 60) : ''}`);

const TaskFormModal = ({ visible, task, defaultDate, defaultType, todos, onSave, onClose }) => {
  const t = useTheme();
  const [form, setForm] = useState(emptyForm());
  const [datePicker, setDatePicker] = useState(null); // 'date' | 'deadline'
  const [timePicker, setTimePicker] = useState(null); // 'start' | 'end'
  const [newStep, setNewStep] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(task ? formFromTask(task) : emptyForm(defaultDate, defaultType));
    setNewStep('');
  }, [visible, task, defaultDate, defaultType]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const duration = (timeToMinutes(form.end) ?? 0) - (timeToMinutes(form.start) ?? 0);

  const setStart = (val) => {
    const keep = Math.max(15, duration);
    set({ start: val, end: minutesToTime(Math.min(timeToMinutes(val) + keep, 24 * 60 - 1)) });
  };

  const setEnd = (val) => {
    if (timeToMinutes(val) <= timeToMinutes(form.start)) {
      Alert.alert('Heure de fin', 'La fin doit être après le début.');
      return;
    }
    set({ end: val });
  };

  const addStep = () => {
    const text = newStep.trim();
    if (!text) return;
    set({ steps: [...form.steps, { id: newId(), text, done: false }] });
    setNewStep('');
  };

  const aiSplit = async () => {
    if (!form.text.trim()) { Alert.alert('Titre requis', 'Donne un titre au projet d\'abord.'); return; }
    const token = await getStoredToken();
    if (!token) { Alert.alert('Clé manquante', 'Ajoute une clé API (Mistral, Gemini, Claude…) dans Réglages.'); return; }
    setAiLoading(true);
    try {
      const steps = await generateSteps({ text: form.text, totalHours: form.totalHours, deadline: form.deadline, steps: form.steps }, token);
      set({ steps: [...form.steps.filter(s => s.done), ...steps] });
    } catch (e) {
      Alert.alert('Erreur IA', String(e.message || e));
    } finally {
      setAiLoading(false);
    }
  };

  const buildTask = () => {
    const base = task ? { ...task } : { id: newId(), done: false, createdAt: new Date().toISOString() };
    const clean = { dueDate: null, startTime: null, endTime: null, recurrence: null, location: undefined, doneDates: undefined };
    if (form.type === 'QUICK') {
      return {
        ...base, ...clean, type: 'PROJECT', quick: true, text: form.text.trim(),
        totalHours: task && task.quick ? task.totalHours : '0.5', initialHours: '0.5',
        deadline: form.date, steps: [],
      };
    }
    if (form.type === 'FIXED') {
      const rec = form.recurrence.type === 'none' ? null : {
        type: form.recurrence.type,
        days: form.recurrence.type === 'weekly'
          ? (form.recurrence.days.length ? [...form.recurrence.days].sort() : [weekdayIndex(form.date)])
          : [],
      };
      return {
        ...base, type: 'FIXED', quick: undefined, text: form.text.trim(), dueDate: form.date,
        startTime: form.start, endTime: form.end, location: form.location.trim() || undefined,
        recurrence: rec, doneDates: rec ? (base.doneDates || []) : undefined,
        totalHours: undefined, initialHours: undefined, deadline: undefined, steps: undefined,
      };
    }
    const hours = Math.max(0.5, Math.round(form.totalHours * 2) / 2);
    const wasProject = task && task.type === 'PROJECT' && !task.quick;
    const prevRemaining = wasProject ? parseFloat(task.totalHours) || 0 : hours;
    const prevInitial = wasProject ? parseFloat(task.initialHours) || prevRemaining : hours;
    return {
      ...base, ...clean, type: 'PROJECT', quick: undefined, text: form.text.trim(),
      totalHours: String(hours), initialHours: String(hours + Math.max(0, prevInitial - prevRemaining)),
      deadline: form.deadline || null, steps: form.steps, done: false,
    };
  };

  const handleSave = () => {
    if (!form.text.trim()) { Alert.alert('Titre requis', 'Que dois-tu faire ?'); return; }
    const newTask = buildTask();
    if (form.type === 'FIXED') {
      const s = timeToMinutes(form.start);
      const e = timeToMinutes(form.end);
      const conflict = (todos || []).find(x => x.id !== newTask.id && x.type === 'FIXED' && occursOn(x, form.date) && (() => {
        const xs = timeToMinutes(x.startTime);
        const xe = timeToMinutes(x.endTime);
        return xs != null && xe != null && Math.max(s, xs) < Math.min(e, xe);
      })());
      if (conflict) {
        Alert.alert('Conflit', `« ${conflict.text} » (${conflict.startTime}–${conflict.endTime}) chevauche ce créneau.`, [
          { text: 'Modifier', style: 'cancel' },
          { text: 'Enregistrer quand même', onPress: () => onSave(newTask) },
        ]);
        return;
      }
    }
    onSave(newTask);
  };

  const inputStyle = [styles.input, { color: t.text, backgroundColor: t.surfaceAlt }];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={task ? 'Modifier' : 'Nouvelle tâche'}
      footer={<Button title="Enregistrer" onPress={handleSave} size="lg" />}
    >
      <TextInput
        style={[styles.titleInput, { color: t.text }]}
        placeholder="Que dois-tu faire ?"
        placeholderTextColor={t.textFaint}
        value={form.text}
        onChangeText={x => set({ text: x })}
        autoFocus={!task}
        returnKeyType="done"
        onSubmitEditing={form.type === 'QUICK' ? handleSave : undefined}
      />

      <Segmented options={TYPES} value={form.type} onChange={(k) => set({ type: k })} />
      <Txt variant="caption" muted style={styles.help}>{HELP[form.type]}</Txt>

      {form.type === 'QUICK' && (
        <ListRow icon="calendar" label="Jour" value={formatDayLabel(form.date)} chevron onPress={() => setDatePicker('date')} />
      )}

      {form.type === 'FIXED' && (
        <>
          <ListRow icon="calendar" label={form.recurrence.type !== 'none' ? 'À partir du' : 'Date'} value={formatDayLabel(form.date)} chevron onPress={() => setDatePicker('date')} />
          <Divider inset={30} />
          <ListRow icon="clock" label="Début" value={form.start} chevron onPress={() => setTimePicker('start')} />
          <Divider inset={30} />
          <ListRow icon="clock" label="Fin" value={form.end} chevron onPress={() => setTimePicker('end')} />
          <View style={styles.chips}>
            {DURATIONS.map(d => (
              <Chip key={d} label={formatDuration(d)} selected={duration === d}
                onPress={() => set({ end: minutesToTime(Math.min(timeToMinutes(form.start) + d, 24 * 60 - 1)) })} />
            ))}
          </View>
          <TextInput style={inputStyle} placeholder="Lieu (optionnel)" placeholderTextColor={t.textFaint}
            value={form.location} onChangeText={x => set({ location: x })} />

          <SectionHeader title="Répéter" style={{ marginTop: space.lg }} />
          <Segmented
            options={[{ key: 'none', label: 'Jamais' }, { key: 'daily', label: 'Chaque jour' }, { key: 'weekly', label: 'Chaque semaine' }]}
            value={form.recurrence.type}
            onChange={(k) => set({ recurrence: { ...form.recurrence, type: k, days: k === 'weekly' && !form.recurrence.days.length ? [weekdayIndex(form.date)] : form.recurrence.days } })}
          />
          {form.recurrence.type === 'weekly' && (
            <View style={[styles.chips, { justifyContent: 'space-between' }]}>
              {DAYS.map((d, idx) => {
                const sel = form.recurrence.days.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => set({ recurrence: { ...form.recurrence, days: sel ? form.recurrence.days.filter(x => x !== idx) : [...form.recurrence.days, idx] } })}
                    style={[styles.dayBtn, { backgroundColor: sel ? t.accent : t.surfaceAlt }]}
                  >
                    <Txt variant="caption" color={sel ? t.onAccent : t.text} style={{ fontWeight: '600' }}>{d}</Txt>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {form.type === 'PROJECT' && (
        <>
          <ListRow icon="clock" label={task ? 'Temps restant' : 'Temps estimé'}
            right={<Stepper value={formatHours(form.totalHours)}
              onMinus={() => set({ totalHours: Math.max(0.5, form.totalHours - 0.5) })}
              onPlus={() => set({ totalHours: form.totalHours + 0.5 })} />} />
          <Divider inset={30} />
          <ListRow icon="flag" label="Deadline" value={form.deadline ? formatShortDate(form.deadline) : 'Aucune'} chevron onPress={() => setDatePicker('deadline')} />

          <SectionHeader
            title={`Étapes${form.steps.length ? ` · ${form.steps.length}` : ''}`}
            right={<Button title="Découper avec l'IA" icon="zap" variant="ghost" size="sm" loading={aiLoading} onPress={aiSplit} />}
          />
          {form.steps.length === 0 ? (
            <Txt variant="caption" muted style={{ marginBottom: space.sm }}>
              De petites étapes concrètes rendent le démarrage beaucoup plus facile.
            </Txt>
          ) : null}
          {form.steps.map(s => (
            <View key={s.id} style={styles.stepRow}>
              <Check checked={s.done} size={20} onPress={() => set({ steps: form.steps.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })} />
              <Txt style={[styles.stepText, s.done && { color: t.textFaint, textDecorationLine: 'line-through' }]}>{s.text}</Txt>
              <IconButton name="x" size={16} diameter={30} color={t.textFaint} onPress={() => set({ steps: form.steps.filter(x => x.id !== s.id) })} />
            </View>
          ))}
          <View style={styles.addStep}>
            <TextInput style={[inputStyle, { flex: 1, marginBottom: 0 }]} placeholder="Ajouter une étape" placeholderTextColor={t.textFaint}
              value={newStep} onChangeText={setNewStep} onSubmitEditing={addStep} returnKeyType="done" submitBehavior="submit" />
            <IconButton name="plus" onPress={addStep} bg={t.accentSoft} color={t.accent} diameter={44} style={{ marginLeft: space.sm }} />
          </View>
        </>
      )}

      <DatePickerModal
        visible={!!datePicker}
        value={datePicker === 'deadline' ? form.deadline : form.date}
        title={datePicker === 'deadline' ? 'Deadline' : 'Date'}
        allowClear={datePicker === 'deadline'}
        onClear={() => set({ deadline: null })}
        onSelectDate={(ymd) => set(datePicker === 'deadline' ? { deadline: ymd } : { date: ymd })}
        onClose={() => setDatePicker(null)}
      />
      <TimePickerModal
        visible={!!timePicker}
        value={timePicker === 'end' ? form.end : form.start}
        title={timePicker === 'end' ? 'Heure de fin' : 'Heure de début'}
        onConfirm={(v) => (timePicker === 'end' ? setEnd(v) : setStart(v))}
        onClose={() => setTimePicker(null)}
      />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  titleInput: { ...type.title, fontWeight: '600', paddingVertical: space.sm, marginBottom: space.md },
  help: { marginTop: space.sm, marginBottom: space.sm },
  input: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  dayBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stepText: { flex: 1, marginLeft: space.md },
  addStep: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
});

export default TaskFormModal;
