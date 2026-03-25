import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getTheme } from '../styles/globalStyles';

const DatePickerModal = ({ onClose, onSelectDate, isDarkMode }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth()+1); setCurrentMonth(d); };
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth()-1); setCurrentMonth(d); };

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
      week.push({ date: d, inMonth: false, ymd: d.toISOString().slice(0,10) });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      week.push({ date: d, inMonth: true, ymd: d.toISOString().slice(0,10) });
      if (week.length === 7) { matrix.push(week); week = []; }
    }
    let nextDay = 1;
    while (week.length > 0 && week.length < 7) {
      const d = new Date(year, month + 1, nextDay++);
      week.push({ date: d, inMonth: false, ymd: d.toISOString().slice(0,10) });
    }
    if (week.length > 0) matrix.push(week);
    return matrix;
  };

  const theme = getTheme(!!isDarkMode);
  const textColor = theme.text;
  const bgColor = theme.card;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={[styles.title, {color: textColor}]}>Choisir une date</Text>
      
      {/* Header Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={[styles.navText, { color: theme.subText }]}>◀</Text></TouchableOpacity>
        <Text style={[styles.monthText, { color: textColor }]}>
            {currentMonth.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={[styles.navText, { color: theme.subText }]}>▶</Text></TouchableOpacity>
      </View>

      {/* Jours Semaine */}
      <View style={styles.weekHeader}>
        {['L','M','M','J','V','S','D'].map((d,i) => <Text key={i} style={[styles.dayName, { color: theme.subText }]}>{d}</Text>)}
      </View>

      {/* Grille */}
      <View>
        {buildMonthMatrix(currentMonth).map((week, i) => (
          <View key={i} style={styles.weekRow}>
            {week.map((day, j) => (
              <TouchableOpacity 
                key={j} 
                onPress={() => {
                   if(day.inMonth) {
                       onSelectDate(day.ymd);
                       onClose(); // Ferme le calendrier
                   }
                }}
                style={[
                  styles.dayCell, 
                  !day.inMonth && styles.dayOut,
                  day.ymd === new Date().toISOString().slice(0,10) && styles.today
                ]}>
                <Text style={[
                  styles.dayText, 
                  { color: !day.inMonth ? theme.subText : textColor },
                  day.ymd === new Date().toISOString().slice(0,10) && { color: theme.primary, fontWeight:'bold' }
                ]}>
                    {day.date.getDate()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
        <Text style={{color: theme.danger}}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' }, // Prend toute la largeur disponible
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  navBtn: { padding: 10 },
  navText: { fontSize: 18 },
  monthText: { fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  weekHeader: { flexDirection: 'row', marginBottom: 5 },
  dayName: { flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 12 },
  weekRow: { flexDirection: 'row', height: 40 },
  dayCell: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 14 },
  dayOut: { opacity: 0.3 },
  today: { borderWidth: 1, borderRadius: 20 },
  cancelBtn: { marginTop: 15, alignItems: 'center', padding: 10 }
});

export default DatePickerModal;