import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useStore } from '../store/useStore';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuthUser = useStore((state) => state.setAuthUser);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Replace localhost/IP here with your actual C# API running address
      const apiUrl = 'https://localhost:7123/api/IBISApi/login';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UserName: username, Password: password })
      });

      const data = await response.json();

      if (response.ok) {
        setAuthUser(data.role || 'USER', data.name || username);
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err: any) {
      setError('Network error: Ensure C# API is running and IP is correct (' + err.message + ')');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to VoiceOrder</Text>
      <Text style={styles.subtitle}>Login to access your assigned territory</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Note for DB Integration: Direct connection to SQL Server (10.10.50.54) over FortiClient is not supported natively in mobile apps. You will need to create a REST API middleware to execute &apos;Sfa_spGetSfaLoginAccess&apos;.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#18181B', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#71717A', marginBottom: 32 },
  error: { color: '#EF4444', marginBottom: 16, fontWeight: '500' },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#3F3F46', marginBottom: 8 },
  input: {
    backgroundColor: 'white', borderWidth: 1, borderColor: '#E4E4E7',
    borderRadius: 8, padding: 12, fontSize: 16, color: '#18181B'
  },
  loginButton: {
    backgroundColor: '#059669', padding: 16, borderRadius: 8,
    alignItems: 'center', marginTop: 16
  },
  loginText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  infoBox: { marginTop: 40, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 8 },
  infoText: { color: '#92400E', fontSize: 12, lineHeight: 18 }
});