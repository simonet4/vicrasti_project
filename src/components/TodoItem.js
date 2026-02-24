import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Bibliothèque d'icônes standard d'Expo
import { colors } from '../styles/globalStyles';

const TodoItem = ({ item, onToggle, onDelete, onEdit, isActive }) => {
  // Formatage date : "2023-10-25" -> "25/10"
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  return (
    <Pressable 
      onPress={() => onToggle(item.id)} 
      style={({pressed}) => [
        styles.todoRow, 
        pressed && {opacity: 0.9, transform: [{scale: 0.98}]}, 
        isActive && {backgroundColor:'#f0f0f0'}
      ]}
    >
      {/* Case à cocher (Icône) */}
      <TouchableOpacity onPress={() => onToggle(item.id)}>
        <Ionicons 
          name={item.done ? "checkbox" : "square-outline"} 
          size={24} 
          color={item.done ? colors.success : colors.primary} 
          style={{ marginRight: 12 }}
        />
      </TouchableOpacity>
      
      <View style={{flex:1}}>
        <Text style={[styles.todoText, item.done && styles.todoDone]}>{item.text}</Text>
        
        {/* Badge Date avec Icône */}
        {item.dueDate && (
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={12} color="#666" style={{marginRight: 4}} />
            <Text style={styles.dateText}>{formatDate(item.dueDate)}</Text>
          </View>
        )}
      </View>
      
      {/* Boutons d'action */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn}>
          <Ionicons name="pencil" size={20} color="#555" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => onDelete(item.id)} style={[styles.iconBtn, {marginLeft: 8}]}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    // Ombre douce
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  todoText: { flex: 1, fontSize: 16, color: '#333', fontWeight: '500' },
  todoDone: { textDecorationLine: 'line-through', color: '#aaa' },
  
  dateBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    marginTop: 6 
  },
  dateText: { fontSize: 12, color: '#666', fontWeight: 'bold' },

  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 5 },
});

export default TodoItem;