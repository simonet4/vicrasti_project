import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, Platform, Switch } from 'react-native';
import { globalStyles, colors } from '../styles/globalStyles';

const SettingsModal = ({ visible, onClose, onResetData, isDarkMode, setIsDarkMode, showFocus, setShowFocus }) => {
  const triggerReset = () => {
    const msg = "Voulez-vous supprimer toutes les données ?";
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) onResetData();
    } else {
      Alert.alert("CONFIRMATION", msg, [
        { text: "Annuler", style: "cancel" },
        { text: "OUI, RESET", style: "destructive", onPress: onResetData }
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={globalStyles.modalOverlay}>
        <View style={[globalStyles.modalContent, isDarkMode && {backgroundColor: '#1e1e1e'}]}>
          <Text style={[globalStyles.title, isDarkMode && {color: '#fff'}]}>Paramètres</Text>

          <View style={styles.settingRow}>
            <Text style={{color: isDarkMode ? '#fff' : '#333'}}>Mode Sombre</Text>
            <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
          </View>

          <View style={styles.settingRow}>
            <Text style={{color: isDarkMode ? '#fff' : '#333'}}>Afficher le mode Focus</Text>
            <Switch value={!!showFocus} onValueChange={setShowFocus} />
          </View>

          <TouchableOpacity onPress={triggerReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>RÉINITIALISER TOUT</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  resetBtn: { backgroundColor: '#ff4444', padding: 15, borderRadius: 10, marginTop: 20 },
  resetBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  closeBtn: { marginTop: 40, alignSelf: 'center', padding: 10 }
});

export default SettingsModal;