import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
import { colors } from '../styles/globalStyles';

const CalendarScreen = ({ tasks, onSelectDate, isDarkMode, onToggle }) => {
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
    // exact dueDate match
    if (task.dueDate === ymd) return true;
    const r = task.recurrence;
    if (!r || !r.type || r.type === 'none') return false;
    const d = parseYmd(ymd);
    // allow recurrence only from the task's dueDate (if provided) or from task creation
    let start = task.dueDate ? parseYmd(task.dueDate) : null;
    if (!start && task.createdAt) start = parseYmd(task.createdAt.slice(0,10));
    // if start defined and date is before start, don't match
    if (start && d < start) return false;
    if (r.type === 'daily') {
      return true; // every day from start
    }
    if (r.type === 'weekly') {
      // day index: 0=Mon .. 6=Sun in our UI mapping
      const dow = (d.getDay() + 6) % 7;
      return Array.isArray(r.days) && r.days.includes(dow);
    }
    return false;
  };

  const getTasksForDate = (ymd) => tasks.filter(t => occursOnDate(t, ymd));
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

  // Styles dynamiques
  const textColor = isDarkMode ? '#fff' : colors.text;
  const containerStyle = { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' };

  return (
    // AJOUT DU SCROLLVIEW ICI POUR PERMETTRE L'INTERACTION
    <ScrollView style={[styles.container, containerStyle]} contentContainerStyle={{ paddingBottom: 80 }}>
      <Text style={[styles.title, {color: textColor}]}>Calendrier</Text>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navText}>◀</Text></TouchableOpacity>
        <Text style={[styles.monthText, {color: textColor}]}>{currentMonth.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navText}>▶</Text></TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {['L','M','M','J','V','S','D'].map((d,i) => <Text key={i} style={styles.dayName}>{d}</Text>)}
      </View>

      <View style={[styles.calendarGrid, {backgroundColor: isDarkMode ? '#333' : '#fff'}]}>
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
                    isSelected && styles.selectedDay,
                    !isSelected && isToday && styles.today,
                    !isSelected && count > 0 && styles.hasTask
                  ]}>
                  <Text style={[
                    styles.dayText, 
                    !day.inMonth && styles.outText,
                    isSelected && { color: '#fff', fontWeight:'bold' },
                    !isSelected && { color: isDarkMode ? '#fff' : '#333' }
                  ]}>{day.date.getDate()}</Text>
                  {count > 0 && <View style={[styles.dot, isSelected && {backgroundColor:'#fff'}]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.taskPreview}>
        <Text style={[styles.previewTitle, {color: textColor}]}>Tâches du {new Date(selectedDate).toLocaleDateString()}</Text>
        {selectedTasks.length === 0 ? (
          <Text style={styles.noTaskText}>Aucune tâche.</Text>
        ) : (
          selectedTasks.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => { if (onToggle) onToggle(item.id, item.type, item.parentId); }} style={[styles.miniTask, {backgroundColor: isDarkMode ? '#333' : '#fff'}]}>
              <View style={styles.taskRow}>
                <Text style={{color: item.done ? '#aaa' : (isDarkMode ? '#fff' : '#333'), textDecorationLine: item.done ? 'line-through' : 'none', flex:1}}>
                  {item.done ? '✅' : '⬜'} {item.text}
                </Text>
                <Text style={styles.taskTime}>{getTimeForTask(item)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.confirmRow}>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => { if (onSelectDate) onSelectDate(selectedDate); }}>
          <Text style={styles.confirmText}>Confirmer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20 },
  navBtn: { padding: 10, backgroundColor: '#eee', borderRadius: 5 },
  navText: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  monthText: { fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  weekHeader: { flexDirection: 'row', marginBottom: 5 },
  dayName: { flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#888' },
  calendarGrid: { borderRadius: 10, padding: 5, elevation: 2 },
  weekRow: { flexDirection: 'row', height: 45 },
  dayCell: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 5 },
  dayOut: { opacity: 0.3 },
  outText: { color: '#999' },
  today: { borderWidth: 1, borderColor: colors.primary },
  selectedDay: { backgroundColor: colors.primary },
  hasTask: { backgroundColor: '#e3f2fd' },
  dayText: { fontSize: 14 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 2 },
  taskPreview: { marginTop: 20 },
  previewTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  noTaskText: { fontStyle: 'italic', color: '#999' },
  miniTask: { padding: 10, marginBottom: 5, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: colors.primary }
  ,
  confirmRow: { marginTop: 12, alignItems: 'center', marginBottom: 40 },
  confirmBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 8 },
  confirmText: { color: '#fff', fontWeight: 'bold' },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskTime: { marginLeft: 12, color: '#666', fontSize: 12 }
});

export default CalendarScreen;