import { StyleSheet } from 'react-native';

// Centralized light/dark theme tokens
export const theme = {
  light: {
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#111827',
    subText: '#6B7280',
    primary: '#007bff',
    success: '#00c853',
    danger: '#ff5252',
    border: '#E6E7E8',
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalContent: '#FFFFFF',
    inputBg: '#FAFAFA',
    white: '#FFFFFF',
    taskBg: '#FDFDFD',
    header: '#FFFFFF'
  },
  dark: {
    background: '#0B0B0B',
    card: '#121212',
    text: '#FFFFFF',
    subText: '#BDBDBD',
    primary: '#3EA6FF',
    success: '#32D672',
    danger: '#FF6B6B',
    border: '#1F1F1F',
    modalOverlay: 'rgba(0,0,0,0.6)',
    modalContent: '#151515',
    inputBg: '#171717',
    white: '#FFFFFF',
    taskBg: '#161616',
    header: '#0F0F0F'
  }
};

export const getTheme = (isDark) => (isDark ? theme.dark : theme.light);

export const globalStyles = StyleSheet.create({
  // Conteneurs
  container: { flex: 1 },
  safeArea: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  
  // Textes
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  
  // Modals (Fenêtres)
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  modalContent: { 
    padding: 20, 
    borderRadius: 15, 
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  
  // Boutons
  btn: { padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 5 },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  
  // Inputs
  input: { 
    borderWidth: 1, 
    padding: 12, 
    borderRadius: 8, 
    fontSize: 16, 
    marginBottom: 15,
  },
});