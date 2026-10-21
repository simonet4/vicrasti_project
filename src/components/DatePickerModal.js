import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, space } from '../styles/globalStyles';
import { Sheet, Txt, IconButton, Chip } from './ui';
import { parseYmd, todayYmd, addDays, buildMonthMatrix } from '../logic/dates';

const DatePickerModal = ({ visible, value, onClose, onSelectDate, title = 'Choisir une date', allowClear, onClear }) => {
  const t = useTheme();
  const [month, setMonth] = useState(value ? parseYmd(value) : new Date());
  useEffect(() => { if (visible) setMonth(value ? parseYmd(value) : new Date()); }, [visible, value]);

  const today = todayYmd();
  const pick = (ymd) => { onSelectDate(ymd); onClose(); };
  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.quick}>
        <Chip label="Aujourd'hui" onPress={() => pick(today)} selected={value === today} />
        <Chip label="Demain" onPress={() => pick(addDays(today, 1))} selected={value === addDays(today, 1)} />
        <Chip label="Dans 1 semaine" onPress={() => pick(addDays(today, 7))} selected={value === addDays(today, 7)} />
        {allowClear ? <Chip label="Aucune" onPress={() => { onClear(); onClose(); }} selected={!value} /> : null}
      </View>

      <View style={styles.header}>
        <IconButton name="chevron-left" onPress={() => shift(-1)} />
        <Txt variant="heading" style={{ textTransform: 'capitalize' }}>
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </Txt>
        <IconButton name="chevron-right" onPress={() => shift(1)} />
      </View>

      <View style={styles.week}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Txt key={i} variant="small" faint style={styles.dayName}>{d}</Txt>)}
      </View>
      {buildMonthMatrix(month).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map(day => {
            const selected = day.ymd === value;
            const isToday = day.ymd === today;
            return (
              <Pressable key={day.ymd} onPress={() => pick(day.ymd)} style={styles.cell}>
                <View style={[styles.circle, selected && { backgroundColor: t.accent }]}>
                  <Txt
                    color={selected ? t.onAccent : isToday ? t.accent : day.inMonth ? t.text : t.textFaint}
                    style={{ fontWeight: selected || isToday ? '700' : '400' }}
                  >
                    {day.date.getDate()}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  week: { flexDirection: 'row' },
  dayName: { flex: 1, textAlign: 'center', marginBottom: space.xs },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

export default DatePickerModal;
