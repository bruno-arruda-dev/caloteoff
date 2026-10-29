export type ThemeMode =
  | 'light'
  | 'dark_blue'
  | 'amoled'
  | 'rose_gold'
  | 'lavender'
  | 'dracula'
  | 'emerald_dark'
  | 'midnight_slate'
  | 'amoled_contrast'
  | 'amoled_emerald'
  | 'amoled_sunset';

export interface ThemeColors {
  mode: ThemeMode;
  name: string;
  isDark: boolean;
  background: string;
  card: string;
  cardSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryBg: string;
  primaryText: string;
  cardSelectedBg: string;
  cardSelectedBorder: string;
  tabContainerBg: string;
  tabActiveBg: string;
  tabActiveBorder: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabBadgeActiveBg: string;
  tabBadgeActiveText: string;
  tabBadgeInactiveBg: string;
  tabBadgeInactiveText: string;
  accent: string;
  warning: string;
  warningBg: string;
  income: string;
  incomeBg: string;
  expense: string;
  expenseBg: string;
  statusBar: 'dark-content' | 'light-content';
  statusBarBg: string;
  topBar: string;
  backdrop: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
}

/**
 * Retorna true se o tema for exclusivo para assinantes PRO.
 * Os únicos temas gratuitos são 'light' e 'dark_blue'.
 */
export function isThemePro(mode: ThemeMode): boolean {
  return mode !== 'light' && mode !== 'dark_blue';
}

// -------------------------------------------------------------
// 1. TEMA CLÁSSICO CLARO (GRÁTIS)
// -------------------------------------------------------------
export const lightTheme: ThemeColors = {
  mode: 'light',
  name: 'Claro',
  isDark: false,
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  cardSelectedBg: '#EEF2FF',
  cardSelectedBorder: '#4F46E5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryBg: '#EEF2FF',
  primaryText: '#FFFFFF',
  tabContainerBg: '#F1F5F9',
  tabActiveBg: '#FFFFFF',
  tabActiveBorder: '#E2E8F0',
  tabActiveText: '#0F172A',
  tabInactiveText: '#64748B',
  tabBadgeActiveBg: '#EEF2FF',
  tabBadgeActiveText: '#4F46E5',
  tabBadgeInactiveBg: '#E2E8F0',
  tabBadgeInactiveText: '#64748B',
  accent: '#0284C7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  income: '#16A34A',
  incomeBg: '#DCFCE7',
  expense: '#DC2626',
  expenseBg: '#FEE2E2',
  statusBar: 'dark-content',
  statusBarBg: '#FFFFFF',
  topBar: '#FFFFFF',
  backdrop: 'rgba(15, 23, 42, 0.45)',
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 2. TEMA AZUL ESCURO (GRÁTIS)
// -------------------------------------------------------------
export const darkBlueTheme: ThemeColors = {
  mode: 'dark_blue',
  name: 'Azul Escuro',
  isDark: true,
  background: '#0B132B',
  card: '#111D38',
  cardSecondary: '#16223F',
  cardSelectedBg: '#1A284E',
  cardSelectedBorder: '#6366F1',
  surface: '#111D38',
  surfaceElevated: '#172547',
  border: '#1E2F54',
  borderLight: '#16223F',
  textPrimary: '#FFFFFF',
  textSecondary: '#A5B4CB',
  textMuted: '#8E9EB5',
  primary: '#6366F1',
  primaryLight: '#1E295A',
  primaryBg: '#1E295A',
  primaryText: '#FFFFFF',
  tabContainerBg: '#0E1730',
  tabActiveBg: '#1D2D56',
  tabActiveBorder: '#374C7D',
  tabActiveText: '#FFFFFF',
  tabInactiveText: '#8E9EB5',
  tabBadgeActiveBg: '#312E81',
  tabBadgeActiveText: '#C7D2FE',
  tabBadgeInactiveBg: '#172547',
  tabBadgeInactiveText: '#8E9EB5',
  accent: '#38BDF8',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.16)',
  income: '#22C55E',
  incomeBg: 'rgba(34, 197, 94, 0.16)',
  expense: '#F87171',
  expenseBg: 'rgba(248, 113, 113, 0.16)',
  statusBar: 'light-content',
  statusBarBg: '#0B132B',
  topBar: '#0E1733',
  backdrop: 'rgba(0, 0, 0, 0.65)',
  inputBg: '#16223F',
  inputBorder: '#273B66',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 3. TEMA AMOLED PRETO PURO (PRO)
// -------------------------------------------------------------
export const amoledTheme: ThemeColors = {
  mode: 'amoled',
  name: 'AMOLED Preto Puro',
  isDark: true,
  background: '#000000',
  card: '#0A0A0A',
  cardSecondary: '#121212',
  cardSelectedBg: '#111728',
  cardSelectedBorder: '#818CF8',
  surface: '#0A0A0A',
  surfaceElevated: '#141414',
  border: '#262626',
  borderLight: '#1C1C1C',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#8C8C8C',
  primary: '#818CF8',
  primaryLight: '#1E1B4B',
  primaryBg: '#1E1B4B',
  primaryText: '#FFFFFF',
  tabContainerBg: '#0A0A0A',
  tabActiveBg: '#1E1E26',
  tabActiveBorder: '#3F3F4D',
  tabActiveText: '#FFFFFF',
  tabInactiveText: '#8C8C8C',
  tabBadgeActiveBg: '#312E81',
  tabBadgeActiveText: '#E0E7FF',
  tabBadgeInactiveBg: '#191919',
  tabBadgeInactiveText: '#8C8C8C',
  accent: '#38BDF8',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.16)',
  income: '#4ADE80',
  incomeBg: 'rgba(74, 222, 128, 0.16)',
  expense: '#FB7185',
  expenseBg: 'rgba(251, 113, 133, 0.16)',
  statusBar: 'light-content',
  statusBarBg: '#000000',
  topBar: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.75)',
  inputBg: '#121212',
  inputBorder: '#333333',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 4. TEMA ROSÉ GOLD (FEMININO / SOFISTICADO) (PRO)
