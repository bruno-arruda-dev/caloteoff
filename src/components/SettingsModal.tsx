import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { useLicense } from '../theme/LicenseContext';
import { isBiometricsAvailable, authenticateWithBiometrics } from '../services/authService';
import { getSetting, setSetting } from '../database/settingsRepository';
import { exportBackup, pickAndRestoreBackup } from '../services/backupService';
import { BackupType } from '../services/backup/backupTypes';
import { requestNotificationPermission, getNotificationPermissionStatus } from '../services/notificationService';
import { LimitPolicy } from '../types';

const APP_VERSION_STRING = 'v1.0.7 (Build 8)';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenThemes?: () => void;
  onOpenTemplates?: () => void;
  onOpenNotifications?: () => void;
  onOpenBusinessProfile?: () => void;
  onOpenPixKeys?: () => void;
  onDataRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onOpenThemes,
  onOpenTemplates,
  onOpenNotifications,
  onOpenBusinessProfile,
  onOpenPixKeys,
  onDataRestored,
}) => {
  const { theme, themeMode } = useTheme();
  const {
    maskType,
    setMaskTypeSetting,
    privacyDefault,
    setPrivacyDefaultSetting,
  } = usePrivacy();
  const { isPremium, planType, openPaywall, purchasePlan, resetToFree } = useLicense();

  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState<boolean>(false);
  const [globalLimitPolicy, setGlobalLimitPolicy] = useState<LimitPolicy>('AVISAR_E_PERMITIR');
  const devTapCountRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      loadSettings();
      devTapCountRef.current = 0;
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      const bioAvail = await isBiometricsAvailable();
      setHasBiometricHardware(bioAvail);

      const bioSaved = await getSetting('biometrics_enabled', 'false');
      setBiometricsEnabled(bioSaved === 'true');

      const notifPerm = await getNotificationPermissionStatus();
      setNotificationsEnabled(notifPerm.granted);

      const limitPol = await getSetting('global_limit_policy', 'AVISAR_E_PERMITIR');
      setGlobalLimitPolicy(limitPol as LimitPolicy);
    } catch (err) {
      console.warn('Erro ao carregar configurações:', err);
    }
  };

  const handleSetGlobalLimitPolicy = async (val: LimitPolicy) => {
    setGlobalLimitPolicy(val);
    await setSetting('global_limit_policy', val);
  };

  const handleVersionTap = async () => {
    devTapCountRef.current += 1;
    if (devTapCountRef.current >= 5) {
      devTapCountRef.current = 0;
      await purchasePlan('lifetime');
      Alert.alert(
        '👑 Modo Desenvolvedor Ativado',
        'Licença Vitalícia PRO desbloqueada com sucesso para testes do app!'
      );
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      if (!hasBiometricHardware) {
        Alert.alert(
          'Biometria Indisponível',
          'Seu dispositivo não possui biometria ou senha/PIN configurada no sistema Android.'
        );
        return;
      }

      const success = await authenticateWithBiometrics(
        'Confirme sua digital ou PIN para ativar o bloqueio'
      );
      if (success) {
        setBiometricsEnabled(true);
        await setSetting('biometrics_enabled', 'true');
        Alert.alert('Sucesso', 'Bloqueio por digital ativado! O app exigirá autenticação ao abrir.');
      }
    } else {
      setBiometricsEnabled(false);
      await setSetting('biometrics_enabled', 'false');
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted) {
        Alert.alert('Notificações Ativadas', 'Você receberá alertas automáticos de cobrança.');
      } else {
        Alert.alert('Permissão Negada', 'Habilite as notificações nas configurações do seu celular.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const executeExport = async (type: BackupType) => {
    const res = await exportBackup({ backupType: type });
    if (res.success) {
      const typeLabel =
        type === 'PENDING_ONLY'
          ? 'de Pendências'
          : type === 'CONSOLIDATED_ARCHIVE'
          ? 'Consolidado (Arquivo Morto)'
          : 'Completo';
      Alert.alert(
        'Sucesso 🎉',
        `Backup ${typeLabel} exportado e salvo com segurança!\n\n${
          res.header
            ? `• Clientes: ${res.header.summary.total_clients}\n• Registros: ${res.header.summary.total_entries}\n• Total: R$ ${res.header.summary.total_pending_amount.toFixed(2)}`
            : ''
        }`
      );
    } else {
      Alert.alert('Erro', res.error || 'Falha ao exportar backup');
    }
  };

  const handleExportBackup = () => {
    setExportModalVisible(true);
  };

  const handleRestoreBackup = () => {
    setRestoreModalVisible(true);
  };

  const executeRestore = async (mode: 'REPLACE_ALL' | 'MERGE') => {
    const res = await pickAndRestoreBackup(undefined, undefined, mode);
    if (res.success) {
      const summary = res.header?.summary;
      Alert.alert(
        'Restauração Concluída! 🎉',
        `Dados processados com sucesso via migração automática!\n\n${
          summary
            ? `• Clientes restaurados: ${summary.total_clients}\n• Registros: ${summary.total_entries}\n• Pendente: R$ ${summary.total_pending_amount.toFixed(2)}`
            : ''
        }`
      );
      if (onDataRestored) onDataRestored();
      onClose();
    } else if (res.error && res.error !== 'Seleção cancelada') {
      Alert.alert('Atenção', res.error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.drawerContent, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Configurações</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Segurança, privacidade e plano
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* SEGURANÇA & BIOMETRIA */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              SEGURANÇA & ACESSO
            </Text>

            <View
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="finger-print-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Bloqueio por Digital / PIN
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Exige biometria ao abrir o aplicativo
                </Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>

            {/* MODO PRIVACIDADE */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              MODO PRIVACIDADE (MASCARAMENTO)
            </Text>

            <View
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="eye-off-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Privacidade Ativa ao Abrir
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Inicia o app com nomes ou valores ocultos
                </Text>
              </View>
              <Switch
                value={privacyDefault}
                onValueChange={setPrivacyDefaultSetting}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>

            <View style={styles.maskTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.maskTypeBtn,
                  {
                    backgroundColor:
                      maskType === 'masked' ? theme.primary : theme.cardSecondary,
                  },
                ]}
                onPress={() => setMaskTypeSetting('masked')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.maskTypeBtnText,
                    {
                      color:
                        maskType === 'masked' ? theme.primaryText : theme.textSecondary,
                    },
                  ]}
                >
                  Mascarar (J*** S***)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.maskTypeBtn,
                  {
                    backgroundColor:
                      maskType === 'hidden' ? theme.primary : theme.cardSecondary,
                  },
                ]}
                onPress={() => setMaskTypeSetting('hidden')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.maskTypeBtnText,
                    {
                      color:
                        maskType === 'hidden' ? theme.primaryText : theme.textSecondary,
                    },
                  ]}
                >
                  Ocultar Total (••••••)
                </Text>
              </TouchableOpacity>
            </View>

            {/* POLÍTICA GLOBAL DE LIMITE DE CRÉDITO */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              POLÍTICA DE LIMITE DE FIADO (GERAL)
            </Text>
            <View
              style={[
                styles.policyContainer,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
            >
              <View style={styles.policyHeaderRow}>
                <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.itemTextCol}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    Se o cliente estourar o limite:
                  </Text>
                  <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                    Regra padrão do app (a regra do cliente tem prioridade)
                  </Text>
                </View>
              </View>

              <View style={styles.policyBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.policyChoiceBtn,
                    {
                      backgroundColor:
                        globalLimitPolicy === 'AVISAR_E_PERMITIR'
                          ? theme.primary
                          : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => handleSetGlobalLimitPolicy('AVISAR_E_PERMITIR')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      globalLimitPolicy === 'AVISAR_E_PERMITIR'
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={16}
                    color={
                      globalLimitPolicy === 'AVISAR_E_PERMITIR'
                        ? theme.primaryText
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.policyChoiceText,
                      {
                        color:
                          globalLimitPolicy === 'AVISAR_E_PERMITIR'
                            ? theme.primaryText
                            : theme.textSecondary,
                        fontWeight:
                          globalLimitPolicy === 'AVISAR_E_PERMITIR' ? '700' : '500',
                      },
                    ]}
                  >
                    Avisar e Permitir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.policyChoiceBtn,
                    {
                      backgroundColor:
                        globalLimitPolicy === 'BLOQUEAR_TOTAL'
                          ? theme.expense
                          : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => handleSetGlobalLimitPolicy('BLOQUEAR_TOTAL')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      globalLimitPolicy === 'BLOQUEAR_TOTAL'
                        ? 'close-circle'
                        : 'ellipse-outline'
                    }
                    size={16}
                    color={
                      globalLimitPolicy === 'BLOQUEAR_TOTAL'
                        ? '#FFFFFF'
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.policyChoiceText,
                      {
                        color:
                          globalLimitPolicy === 'BLOQUEAR_TOTAL'
                            ? '#FFFFFF'
                            : theme.textSecondary,
                        fontWeight:
                          globalLimitPolicy === 'BLOQUEAR_TOTAL' ? '700' : '500',
                      },
                    ]}
                  >
                    Bloquear Total
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* NOTIFICAÇÕES */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              ALERTAS E COBRANÇAS
            </Text>
            <View
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.warningBg }]}>
                <Ionicons name="notifications-outline" size={20} color={theme.warning} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Lembrete de Vencidos (1 Dia)
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Alerta diário às 09:00 com clientes atrasados
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.border, true: theme.warning }}
              />
            </View>

            {onOpenNotifications && (
              <TouchableOpacity
                style={[
                  styles.itemRow,
                  { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight, marginTop: 8 },
                ]}
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenNotifications(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.itemIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time-outline" size={20} color="#D97706" />
                </View>
                <View style={styles.itemTextCol}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    Regras de Notificação & Horários
                  </Text>
                  <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                    Cobrar no dia recomendado, dias após 1ª compra e atrasos
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}

            {/* BACKUP */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              DADOS & BACKUP
            </Text>
            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={handleExportBackup}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="cloud-upload-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Exportar Backup (.irineu)
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Completo, Apenas Pendências ou Arquivo Morto
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={handleRestoreBackup}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.incomeBg }]}>
                <Ionicons name="cloud-download-outline" size={20} color={theme.income} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Restaurar Backup
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Substituir tudo ou mesclar com histórico existente
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* CARD ELEGANTE DE LICENÇA & VERSÃO (PADRÃO MINHAS FINANÇAS) */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 18 }]}>
              LICENÇA & VERSÃO
            </Text>

            <View
              style={[
                styles.licenseCard,
                {
                  backgroundColor: theme.cardSecondary,
                  borderColor: isPremium ? theme.income : theme.border,
                },
              ]}
            >
              <View style={styles.licenseBadgeRow}>
                <View
                  style={[
                    styles.licenseBadge,
                    { backgroundColor: isPremium ? '#FEF3C7' : theme.primaryBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.licenseBadgeText,
                      { color: isPremium ? '#D97706' : theme.primary },
                    ]}
                  >
                    {isPremium
                      ? `CaloteOff PRO 👑 (${
                          planType === 'lifetime'
                            ? 'Vitalício'
                            : planType === 'annual'
                            ? 'Anual'
                            : 'Mensal'
                        })`
                      : 'Plano Básico Gratuito'}
                  </Text>
                </View>

                {/* Toque 5 vezes na versão para desbloquear PRO em modo dev */}
                <TouchableOpacity
                  onPress={handleVersionTap}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.licenseVersionText, { color: theme.textMuted }]}>
                    {APP_VERSION_STRING}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.licenseDescription, { color: theme.textSecondary }]}>
                {isPremium
                  ? 'Você tem acesso ilimitado a clientes sem restrição, recibos profissionais em PDF com seu logotipo, modo privacidade e backup seguro.'
                  : 'Você está no plano gratuito (até 5 clientes ativos com saldo). Faça upgrade para cadastrar devedores ilimitados e gerar comprovantes em PDF.'}
              </Text>

              {!isPremium ? (
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    onClose();
                    setTimeout(() => openPaywall(), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  <Text style={styles.upgradeBtnText}>Desbloquear Versão PRO</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.devResetBtn, { borderColor: theme.border }]}
                  onPress={async () => {
                    await resetToFree();
                    Alert.alert(
                      'Modo Teste',
                      'Plano redefinido para Gratuito para você testar as travas do aplicativo.'
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flask-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.devResetBtnText, { color: theme.textMuted }]}>
                    Alternar para Modo Gratuito (Ambiente de Testes)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* SEÇÃO SOBRE O APLICATIVO */}
            <View style={styles.aboutCard}>
              <Text style={[styles.aboutText, { color: theme.textMuted }]}>
                • <Text style={{ fontWeight: '700' }}>100% Offline-First:</Text> Seus clientes e fiados ficam guardados exclusivamente no banco de dados SQLite do seu celular.
              </Text>
              <Text style={[styles.aboutText, { color: theme.textMuted, marginTop: 4 }]}>
                • <Text style={{ fontWeight: '700' }}>Privacidade Total:</Text> Zero servidores externos, sem rastreamento e sem propagandas.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* MODAL VISUAL: SELEÇÃO CLARA DE EXPORTAÇÃO DE BACKUP */}
      <Modal visible={exportModalVisible} transparent animationType="fade" onRequestClose={() => setExportModalVisible(false)}>
        <View style={styles.subModalOverlay}>
          <View style={[styles.subModalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.subModalHeader}>
              <View>
                <Text style={[styles.subModalTitle, { color: theme.textPrimary }]}>Exportar Backup do Irineu</Text>
                <Text style={[styles.subModalSubtitle, { color: theme.textMuted }]}>Escolha a modalidade de dados que deseja salvar:</Text>
              </View>
              <TouchableOpacity onPress={() => setExportModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Opção 1: Backup Completo */}
              <TouchableOpacity
                style={[styles.backupCardOption, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}
                onPress={() => {
                  setExportModalVisible(false);
                  executeExport('FULL');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.backupCardTop}>
                  <View style={[styles.backupIconBox, { backgroundColor: theme.primary }]}>
                    <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.backupCardTitle, { color: theme.textPrimary }]}>1. Backup Completo</Text>
                      <View style={{ backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>RECOMENDADO</Text>
                      </View>
                    </View>
                    <Text style={[styles.backupCardSub, { color: theme.textSecondary }]}>Salva todos os dados sem exceção</Text>
                  </View>
                </View>
                <View style={styles.backupCardDetails}>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary }]}>• <Text style={{ fontWeight: '700' }}>O que inclui:</Text> Todos os clientes, contatos, compras em aberto, fiados pagos e histórico de amortizações.</Text>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary, marginTop: 4 }]}>• <Text style={{ fontWeight: '700' }}>Quando usar:</Text> Para trocar de aparelho ou manter uma cópia de segurança total e periódica.</Text>
                </View>
              </TouchableOpacity>

              {/* Opção 2: Apenas Pendências */}
              <TouchableOpacity
                style={[styles.backupCardOption, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
                onPress={() => {
                  setExportModalVisible(false);
                  executeExport('PENDING_ONLY');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.backupCardTop}>
                  <View style={[styles.backupIconBox, { backgroundColor: '#D97706' }]}>
                    <Ionicons name="flash" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.backupCardTitle, { color: theme.textPrimary }]}>2. Apenas Pendências</Text>
                      <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#B45309' }}>COBRANÇA ATIVA</Text>
                      </View>
                    </View>
                    <Text style={[styles.backupCardSub, { color: theme.textSecondary }]}>Focado no que tem para receber hoje</Text>
                  </View>
                </View>
                <View style={styles.backupCardDetails}>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary }]}>• <Text style={{ fontWeight: '700' }}>O que inclui:</Text> Somente os clientes que estão devendo e compras não pagas.</Text>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary, marginTop: 4 }]}>• <Text style={{ fontWeight: '700' }}>Quando usar:</Text> Backup rápido do dia a dia focado em cobrança, sem histórico passado.</Text>
                </View>
              </TouchableOpacity>

              {/* Opção 3: Histórico Consolidado */}
              <TouchableOpacity
                style={[styles.backupCardOption, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
                onPress={() => {
                  setExportModalVisible(false);
                  executeExport('CONSOLIDATED_ARCHIVE');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.backupCardTop}>
                  <View style={[styles.backupIconBox, { backgroundColor: '#475569' }]}>
                    <Ionicons name="archive" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.backupCardTitle, { color: theme.textPrimary }]}>3. Histórico Consolidado</Text>
                      <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>ARQUIVO MORTO</Text>
                      </View>
                    </View>
                    <Text style={[styles.backupCardSub, { color: theme.textSecondary }]}>Guarda quitações e contas já pagas</Text>
                  </View>
                </View>
                <View style={styles.backupCardDetails}>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary }]}>• <Text style={{ fontWeight: '700' }}>O que inclui:</Text> Somente compras quitadas e pagamentos recebidos no passado.</Text>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary, marginTop: 4 }]}>• <Text style={{ fontWeight: '700' }}>Quando usar:</Text> Para fins de conferência contábil e desafogar o dia a dia.</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL VISUAL: SELEÇÃO CLARA DE RESTAURAÇÃO DE BACKUP */}
      <Modal visible={restoreModalVisible} transparent animationType="fade" onRequestClose={() => setRestoreModalVisible(false)}>
        <View style={styles.subModalOverlay}>
          <View style={[styles.subModalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.subModalHeader}>
              <View>
                <Text style={[styles.subModalTitle, { color: theme.textPrimary }]}>Restaurar Backup do Irineu</Text>
                <Text style={[styles.subModalSubtitle, { color: theme.textMuted }]}>Escolha como deseja aplicar o arquivo no aparelho:</Text>
              </View>
              <TouchableOpacity onPress={() => setRestoreModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginTop: 12 }}>
              {/* Opção 1: Mesclar com Dados Atuais */}
              <TouchableOpacity
                style={[styles.backupCardOption, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}
                onPress={() => {
                  setRestoreModalVisible(false);
                  executeRestore('MERGE');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.backupCardTop}>
                  <View style={[styles.backupIconBox, { backgroundColor: theme.primary }]}>
                    <Ionicons name="git-merge-outline" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.backupCardTitle, { color: theme.textPrimary }]}>Mesclar com Dados Atuais</Text>
                      <View style={{ backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>MANTÉM O ATUAL</Text>
                      </View>
                    </View>
                    <Text style={[styles.backupCardSub, { color: theme.textSecondary }]}>Não apaga nada do que você já tem hoje</Text>
                  </View>
                </View>
                <View style={styles.backupCardDetails}>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary }]}>• Mantém todos os seus clientes e fiados atuais intactos.</Text>
                  <Text style={[styles.backupDetailItem, { color: theme.textSecondary, marginTop: 4 }]}>• Adiciona apenas clientes novos e lançamentos que não existirem no seu aparelho.</Text>
                </View>
              </TouchableOpacity>

              {/* Opção 2: Substituição Total */}
              <TouchableOpacity
                style={[styles.backupCardOption, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}
                onPress={() => {
                  setRestoreModalVisible(false);
                  executeRestore('REPLACE_ALL');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.backupCardTop}>
                  <View style={[styles.backupIconBox, { backgroundColor: '#DC2626' }]}>
                    <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.backupCardTitle, { color: '#991B1B' }]}>Substituição Total</Text>
                      <View style={{ backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>LIMPAR & RESTAURAR</Text>
                      </View>
                    </View>
                    <Text style={[styles.backupCardSub, { color: '#B91C1C' }]}>Deixa o aparelho exatamente igual ao arquivo</Text>
                  </View>
                </View>
                <View style={styles.backupCardDetails}>
                  <Text style={[styles.backupDetailItem, { color: '#991B1B' }]}>• Substitui a base local inteira pelos dados do backup selecionado.</Text>
                  <Text style={[styles.backupDetailItem, { color: '#991B1B', marginTop: 4 }]}>• Ideal ao comprar celular novo ou recuperar cópia geral.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  maskTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  maskTypeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  maskTypeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  licenseCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  licenseBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  licenseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  licenseBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  licenseVersionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  licenseDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  devResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  devResetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  policyContainer: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  policyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  policyBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  policyChoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  policyChoiceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  aboutCard: {
    paddingHorizontal: 6,
    paddingBottom: 30,
    marginTop: 6,
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 17,
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subModalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  subModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  backupCardOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  backupCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backupIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  backupCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  backupCardDetails: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  backupDetailItem: {
    fontSize: 11,
    lineHeight: 16,
  },
});
