import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getLimitColors } from '../utils/limit';

export { getLimitColors };

interface LimitProgressCircleProps {
  currentBalance: number;
  creditLimit: number | null | undefined;
  size?: number;
  showSubText?: boolean;
}

export const LimitProgressCircle: React.FC<LimitProgressCircleProps> = ({
  currentBalance,
  creditLimit,
  size = 46,
  showSubText = false,
}) => {
  const { theme } = useTheme();

  if (creditLimit === null || creditLimit === undefined || creditLimit <= 0) {
    return null;
  }

  const positiveDebt = Math.max(0, currentBalance);
  const percent = Math.round((positiveDebt / creditLimit) * 100);
  const colors = getLimitColors(percent, theme.isDark);

  const borderWidth = Math.max(2.5, Math.round(size * 0.07));
  const fontSize = size >= 48 ? 12 : size >= 40 ? 11 : 9.5;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: colors.border,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <Text
          style={[
            styles.percentText,
            {
              fontSize,
              color: colors.text,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {percent}%
        </Text>
      </View>
      {showSubText && (
        <Text style={[styles.subLabel, { color: colors.text }]}>
          {percent > 100 ? 'Estourou' : 'Limite'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
});
