import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String((error && error.message) || error) };
  }

  componentDidCatch(error, info) {
    console.warn('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Une erreur est survenue dans la vue.</Text>
          <Text style={styles.detail}>{this.state.message}</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false, message: '' })} style={styles.btn}>
            <Text style={styles.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { color: '#D33B3B', fontSize: 16, textAlign: 'center' },
  detail: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: '#4F46E5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});

export default ErrorBoundary;
