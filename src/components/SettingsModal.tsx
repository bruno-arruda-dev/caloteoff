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
import { requestNotificationPermission, getNotificationPermissionStatus } from '../services/notificationService';
import { LimitPolicy } from '../types';

const APP_VERSION_STRING = 'v1.0.2 (Build 3)';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenThemes?: () => void;
  onOpenTemplates?: () => void;
  onOpenBusinessProfile?: () => void;
  onOpenPixKeys?: () => void;
  onDataRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onOpenThemes,
  onOpenTemplates,
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

  const handleExportBackup = async () => {
    Alert.alert(
      'Exportar Backup',
      'Deseja exportar uma cópia completa dos seus clientes, compras fiadas e chaves Pix?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar Agora',
          onPress: async () => {
            const res = await exportBackup();
            if (res.success) {
              Alert.alert('Sucesso', 'Arquivo de backup exportado com segurança!');
            } else {
              Alert.alert('Erro', res.error || 'Falha ao exportar backup');
            }
          },
        },
      ]
    );
  };

  const handleRestoreBackup = async () => {
    Alert.alert(
      'Restaurar Backup',
      'Ao restaurar um backup, os dados do arquivo substituirão os registros atuais. Deseja prosseguir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Selecionar Arquivo',
          onPress: async () => {
            const res = await pickAndRestoreBackup();
            if (res.success) {
              Alert.alert('Sucesso 🎉', 'Dados restaurados com sucesso!');
              if (onDataRestored) onDataRestored();
              onClose();
            } else if (res.error && res.error !== 'Seleção cancelada') {
              Alert.alert('Atenção', res.error);
            }
          },
        },
      ]
    );
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
                  Exportar Backup (.caloteoff)
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Salva cópia criptografada dos seus clientes e fiados
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
                  Importa clientes e histórico de arquivo protegido
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
});
