import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  formatDateBR,
  getTodayISO,
  addMonthsPreservingDay,
  addDaysToISO,
  WEEKDAYS_PT,
} from '../utils/date';
import { useTheme } from '../theme/ThemeContext';

interface DatePickerFieldProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (dateISO: string) => void;
  label?: string;
  helperText?: string;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  label,
  helperText,
}) => {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState<boolean>(false);

  // Converte 'YYYY-MM-DD' para Date local seguro (evitando off-by-one de timezone)
  const getDateObject = (iso: string): Date => {
    if (!iso) return new Date();
    const parts = iso.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // No Android o picker fecha após seleção ou cancelamento
    setShowPicker(false);

    if (event.type === 'set' && selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  // Atalhos rápidos
  const setToday = () => {
    onChange(getTodayISO());
  };

  const setYesterday = () => {
    const base = value || getTodayISO();
    onChange(addDaysToISO(base, -1));
  };

  const addMonth = () => {
    const base = value || getTodayISO();
    const parts = base.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const res = addMonthsPreservingDay(y, m, 1, d);
      onChange(res.dateISO);
    }
  };

  const subtractMonth = () => {
    const base = value || getTodayISO();
    const parts = base.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const res = addMonthsPreservingDay(y, m, -1, d);
      onChange(res.dateISO);
    }
  };

  // Dia da semana por extenso para enriquecer a UX
  const getWeekdayLabel = (iso: string): string => {
    if (!iso) return 'Toque para selecionar';
    try {
      const d = getDateObject(iso);
      const weekday = WEEKDAYS_PT[d.getDay()] || '';
      const isToday = iso === getTodayISO();
      return isToday ? `Hoje • ${weekday}` : weekday;
    } catch {
      return iso;
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}

      {/* Botão de toque para abrir o DatePicker nativo */}
      <TouchableOpacity
        style={[
          styles.fieldButton,
          {
            backgroundColor: theme.cardSecondary,
            borderColor: theme.border,
          },
        ]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <View style={styles.leftContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primaryBg }]}>
            <Ionicons name="calendar" size={18} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.dateText, { color: value ? theme.textPrimary : theme.textMuted }]}>
              {value ? formatDateBR(value) : 'Nenhuma data definida'}
            </Text>
            <Text style={[styles.subDateText, { color: theme.textMuted }]}>
              {getWeekdayLabel(value)}
            </Text>
          </View>
        </View>

        {value ? (
          <View style={styles.rightActionsRow}>
            <TouchableOpacity
              onPress={() => onChange('')}
              style={[styles.clearActionBtn, { backgroundColor: theme.surface }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <View style={[styles.changeActionBadge, { backgroundColor: theme.primaryBg }]}>
              <Text style={[styles.changeActionText, { color: theme.primary }]}>Alterar</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.primary} />
            </View>
          </View>
        ) : (
          <View style={[styles.changeActionBadge, { backgroundColor: theme.primaryBg }]}>
            <Text style={[styles.changeActionText, { color: theme.primary }]}>Definir</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Barra de atalhos rápidos com design elegante */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={[
            styles.shortcutBtn,
            { backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 },
          ]}
          onPress={subtractMonth}
          activeOpacity={0.7}
        >
          <Ionicons name="remove-circle-outline" size={13} color={theme.textMuted} />
          <Text style={[styles.shortcutText, { color: theme.textMuted }]}>-1 Mês</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shortcutBtn,
            { backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 },
          ]}
          onPress={setYesterday}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={13} color={theme.textMuted} />
          <Text style={[styles.shortcutText, { color: theme.textMuted }]}>Ontem</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shortcutBtn,
            { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 },
          ]}
          onPress={setToday}
          activeOpacity={0.7}
        >
          <Ionicons name="today-outline" size={13} color={theme.primary} />
          <Text style={[styles.shortcutText, { color: theme.primary, fontWeight: '700' }]}>Hoje</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shortcutBtn,
            { backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 },
          ]}
          onPress={addMonth}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={13} color={theme.textMuted} />
          <Text style={[styles.shortcutText, { color: theme.textMuted }]}>+1 Mês</Text>
        </TouchableOpacity>
      </View>

      {helperText && <Text style={[styles.helperText, { color: theme.textMuted }]}>{helperText}</Text>}

      {/* Modal / Diálogo Nativo DateTimePicker (Android e iOS) */}
      {showPicker && (
        <DateTimePicker
          value={getDateObject(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
  },
  subDateText: {
    fontSize: 11,
    marginTop: 1,
  },
  changeActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 2,
  },
  changeActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
