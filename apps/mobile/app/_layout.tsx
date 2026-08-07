import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthNavigator />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </AuthProvider>
  );
}

function AuthNavigator() {
  const { ready, user } = useAuth();
  const segments = useSegments();
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={Colors.light.primary} size="large" /></View>;
  const inLogin = String(segments[0]) === 'login';
  if (!user && !inLogin) return <Redirect href={'/login' as never} />;
  if (user && inLogin) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="login" /><Stack.Screen name="(tabs)" /></Stack>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background } });