// -------------------------------------------------------------
export const roseGoldTheme: ThemeColors = {
  mode: 'rose_gold',
  name: 'Rosé Gold',
  isDark: false,
  background: '#FFF1F2',
  card: '#FFFFFF',
  cardSecondary: '#FFE4E6',
  cardSelectedBg: '#FFE4E6',
  cardSelectedBorder: '#E11D48',
  surface: '#FFFFFF',
  surfaceElevated: '#FFF8F8',
  border: '#FECDD3',
  borderLight: '#FFE4E6',
  textPrimary: '#4C0519',
  textSecondary: '#881337',
  textMuted: '#9F1239',
  primary: '#E11D48',
  primaryLight: '#FFE4E6',
  primaryBg: '#FFE4E6',
  primaryText: '#FFFFFF',
  tabContainerBg: '#FFE4E6',
  tabActiveBg: '#FFFFFF',
  tabActiveBorder: '#FECDD3',
  tabActiveText: '#4C0519',
  tabInactiveText: '#9F1239',
  tabBadgeActiveBg: '#FFE4E6',
  tabBadgeActiveText: '#E11D48',
  tabBadgeInactiveBg: '#FECDD3',
  tabBadgeInactiveText: '#881337',
  accent: '#D97706',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  income: '#059669',
  incomeBg: '#D1FAE5',
  expense: '#E11D48',
  expenseBg: '#FFE4E6',
  statusBar: 'dark-content',
  statusBarBg: '#FFF1F2',
  topBar: '#FFF1F2',
  backdrop: 'rgba(76, 5, 25, 0.45)',
  inputBg: '#FFFFFF',
  inputBorder: '#FECDD3',
  shadow: '#881337',
};

