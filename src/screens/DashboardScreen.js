import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { organizeDay } from '../logic/planner';
import { colors } from '../styles/globalStyles';

const DashboardScreen = ({ todos, onAddPress, onOpenSettings, onImportICS, onDelete, onToggle, onEdit, isDarkMode }) => {
  const today = new Date().toISOString().slice(0, 10);
  const { schedule } = organizeDay(todos, today);
  const txtColor = isDarkMode ? '#fff' : '#333';

  return (
    <ScrollView style={[styles.container, isDarkMode && { backgroundColor: '#121212' }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: txtColor }]}>Mon Planning</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ACTIONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onAddPress} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={styles.btnText}>+ Ajouter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onImportICS} style={[styles.btn, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.btnText}>📅 Import ICS</Text>
        </TouchableOpacity>
      </View>

      {/* TIMELINE */}
      <View style={styles.timeline}>
        {schedule?.map((item) => (
          <View key={item.id} style={[
            styles.slot, 
            isDarkMode && { backgroundColor: '#1e1e1e' }, 
            item.type === 'AUTO' ? styles.autoSlot : styles.fixedSlot
          ]}>
            {/* CHECKBOX */}
            <TouchableOpacity style={styles.checkArea} onPress={() => onToggle(item.id, item.type, item.parentProjectId)}>
              <Text style={styles.checkIcon}>{item.done ? '✅' : '⭕'}</Text>
            </TouchableOpacity>

            {/* CONTENU PRINCIPAL */}
            <View style={styles.contentContainer}>
              {/* HEURES */}
              <Text style={styles.timeTag}>{item.startTime} - {item.endTime}</Text>
              
              {/* TITRE DU COURS (Nettoyé) */}
              <Text style={[styles.taskText, { color: txtColor }, item.done && styles.textDone]}>
                {item.text}
              </Text>

              {/* DÉTAILS SPÉCIFIQUES AUX COURS (FIXED) */}
              {item.type === 'FIXED' && (
                <View style={styles.detailsBlock}>
                  {item.location ? <Text style={styles.locationText}>{item.location}</Text> : null}
                  {item.teacher ? <Text style={styles.teacherText}>{item.teacher}</Text> : null}
                  {item.remarks ? <Text style={styles.remarksText}>Note: {item.remarks}</Text> : null}
                </View>
              )}
            </View>

            {/* BOUTONS D'ÉDITION / SUPPRESSION */}
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionBtn}><Text>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item.id, item.type, item.parentProjectId)} style={styles.actionBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  btn: { flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  timeline: { borderLeftWidth: 2, borderLeftColor: '#ddd', marginLeft: 10, paddingLeft: 15 },
  slot: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15, borderRadius: 12, padding: 15, backgroundColor: '#fff', elevation: 3 },
  fixedSlot: { borderLeftWidth: 6, borderLeftColor: colors.danger },
  autoSlot: { borderLeftWidth: 6, borderLeftColor: colors.success, backgroundColor: '#f1f8e9' },
  checkArea: { marginTop: 15, marginRight: 12 },
  checkIcon: { fontSize: 22 },
  contentContainer: { flex: 1 },
  timeTag: { fontSize: 13, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  taskText: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  textDone: { textDecorationLine: 'line-through', color: '#aaa' },
  detailsBlock: { marginTop: 4 },
  locationText: { fontSize: 14, color: '#444', fontWeight: '600' },
  teacherText: { fontSize: 13, color: '#666', fontStyle: 'italic', marginTop: 2 },
  remarksText: { fontSize: 11, color: '#888', marginTop: 4, padding: 4, backgroundColor: '#f9f9f9', borderRadius: 4 },
  actions: { flexDirection: 'row', marginTop: 10 },
  actionBtn: { padding: 8, marginLeft: 5 }
});

export default DashboardScreen;