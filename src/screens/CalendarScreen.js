import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, space } from '../styles/globalStyles';
import { Txt, IconButton, Card, Check, Divider, Button, Icon } from '../components/ui';
import { todayYmd, buildMonthMatrix, formatDayLabel } from '../logic/dates';
import { getFixedForDay, sortByTime } from '../logic/tasks';

const CalendarScreen = ({ tasks = [], onToggle, onOpenDay }) => {
  const t = useTheme();
  const today = todayYmd();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(today);

  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const matrix = useMemo(() => buildMonthMatrix(month), [month]);

  const deadlines = useMemo(() => {
    const map = {};
    tasks.filter(p => p.type === 'PROJECT' && !p.done && p.deadline && !p.quick).forEach(p => {
      (map[p.deadline] = map[p.deadline] || []).push(p);
    });
    return map;
  }, [tasks]);

  const counts = useMemo(() => {
    const map = {};
    matrix.flat().forEach(d => {
      const items = getFixedForDay(tasks, d.ymd);
      map[d.ymd] = { n: items.length, done: items.filter(i => i.done).length };
    });
    return map;
  }, [tasks, matrix]);

  const items = useMemo(() => getFixedForDay(tasks, selected).sort(sortByTime), [tasks, selected]);
  const dayDeadlines = deadlines[selected] || [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Txt variant="display">Agenda</Txt>

      <View style={styles.monthRow}>
        <Pressable onPress={() => { setMonth(new Date()); setSelected(today); }}>
          <Txt variant="heading" style={{ textTransform: 'capitalize' }}>
            {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <IconButton name="chevron-left" onPress={() => shift(-1)} />
          <IconButton name="chevron-right" onPress={() => shift(1)} />
        </View>
      </View>

      <Card style={{ paddingHorizontal: space.sm }}>
        <View style={styles.week}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Txt key={i} variant="small" faint style={styles.dayName}>{d}</Txt>)}
        </View>
        {matrix.map((week, i) => (
          <View key={i} style={styles.week}>
            {week.map(day => {
              const c = counts[day.ymd] || { n: 0, done: 0 };
              const sel = day.ymd === selected;
              const isT = day.ymd === today;
              const allDone = c.n > 0 && c.done === c.n;
              return (
                <Pressable key={day.ymd} onPress={() => setSelected(day.ymd)} onLongPress={() => onOpenDay(day.ymd)} style={styles.cell}>
                  <View style={[styles.circle, sel && { backgroundColor: t.accent }]}>
                    <Txt
                      color={sel ? t.onAccent : isT ? t.accent : day.inMonth ? t.text : t.textFaint}
                      style={{ fontWeight: sel || isT ? '700' : '400' }}
                    >
                      {day.date.getDate()}
                    </Txt>
                  </View>
                  <View style={styles.dots}>
                    {c.n > 0 ? <View style={[styles.dot, { backgroundColor: allDone ? t.success : t.textFaint }]} /> : null}
                    {deadlines[day.ymd] ? <View style={[styles.dot, { backgroundColor: t.danger }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <View style={styles.dayHeader}>
        <Txt variant="heading" style={{ textTransform: 'capitalize' }}>{formatDayLabel(selected, today)}</Txt>
        <Button title="Voir la journée" variant="ghost" size="sm" onPress={() => onOpenDay(selected)} />
      </View>

      {dayDeadlines.length === 0 && items.length === 0 ? (
        <Txt muted>Rien de prévu ce jour-là.</Txt>
      ) : (
        <Card padded={false}>
          {dayDeadlines.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <View style={styles.row}>
                <Icon name="flag" size={18} color={t.danger} />
                <Txt style={{ flex: 1, marginLeft: space.md }} numberOfLines={1}>Deadline · {p.text}</Txt>
              </View>
            </View>
          ))}
          {items.map((item, i) => (
            <View key={item.id}>
              {i > 0 || dayDeadlines.length ? <Divider inset={space.lg} /> : null}
              <View style={styles.row}>
                <Check checked={item.done} onPress={() => onToggle(item)} size={22} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Txt color={item.done ? t.textFaint : t.text} style={item.done && { textDecorationLine: 'line-through' }} numberOfLines={1}>
                    {item.text}
                  </Txt>
                  {item.location ? <Txt variant="small" muted numberOfLines={1}>{item.location}</Txt> : null}
                </View>
                <Txt variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                  {item.startTime ? `${item.startTime}–${item.endTime || ''}` : 'Journée'}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 60 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, marginBottom: space.sm },
  week: { flexDirection: 'row' },
  dayName: { flex: 1, textAlign: 'center', marginBottom: space.xs },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: space.lg },
});

export default CalendarScreen;
