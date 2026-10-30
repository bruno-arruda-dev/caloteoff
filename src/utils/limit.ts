export interface LimitColorResult {
  border: string;
  bg: string;
  text: string;
  status: 'seguro' | 'baixo' | 'medio' | 'atencao' | 'critico' | 'estourado';
}

export function getLimitColors(percent: number, isDark: boolean = false): LimitColorResult {
  if (percent > 100) {
    // Estourado
    return {
      border: '#DC2626',
      bg: isDark ? 'rgba(220, 38, 38, 0.22)' : '#FEF2F2',
      text: isDark ? '#FCA5A5' : '#991B1B',
      status: 'estourado',
    };
  }
  if (percent >= 85) {
    // Crítico
    return {
      border: '#EF4444',
      bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
      text: isDark ? '#F87171' : '#DC2626',
      status: 'critico',
    };
  }
  if (percent >= 65) {
    // Atenção
    return {
      border: '#F97316',
      bg: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
      text: isDark ? '#FB923C' : '#C2410C',
      status: 'atencao',
    };
  }
  if (percent >= 40) {
    // Médio
    return {
      border: '#EAB308',
      bg: isDark ? 'rgba(234, 179, 8, 0.2)' : '#FEFCE8',
      text: isDark ? '#FACC15' : '#854D0E',
      status: 'medio',
    };
  }
  if (percent >= 20) {
    // Baixo
    return {
      border: '#84CC16',
      bg: isDark ? 'rgba(132, 204, 22, 0.2)' : '#F7FEE7',
      text: isDark ? '#A3E635' : '#4D7C0F',
      status: 'baixo',
    };
  }
  // Seguro / Início
  return {
    border: '#10B981',
    bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
    text: isDark ? '#6EE7B7' : '#047857',
    status: 'seguro',
  };
}
