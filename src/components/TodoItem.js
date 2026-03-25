import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Bibliothèque d'icônes standard d'Expo
import { getTheme } from '../styles/globalStyles';

const TodoItem = ({ item, onToggle, onDelete, onEdit, isActive, isDarkMode = false }) => {
  const theme = getTheme(!!isDarkMode);
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
          isActive && {backgroundColor: theme.taskBg}
        ]}
    >
      {/* Case à cocher (Icône) */}
      <TouchableOpacity onPress={() => onToggle(item.id)}>
        <Ionicons 
          name={item.done ? "checkbox" : "square-outline"} 
          size={24} 
          color={item.done ? theme.success : theme.primary} 
          style={{ marginRight: 12 }}
        />
      </TouchableOpacity>
      
      <View style={{flex:1}}>
        <Text style={[styles.todoText, item.done && styles.todoDone]}>{item.text}</Text>
        
        {/* Badge Date avec Icône */}
        {item.dueDate && (
          <View style={[styles.dateBadge, { backgroundColor: theme.inputBg }]}> 
            <Ionicons name="calendar-outline" size={12} color={theme.subText} style={{marginRight: 4}} />
            <Text style={[styles.dateText, { color: theme.subText }]}>{formatDate(item.dueDate)}</Text>
          </View>
        )}
      </View>
      
      {/* Boutons d'action */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn}>
          <Ionicons name="pencil" size={20} color={theme.subText} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => onDelete(item.id)} style={[styles.iconBtn, {marginLeft: 8}]}>
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
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
    borderRadius: 12,
    borderRadius: 12,
    // Ombre douce
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  todoText: { flex: 1, fontSize: 16, fontWeight: '500' },
  todoDone: { textDecorationLine: 'line-through' },
  
  dateBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    marginTop: 6 
  },
  dateText: { fontSize: 12, fontWeight: 'bold' },

  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 5 },
});

export default TodoItem;