// -------------------------------------------------------------
// 5. TEMA LAVANDA DREAMS (FEMININO / ZEN PASTEL) (PRO)
// -------------------------------------------------------------
export const lavenderTheme: ThemeColors = {
  mode: 'lavender',
  name: 'Lavanda Dreams',
  isDark: false,
  background: '#FAF5FF',
  card: '#FFFFFF',
  cardSecondary: '#F3E8FF',
  cardSelectedBg: '#F3E8FF',
  cardSelectedBorder: '#9333EA',
  surface: '#FFFFFF',
  surfaceElevated: '#FCF8FF',
  border: '#E9D5FF',
  borderLight: '#F3E8FF',
  textPrimary: '#3B0764',
  textSecondary: '#6B21A8',
  textMuted: '#9333EA',
  primary: '#9333EA',
  primaryLight: '#F3E8FF',
  primaryBg: '#F3E8FF',
  primaryText: '#FFFFFF',
  tabContainerBg: '#F3E8FF',
  tabActiveBg: '#FFFFFF',
  tabActiveBorder: '#E9D5FF',
  tabActiveText: '#3B0764',
  tabInactiveText: '#7E22CE',
  tabBadgeActiveBg: '#F3E8FF',
  tabBadgeActiveText: '#9333EA',
  tabBadgeInactiveBg: '#E9D5FF',
  tabBadgeInactiveText: '#6B21A8',
  accent: '#C026D3',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  income: '#16A34A',
  incomeBg: '#DCFCE7',
  expense: '#DC2626',
  expenseBg: '#FEE2E2',
  statusBar: 'dark-content',
  statusBarBg: '#FAF5FF',
  topBar: '#FAF5FF',
  backdrop: 'rgba(59, 7, 100, 0.45)',
  inputBg: '#FFFFFF',
  inputBorder: '#E9D5FF',
  shadow: '#3B0764',
};

