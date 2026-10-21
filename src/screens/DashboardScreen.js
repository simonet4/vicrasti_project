import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { organizeDay, getNowAndNext } from '../logic/planner';
import { getOverdue, getActiveProjects, projectInfo, getFixedForDay } from '../logic/tasks';
import {
  todayYmd, addDays, formatDayLabel, formatShortDate, timeToMinutes, nowMinutes, formatDuration, formatHours,
  parseYmd, weekdayIndex,
} from '../logic/dates';
import { useTheme, space, radius } from '../styles/globalStyles';
import {
  Txt, Icon, IconButton, Button, Card, Check, Divider, ProgressBar, SectionHeader, EmptyState, ActionSheet,
} from '../components/ui';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TodayScreen = ({
  todos, settings, streak, todayActivity, focusTaskId, selectedDate, onChangeDate,
  onAdd, onOpenSettings, onOpenFocus, onToggle, onDelete, onEdit, onStartFocus, onReschedule, onToggleStep,
}) => {
  const t = useTheme();
  const [showOverdue, setShowOverdue] = useState(false);
  const [menu, setMenu] = useState(null);
  const [minute, setMinute] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setMinute(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const today = todayYmd();
  const isToday = selectedDate === today;
  const plannerOpts = { dayStart: settings.dayStart, dayEnd: settings.dayEnd, maxProjectHoursPerDay: settings.maxProjectHoursPerDay };

  const { schedule, issues } = useMemo(
    () => organizeDay(todos, selectedDate, plannerOpts),
    [todos, selectedDate, settings.dayStart, settings.dayEnd, settings.maxProjectHoursPerDay, isToday ? Math.floor(minute / 60000 / 30) : 0],
  );
  const lateNames = issues.filter(i => i.kind === 'late').map(i => i.project.text);
  const overflow = issues.filter(i => i.kind === 'overflow');
  const overdue = useMemo(() => getOverdue(todos, today), [todos, today]);
  const projects = useMemo(() => getActiveProjects(todos).filter(p => !p.quick), [todos]);
  const { current, next } = isToday ? getNowAndNext(schedule) : { current: null, next: null };

  const weekStart = addDays(selectedDate, -weekdayIndex(selectedDate));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const busyDays = useMemo(() => new Set(week.filter(d => getFixedForDay(todos, d).length)), [todos, weekStart]);

  const doneCount = schedule.filter(i => i.done).length;
  const total = schedule.length;
  const nm = nowMinutes();
  const sessions = (todayActivity && todayActivity.pomodoros) || 0;
  const goal = settings.dailyGoal || 4;

  const openMenu = (item) => {
    if (item.type === 'AUTO') {
      const pendingSlots = (item.slots || [item]).filter(s => !s.done);
      setMenu({
        title: item.text,
        subtitle: `${item.quick ? 'Tâche rapide' : 'Projet'} · ${item.startTime}–${item.endTime}`,
        actions: [
          pendingSlots.length > 1 ? { label: `Valider les ${pendingSlots.length} sessions`, icon: 'check-circle', onPress: () => pendingSlots.forEach(s => onToggle(s)) } : null,
          { label: item.quick ? 'Modifier la tâche' : 'Modifier le projet', icon: 'edit-2', onPress: () => item.project && onEdit(item.project) },
          { label: item.quick ? 'Supprimer la tâche' : 'Supprimer le projet', icon: 'trash-2', destructive: true, onPress: () => onDelete(item, 'all') },
        ],
      });
      return;
    }
    const actions = [{ label: 'Modifier', icon: 'edit-2', onPress: () => onEdit(item.task) }];
    if (item.recurring) {
      actions.push({ label: 'Supprimer cette occurrence', icon: 'x', onPress: () => onDelete(item, 'occurrence') });
      actions.push({ label: 'Supprimer la série', icon: 'trash-2', destructive: true, onPress: () => onDelete(item, 'all') });
    } else {
      if (!item.done) actions.push({ label: 'Reporter à demain', icon: 'corner-down-right', onPress: () => onReschedule(item.task, addDays(selectedDate < today ? today : selectedDate, 1)) });
      actions.push({ label: 'Supprimer', icon: 'trash-2', destructive: true, onPress: () => onDelete(item, 'all') });
    }
    setMenu({
      title: item.text,
      subtitle: [item.startTime && `${item.startTime}–${item.endTime || ''}`, item.location].filter(Boolean).join(' · '),
      actions,
    });
  };

  // ── Carte « Maintenant » ──
  const renderNow = () => {
    let item = current || next;
    let label = current ? 'Maintenant' : null;
    if (!current && next) {
      const delta = timeToMinutes(next.startTime) - nm;
      label = delta <= 90 ? `Ensuite · dans ${formatDuration(delta)}` : `Ensuite · ${next.startTime}`;
    }
    if (!item && overdue.length) {
      const o = overdue[0];
      item = { id: o.id, type: 'FIXED', text: o.text, task: o, date: o.dueDate, overdue: true };
      label = `À rattraper · ${formatShortDate(o.dueDate)}`;
    }
    if (!item) {
      const allDone = total > 0;
      return (
        <Card style={styles.nowCard}>
          <Txt variant="overline" color={allDone ? t.success : t.textMuted}>{allDone ? 'Journée bouclée' : 'Journée libre'}</Txt>
          <Txt variant="title" style={{ marginTop: 6 }}>{allDone ? 'Tout est fait.' : 'Rien de prévu pour l\'instant.'}</Txt>
          <Txt muted style={{ marginTop: 4 }}>
            {allDone ? 'Repose-toi, ou avance un projet en bonus.' : 'Ajoute une tâche : l\'app lui trouve un créneau.'}
          </Txt>
          <View style={styles.nowActions}>
            <Button title="Session libre" icon="target" variant="secondary" onPress={() => onOpenFocus()} style={{ flex: 1 }} />
            <Button title="Ajouter" icon="plus" variant="soft" onPress={() => onAdd(selectedDate)} style={{ flex: 1 }} />
          </View>
        </Card>
      );
    }
    const step = item.type === 'AUTO' && item.project ? projectInfo(item.project, today).nextStep : null;
    const running = focusTaskId && focusTaskId === item.id;
    return (
      <Card style={styles.nowCard}>
        <Txt variant="overline" color={item.overdue ? t.warning : t.accent}>{label}</Txt>
        <Txt variant="title" style={{ marginTop: 6 }} numberOfLines={2}>{item.text}</Txt>
        {item.startTime ? (
          <Txt variant="caption" muted style={{ marginTop: 2 }}>
            {item.startTime} – {item.endTime}{item.location ? ` · ${item.location}` : ''}
          </Txt>
        ) : null}
        {step ? (
          <Pressable onPress={() => onToggleStep(item.parentProjectId, step.id)} style={[styles.stepBox, { backgroundColor: t.surfaceAlt }]}>
            <Check checked={false} size={20} onPress={() => onToggleStep(item.parentProjectId, step.id)} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Txt variant="small" muted>Prochaine étape</Txt>
              <Txt variant="bodyStrong" numberOfLines={2}>{step.text}</Txt>
            </View>
          </Pressable>
        ) : null}
        <View style={styles.nowActions}>
          <Button
            title={running ? 'En cours' : 'Commencer'}
            icon={running ? 'activity' : 'play'}
            onPress={() => (running ? onOpenFocus() : onStartFocus(item, settings.workMin))}
            style={{ flex: 1.4 }}
          />
          <Button title="5 min" icon="clock" variant="secondary" onPress={() => onStartFocus(item, 5)} style={{ flex: 1 }} />
          <IconButton name="check" diameter={46} bg={t.successSoft} color={t.success}
            onPress={() => onToggle(item.overdue ? { ...item, date: item.date } : item)} />
        </View>
      </Card>
    );
  };

  // ── Lignes du planning ──
  const rows = [];
  let nowShown = !isToday;
  const nowLine = (
    <View key="now" style={styles.nowLine}>
      <View style={[styles.nowDot, { backgroundColor: t.danger }]} />
      <View style={[styles.nowBar, { backgroundColor: t.danger }]} />
    </View>
  );
  // Les sessions consécutives d'un même projet forment un seul bloc
  const blocks = [];
  schedule.forEach(item => {
    const last = blocks[blocks.length - 1];
    if (item.type === 'AUTO' && last && last.type === 'AUTO' && last.parentProjectId === item.parentProjectId && last.endTime === item.startTime) {
      last.slots.push(item);
      last.endTime = item.endTime;
      last.done = last.slots.every(s => s.done);
      return;
    }
    blocks.push(item.type === 'AUTO' ? { ...item, slots: [item] } : item);
  });

  // Session à cibler dans un bloc : celle en cours, sinon la première non faite
  const targetSlot = (block) => {
    if (!block.slots) return block;
    return block.slots.find(s => current && s.id === current.id) || block.slots.find(s => !s.done) || block.slots[block.slots.length - 1];
  };
  const toggleBlock = (block) => {
    if (!block.slots) { onToggle(block); return; }
    const pending = block.slots.find(s => !s.done);
    onToggle(pending || [...block.slots].reverse().find(s => s.done));
  };

  blocks.forEach((item, idx) => {
    if (!nowShown && item.startTime && timeToMinutes(item.startTime) > nm) {
      nowShown = true;
      rows.push(nowLine);
    } else if (idx > 0) {
      rows.push(<Divider key={`d-${item.id}`} inset={74} />);
    }
    const isAuto = item.type === 'AUTO';
    const isPast = isToday && item.endTime && timeToMinutes(item.endTime) <= nm && !item.done;
    const isCurrent = current && (item.slots ? item.slots.some(s => s.id === current.id) : current.id === item.id);
    const marker = isAuto ? (item.quick ? t.warning : t.accent) : t.textFaint;
    const step = isAuto && item.project && !item.done ? projectInfo(item.project, today).nextStep : null;
    let sub = '';
    if (isAuto) {
      const n = item.slots.length;
      const doneN = item.slots.filter(s => s.done).length;
      const progress = n > 1 ? `${doneN}/${n} sessions` : (item.quick ? 'Tâche rapide' : 'Projet');
      sub = [progress, step && step.text].filter(Boolean).join(' · ');
    } else sub = [item.recurring && 'Récurrent', item.location, item.teacher].filter(Boolean).join(' · ');

    rows.push(
      <Pressable
        key={item.id}
        onPress={() => openMenu(item)}
        style={({ pressed }) => [styles.row, isCurrent && { backgroundColor: t.accentSoft }, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.timeCol}>
          <Txt variant="caption" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }} color={item.done ? t.textFaint : t.text}>
            {item.startTime || 'Jour'}
          </Txt>
          {item.endTime ? <Txt variant="small" faint style={{ fontVariant: ['tabular-nums'] }}>{item.endTime}</Txt> : null}
        </View>
        <View style={[styles.marker, { backgroundColor: marker, opacity: item.done ? 0.35 : 1 }]} />
        <View style={styles.rowBody}>
          <Txt
            variant="bodyStrong"
            numberOfLines={2}
            color={item.done ? t.textFaint : t.text}
            style={item.done && { textDecorationLine: 'line-through' }}
          >
            {item.text}
          </Txt>
          {isPast ? <Txt variant="small" color={t.warning}>Passé — coche-le si c'est fait</Txt>
            : sub ? <Txt variant="small" muted numberOfLines={1}>{sub}</Txt> : null}
        </View>
        {isToday && !item.done ? (
          <IconButton name="play" size={14} diameter={32} bg={t.accentSoft} color={t.accent}
            onPress={() => onStartFocus(targetSlot(item), settings.workMin)} style={{ marginRight: space.sm }} />
        ) : null}
        <Check checked={item.done} onPress={() => toggleBlock(item)} />
      </Pressable>,
    );
  });
  if (!nowShown && blocks.length) rows.push(nowLine);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Txt variant="overline" muted>
              {parseYmd(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Txt>
            <Txt variant="display" style={{ textTransform: 'capitalize' }}>{formatDayLabel(selectedDate, today)}</Txt>
          </View>
          <IconButton name="settings" onPress={onOpenSettings} bg={t.surface} />
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Icon name="zap" size={14} color={streak.current ? t.accent : t.textFaint} />
            <Txt variant="caption" muted style={styles.statText}>{streak.current} j{!streak.todayDone && streak.current ? ' · à valider' : ''}</Txt>
          </View>
          <View style={styles.stat}>
            <Icon name="target" size={14} color={sessions >= goal ? t.success : t.textFaint} />
            <Txt variant="caption" muted style={styles.statText}>{sessions}/{goal} sessions</Txt>
          </View>
          {total > 0 ? (
            <View style={styles.stat}>
              <Icon name="check-circle" size={14} color={t.textFaint} />
              <Txt variant="caption" muted style={styles.statText}>{doneCount}/{total}</Txt>
            </View>
          ) : null}
        </View>

        {/* Semaine */}
        <View style={styles.weekRow}>
          <IconButton name="chevron-left" size={18} diameter={30} color={t.textMuted} onPress={() => onChangeDate(addDays(selectedDate, -7))} />
          {week.map((d, i) => {
            const sel = d === selectedDate;
            const isT = d === today;
            return (
              <Pressable key={d} onPress={() => onChangeDate(d)} style={styles.weekDay}>
                <Txt variant="small" color={sel ? t.accent : t.textFaint}>{DAY_LETTERS[i]}</Txt>
                <View style={[styles.weekCircle, sel && { backgroundColor: t.accent }]}>
                  <Txt variant="bodyStrong" color={sel ? t.onAccent : isT ? t.accent : t.text}>{parseYmd(d).getDate()}</Txt>
                </View>
                <View style={[styles.weekDot, { backgroundColor: busyDays.has(d) && !sel ? t.textFaint : 'transparent' }]} />
              </Pressable>
            );
          })}
          <IconButton name="chevron-right" size={18} diameter={30} color={t.textMuted} onPress={() => onChangeDate(addDays(selectedDate, 7))} />
        </View>
        {!isToday ? (
          <Button title="Revenir à aujourd'hui" variant="ghost" size="sm" onPress={() => onChangeDate(today)} style={{ alignSelf: 'center' }} />
        ) : null}

        {isToday && renderNow()}

        {/* Retards */}
        {isToday && overdue.length > 0 && (
          <Card style={{ marginTop: space.md }} padded={false}>
            <Pressable onPress={() => setShowOverdue(v => !v)} style={styles.overdueHead}>
              <Icon name="alert-circle" size={18} color={t.warning} />
              <Txt variant="bodyStrong" style={{ flex: 1, marginLeft: space.md }}>
                {overdue.length} tâche{overdue.length > 1 ? 's' : ''} en retard
              </Txt>
              <Icon name={showOverdue ? 'chevron-up' : 'chevron-down'} size={18} color={t.textFaint} />
            </Pressable>
            {showOverdue && overdue.map(o => (
              <View key={o.id}>
                <Divider inset={space.lg} />
                <View style={styles.overdueRow}>
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{o.text}</Txt>
                    <Txt variant="small" muted>{formatShortDate(o.dueDate)}{o.startTime ? ` · ${o.startTime}` : ''}</Txt>
                  </View>
                  <IconButton name="corner-down-right" size={16} diameter={34} color={t.accent} onPress={() => onReschedule(o, today)} />
                  <IconButton name="check" size={16} diameter={34} color={t.success} onPress={() => onToggle({ id: o.id, type: 'FIXED', task: o, date: o.dueDate })} />
                  <IconButton name="trash-2" size={16} diameter={34} color={t.textFaint} onPress={() => onDelete({ id: o.id, type: 'FIXED', task: o, text: o.text }, 'all')} />
                </View>
              </View>
            ))}
          </Card>
        )}

        {lateNames.length > 0 && (
          <View style={styles.warning}>
            <Icon name="flag" size={14} color={t.danger} />
            <Txt variant="caption" muted style={{ flex: 1, marginLeft: space.sm }} numberOfLines={2}>
              Deadline dépassée : {lateNames.join(', ')}
            </Txt>
          </View>
        )}
        {overflow.length > 0 && (
          <View style={styles.warning}>
            <Icon name="alert-triangle" size={14} color={t.warning} />
            <Txt variant="caption" muted style={{ flex: 1, marginLeft: space.sm }} numberOfLines={2}>
              Pas assez de temps libre : {overflow.map(o => `${o.project.text} (${formatDuration(o.minutes)})`).join(', ')}
            </Txt>
          </View>
        )}

        {/* Planning */}
        <SectionHeader title="Planning" />
        {schedule.length === 0 ? (
          <Card>
            <EmptyState icon="sun" title="Journée libre" text="Ajoute une tâche ou un projet avec +, je m'occupe de le placer." />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>{rows}</Card>
        )}

        {/* Projets */}
        {projects.length > 0 && (
          <>
            <SectionHeader title="Projets" />
            <Card padded={false}>
              {projects.map((p, i) => {
                const info = projectInfo(p, today);
                const riskColor = { ok: t.textMuted, medium: t.warning, high: t.danger, late: t.danger }[info.risk];
                const riskLabel = info.risk === 'late' ? 'En retard' : info.daysLeft != null ? `J-${info.daysLeft}` : 'Sans deadline';
                return (
                  <View key={p.id}>
                    {i > 0 ? <Divider inset={space.lg} /> : null}
                    <Pressable onPress={() => onEdit(p)} style={({ pressed }) => [styles.project, pressed && { opacity: 0.7 }]}>
                      <View style={styles.projectHead}>
                        <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{p.text}</Txt>
                        <Txt variant="caption" color={riskColor} style={{ fontWeight: '600' }}>{riskLabel}</Txt>
                      </View>
                      <ProgressBar value={info.progress} color={info.risk === 'ok' ? t.accent : riskColor} style={{ marginVertical: space.sm }} />
                      <Txt variant="small" muted>
                        {formatHours(info.remaining)} restantes
                        {info.perDay != null && info.risk !== 'late' ? ` · ${formatHours(info.perDay)} par jour` : ''}
                        {info.stepsTotal ? ` · ${info.stepsDone}/${info.stepsTotal} étapes` : ''}
                      </Txt>
                      {info.nextStep ? (
                        <Pressable onPress={() => onToggleStep(p.id, info.nextStep.id)} style={styles.projectStep}>
                          <Check checked={false} size={18} onPress={() => onToggleStep(p.id, info.nextStep.id)} />
                          <Txt variant="caption" style={{ flex: 1, marginLeft: space.sm }} numberOfLines={1}>{info.nextStep.text}</Txt>
                        </Pressable>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      <Pressable onPress={() => onAdd(selectedDate)} style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="plus" size={26} color={t.onAccent} />
      </Pressable>

      <ActionSheet visible={!!menu} onClose={() => setMenu(null)} {...(menu || {})} />
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statText: { marginLeft: 5 },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, marginBottom: space.xs },
  weekDay: { flex: 1, alignItems: 'center' },
  weekCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  weekDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  nowCard: { marginTop: space.lg },
  nowActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignItems: 'center' },
  stepBox: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md, marginTop: space.md },
  overdueHead: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  overdueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, paddingLeft: space.lg, paddingRight: space.sm },
  warning: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingRight: space.lg },
  timeCol: { width: 58, alignItems: 'center' },
  marker: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: space.md },
  rowBody: { flex: 1, paddingRight: space.sm },
  nowLine: { flexDirection: 'row', alignItems: 'center', paddingLeft: 52 },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowBar: { flex: 1, height: 1.5 },
  project: { padding: space.lg },
  projectHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  projectStep: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  fab: { position: 'absolute', right: space.xl, bottom: space.xl, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});

export default TodayScreen;
