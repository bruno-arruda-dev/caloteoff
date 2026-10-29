import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SortOption } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface SortFilterTabsProps {
  selected: SortOption;
  onSelect: (option: SortOption) => void;
}

const TABS: { id: SortOption; label: string }[] = [
  { id: 'collection_queue', label: '🔥 Fila de Cobrança' },
  { id: 'highest_debt', label: '💰 Maior Dívida' },
  { id: 'lowest_debt', label: '📉 Menor Dívida' },
  { id: 'oldest_purchase', label: '⏳ Mais Antiga' },
  { id: 'alphabetical', label: '🔤 A - Z' },
];

export const SortFilterTabs: React.FC<SortFilterTabsProps> = ({ selected, onSelect }) => {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TABS.map((tab) => {
        const isSelected = selected === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={[
              styles.tab,
              {
                backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                borderColor: isSelected ? theme.primary : theme.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isSelected ? theme.primaryText : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
  },
});