// -------------------------------------------------------------
// 6. TEMA DRÁCULA NOTURNO (DARK ESPECIAL / MAUVE NEON) (PRO)
// -------------------------------------------------------------
export const draculaTheme: ThemeColors = {
  mode: 'dracula',
  name: 'Drácula Noturno',
  isDark: true,
  background: '#181825',
  card: '#1E1E2E',
  cardSecondary: '#262638',
  cardSelectedBg: '#2B2446',
  cardSelectedBorder: '#CBA6F7',
  surface: '#1E1E2E',
  surfaceElevated: '#28283D',
  border: '#313244',
  borderLight: '#262638',
  textPrimary: '#CDD6F4',
  textSecondary: '#A6ADC8',
  textMuted: '#7F849C',
  primary: '#CBA6F7',
  primaryLight: '#2C2545',
  primaryBg: '#2C2545',
  primaryText: '#11111B',
  tabContainerBg: '#11111B',
  tabActiveBg: '#26263D',
  tabActiveBorder: '#45475A',
  tabActiveText: '#CDD6F4',
  tabInactiveText: '#7F849C',
  tabBadgeActiveBg: '#3A2F5A',
  tabBadgeActiveText: '#CBA6F7',
  tabBadgeInactiveBg: '#1E1E2E',
  tabBadgeInactiveText: '#7F849C',
  accent: '#89DCEB',
  warning: '#F9E2AF',
  warningBg: 'rgba(249, 226, 175, 0.16)',
  income: '#A6E3A1',
  incomeBg: 'rgba(166, 227, 161, 0.16)',
  expense: '#F38BA8',
  expenseBg: 'rgba(243, 139, 168, 0.16)',
  statusBar: 'light-content',
  statusBarBg: '#181825',
  topBar: '#181825',
  backdrop: 'rgba(0, 0, 0, 0.70)',
  inputBg: '#1E1E2E',
  inputBorder: '#313244',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 7. TEMA ESMERALDA NOBRE (DARK ESPECIAL / WEALTH & LUXURY) (PRO)
// -------------------------------------------------------------
export const emeraldDarkTheme: ThemeColors = {
  mode: 'emerald_dark',
  name: 'Esmeralda Nobre',
  isDark: true,
  background: '#051812',
  card: '#0A251D',
  cardSecondary: '#0F3227',
  cardSelectedBg: '#0B3A2C',
  cardSelectedBorder: '#34D399',
  surface: '#0A251D',
  surfaceElevated: '#133C30',
  border: '#194D3E',
  borderLight: '#0F3227',
  textPrimary: '#ECFDF5',
  textSecondary: '#A7F3D0',
  textMuted: '#6EE7B7',
  primary: '#10B981',
  primaryLight: '#064E3B',
  primaryBg: '#064E3B',
  primaryText: '#FFFFFF',
  tabContainerBg: '#03100B',
  tabActiveBg: '#0D3B2D',
  tabActiveBorder: '#10B981',
  tabActiveText: '#ECFDF5',
  tabInactiveText: '#6EE7B7',
  tabBadgeActiveBg: '#064E3B',
  tabBadgeActiveText: '#A7F3D0',
  tabBadgeInactiveBg: '#0A251D',
  tabBadgeInactiveText: '#6EE7B7',
  accent: '#F59E0B',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.16)',
  income: '#34D399',
  incomeBg: 'rgba(52, 211, 153, 0.16)',
  expense: '#F87171',
  expenseBg: 'rgba(248, 113, 113, 0.16)',
  statusBar: 'light-content',
  statusBarBg: '#051812',
  topBar: '#051812',
  backdrop: 'rgba(3, 16, 11, 0.70)',
  inputBg: '#0A251D',
  inputBorder: '#194D3E',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 8. TEMA GRAFITE SLATE (DARK NEUTRO MODERNO) (PRO)
// -------------------------------------------------------------
export const midnightSlateTheme: ThemeColors = {
  mode: 'midnight_slate',
  name: 'Grafite Slate',
  isDark: true,
  background: '#0F172A',
  card: '#1E293B',
  cardSecondary: '#273549',
  cardSelectedBg: '#1C3754',
  cardSelectedBorder: '#38BDF8',
  surface: '#1E293B',
  surfaceElevated: '#2D3D54',
  border: '#334155',
  borderLight: '#243044',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#38BDF8',
  primaryLight: '#0C4A6E',
  primaryBg: '#0C4A6E',
  primaryText: '#FFFFFF',
  tabContainerBg: '#0B1120',
  tabActiveBg: '#24344D',
  tabActiveBorder: '#38BDF8',
  tabActiveText: '#FFFFFF',
  tabInactiveText: '#94A3B8',
  tabBadgeActiveBg: '#075985',
  tabBadgeActiveText: '#BAE6FD',
  tabBadgeInactiveBg: '#1E293B',
  tabBadgeInactiveText: '#64748B',
  accent: '#818CF8',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.16)',
  income: '#4ADE80',
  incomeBg: 'rgba(74, 222, 128, 0.16)',
  expense: '#F87171',
  expenseBg: 'rgba(248, 113, 113, 0.16)',
  statusBar: 'light-content',
  statusBarBg: '#0F172A',
  topBar: '#0F172A',
  backdrop: 'rgba(0, 0, 0, 0.65)',
  inputBg: '#1E293B',
  inputBorder: '#334155',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 9. TEMA AMOLED ALTO CONTRASTE (PRETO PURO & ÂMBAR SOLAR) (PRO)
// -------------------------------------------------------------
export const amoledContrastTheme: ThemeColors = {
  mode: 'amoled_contrast',
  name: 'AMOLED Alto Contraste',
  isDark: true,
  background: '#000000',
  card: '#0A0A0A',
  cardSecondary: '#141414',
  cardSelectedBg: '#261A05',
  cardSelectedBorder: '#FBBF24',
  surface: '#0A0A0A',
  surfaceElevated: '#171717',
  border: '#F59E0B',
  borderLight: '#333333',
  textPrimary: '#FFFFFF',
  textSecondary: '#FDE68A',
  textMuted: '#D1D5DB',
  primary: '#FBBF24',
  primaryLight: '#451A03',
  primaryBg: '#451A03',
  primaryText: '#000000',
  tabContainerBg: '#000000',
  tabActiveBg: '#261A05',
  tabActiveBorder: '#FBBF24',
  tabActiveText: '#FBBF24',
  tabInactiveText: '#D1D5DB',
  tabBadgeActiveBg: '#78350F',
  tabBadgeActiveText: '#FDE68A',
  tabBadgeInactiveBg: '#171717',
  tabBadgeInactiveText: '#9CA3AF',
  accent: '#60A5FA',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.25)',
  income: '#4ADE80',
  incomeBg: 'rgba(74, 222, 128, 0.25)',
  expense: '#F87171',
  expenseBg: 'rgba(248, 113, 113, 0.25)',
  statusBar: 'light-content',
  statusBarBg: '#000000',
  topBar: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.85)',
  inputBg: '#0A0A0A',
  inputBorder: '#F59E0B',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 10. TEMA AMOLED MATRIX (PRETO PURO & VERDE ELÉTRICO) (PRO)
