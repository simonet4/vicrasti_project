import React, { useState, useEffect, useRef } from 'react';
import { 
  SafeAreaView, View, Text, Modal, TextInput, TouchableOpacity, 
  ScrollView, StyleSheet, useWindowDimensions, Alert, Platform, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from './src/components/ErrorBoundary';
import * as DocumentPicker from 'expo-document-picker';
import { globalStyles, getTheme } from './src/styles/globalStyles';

import DashboardScreen from './src/screens/DashboardScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import PomodoroTimer from './src/components/PomodoroTimer';
import SettingsModal from './src/components/SettingsModal';
import { parseICS } from './src/logic/icsImporter';

export default function App() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  
  const [todos, setTodos] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showFocus, setShowFocus] = useState(true);
  const [resetKey, setResetKey] = useState(0); 

  const [taskType, setTaskType] = useState('FIXED');
  const [editingTodo, setEditingTodo] = useState(null);
  const [formData, setFormData] = useState({
    text: '', date: new Date().toISOString().slice(0,10),
    start: '08:00', end: '09:00', totalHours: '10', deadline: new Date().toISOString().slice(0,10),
    recurrence: { type: 'none', time: '08:00', days: [] }
  });
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('date'); // 'date' or 'deadline' or 'recurrence'
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeTarget, setTimeTarget] = useState('start');
  const [pickerHour, setPickerHour] = useState('08');
  const [pickerMinute, setPickerMinute] = useState('00');

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: width, animated: false });
    }, 400); 
    return () => clearTimeout(timer);
  }, [width, resetKey]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@vicrasti_todos');
      const theme = await AsyncStorage.getItem('@vicrasti_theme');
      const focusPref = await AsyncStorage.getItem('@vicrasti_showFocus');
      if (saved) setTodos(JSON.parse(saved));
      if (theme) setIsDarkMode(JSON.parse(theme));
      if (focusPref != null) setShowFocus(JSON.parse(focusPref));
    } catch (e) { console.warn(e); }
  };

  // Helpers: time conversions and overlap/duplicate checks
  const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return null;
    const [h,m] = t.split(':').map(x=>parseInt(x,10));
    return (isNaN(h)||isNaN(m)) ? null : h*60 + m;
  };

  const overlaps = (s1,e1,s2,e2) => {
    if (s1 == null || e1 == null || s2 == null || e2 == null) return false;
    return Math.max(s1,s2) < Math.min(e1,e2);
  };

  const isDuplicateImported = (existingList, imp) => {
    if (!imp) return false;
    // consider FIXED if has dueDate or startTime
    const type = imp.type || (imp.dueDate ? 'FIXED' : 'PROJECT');
    if (type === 'FIXED') {
      return existingList.some(t => t.type === 'FIXED' && t.text === imp.text && t.dueDate === imp.dueDate && t.startTime === imp.startTime);
    }
    // PROJECT duplicates by title
    return existingList.some(t => t.type === 'PROJECT' && t.text === imp.text);
  };

  const saveTodos = async (newTodos) => {
    setTodos(newTodos);
    await AsyncStorage.setItem('@vicrasti_todos', JSON.stringify(newTodos));
  };

  // RÉPARATION IMPORT ICS
  const handleImportICS = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/calendar' });
      if (!result.canceled && result.assets && result.assets[0]) {
        const fileUri = result.assets[0].uri;
        const response = await fetch(fileUri);
        const fileContent = await response.text();
        const imported = parseICS(fileContent) || [];
        if (imported && imported.length > 0) {
          // Filter out duplicates based on same rules as add
          const existing = todos || [];
          const toAdd = [];
          let skipped = 0;
          imported.forEach(imp => {
            // ensure start/end consistency for imported FIXED items
            if ((imp.startTime && imp.endTime) && timeToMinutes(imp.startTime) > timeToMinutes(imp.endTime)) {
              imp.endTime = imp.startTime;
            }
            if (!isDuplicateImported(existing.concat(toAdd), imp)) {
              toAdd.push(imp);
            } else skipped++;
          });
          const updatedTodos = [...existing, ...toAdd];
          await saveTodos(updatedTodos);
          if (Platform.OS !== 'web') Alert.alert("Succès", `${toAdd.length} événements importés.${skipped>0 ? ' ' + skipped + ' doublons ignorés.' : ''}`);
        }
      }
    } catch (e) { 
      console.error("Erreur import:", e);
      if (Platform.OS !== 'web') Alert.alert("Erreur", "Impossible de lire le fichier ICS.");
    }
  };

  // RÉPARATION DU COCHAGE DES TÂCHES
  const handleToggle = (id, type, parentId) => {
    if (type === 'AUTO') {
      // On cherche si ce créneau spécifique (id contient l'heure) est déjà marqué fait
      const isAlreadyDone = todos.find(t => t.id === id);
      
      if (isAlreadyDone) {
        // DÉCOCHER : On supprime le marqueur et on rend 30min au projet
        const newTodos = todos.filter(t => t.id !== id).map(t => {
          if (t.id === parentId) {
            const restoredHours = parseFloat(t.totalHours || 0) + 0.5;
            return { ...t, totalHours: restoredHours.toString(), done: false };
          }
          return t;
        });
        saveTodos(newTodos);
      } else {
        // COCHER : On crée un marqueur "AUTO_DONE" et on déduit 30min
        const slotTask = { id, done: true, type: 'AUTO_DONE', parentId };
        const newTodos = todos.map(t => {
          if (t.id === parentId) {
            const remainingHours = Math.max(0, parseFloat(t.totalHours || 0) - 0.5);
            // Le projet ne disparaît QUE s'il reste 0h
            return { ...t, totalHours: remainingHours.toString(), done: remainingHours <= 0 };
          }
          return t;
        });
        saveTodos([...newTodos, slotTask]);
      }
    } else {
      // Tâches fixes standard
      saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
    }
  };

  const handleSave = () => {
    if (!formData.text) return;
    // Validation: prevent duplicates and overlapping FIXED tasks
    // reuse top-level helpers timeToMinutes and overlaps

    // exclude the task being edited
    const existing = todos.filter(t => !(editingTodo && t.id === editingTodo.id));

    if (taskType === 'FIXED') {
      const ymd = formData.date;
      const sNew = timeToMinutes(formData.start);
      const eNew = timeToMinutes(formData.end);
      // duplicate: same title + same date + same start time
      const dup = existing.find(t => t.type === 'FIXED' && t.text === formData.text && t.dueDate === ymd && t.startTime === formData.start);
      if (dup) { Alert.alert('Doublon', 'Une tâche identique existe déjà à cette date et heure.'); return; }
      // overlap: same date and time interval intersects
      const conflict = existing.find(t => t.type === 'FIXED' && t.dueDate === ymd && overlaps(sNew, eNew, timeToMinutes(t.startTime), timeToMinutes(t.endTime)));
      if (conflict) { Alert.alert('Conflit horaire', `La tâche "${conflict.text}" chevauche l'intervalle horaire choisi.`); return; }
    }

    if (taskType === 'PROJECT') {
      // avoid duplicate project titles
      const dupProj = existing.find(t => t.type === 'PROJECT' && t.text === formData.text);
      if (dupProj) { Alert.alert('Doublon', 'Un projet avec le même titre existe déjà.'); return; }
    }
    // ensure start <= end before saving
    let startVal = formData.start;
    let endVal = formData.end;
    if (taskType === 'FIXED') {
      const s = timeToMinutes(startVal);
      const e = timeToMinutes(endVal);
      if (s != null && e != null && s > e) endVal = startVal;
    }

    const taskData = {
      id: editingTodo ? editingTodo.id : Date.now().toString(),
      text: formData.text, 
      type: taskType, 
      done: editingTodo ? editingTodo.done : false,
      dueDate: taskType === 'FIXED' ? formData.date : null,
      startTime: taskType === 'FIXED' ? startVal : null,
      endTime: taskType === 'FIXED' ? endVal : null,
      recurrence: taskType === 'FIXED' ? formData.recurrence : null,
      totalHours: taskType === 'PROJECT' ? formData.totalHours : 0,
      deadline: taskType === 'PROJECT' ? formData.deadline : null,
    };
    saveTodos(editingTodo ? todos.map(t => t.id === editingTodo.id ? taskData : t) : [taskData, ...todos]);
    setShowAddModal(false);
    setEditingTodo(null);
  };

  const resetData = async () => {
    await AsyncStorage.removeItem('@vicrasti_todos');
    setTodos([]);
    setResetKey(k => k + 1);
  };

  // Add tasks returned by AI assistant (expected array of task objects)
  const handleAddTasksFromAI = async (newTasks) => {
    if (!Array.isArray(newTasks) || newTasks.length === 0) return;
    try {
      // Normalize and assign ids where needed
      const normalized = newTasks.map(t => {
        const id = t.id ? String(t.id) : Date.now().toString() + Math.random().toString(36).slice(2,8);
        return {
          id,
          text: t.text || 'Nouvelle tâche',
          type: t.type || 'FIXED',
          done: !!t.done,
          dueDate: t.dueDate || (t.type === 'FIXED' ? new Date().toISOString().slice(0,10) : null),
          startTime: t.startTime || null,
          endTime: t.endTime || null,
          recurrence: t.recurrence || null,
          totalHours: t.totalHours !== undefined ? String(t.totalHours) : (t.type === 'PROJECT' ? '1' : 0),
          deadline: t.deadline || null
        };
      });
      const updated = [...normalized, ...todos];
      await saveTodos(updated);
      Alert.alert('Tâches ajoutées', `${normalized.length} tâche(s) ajoutée(s).`);
    } catch (e) {
      console.warn('handleAddTasksFromAI', e);
      Alert.alert('Erreur', 'Impossible d\'ajouter les tâches générées.');
    }
  };

  const theme = getTheme(!!isDarkMode);

  return (
    <SafeAreaView key={resetKey} style={{flex: 1, backgroundColor: theme.background}}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={{ padding: 10, backgroundColor: theme.header, borderBottomWidth: 1, borderColor: theme.border || '#eee' }}>
        {showFocus && <PomodoroTimer isDarkMode={isDarkMode} />}
      </View>

      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          <View style={{ width }}>
          <CalendarScreen tasks={todos} isDarkMode={isDarkMode} onToggle={handleToggle} />
        </View>
        
        <View style={{ width }}>
          <DashboardScreen 
            todos={todos} 
            onAddPress={() => { setEditingTodo(null); setFormData({ text: '', date: new Date().toISOString().slice(0,10), start:'08:00', end:'09:00', totalHours:'10', deadline: new Date().toISOString().slice(0,10), recurrence: { type: 'none', time: '08:00', days: [] } }); setShowAddModal(true); }} 
            onOpenSettings={() => setShowSettings(true)}
            onImportICS={handleImportICS}
            onToggle={handleToggle}
            onDelete={(id, type, pId) => saveTodos(todos.filter(t => t.id !== (type === 'AUTO' ? pId : id)))}
            onEdit={(t) => { setEditingTodo(t); setTaskType(t.type); setFormData({ text: t.text || '', date: t.dueDate || new Date().toISOString().slice(0,10), start: t.startTime || '08:00', end: t.endTime || '09:00', totalHours: t.totalHours ? String(t.totalHours) : '10', deadline: t.deadline || new Date().toISOString().slice(0,10), recurrence: t.recurrence || { type:'none', time:'08:00', days:[] } }); setShowAddModal(true); }}
            isDarkMode={isDarkMode}
          />
        </View>

        <View style={{ width }}>
          <AchievementsScreen 
            todos={todos} 
            stats={{ completed: todos.filter(t => t.done).length }} 
            isDarkMode={isDarkMode}
          />
        </View>
      </ScrollView>

      <SettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
        onResetData={resetData} 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        showFocus={showFocus}
        setShowFocus={(v) => { setShowFocus(v); AsyncStorage.setItem('@vicrasti_showFocus', JSON.stringify(v)); }}
        onAddTasks={handleAddTasksFromAI}
      />

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={[globalStyles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <ScrollView contentContainerStyle={[globalStyles.modalContent, { backgroundColor: theme.modalContent }]}>
            <Text style={globalStyles.title}>{editingTodo ? "Modifier" : "Ajouter"}</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity onPress={()=>setTaskType('FIXED')} style={[styles.tab, taskType==='FIXED' && styles.activeTab]}><Text style={{color: taskType==='FIXED' ? '#fff' : '#000'}}>FIXE</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setTaskType('PROJECT')} style={[styles.tab, taskType==='PROJECT' && styles.activeTab]}><Text style={{color: taskType==='PROJECT' ? '#fff' : '#000'}}>PROJET</Text></TouchableOpacity>
            </View>
            <TextInput style={globalStyles.input} placeholder="Titre" value={formData.text} onChangeText={t => setFormData({...formData, text: t})} />
            {taskType === 'FIXED' ? (
              <>
                <TouchableOpacity style={[globalStyles.input, {justifyContent:'center'}]} onPress={() => { setCalendarTarget('date'); setShowCalendarPicker(true); }}>
                  <Text>{formData.date || 'Choisir la date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[globalStyles.input, {justifyContent:'center'}]} onPress={() => { const [h,m]= (formData.start||'08:00').split(':'); setPickerHour(h); setPickerMinute(m); setTimeTarget('start'); setShowTimePicker(true); }}>
                  <Text>{formData.start || 'Heure de début'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[globalStyles.input, {justifyContent:'center'}]} onPress={() => { const [h,m]= (formData.end||'09:00').split(':'); setPickerHour(h); setPickerMinute(m); setTimeTarget('end'); setShowTimePicker(true); }}>
                  <Text>{formData.end || 'Heure de fin'}</Text>
                </TouchableOpacity>
                <View style={{marginTop:8}}>
                  <Text style={{fontWeight:'700', marginBottom:6}}>Récurrence</Text>
                  <View style={{flexDirection:'row', marginBottom:8}}>
                    {['none','daily','weekly'].map(rt => (
                      <TouchableOpacity key={rt} onPress={() => setFormData({...formData, recurrence: {...formData.recurrence, type: rt}})} style={[styles.recButton, formData.recurrence.type===rt && styles.recActive]}>
                        <Text style={{color: formData.recurrence.type===rt ? '#fff' : '#000', textTransform:'capitalize'}}>{rt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {formData.recurrence.type === 'daily' && (
                          <TouchableOpacity style={[globalStyles.input, {justifyContent:'center'}]} onPress={() => { const [h,m]= (formData.recurrence.time||'08:00').split(':'); setPickerHour(h); setPickerMinute(m); setTimeTarget('recurrence'); setShowTimePicker(true); }}>
                            <Text>{formData.recurrence.time || 'Heure'}</Text>
                          </TouchableOpacity>
                  )}
                  {formData.recurrence.type === 'weekly' && (
                    <>
                      <Text style={{marginBottom:6}}>Choisir les jours</Text>
                      <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, idx) => {
                          const selected = formData.recurrence.days.includes(idx);
                          return (
                            <TouchableOpacity key={d} onPress={() => {
                              const days = formData.recurrence.days.includes(idx) ? formData.recurrence.days.filter(x=>x!==idx) : [...formData.recurrence.days, idx];
                              setFormData({...formData, recurrence: {...formData.recurrence, days}});
                            }} style={[styles.dayChip, selected && styles.dayChipActive]}>
                              <Text style={{color: selected ? '#fff' : '#000'}}>{d}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput style={[globalStyles.input,{marginTop:8}]} placeholder="Heure (HH:MM)" value={formData.recurrence.time} onChangeText={t => setFormData({...formData, recurrence: {...formData.recurrence, time: t}})} />
                    </>
                  )}
                </View>
              </>
            ) : (
              <>
                <TextInput style={globalStyles.input} placeholder="Heures" keyboardType="numeric" value={formData.totalHours} onChangeText={t => setFormData({...formData, totalHours: t})} />
                <TouchableOpacity style={[globalStyles.input, {justifyContent:'center'}]} onPress={() => { setCalendarTarget('deadline'); setShowCalendarPicker(true); }}>
                  <Text>{formData.deadline || 'Choisir la date de deadline'}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={handleSave} style={[globalStyles.btn, {backgroundColor: theme.primary}]}><Text style={{color:'#fff', fontWeight:'bold'}}>ENREGISTRER</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowAddModal(false)}><Text style={{textAlign:'center', marginTop:15, color:'red'}}>Annuler</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      {/* Calendar picker modal (reusing CalendarScreen) */}
      <Modal visible={showCalendarPicker} transparent animationType="slide">
        <View style={[globalStyles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[globalStyles.modalContent, { backgroundColor: theme.modalContent, width: '98%', maxWidth: 900, height: '92%', borderRadius: 12, padding: 12 }] }>
            <Text style={globalStyles.title}>Choisir une date</Text>
            <CalendarScreen style={{flex:1}} tasks={todos} onSelectDate={(ymd)=>{
              if (calendarTarget === 'date') setFormData({...formData, date: ymd});
              else if (calendarTarget === 'deadline') setFormData({...formData, deadline: ymd});
              setShowCalendarPicker(false);
            }} isDarkMode={isDarkMode} onToggle={handleToggle} />
            <TouchableOpacity onPress={()=>setShowCalendarPicker(false)} style={[globalStyles.btn,{marginTop:8}]}><Text>Fermer</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time picker modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={[globalStyles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[globalStyles.modalContent, { backgroundColor: theme.modalContent, maxWidth:420, width:'90%', padding:12 }]}> 
            <Text style={{fontSize:18, fontWeight:'bold', marginBottom:8}}>Choisir l'heure</Text>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
              <View style={{flex:1, marginRight:6}}>
                <Text style={{marginBottom:6}}>Heures</Text>
                <ScrollView style={{maxHeight:180}}>
                  <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                    {Array.from({length:24}).map((_,i)=>{
                      const h = String(i).padStart(2,'0');
                      const sel = pickerHour === h;
                      return (
                        <TouchableOpacity key={h} onPress={()=>setPickerHour(h)} style={{padding:8, margin:4, borderRadius:6, backgroundColor: sel ? theme.primary : '#eee'}}>
                          <Text style={{color: sel ? '#fff' : '#000'}}>{h}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
              <View style={{width:120}}>
                <Text style={{marginBottom:6}}>Minutes</Text>
                <View>
                  {['00','15','30','45'].map(m => (
                    <TouchableOpacity key={m} onPress={()=>setPickerMinute(m)} style={{padding:10, marginBottom:6, borderRadius:6, backgroundColor: pickerMinute===m ? theme.primary : '#eee', alignItems:'center'}}>
                      <Text style={{color: pickerMinute===m ? '#fff' : '#000'}}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={{flexDirection:'row', justifyContent:'space-between'}}>
              <TouchableOpacity onPress={()=>setShowTimePicker(false)} style={[globalStyles.btn,{backgroundColor:'#ddd'}]}><Text>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>{
                const val = `${pickerHour}:${pickerMinute}`;
                let newForm = {...formData};
                if (timeTarget === 'start') {
                  newForm.start = val;
                  const s = timeToMinutes(val);
                  const e = timeToMinutes(formData.end);
                  if (e == null || s > e) newForm.end = val; // push end forward so start <= end
                } else if (timeTarget === 'end') {
                  newForm.end = val;
                  const s = timeToMinutes(formData.start);
                  const e = timeToMinutes(val);
                  if (s != null && e < s) {
                    // don't allow end < start -> keep end at start
                    newForm.end = formData.start;
                  }
                } else if (timeTarget === 'recurrence') {
                  newForm.recurrence = {...formData.recurrence, time: val};
                }
                setFormData(newForm);
                setShowTimePicker(false);
              }} style={[globalStyles.btn,{backgroundColor: theme.primary}]}><Text style={{color:'#fff'}}>Confirmer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', marginBottom: 15, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  activeTab: { backgroundColor: '#007bff' },
  recButton: { paddingVertical:8, paddingHorizontal:12, borderRadius:6, backgroundColor:'#eee', marginRight:8 },
  recActive: { backgroundColor: '#007bff' },
  dayChip: { paddingVertical:6, paddingHorizontal:10, borderRadius:6, backgroundColor:'#f0f0f0', marginRight:6, marginBottom:6 },
  dayChipActive: { backgroundColor: '#007bff' }
});