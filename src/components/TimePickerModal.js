import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, space, radius } from '../styles/globalStyles';
import { Sheet, Txt, Button } from './ui';

const MINUTES = ['00', '15', '30', '45'];
const HOURS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')).concat(['00', '01', '02', '03', '04', '05']);

const TimePickerModal = ({ visible, value, onClose, onConfirm, title = "Choisir l'heure" }) => {
  const t = useTheme();
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');

  useEffect(() => {
    if (!visible) return;
    const [h, m] = String(value || '08:00').split(':');
    setHour(String(h || '08').padStart(2, '0'));
    const mm = String(m || '00').padStart(2, '0');
    setMinute(MINUTES.includes(mm) ? mm : '00');
  }, [visible, value]);

  const cell = (label, selected, onPress) => (
    <Pressable key={label} onPress={onPress} style={[styles.cell, { backgroundColor: selected ? t.accent : t.surfaceAlt }]}>
      <Txt color={selected ? t.onAccent : t.text} style={{ fontWeight: selected ? '700' : '400', fontVariant: ['tabular-nums'] }}>{label}</Txt>
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button title={`Valider ${hour}:${minute}`} onPress={() => { onConfirm(`${hour}:${minute}`); onClose(); }} />}
    >
      <Txt variant="overline" muted style={styles.label}>Heure</Txt>
      <View style={styles.grid}>{HOURS.map(h => cell(h, hour === h, () => setHour(h)))}</View>
      <Txt variant="overline" muted style={styles.label}>Minutes</Txt>
      <View style={styles.grid}>{MINUTES.map(m => cell(m, minute === m, () => setMinute(m)))}</View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  label: { marginTop: space.sm, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 52, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});

export default TimePickerModal;
