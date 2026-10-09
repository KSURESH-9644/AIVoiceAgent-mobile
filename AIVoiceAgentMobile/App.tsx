import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import axios from 'axios';
import codePush from 'react-native-code-push';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeApp } from './src/services/appStartup';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await initializeApp();
    } catch (err: unknown) {
      console.error('Startup error:', err);

      if (axios.isAxiosError(err)) {
        if (err.response) {
          setError(`Server error: ${err.response.status}`);
        } else {
          setError('Unable to connect to AI server.\n\nCheck Render Live API:\nhttps://aivoiceagent-mobile.onrender.com');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Application initialization failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void start();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6D85FF" />
        <Text style={styles.loadingText}>Loading AI models...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>AI Voice Agent</Text>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void start()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0D0E12', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  loadingText: { color: '#FFFFFF', marginTop: 15, fontSize: 15, textAlign: 'center' },
  errorTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '600', marginBottom: 20 },
  error: { color: '#FF7777', textAlign: 'center', lineHeight: 22 },
  retryButton: { marginTop: 25, backgroundColor: '#3156D8', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
});

const CodePushOptions = { checkFrequency: codePush.CheckFrequency.ON_APP_START };
export default codePush(CodePushOptions)(App);