// -------------------------------------------------------------
export const amoledEmeraldTheme: ThemeColors = {
  mode: 'amoled_emerald',
  name: 'AMOLED Matrix',
  isDark: true,
  background: '#000000',
  card: '#060C09',
  cardSecondary: '#0C1712',
  cardSelectedBg: '#072818',
  cardSelectedBorder: '#22C55E',
  surface: '#060C09',
  surfaceElevated: '#112019',
  border: '#143D2E',
  borderLight: '#0D281E',
  textPrimary: '#FFFFFF',
  textSecondary: '#86EFAC',
  textMuted: '#4ADE80',
  primary: '#22C55E',
  primaryLight: '#052E16',
  primaryBg: '#052E16',
  primaryText: '#000000',
  tabContainerBg: '#000000',
  tabActiveBg: '#0A331F',
  tabActiveBorder: '#22C55E',
  tabActiveText: '#86EFAC',
  tabInactiveText: '#4ADE80',
  tabBadgeActiveBg: '#14532D',
  tabBadgeActiveText: '#BBF7D0',
  tabBadgeInactiveBg: '#0D281E',
  tabBadgeInactiveText: '#4ADE80',
  accent: '#38BDF8',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.20)',
  income: '#22C55E',
  incomeBg: 'rgba(34, 197, 94, 0.20)',
  expense: '#FB7185',
  expenseBg: 'rgba(251, 113, 133, 0.20)',
  statusBar: 'light-content',
  statusBarBg: '#000000',
  topBar: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.85)',
  inputBg: '#060C09',
  inputBorder: '#143D2E',
  shadow: '#000000',
};

// -------------------------------------------------------------
// 11. TEMA AMOLED CYBER SUNSET (PRETO PURO & NEON CORAL) (PRO)
// -------------------------------------------------------------
export const amoledSunsetTheme: ThemeColors = {
  mode: 'amoled_sunset',
  name: 'AMOLED Cyber Sunset',
  isDark: true,
  background: '#000000',
  card: '#0D0709',
  cardSecondary: '#170C10',
  cardSelectedBg: '#2D0B16',
  cardSelectedBorder: '#F43F5E',
  surface: '#0D0709',
  surfaceElevated: '#211117',
  border: '#3D1420',
  borderLight: '#260D14',
  textPrimary: '#FFFFFF',
  textSecondary: '#FECDD3',
  textMuted: '#FB7185',
  primary: '#F43F5E',
  primaryLight: '#4C0519',
  primaryBg: '#4C0519',
  primaryText: '#FFFFFF',
  tabContainerBg: '#000000',
  tabActiveBg: '#330C19',
  tabActiveBorder: '#FB923C',
  tabActiveText: '#FDA4AF',
  tabInactiveText: '#FB7185',
  tabBadgeActiveBg: '#881337',
  tabBadgeActiveText: '#FFE4E6',
  tabBadgeInactiveBg: '#260D14',
  tabBadgeInactiveText: '#FB7185',
  accent: '#FB923C',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.20)',
  income: '#4ADE80',
  incomeBg: 'rgba(74, 222, 128, 0.20)',
  expense: '#F43F5E',
  expenseBg: 'rgba(244, 63, 94, 0.20)',
  statusBar: 'light-content',
  statusBarBg: '#000000',
  topBar: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.85)',
  inputBg: '#0D0709',
  inputBorder: '#3D1420',
  shadow: '#000000',
};

// -------------------------------------------------------------
// MAPA COMPLETO DE TEMAS
// -------------------------------------------------------------
export const themes: Record<ThemeMode, ThemeColors> = {
  light: lightTheme,
  dark_blue: darkBlueTheme,
  amoled: amoledTheme,
  rose_gold: roseGoldTheme,
  lavender: lavenderTheme,
  dracula: draculaTheme,
  emerald_dark: emeraldDarkTheme,
  midnight_slate: midnightSlateTheme,
  amoled_contrast: amoledContrastTheme,
  amoled_emerald: amoledEmeraldTheme,
  amoled_sunset: amoledSunsetTheme,
};
