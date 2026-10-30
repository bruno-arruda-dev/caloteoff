import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SortOption } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface SortBottomSheetProps {
  visible: boolean;
  selected: SortOption;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}

interface SortItemConfig {
  id: SortOption;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const SORT_OPTIONS: SortItemConfig[] = [
  {
    id: 'collection_queue',
    label: 'Fila de Cobrança',
    description: 'Atrasados e devedores prioritários para acerto no Zap',
    icon: 'flame',
    color: '#EF4444',
  },
  {
    id: 'highest_debt',
    label: 'Maior Dívida',
    description: 'Clientes com maiores valores pendentes no topo',
    icon: 'cash',
    color: '#10B981',
  },
  {
    id: 'lowest_debt',
    label: 'Menor Dívida',
    description: 'Valores menores para liquidação rápida',
    icon: 'trending-down',
    color: '#6366F1',
  },
  {
    id: 'oldest_purchase',
    label: 'Mais Antiga',
    description: 'Compras pendentes há mais tempo',
    icon: 'hourglass-outline',
    color: '#F59E0B',
  },
  {
    id: 'alphabetical',
    label: 'Ordem Alfabética (A - Z)',
    description: 'Organizado pelo nome ou apelido do cliente',
    icon: 'text-outline',
    color: '#8B5CF6',
  },
];

export const SortBottomSheet: React.FC<SortBottomSheetProps> = ({
  visible,
  selected,
  onSelect,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheetContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Indicador de arrasto no topo */}
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Ordenar Clientes</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Escolha a forma de organização da sua lista
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {SORT_OPTIONS.map((item) => {
              const isSelected = selected === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: isSelected ? theme.primaryBg : theme.cardSecondary,
                      borderColor: isSelected ? theme.primary : theme.borderLight,
                    },
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>

                  <View style={styles.textCol}>
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: isSelected ? theme.primary : theme.textPrimary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      {item.description}
                    </Text>
                  </View>

                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? theme.primary : theme.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
