import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/globalStyles';

const AchievementsScreen = ({ todos = [], stats = { completed: 0 }, isDarkMode = false }) => {
  const completedCount = stats.completed || 0;
  const level = Math.floor(completedCount / 10) + 1;
  const xp = completedCount % 10;

  const projects = (todos || []).filter(t => t.type === 'PROJECT');
  const totalProjectHours = projects.reduce((acc, p) => acc + parseFloat(p.totalHours || 0), 0);

  // additional simple metrics for new trophies
  const deadlinesCount = (todos || []).filter(t => (t.type === 'PROJECT' && t.deadline) || (t.type === 'FIXED' && t.dueDate)).length;
  const earlyBirdCount = (todos || []).filter(t => t.type === 'FIXED' && t.startTime && parseInt(t.startTime.split(':')[0],10) < 7).length;
  const nightOwlCount = (todos || []).filter(t => t.type === 'FIXED' && t.startTime && parseInt(t.startTime.split(':')[0],10) >= 22).length;

  const [trophiesState, setTrophiesState] = useState({});

  const TROPHY_KEY = '@vicrasti_trophies';

  const recurringCount = (todos || []).filter(t => t.recurrence && t.recurrence.type && t.recurrence.type !== 'none').length;
  const longTaskCount = (todos || []).filter(t => t.type === 'FIXED' && t.startTime && t.endTime && (function(){ const s = parseInt(t.startTime.split(':')[0],10); const e = parseInt(t.endTime.split(':')[0],10); return !isNaN(s) && !isNaN(e) && (e - s) >= 4; })()).length;
  // Grouped, progressive trophy series (compact display)
  const groupedTrophies = [
    { key: 'tasks', label: 'Tâches complétées', tiers: [
      { id: 'tasks_1', title: '1', target: 1 },
      { id: 'tasks_10', title: '10', target: 10 },
      { id: 'tasks_25', title: '25', target: 25 },
      { id: 'tasks_50', title: '50', target: 50 },
      { id: 'tasks_100', title: '100', target: 100 },
      { id: 'tasks_200', title: '200', target: 200 },
      { id: 'tasks_500', title: '500', target: 500 },
      { id: 'tasks_1000', title: '1000', target: 1000 }
    ], getter: () => completedCount },

    { key: 'projects', label: 'Projets', tiers: [
      { id: 'proj_1', title: '1', target: 1 },
      { id: 'proj_3', title: '3', target: 3 },
      { id: 'proj_5', title: '5', target: 5 },
      { id: 'proj_10', title: '10', target: 10 }
    ], getter: () => projects.length },

    { key: 'project_hours', label: 'Heures projet', tiers: [
      { id: 'ph_10', title: '10h', target: 10 },
      { id: 'ph_50', title: '50h', target: 50 },
      { id: 'ph_100', title: '100h', target: 100 },
      { id: 'ph_200', title: '200h', target: 200 },
      { id: 'ph_500', title: '500h', target: 500 }
    ], getter: () => totalProjectHours },

    { key: 'recurring', label: 'Récurrentes', tiers: [
      { id: 'rec_1', title: '1', target: 1 },
      { id: 'rec_5', title: '5', target: 5 },
      { id: 'rec_10', title: '10', target: 10 }
    ], getter: () => recurringCount },

    { key: 'deadlines', label: 'Deadlines', tiers: [
      { id: 'dl_1', title: '1', target: 1 },
      { id: 'dl_5', title: '5', target: 5 },
      { id: 'dl_20', title: '20', target: 20 }
    ], getter: () => deadlinesCount },

    { key: 'early', label: 'Lève-tôt', tiers: [
      { id: 'eb_1', title: '1', target: 1 },
      { id: 'eb_10', title: '10', target: 10 }
    ], getter: () => earlyBirdCount },

    { key: 'night', label: 'Noctambule', tiers: [
      { id: 'no_1', title: '1', target: 1 },
      { id: 'no_10', title: '10', target: 10 }
    ], getter: () => nightOwlCount },

    { key: 'special', label: 'Spéciaux', tiers: [
      { id: 'long_4h', title: 'Long 4h+', target: 1 },
      { id: 'long_8h', title: 'Très long 8h+', target: 1 },
      { id: 'early_bird', title: 'Lève-tôt', target: 1 }
    ], getter: () => 0 }
  ];

  // Ensure every tier has a human-friendly description (in French)
  groupedTrophies.forEach(group => {
    group.tiers.forEach(t => {
      if (!t.description) {
        if (group.key === 'tasks') {
          t.description = `Compléter ${t.target} tâche${t.target > 1 ? 's' : ''}.`;
        } else if (group.key === 'projects') {
          t.description = `Créer et gérer ${t.target} projet${t.target > 1 ? 's' : ''}.`;
        } else if (group.key === 'project_hours') {
          t.description = `Totaliser ${t.target} heures planifiées sur vos projets.`;
        } else if (group.key === 'recurring') {
          t.description = `Avoir ${t.target} tâche${t.target > 1 ? 's' : ''} récurrente${t.target > 1 ? 's' : ''} activée${t.target > 1 ? 's' : ''}.`;
        } else if (group.key === 'deadlines') {
          t.description = `Avoir ${t.target} tâche${t.target > 1 ? 's' : ''} ou projet${t.target > 1 ? 's' : ''} avec deadline.`;
        } else if (group.key === 'early') {
          t.description = `Terminer ${t.target} tâche${t.target > 1 ? 's' : ''} commençant avant 7h.`;
        } else if (group.key === 'night') {
          t.description = `Terminer ${t.target} tâche${t.target > 1 ? 's' : ''} commençant après 22h.`;
        } else if (group.key === 'special') {
          if (t.id === 'long_4h') t.description = 'Créer ou compléter une tâche fixe d\u00e9gagée durant au moins 4 heures.';
          else if (t.id === 'long_8h') t.description = 'Créer ou compléter une tâche fixe d\u00e9gagée durant au moins 8 heures.';
          else t.description = 'Objectif spécial à atteindre.';
        } else {
          t.description = 'Objectif: ' + (t.target || '—');
        }
      }
    });
  });

  useEffect(() => {
    const syncTrophies = async () => {
      try {
        const raw = await AsyncStorage.getItem(TROPHY_KEY);
        const saved = raw ? JSON.parse(raw) : {};
        const updated = { ...saved };
        let changed = false;

        groupedTrophies.forEach(group => {
          const value = group.getter();
          group.tiers.forEach(tier => {
            const earned = value >= tier.target;
            if (earned && !saved[tier.id]) {
              updated[tier.id] = { earnedAt: new Date().toISOString() };
              changed = true;
            }
            if (!earned && saved[tier.id]) {
              updated[tier.id] = saved[tier.id];
            }
          });
        });

        if (changed) await AsyncStorage.setItem(TROPHY_KEY, JSON.stringify(updated));
        setTrophiesState(updated);
      } catch (e) { console.warn('trophy sync', e); }
    };
    syncTrophies();
  }, [completedCount, projects.length, totalProjectHours, recurringCount, longTaskCount, deadlinesCount, earlyBirdCount, nightOwlCount]);

  // UI state for trophy details modal
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showTrophyModal, setShowTrophyModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  // theme-aware colors
  const bg = isDarkMode ? '#121212' : '#F8F9FA';
  const cardBg = isDarkMode ? '#171717' : '#FFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const subText = isDarkMode ? '#BBBBBB' : '#666666';

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}> 
      <Text style={[styles.mainTitle, { color: textColor }]}>Statistiques</Text>

      <View style={[styles.levelCard, { backgroundColor: cardBg }] }>
        <View style={styles.outerCircle}>
          <View style={styles.innerCircle}>
            <Text style={styles.levelNumber}>{level}</Text>
            <Text style={styles.levelLabel}>NIVEAU</Text>
          </View>
        </View>
        <Text style={[styles.xpText, { color: subText }]}>{xp} / 10 tâches pour le niveau {level + 1}</Text>
        <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#222' : '#EEE' }]}><View style={[styles.progressBarFill, { width: `${xp * 10}%` }]} /></View>
      </View>

      <Text style={styles.sectionTitle}>Répartition Projets</Text>
      <View style={[styles.chartCard, { backgroundColor: cardBg }]}> 
        {projects.length > 0 ? (
          <View>
            <View style={styles.segmentedBar}>
              {projects.map((p, i) => (
                <View key={p.id} style={{ flex: parseFloat(p.totalHours), backgroundColor: i % 2 === 0 ? colors.primary : colors.success, borderRightWidth: 1, borderColor: '#fff' }} />
              ))}
            </View>
            {projects.map((p, i) => (
              <View key={p.id} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: i % 2 === 0 ? colors.primary : colors.success }]} />
                <Text style={styles.legendText}>{p.text} ({p.totalHours}h)</Text>
              </View>
            ))}
          </View>
        ) : <Text style={[styles.empty, { color: subText }]}>Aucun projet actif.</Text>}
      </View>

      <Text style={styles.sectionTitle}>Trophées</Text>
      <View style={[styles.chartCard, { backgroundColor: cardBg }]}>
        {groupedTrophies.map(group => {
          const value = group.getter();
          const tiers = group.tiers;
          let highest = -1;
          tiers.forEach((t, i) => { if (value >= t.target) highest = i; });
          const next = tiers[highest + 1];
          const progress = next ? Math.min(100, Math.round((value / next.target) * 100)) : 100;
          const highestTier = highest >= 0 ? tiers[highest] : null;
          const earnedAt = highestTier && trophiesState && trophiesState[highestTier.id] ? trophiesState[highestTier.id].earnedAt : null;

          return (
            <TouchableOpacity key={group.key} style={{marginBottom:14}} onPress={() => { setSelectedGroup(group); setShowTrophyModal(true); }}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                  <Text style={{fontSize:20, marginRight:10}}>{highest >= 0 ? '🏆' : '🔒'}</Text>
                  <View>
                    <Text style={{fontWeight:'700', color: textColor}}>{group.label}</Text>
                    <Text style={{color: subText, fontSize:12}}>{highestTier ? `Palier: ${highestTier.title}` : `Objectif: ${tiers[0].title}`}</Text>
                  </View>
                </View>
                <Text style={{fontSize:12, color: subText}}>{earnedAt ? new Date(earnedAt).toLocaleDateString() : (next ? `${value}/${next.target}` : `${value}`)}</Text>
              </View>

              <View style={{height:8, backgroundColor: isDarkMode ? '#222' : '#eee', borderRadius:6, overflow:'hidden'}}>
                <View style={{height:'100%', width: `${progress}%`, backgroundColor: colors.primary }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={showTrophyModal} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20}}>
          <View style={{backgroundColor: cardBg, borderRadius:12, padding:16, maxHeight:'80%'}}>
            <Text style={{fontWeight:'700', fontSize:18, marginBottom:8, color: textColor}}>{selectedGroup ? selectedGroup.label : ''}</Text>
            <ScrollView>
              {selectedGroup && selectedGroup.tiers.map(t => {
                const earned = trophiesState && trophiesState[t.id];
                return (
                  <TouchableOpacity key={t.id} onPress={() => { setSelectedTier(t); }}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderColor: isDarkMode ? '#2a2a2a' : '#eee'}}>
                      <View>
                        <Text style={{fontWeight:'700', color: textColor}}>{t.title} {t.target && typeof t.target === 'number' ? (t.title.toString().match(/h/i) ? '' : '') : ''}</Text>
                        <Text style={{color: subText, fontSize:12}}>Objectif: {t.target}</Text>
                      </View>
                      <View style={{alignItems:'flex-end'}}>
                        <Text style={{fontSize:16}}>{earned ? '🏆' : '🔒'}</Text>
                        <Text style={{fontSize:11, color: subText}}>{earned ? new Date(earned.earnedAt).toLocaleString() : ''}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {selectedTier && (
                <View style={{marginTop:12, padding:12, backgroundColor: isDarkMode ? '#0f0f0f' : '#f7f7f7', borderRadius:8}}>
                  <Text style={{fontWeight:'700', color: textColor, marginBottom:6}}>{selectedTier.title}</Text>
                  <Text style={{color: subText}}>{selectedTier.description}</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => { setShowTrophyModal(false); setSelectedGroup(null); }} style={{marginTop:12, backgroundColor: colors.primary, padding:10, borderRadius:8, alignItems:'center'}}>
              <Text style={{color:'#fff', fontWeight:'700'}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8F9FA' },
  mainTitle: { fontSize: 26, fontWeight: '800', marginBottom: 20 },
  levelCard: { backgroundColor: '#FFF', padding: 25, borderRadius: 24, alignItems: 'center', elevation: 4, marginBottom: 25 },
  outerCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  innerCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', elevation: 2, justifyContent: 'center', alignItems: 'center' },
  levelNumber: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  levelLabel: { fontSize: 10, color: '#999', fontWeight: 'bold' },
  xpText: { fontSize: 13, color: '#666', marginBottom: 8 },
  progressBarBg: { width: '100%', height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
  chartCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, marginBottom: 25 },
  trophyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  segmentedBar: { height: 18, borderRadius: 9, flexDirection: 'row', overflow: 'hidden', marginBottom: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendText: { fontSize: 14, color: '#444' },
  empty: { fontStyle: 'italic', color: '#999', textAlign: 'center' }
});

export default AchievementsScreen;