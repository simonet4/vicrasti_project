import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, Pressable, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, space, radius } from '../styles/globalStyles';
import { Txt, IconButton, Icon, Chip, Button, Check, ProgressBar } from './ui';
import { MODE_LABELS } from '../hooks/usePomodoro';

const fmt = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

const TIPS = [
  'Téléphone retourné, notifications coupées.',
  'Une seule chose. Tout le reste attendra.',
  'Pas besoin d\'avoir envie : l\'envie vient en faisant.',
  'Bloqué ? Fais l\'étape la plus petite possible.',
  'Fait vaut mieux que parfait.',
];

// Écran plein écran pendant une session : rien d'autre à regarder que la tâche et le temps
export const FocusScreen = ({ visible, onClose, pomo, settings, pendingTask, nextStep, onToggleStep }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [minutes, setMinutes] = useState(settings.workMin);
  useEffect(() => { if (visible) setMinutes(settings.workMin); }, [visible, settings.workMin]);

  const idle = !pomo.isRunningOrPaused;
  const isWork = pomo.mode === 'WORK';
  const task = idle && isWork ? pendingTask : pomo.sessionTask;
  const accent = isWork ? t.accent : t.success;
  const every = Math.max(1, settings.longBreakEvery || 4);
  const shown = idle && isWork ? minutes * 60 : pomo.secondsLeft;
  const tip = TIPS[new Date().getHours() % TIPS.length];
  const presets = Array.from(new Set([5, 15, settings.workMin, 50])).sort((a, b) => a - b);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.header}>
          <IconButton name="chevron-down" onPress={onClose} bg={t.surfaceAlt} />
          <View style={styles.dots}>
            {Array.from({ length: every }).map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < pomo.cycle % every ? accent : t.border }]} />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.center}>
          <Txt variant="overline" color={accent}>{MODE_LABELS[pomo.mode]}</Txt>
          <Txt variant="title" style={styles.task} numberOfLines={2}>
            {isWork ? (task ? task.text : 'Session libre') : 'Lève-toi, bois de l\'eau, respire.'}
          </Txt>
          <Txt style={[styles.timer, { color: t.text }]}>{fmt(shown)}</Txt>
          <ProgressBar value={idle ? 0 : pomo.progress} color={accent} height={3} style={{ width: '64%' }} />

          {isWork && nextStep ? (
            <Pressable onPress={onToggleStep} style={[styles.step, { backgroundColor: t.surface }]}>
              <Check checked={false} onPress={onToggleStep} size={22} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Txt variant="small" muted>Prochaine étape</Txt>
                <Txt variant="bodyStrong" numberOfLines={2}>{nextStep.text}</Txt>
              </View>
            </Pressable>
          ) : null}
        </View>

        {idle && isWork ? (
          <View style={styles.bottom}>
            <View style={styles.presets}>
              {presets.map(m => (
                <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} style={{ marginHorizontal: 4 }} />
              ))}
            </View>
            <Button title="Commencer" icon="play" size="lg" onPress={() => pomo.start(minutes, pendingTask)} />
            <Txt variant="caption" muted style={styles.tip}>{tip}</Txt>
          </View>
        ) : (
          <View style={styles.bottom}>
            <View style={styles.controls}>
              <IconButton name="square" size={20} diameter={56} bg={t.surfaceAlt} onPress={pomo.stop} />
              <Pressable onPress={pomo.toggle} style={({ pressed }) => [styles.mainBtn, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}>
                <Icon name={pomo.isActive ? 'pause' : 'play'} size={30} color={t.onAccent} />
              </Pressable>
              <IconButton name="skip-forward" size={20} diameter={56} bg={t.surfaceAlt} onPress={pomo.skip} />
            </View>
            <Txt variant="caption" muted style={styles.tip}>
              {isWork ? tip : 'Passe la pause si tu veux enchaîner.'}
            </Txt>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Barre compacte affichée quand une session tourne et que l'écran Focus est réduit
export const FocusBar = ({ pomo, onOpen }) => {
  const t = useTheme();
  if (!pomo.isRunningOrPaused) return null;
  const isWork = pomo.mode === 'WORK';
  const accent = isWork ? t.accent : t.success;
  return (
    <Pressable onPress={onOpen} style={[styles.bar, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[styles.barDot, { backgroundColor: pomo.isActive ? accent : t.textFaint }]} />
      <View style={{ flex: 1 }}>
        <Txt variant="small" muted>{MODE_LABELS[pomo.mode]}{pomo.isActive ? '' : ' · en pause'}</Txt>
        <Txt variant="bodyStrong" numberOfLines={1}>{isWork ? (pomo.sessionTask ? pomo.sessionTask.text : 'Session libre') : 'Respire un peu'}</Txt>
      </View>
      <Txt variant="heading" style={{ fontVariant: ['tabular-nums'], marginRight: space.sm }}>{fmt(pomo.secondsLeft)}</Txt>
      <IconButton name={pomo.isActive ? 'pause' : 'play'} onPress={pomo.toggle} bg={accent} color={t.onAccent} diameter={36} size={16} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  task: { textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md },
  // lineHeight explicite : sinon celle du texte courant (21) rogne les chiffres
  timer: { fontSize: 88, lineHeight: 104, fontWeight: '200', letterSpacing: -2, fontVariant: ['tabular-nums'], marginVertical: space.lg },
  step: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: space.lg, marginTop: space.xxl, alignSelf: 'stretch' },
  bottom: { alignItems: 'stretch' },
  presets: { flexDirection: 'row', justifyContent: 'center', marginBottom: space.lg },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
  mainBtn: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  tip: { textAlign: 'center', marginTop: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.md, marginBottom: space.sm, paddingVertical: space.sm, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  barDot: { width: 8, height: 8, borderRadius: 4, marginRight: space.md },
});
