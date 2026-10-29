import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useLicense } from '../theme/LicenseContext';
import { ThemeMode, isThemePro } from '../theme/themes';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ThemeOption {
  key: ThemeMode;
  name: string;
  subtitle: string;
  category: 'free' | 'pastel' | 'dark' | 'amoled';
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  previewBg: string;
  previewCard: string;
  previewBorder: string;
  previewAccent: string;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ visible, onClose }) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { isPremium, openPaywall } = useLicense();
  const [filter, setFilter] = useState<'all' | 'free' | 'pro' | 'amoled'>('all');

  const options: ThemeOption[] = [
    // --- TEMAS GRATUITOS ---
    {
      key: 'light',
      name: 'Claro (Light)',
      subtitle: 'Interface limpa, clássica e iluminada',
      category: 'free',
      icon: 'sunny-outline',
      iconColor: '#D97706',
      previewBg: '#F8FAFC',
      previewCard: '#FFFFFF',
      previewBorder: '#E2E8F0',
      previewAccent: '#4F46E5',
    },
    {
      key: 'dark_blue',
      name: 'Azul Escuro (Dark Blue)',
      subtitle: 'Tons refinados de azul marinho profundo',
      category: 'free',
      icon: 'moon-outline',
      iconColor: '#818CF8',
      previewBg: '#0B132B',
      previewCard: '#111D38',
      previewBorder: '#1E2F54',
      previewAccent: '#6366F1',
    },

    // --- TEMAS PRO: FEMINILIZADOS & PASTEL ---
    {
      key: 'rose_gold',
      name: 'Rosé Gold',
      subtitle: 'Blush suave, ouro rosé e alta sofisticação',
      category: 'pastel',
      icon: 'flower-outline',
      iconColor: '#E11D48',
      previewBg: '#FFF1F2',
      previewCard: '#FFFFFF',
      previewBorder: '#FECDD3',
      previewAccent: '#E11D48',
    },
    {
      key: 'lavender',
      name: 'Lavanda Dreams',
      subtitle: 'Tons zen de lilás e violeta suave relaxante',
      category: 'pastel',
      icon: 'sparkles-outline',
      iconColor: '#9333EA',
      previewBg: '#FAF5FF',
      previewCard: '#FFFFFF',
      previewBorder: '#E9D5FF',
      previewAccent: '#9333EA',
    },

    // --- TEMAS PRO: DARK REFINADO ---
    {
      key: 'dracula',
      name: 'Drácula Noturno',
      subtitle: 'Paleta moderna com roxo neon e estética dev',
      category: 'dark',
      icon: 'color-wand-outline',
      iconColor: '#CBA6F7',
      previewBg: '#181825',
      previewCard: '#1E1E2E',
      previewBorder: '#313244',
      previewAccent: '#CBA6F7',
    },
    {
      key: 'emerald_dark',
      name: 'Esmeralda Nobre',
      subtitle: 'Verde floresta nobre estilo private banking',
      category: 'dark',
      icon: 'leaf-outline',
      iconColor: '#10B981',
      previewBg: '#051812',
      previewCard: '#0A251D',
      previewBorder: '#194D3E',
      previewAccent: '#10B981',
    },
    {
      key: 'midnight_slate',
      name: 'Grafite Slate',
      subtitle: 'Escuro neutro em ardósia moderno sem azul',
      category: 'dark',
      icon: 'cube-outline',
      iconColor: '#38BDF8',
      previewBg: '#0F172A',
      previewCard: '#1E293B',
      previewBorder: '#334155',
      previewAccent: '#38BDF8',
    },

    // --- TEMAS PRO: AMOLED & ALTO CONTRASTE ---
    {
      key: 'amoled',
      name: 'AMOLED Preto Puro',
      subtitle: 'Preto 100% que desliga pixels e poupa bateria',
      category: 'amoled',
      icon: 'phone-portrait-outline',
      iconColor: '#818CF8',
      previewBg: '#000000',
      previewCard: '#0A0A0A',
      previewBorder: '#262626',
      previewAccent: '#818CF8',
    },
    {
      key: 'amoled_contrast',
      name: 'AMOLED Alto Contraste',
      subtitle: 'Âmbar solar de altíssima visibilidade no sol',
      category: 'amoled',
      icon: 'flash-outline',
      iconColor: '#FBBF24',
      previewBg: '#000000',
      previewCard: '#0A0A0A',
      previewBorder: '#F59E0B',
      previewAccent: '#FBBF24',
    },
    {
      key: 'amoled_emerald',
      name: 'AMOLED Matrix',
      subtitle: 'Terminal preto puro com verde elétrico neon',
      category: 'amoled',
      icon: 'terminal-outline',
      iconColor: '#22C55E',
      previewBg: '#000000',
      previewCard: '#060C09',
      previewBorder: '#143D2E',
      previewAccent: '#22C55E',
    },
    {
      key: 'amoled_sunset',
      name: 'AMOLED Cyber Sunset',
      subtitle: 'Preto 100% com acentos neon coral e sunset',
      category: 'amoled',
      icon: 'flame-outline',
      iconColor: '#F43F5E',
      previewBg: '#000000',
      previewCard: '#0D0709',
      previewBorder: '#3D1420',
      previewAccent: '#F43F5E',
    },
  ];

  const handleSelect = async (opt: ThemeOption) => {
    const isPro = isThemePro(opt.key);
    if (isPro && !isPremium) {
      onClose();
      setTimeout(() => {
        openPaywall({
          feature: 'themes',
          title: `Tema ${opt.name}`,
          description: `Desbloqueie o tema exclusivo ${opt.name} e transforme a aparência das suas finanças com o plano PRO.`,
        });
      }, 200);
      return;
    }
    await setThemeMode(opt.key);
    onClose();
  };

  const filteredOptions = options.filter((opt) => {
    const isPro = isThemePro(opt.key);
    if (filter === 'free') return !isPro;
    if (filter === 'pro') return isPro;
    if (filter === 'amoled') return opt.category === 'amoled';
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Aparência e Temas</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
                  Escolha a paleta de cores perfeita para o seu app
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Abas de Filtro Rápidas */}
          <View style={[styles.filterBar, { borderBottomColor: theme.borderLight, backgroundColor: theme.surfaceElevated }]}>
            <TouchableOpacity
              style={[styles.filterChip, filter === 'all' && [styles.filterChipActive, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]]}
              onPress={() => setFilter('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: filter === 'all' ? theme.primary : theme.textSecondary, fontWeight: filter === 'all' ? '700' : '500' }]}>
                Todos ({options.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'free' && [styles.filterChipActive, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]]}
              onPress={() => setFilter('free')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: filter === 'free' ? theme.primary : theme.textSecondary, fontWeight: filter === 'free' ? '700' : '500' }]}>
                Grátis (2)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'pro' && [styles.filterChipActive, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]]}
              onPress={() => setFilter('pro')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: filter === 'pro' ? theme.primary : theme.textSecondary, fontWeight: filter === 'pro' ? '700' : '500' }]}>
                PRO 👑 ({options.filter((o) => isThemePro(o.key)).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'amoled' && [styles.filterChipActive, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]]}
              onPress={() => setFilter('amoled')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: filter === 'amoled' ? theme.primary : theme.textSecondary, fontWeight: filter === 'amoled' ? '700' : '500' }]}>
                AMOLED (4)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista com Scroll */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredOptions.map((opt) => {
              const isSelected = themeMode === opt.key;
              const isPro = isThemePro(opt.key);

              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => handleSelect(opt)}
                  activeOpacity={0.8}
                >
                  {/* Swatch de Preview de Cores com Ícone */}
                  <View
                    style={[
                      styles.previewCircle,
                      {
                        backgroundColor: opt.previewBg,
                        borderColor: opt.previewBorder,
                      },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={20} color={opt.iconColor} />
                  </View>

                  {/* Informações do Tema */}
                  <View style={styles.optionInfo}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionName, { color: theme.textPrimary }]}>{opt.name}</Text>
                      {isPro ? (
                        <View style={[styles.proBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                          <Text style={styles.proBadgeText}>PRO 👑</Text>
                        </View>
                      ) : (
                        <View style={[styles.freeBadge, { backgroundColor: theme.incomeBg }]}>
                          <Text style={[styles.freeBadgeText, { color: theme.income }]}>Grátis</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                      {opt.subtitle}
                    </Text>
                  </View>

                  {/* Indicador de Seleção */}
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: isSelected ? theme.primary : theme.border },
                      isSelected && { backgroundColor: theme.primary },
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
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
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
  },
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionCardSelected: {
    borderWidth: 2,
  },
  previewCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  freeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  optionSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
