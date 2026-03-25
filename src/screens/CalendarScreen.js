import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { getTheme } from '../styles/globalStyles';

const CalendarScreen = ({ tasks = [], onSelectDate, isDarkMode = false, onToggle }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const formatLocalYmd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(formatLocalYmd(new Date()));

  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth()+1); setCurrentMonth(d); };
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth()-1); setCurrentMonth(d); };

  const parseYmd = (ymd) => {
    const parts = ymd.split('-');
    return new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10));
  };

  const occursOnDate = (task, ymd) => {
    if (!task) return false;
    if (task.dueDate === ymd) return true;
    const r = task.recurrence;
    if (!r || !r.type || r.type === 'none') return false;
    const d = parseYmd(ymd);
    let start = task.dueDate ? parseYmd(task.dueDate) : null;
    if (!start && task.createdAt) start = parseYmd(task.createdAt.slice(0,10));
    if (start && d < start) return false;
    if (r.type === 'daily') return true;
    if (r.type === 'weekly') {
      const dow = (d.getDay() + 6) % 7;
      return Array.isArray(r.days) && r.days.includes(dow);
    }
    return false;
  };

  const getTasksForDate = (ymd) => (tasks || []).filter(t => occursOnDate(t, ymd));
  const selectedTasks = getTasksForDate(selectedDate);

  const getTimeForTask = (t) => {
    if (!t) return '';
    if (t.startTime || t.endTime) {
      if (t.startTime && t.endTime) return `${t.startTime} - ${t.endTime}`;
      return t.startTime || t.endTime || '';
    }
    if (t.recurrence && t.recurrence.time) return t.recurrence.time;
    return '';
  };

  const buildMonthMatrix = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const matrix = [];
    let week = [];
    for (let i = 0; i < startDay; i++) {
      const d = new Date(year, month - 1, prevMonthDays - (startDay - 1 - i));
      week.push({ date: d, inMonth: false, ymd: formatLocalYmd(d) });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      week.push({ date: d, inMonth: true, ymd: formatLocalYmd(d) });
      if (week.length === 7) { matrix.push(week); week = []; }
    }
    let nextDay = 1;
    while (week.length > 0 && week.length < 7) {
      const d = new Date(year, month + 1, nextDay++);
      week.push({ date: d, inMonth: false, ymd: formatLocalYmd(d) });
    }
    if (week.length > 0) matrix.push(week);
    return matrix;
  };

  const theme = getTheme(!!isDarkMode);
  const textColor = theme.text;
  const containerStyle = { backgroundColor: theme.background };

  return (
    <ScrollView style={[styles.container, containerStyle]} contentContainerStyle={{ paddingBottom: 80 }}>
      <Text style={[styles.title, {color: textColor}]}>Calendrier v6</Text>

      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={[styles.navBtn, { backgroundColor: theme.card }]}><Text style={[styles.navText, { color: theme.primary }]}>◀</Text></TouchableOpacity>
        <Text style={[styles.monthText, {color: textColor}]}>{currentMonth.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</Text>
        <TouchableOpacity onPress={nextMonth} style={[styles.navBtn, { backgroundColor: theme.card }]}><Text style={[styles.navText, { color: theme.primary }]}>▶</Text></TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {['L','M','M','J','V','S','D'].map((d,i) => <Text key={i} style={[styles.dayName, { color: theme.subText }]}>{d}</Text>)}
      </View>

      <View style={[styles.calendarGrid, {backgroundColor: theme.card}] }>
        {buildMonthMatrix(currentMonth).map((week, i) => (
          <View key={i} style={styles.weekRow}>
            {week.map((day, j) => {
              const count = getTasksForDate(day.ymd).length;
              const isSelected = day.ymd === selectedDate;
              const isToday = day.ymd === new Date().toISOString().slice(0,10);

              return (
                <TouchableOpacity 
                  key={j} 
                  onPress={() => { setSelectedDate(day.ymd); }}
                  style={[
                    styles.dayCell, 
                    !day.inMonth && styles.dayOut, 
                    isSelected && { backgroundColor: theme.primary },
                    !isSelected && isToday && { borderWidth: 1, borderColor: theme.primary },
                    !isSelected && count > 0 && { backgroundColor: theme.taskBg }
                  ]}>
                  <Text style={[
                    styles.dayText, 
                    !day.inMonth && styles.outText,
                    !day.inMonth && { color: theme.subText },
                    isSelected && { color: theme.white, fontWeight:'bold' },
                    !isSelected && { color: theme.text }
                  ]}>{day.date.getDate()}</Text>
                  {count > 0 && <View style={[styles.dot, isSelected && {backgroundColor: theme.white}, { backgroundColor: theme.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.taskPreview}>
        <Text style={[styles.previewTitle, {color: textColor}]}>Tâches du {new Date(selectedDate).toLocaleDateString()}</Text>
        {selectedTasks.length === 0 ? (
          <Text style={[styles.noTaskText, { color: theme.subText }]}>Aucune tâche.</Text>
        ) : (
          selectedTasks.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => { if (onToggle) onToggle(item.id, item.type, item.parentId); }} style={[styles.miniTask, {backgroundColor: theme.card, borderLeftColor: theme.primary}]}>
              <View style={styles.taskRow}>
                <Text style={{color: item.done ? theme.subText : theme.text, textDecorationLine: item.done ? 'line-through' : 'none', flex:1}}>
                  {item.done ? '✅' : '⬜'} {item.text}
                </Text>
                <Text style={[styles.taskTime, { color: theme.subText }]}>{getTimeForTask(item)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {onSelectDate && (
        <View style={styles.confirmRow}>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={() => { if (onSelectDate) onSelectDate(selectedDate); }}>
            <Text style={[styles.confirmText, { color: theme.white }]}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20 },
  navBtn: { padding: 10, borderRadius: 5 },
  navText: { fontSize: 18, fontWeight: 'bold' },
  monthText: { fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  weekHeader: { flexDirection: 'row', marginBottom: 5 },
  dayName: { flex: 1, textAlign: 'center', fontWeight: 'bold' },
  calendarGrid: { borderRadius: 10, padding: 5, elevation: 2 },
  weekRow: { flexDirection: 'row', height: 45 },
  dayCell: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 5 },
  dayOut: { opacity: 0.3 },
  outText: { },
  dayText: { fontSize: 14 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  taskPreview: { marginTop: 20 },
  previewTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  noTaskText: { fontStyle: 'italic' },
  miniTask: { padding: 10, marginBottom: 5, borderRadius: 5, borderLeftWidth: 3 },
  confirmRow: { marginTop: 12, alignItems: 'center', marginBottom: 40 },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 8 },
  confirmText: { fontWeight: 'bold' },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskTime: { marginLeft: 12, fontSize: 12 }
});

export default CalendarScreen;
