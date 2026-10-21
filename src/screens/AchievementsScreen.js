import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, space, radius } from '../styles/globalStyles';
import { Txt, Icon, Card, ProgressBar, Divider, Sheet } from '../components/ui';
import { todayYmd, parseYmd, formatDuration } from '../logic/dates';
import {
  dailyActivity, computeStreak, computeTotals, computeXp, levelFromXp, levelTitle, lastDays,
} from '../logic/stats';

const TROPHY_KEY = '@vicrasti_trophies';
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const GROUPS = [
  { key: 'tasks', icon: 'check-circle', label: 'Tâches terminées', unit: '', targets: [1, 10, 25, 50, 100, 250, 500, 1000], get: (x) => x.tasks },
  { key: 'pomodoros', icon: 'target', label: 'Sessions de focus', unit: '', targets: [1, 10, 25, 50, 100, 250, 500], get: (x) => x.pomodoros },
  { key: 'focus', icon: 'clock', label: 'Heures de focus', unit: ' h', targets: [1, 10, 25, 50, 100, 250], get: (x) => Math.floor(x.focusMin / 60) },
  { key: 'streak', icon: 'zap', label: 'Meilleure série', unit: ' j', targets: [3, 7, 14, 30, 60, 100], get: (x, s) => s.best },
  { key: 'projects', icon: 'folder', label: 'Projets terminés', unit: '', targets: [1, 3, 5, 10, 25], get: (x) => x.projects },
  { key: 'slots', icon: 'layers', label: 'Sessions de projet', unit: '', targets: [1, 10, 50, 100, 250], get: (x) => x.slots },
  { key: 'early', icon: 'sunrise', label: 'Lève-tôt · avant 8h', unit: '', targets: [1, 10, 50], get: (x) => x.earlyBird },
  { key: 'night', icon: 'moon', label: 'Noctambule · après 21h', unit: '', targets: [1, 10, 50], get: (x) => x.nightOwl },
];

