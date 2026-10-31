import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NotificationRule, NotificationRuleType } from '../types';
import { useTheme } from '../theme/ThemeContext';
import {
  getNotificationRules,
  createNotificationRule,
  toggleNotificationRule,
  deleteNotificationRule,
} from '../database/notificationRepository';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendTestNotification,
  scheduleQuickTestAlarm,
  rescheduleAllNotifications,
  getNextTriggerInfo,
} from '../services/notificationService';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onRulesChanged?: () => void;
}

const RULE_TYPE_OPTIONS: {
  type: NotificationRuleType;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  defaultDays: number;
}[] = [
  {
    type: 'on_due_date',
    label: 'No dia recomendado de cobrança',
    sublabel: 'Avisa que "Fulano deve pagar hoje!" na data de acerto',
    icon: 'today-outline',
    color: '#0284C7',
    defaultDays: 0,
  },
  {
    type: 'after_first_purchase',
    label: 'Dias após a 1ª compra em aberto',
    sublabel: 'Ex: 30 dias que a pessoa comprou e ainda não pagou nada',
    icon: 'hourglass-outline',
    color: '#D97706',
    defaultDays: 30,
  },
  {
    type: 'after_due',
    label: 'Dias de atraso após o acerto',
    sublabel: 'Ex: 3 dias de atraso depois da data recomendada',
    icon: 'alert-circle-outline',
    color: '#DC2626',
    defaultDays: 3,
  },
  {
    type: 'before_due',
    label: 'Dias antes da data recomendada',
    sublabel: 'Lembrete amigável prévio antes do dia do acerto',
    icon: 'calendar-outline',
    color: '#7C3AED',
    defaultDays: 1,
  },
];

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
  onRulesChanged,
}) => {
  const { theme } = useTheme();

  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(true);

  // Estados do formulário de nova regra
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<NotificationRuleType>('on_due_date');
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testingScheduled, setTestingScheduled] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setCheckingPermission(true);
      let perm = await getNotificationPermissionStatus();
      if (!perm.granted) {
        await requestNotificationPermission();
        perm = await getNotificationPermissionStatus();
      }
      setPermissionGranted(perm.granted);
      setCheckingPermission(false);

      setLoadingRules(true);
      const list = await getNotificationRules();
      setRules(list);
      setLoadingRules(false);
    } catch (err) {
      console.warn('Erro ao carregar dados de notificação:', err);
      setCheckingPermission(false);
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
      setIsAddingRule(false);
    }
  }, [visible]);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permissão Necessária',
        'O Android bloqueou as notificações para este app. Deseja abrir as configurações do sistema para autorizar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      await rescheduleAllNotifications();
      Alert.alert('Sucesso', 'Permissão de notificação concedida!');
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
      Alert.alert('Notificação Enviada', 'Verifique a barra de notificações do seu aparelho!');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao disparar teste de notificação.');
    }
  };

  const handleTestScheduledAlarm = async () => {
    try {
      setTestingScheduled(true);
      await scheduleQuickTestAlarm(10);
      setTestingScheduled(false);
      Alert.alert(
        'Alarme Agendado para daqui a 10s!',
        'Um lembrete de teste foi agendado para disparar em exatamente 10 segundos.\n\nVocê pode bloquear a tela ou sair do app para conferir o disparo!'
      );
    } catch (err: any) {
      setTestingScheduled(false);
      Alert.alert('Erro', err.message || 'Falha ao agendar alarme de teste.');
    }
  };

  const handleToggleRule = async (rule: NotificationRule) => {
    try {
      const nextState = !rule.enabled;
      await toggleNotificationRule(rule.id, nextState);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextState } : r))
      );
      await rescheduleAllNotifications();
      onRulesChanged?.();

      if (nextState) {
        const info = getNextTriggerInfo(rule.time);
        if (info.isToday) {
          Alert.alert(
            'Lembrete Ativado ⏰',
            `Alarme programado para HOJE às ${info.formattedTime}h (em ~${info.diffMinutes} min).`
          );
        } else {
          Alert.alert(
            'Lembrete Ativado ⏰',
            `Como ${info.formattedTime}h já passou hoje, o primeiro alarme diário tocará AMANHÃ às ${info.formattedTime}h.`
          );
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar a regra.');
    }
  };

  const handleDeleteRule = (rule: NotificationRule) => {
    Alert.alert(
      'Excluir Lembrete',
      'Deseja remover este lembrete de cobrança?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotificationRule(rule.id);
              setRules((prev) => prev.filter((r) => r.id !== rule.id));
              await rescheduleAllNotifications();
              onRulesChanged?.();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir a regra.');
            }
          },
        },
      ]
    );
  };

  const handleSaveNewRule = async () => {
    try {
      setIsSubmitting(true);
      const hours = String(selectedTime.getHours()).padStart(2, '0');
      const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const triggerInfo = getNextTriggerInfo(timeStr);
      const days = selectedType === 'on_due_date' ? 0 : Math.max(1, selectedDays);

      const created = await createNotificationRule(selectedType, days, timeStr);
      setRules((prev) => [...prev, created]);
      await rescheduleAllNotifications();
      onRulesChanged?.();

      setIsSubmitting(false);
      setIsAddingRule(false);

      if (triggerInfo.isToday) {
        Alert.alert(
          'Lembrete Criado! ⏰',
          `Programado para HOJE às ${triggerInfo.formattedTime}h (em ~${triggerInfo.diffMinutes} min).\n\nO Android emitirá o alerta no horário exato configurado.`
        );
      } else {
        Alert.alert(
          'Lembrete Salvo! ⏰',
          `Como o horário ${triggerInfo.formattedTime}h já passou hoje, o primeiro alarme diário tocará AMANHÃ às ${triggerInfo.formattedTime}h.`
        );
      }
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Erro', err.message || 'Não foi possível cadastrar a regra.');
    }
  };

  const renderRuleTitle = (rule: NotificationRule) => {
    switch (rule.type) {
      case 'on_due_date':
        return 'No dia recomendado de cobrança';
      case 'after_first_purchase':
        return `${rule.days_offset} dias após a 1ª compra em aberto`;
      case 'after_due':
        return `${rule.days_offset} dia(s) de atraso após o acerto`;
      case 'before_due':
        return `${rule.days_offset} dia(s) antes da data recomendada`;
      default:
        return 'Lembrete de cobrança';
    }
  };

  const getRuleIcon = (type: NotificationRuleType) => {
    switch (type) {
      case 'on_due_date':
        return { name: 'today-outline' as const, color: '#0284C7', bg: '#E0F2FE' };
      case 'after_first_purchase':
        return { name: 'hourglass-outline' as const, color: '#D97706', bg: '#FEF3C7' };
      case 'after_due':
        return { name: 'alert-circle-outline' as const, color: '#DC2626', bg: '#FEE2E2' };
      case 'before_due':
        return { name: 'calendar-outline' as const, color: '#7C3AED', bg: '#EDE9FE' };
      default:
        return { name: 'notifications-outline' as const, color: '#4F46E5', bg: '#EEF2FF' };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconBox, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="notifications" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  Lembretes & Notificações
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
                  Configure quando cobrar e ser avisado
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Banner de Permissão */}
            {!checkingPermission && !permissionGranted && (
              <View style={[styles.warningBanner, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <Ionicons name="alert-circle" size={22} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B' }}>
                    Notificações Desativadas no Android
                  </Text>
                  <Text style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>
                    O sistema bloqueou os alertas deste app. Ative para receber os lembretes diários.
                  </Text>
                  <TouchableOpacity
                    style={[styles.bannerActionBtn, { backgroundColor: '#DC2626' }]}
                    onPress={handleRequestPermission}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                      Autorizar Notificações
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Ações de Teste */}
            <View style={styles.testActionsRow}>
              <TouchableOpacity
                style={[styles.testBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
                onPress={handleTestNotification}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={16} color={theme.primary} />
                <Text style={[styles.testBtnText, { color: theme.primary }]}>Testar Agora</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
                onPress={handleTestScheduledAlarm}
                activeOpacity={0.7}
                disabled={testingScheduled}
              >
                {testingScheduled ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <>
                    <Ionicons name="alarm-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.testBtnText, { color: theme.textSecondary }]}>Testar Alarme (10s)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Formulário de Adicionar Lembrete */}
            {isAddingRule ? (
              <View style={[styles.addFormBox, { backgroundColor: theme.cardSecondary, borderColor: theme.primary }]}>
                <View style={styles.addFormHeader}>
                  <Text style={[styles.addFormTitle, { color: theme.textPrimary }]}>
                    Novo Lembrete de Cobrança
                  </Text>
                  <TouchableOpacity onPress={() => setIsAddingRule(false)}>
                    <Ionicons name="close" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Seleção do Tipo */}
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  QUANDO VOCÊ DESEJA SER AVISADO?
                </Text>
                <View style={{ gap: 8, marginTop: 4 }}>
                  {RULE_TYPE_OPTIONS.map((opt) => {
                    const isSelected = selectedType === opt.type;
                    return (
                      <TouchableOpacity
                        key={opt.type}
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: isSelected ? theme.primaryBg : theme.card,
                            borderColor: isSelected ? theme.primary : theme.borderLight,
                          },
                        ]}
                        onPress={() => {
                          setSelectedType(opt.type);
                          if (opt.defaultDays > 0) setSelectedDays(opt.defaultDays);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={opt.icon as any} size={20} color={opt.color} style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.typeTitle, { color: theme.textPrimary }]}>{opt.label}</Text>
                          <Text style={[styles.typeSub, { color: theme.textMuted }]}>{opt.sublabel}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Se não for "No dia", seleciona os dias */}
                {selectedType !== 'on_due_date' && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      QUANTIDADE DE DIAS:
                    </Text>
                    <View style={styles.daysSelectorRow}>
                      {[1, 3, 7, 15, 30, 45, 60].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.dayChip,
                            {
                              backgroundColor: selectedDays === d ? theme.primary : theme.card,
                              borderColor: selectedDays === d ? theme.primary : theme.borderLight,
                            },
                          ]}
                          onPress={() => setSelectedDays(d)}
                        >
                          <Text
                            style={[
                              styles.dayChipText,
                              { color: selectedDays === d ? '#FFFFFF' : theme.textPrimary },
                            ]}
                          >
                            {d}d
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Seleção do Horário */}
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    HORÁRIO DO DISPARO:
                  </Text>
                  <TouchableOpacity
                    style={[styles.timeBtn, { backgroundColor: theme.card, borderColor: theme.borderLight }]}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color={theme.primary} />
                    <Text style={[styles.timeBtnText, { color: theme.textPrimary }]}>
                      {String(selectedTime.getHours()).padStart(2, '0')}:
                      {String(selectedTime.getMinutes()).padStart(2, '0')}h
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>
                      Toque para mudar
                    </Text>
                  </TouchableOpacity>

                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === 'android' ? 'default' : 'spinner'}
                      onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (date) setSelectedTime(date);
                      }}
                    />
                  )}
                </View>

                {/* Salvar ou Cancelar */}
                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: theme.borderLight }]}
                    onPress={() => setIsAddingRule(false)}
                  >
                    <Text style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 13 }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSaveNewRule}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        Salvar Lembrete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addRuleBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}
                onPress={() => setIsAddingRule(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.addRuleBtnText, { color: theme.primary }]}>
                  Adicionar Novo Lembrete
                </Text>
              </TouchableOpacity>
            )}

            {/* Lista de Regras Cadastradas */}
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                SEUS LEMBRETES CONFIGURADOS ({rules.length})
              </Text>

              {loadingRules ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 16 }} />
              ) : rules.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.borderLight }]}>
                  <Ionicons name="notifications-off-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Nenhum lembrete cadastrado.
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                    Toque no botão acima para adicionar regras de cobrança automática.
                  </Text>
                </View>
              ) : (
                rules.map((rule) => {
                  const iconInfo = getRuleIcon(rule.type);
                  return (
                    <View
                      key={rule.id}
                      style={[
                        styles.ruleCard,
                        {
                          backgroundColor: theme.cardSecondary,
                          borderColor: theme.borderLight,
                          opacity: rule.enabled ? 1 : 0.6,
                        },
                      ]}
                    >
                      <View style={[styles.ruleIconBox, { backgroundColor: iconInfo.bg }]}>
                        <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={[styles.ruleTitleText, { color: theme.textPrimary }]}>
                          {renderRuleTitle(rule)}
                        </Text>
                        <Text style={[styles.ruleSubText, { color: theme.textMuted }]}>
                          Disparo diário às {rule.time}h {rule.enabled ? '• Ativo' : '• Pausado'}
                        </Text>
                      </View>

                      <Switch
                        value={rule.enabled}
                        onValueChange={() => handleToggleRule(rule)}
                        thumbColor={rule.enabled ? theme.primary : '#94A3B8'}
                        trackColor={{ false: '#CBD5E1', true: theme.primaryBg }}
                      />

                      <TouchableOpacity
                        onPress={() => handleDeleteRule(rule)}
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  testActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addRuleBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addFormBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  addFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addFormTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeSub: {
    fontSize: 11,
    marginTop: 2,
  },
  daysSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  formActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  ruleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTitleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ruleSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
