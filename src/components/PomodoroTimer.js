import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';

const PomodoroTimer = ({ isDarkMode }) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60); 
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('WORK'); // 'WORK' ou 'BREAK'

  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(secondsLeft => secondsLeft - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      Vibration.vibrate();
      setIsActive(false);
      const nextMode = mode === 'WORK' ? 'BREAK' : 'WORK';
      setMode(nextMode);
      setSecondsLeft(nextMode === 'WORK' ? 25 * 60 : 5 * 60);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, mode]);

  const formatTime = () => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={[styles.container, mode === 'BREAK' ? styles.breakContainer : null, isDarkMode && styles.containerDark]}>
      <Text style={[styles.label, isDarkMode && styles.labelDark]}>{mode === 'WORK' ? '🔥 Session Focus' : '☕ Pause Café'}</Text>
      <Text style={[styles.timer, isDarkMode && styles.timerDark]}>{formatTime()}</Text>
      
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setIsActive(!isActive)} style={styles.btnMain}>
          <Text style={styles.btnText}>{isActive ? 'Pause' : 'Démarrer'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => { setIsActive(false); setSecondsLeft(25*60); setMode('WORK'); }} style={styles.btnReset}>
          <Text style={styles.btnTextSmall}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff0f0', // Rouge très pâle (Focus)
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ffcdd2',
    elevation: 3,
  },
  breakContainer: {
    backgroundColor: '#e8f5e9', // Vert très pâle (Pause)
    borderColor: '#c8e6c9',
  },
  label: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
  timer: { fontSize: 48, fontWeight: 'bold', color: '#333', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  btnMain: { backgroundColor: '#ff5252', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginRight: 15, elevation: 2 },
  btnReset: { padding: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnTextSmall: { color: '#999', fontWeight: 'bold' }
});

// Dark variants
styles.containerDark = {
  backgroundColor: '#1b1b1b',
  borderColor: '#2a2a2a'
};
styles.labelDark = { color: '#fff' };
styles.timerDark = { color: '#fff' };

export default PomodoroTimer;