const AchievementsScreen = ({ todos = [], focusLog = [], settings }) => {
  const t = useTheme();
  const today = todayYmd();
  const goal = settings.dailyGoal || 4;

  const activity = useMemo(() => dailyActivity(todos, focusLog), [todos, focusLog]);
  const streak = useMemo(() => computeStreak(activity, today, goal), [activity, today, goal]);
  const totals = useMemo(() => computeTotals(todos, focusLog), [todos, focusLog]);
  const lvl = levelFromXp(computeXp(totals));
  const week = lastDays(activity, today, 7);
  const maxMin = Math.max(settings.workMin * goal, ...week.map(d => d.focusMin), 1);
  const weekFocus = week.reduce((a, d) => a + d.focusMin, 0);
  const todayAct = activity[today] || { pomodoros: 0, focusMin: 0 };

  const [earned, setEarned] = useState({});
  const [group, setGroup] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TROPHY_KEY);
        const updated = raw ? JSON.parse(raw) : {};
        let changed = false;
        GROUPS.forEach(g => {
          const v = g.get(totals, streak);
          g.targets.forEach(target => {
            const id = `${g.key}_${target}`;
            if (v >= target && !updated[id]) { updated[id] = { earnedAt: new Date().toISOString() }; changed = true; }
          });
        });
        if (changed) await AsyncStorage.setItem(TROPHY_KEY, JSON.stringify(updated));
        setEarned(updated);
      } catch (_) {}
    })();
  }, [totals, streak.best]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Txt variant="display">Progrès</Txt>

      {/* Niveau */}
      <Card style={{ marginTop: space.lg }}>
        <View style={styles.levelRow}>
          <View style={[styles.levelBadge, { backgroundColor: t.accentSoft }]}>
            <Txt variant="title" color={t.accent}>{lvl.level}</Txt>
          </View>
          <View style={{ flex: 1, marginLeft: space.lg }}>
            <Txt variant="small" muted>Niveau {lvl.level}</Txt>
            <Txt variant="heading">{levelTitle(lvl.level)}</Txt>
          </View>
        </View>
        <ProgressBar value={lvl.into / lvl.needed} style={{ marginTop: space.lg }} height={6} />
        <Txt variant="small" muted style={{ marginTop: space.sm }}>{lvl.needed - lvl.into} XP avant le niveau {lvl.level + 1}</Txt>
      </Card>

      {/* Série + aujourd'hui */}
      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Icon name="zap" size={18} color={streak.current ? t.accent : t.textFaint} />
          <Txt variant="display" style={{ marginTop: space.sm }}>{streak.current}</Txt>
          <Txt variant="small" muted>jour{streak.current > 1 ? 's' : ''} d'affilée · record {streak.best}</Txt>
        </Card>
        <Card style={styles.tile}>
          <Icon name="target" size={18} color={todayAct.pomodoros >= goal ? t.success : t.textFaint} />
          <Txt variant="display" style={{ marginTop: space.sm }}>
            {todayAct.pomodoros}<Txt variant="heading" muted>/{goal}</Txt>
          </Txt>
          <Txt variant="small" muted>{todayAct.pomodoros >= goal ? 'journée validée' : 'sessions aujourd\'hui'}</Txt>
        </Card>
      </View>

      {/* Semaine */}
      <Card style={{ marginTop: space.md }}>
        <View style={styles.cardHead}>
          <Txt variant="bodyStrong">7 derniers jours</Txt>
          <Txt variant="caption" muted>{formatDuration(weekFocus)} de focus</Txt>
        </View>
        <View style={styles.chart}>
          {week.map(d => {
            const ok = d.pomodoros >= goal;
            return (
              <View key={d.date} style={styles.chartCol}>
                <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
                  <View style={[styles.bar, { height: `${Math.max(d.focusMin ? 4 : 0, (d.focusMin / maxMin) * 100)}%`, backgroundColor: ok ? t.success : t.accent }]} />
                </View>
                <Txt variant="small" color={d.date === today ? t.accent : t.textFaint} style={{ marginTop: 6, fontWeight: '600' }}>
                  {DAY_LETTERS[parseYmd(d.date).getDay()]}
                </Txt>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Totaux */}
      <View style={styles.tiles}>
        {[
          ['clock', formatDuration(totals.focusMin), 'de focus au total'],
          ['check-circle', totals.tasks + totals.slots, 'tâches et sessions'],
        ].map(([icon, value, label]) => (
          <Card key={label} style={styles.tile}>
            <Icon name={icon} size={18} color={t.textFaint} />
            <Txt variant="title" style={{ marginTop: space.sm }}>{value}</Txt>
            <Txt variant="small" muted>{label}</Txt>
          </Card>
        ))}
      </View>

      {/* Badges */}
      <Txt variant="overline" muted style={styles.section}>Badges</Txt>
      <Card padded={false}>
        {GROUPS.map((g, i) => {
          const v = g.get(totals, streak);
          const reached = g.targets.filter(x => v >= x);
          const next = g.targets.find(x => v < x);
          const prev = reached.length ? reached[reached.length - 1] : 0;
          const progress = next ? (v - prev) / (next - prev) : 1;
          const unlocked = reached.length > 0;
          return (
            <View key={g.key}>
              {i > 0 ? <Divider inset={68} /> : null}
              <Pressable onPress={() => setGroup(g)} style={({ pressed }) => [styles.badgeRow, pressed && { opacity: 0.7 }]}>
                <View style={[styles.badgeIcon, { backgroundColor: unlocked ? t.accentSoft : t.surfaceAlt }]}>
                  <Icon name={g.icon} size={18} color={unlocked ? t.accent : t.textFaint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHead}>
                    <Txt variant="bodyStrong" color={unlocked ? t.text : t.textMuted}>{g.label}</Txt>
                    <Txt variant="caption" muted>{next ? `${v}/${next}${g.unit}` : 'Max'}</Txt>
                  </View>
                  <ProgressBar value={progress} style={{ marginTop: 6 }} color={unlocked ? t.accent : t.textFaint} />
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <Txt variant="small" faint style={{ marginTop: space.md, textAlign: 'center' }}>
        +10 XP par tâche ou session de projet · +10 XP par session de focus · +50 XP par projet terminé
      </Txt>

      <Sheet visible={!!group} onClose={() => setGroup(null)} title={group ? group.label : ''}>
        {group && group.targets.map((target, i) => {
          const e = earned[`${group.key}_${target}`];
          const ok = group.get(totals, streak) >= target;
          return (
            <View key={target}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.tierRow}>
                <Icon name={ok ? 'award' : 'lock'} size={18} color={ok ? t.accent : t.textFaint} />
                <Txt variant="bodyStrong" style={{ flex: 1, marginLeft: space.md }} color={ok ? t.text : t.textMuted}>{target}{group.unit}</Txt>
                <Txt variant="caption" muted>{ok && e ? new Date(e.earnedAt).toLocaleDateString('fr-FR') : ok ? 'Obtenu' : 'À débloquer'}</Txt>
              </View>
            </View>
          );
        })}
      </Sheet>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 60 },
  levelRow: { flexDirection: 'row', alignItems: 'center' },
  levelBadge: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  tile: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chart: { flexDirection: 'row', height: 130, marginTop: space.lg },
  chartCol: { flex: 1, alignItems: 'center' },
  track: { flex: 1, width: 14, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  section: { marginTop: space.xl, marginBottom: space.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  badgeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  tierRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
});

export default AchievementsScreen;
