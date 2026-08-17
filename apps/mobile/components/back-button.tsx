import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function BackButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      onPress={() => router.back()}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.soft, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="arrow-back" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});
