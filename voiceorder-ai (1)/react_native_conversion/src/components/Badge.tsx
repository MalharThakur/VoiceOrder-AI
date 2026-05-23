import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS, SPACING } from '../theme';

interface BadgeProps {
  icon: React.ReactNode;
  label: string;
}

export const Badge: React.FC<BadgeProps> = ({ icon, label }) => {
  return (
    <View style={styles.badgeContainer}>
      <View style={styles.iconWrapper}>{icon}</View>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: '#E4E4E7', // Zinc 200 representation matches the native badge color
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  iconWrapper: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#52525B', // Zinc 600
  },
});
