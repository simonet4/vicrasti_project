import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#007bff',       // Bleu principal
  success: '#00c853',       // Vert succès
  danger: '#ff5252',        // Rouge action/suppression
  background: '#f5f5f5',    // Gris clair fond
  white: '#ffffff',
  text: '#333333',
  textLight: '#666666',
  border: '#eeeeee',
  lightInput: '#fafafa',
};

export const globalStyles = StyleSheet.create({
  // Conteneurs
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center' },
  
  // Textes
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginVertical: 15 },
  subtitle: { fontSize: 18, fontWeight: 'bold', color: colors.textLight, marginBottom: 10 },
  
  // Modals (Fenêtres)
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    padding: 20 
  },
  modalContent: { 
    backgroundColor: colors.white, 
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
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  
  // Inputs
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 12, 
    borderRadius: 8, 
    fontSize: 16, 
    marginBottom: 15,
    backgroundColor: colors.lightInput,
    color: colors.text
  },
});