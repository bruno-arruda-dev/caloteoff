import React, { useState, useEffect } from 'react';
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

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenThemes: () => void;
  onOpenTemplates: () => void;
  onOpenBusinessProfile: () => void;
  onDataRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onOpenThemes,
  onOpenTemplates,
  onOpenBusinessProfile,
  onDataRestored,
}) => {
  const { theme, themeMode } = useTheme();
  const {
    maskType,
    setMaskTypeSetting,
    privacyDefault,
    setPrivacyDefaultSetting,
  } = usePrivacy();
  const { isPremium, planType, openPaywall } = useLicense();

  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (visible) {
      loadSettings();
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
    } catch (err) {
      console.warn('Erro ao carregar configurações:', err);
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
                Segurança, aparência e preferências
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Banner do Plano */}
            <TouchableOpacity
              style={[
                styles.planBanner,
                {
                  backgroundColor: isPremium ? theme.incomeBg : theme.warningBg,
                  borderColor: isPremium ? theme.income : theme.warning,
                },
              ]}
              onPress={() => openPaywall()}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPremium ? 'shield-checkmark' : 'star'}
                size={22}
                color={isPremium ? theme.income : theme.warning}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    styles.planBannerTitle,
                    { color: isPremium ? theme.income : theme.warning },
                  ]}
                >
                  {isPremium
                    ? `Assinante PRO Ativo (${planType === 'annual' ? 'Anual' : 'Mensal'})`
                    : 'Plano Gratuito (Até 5 clientes ativos)'}
                </Text>
                <Text style={[styles.planBannerSub, { color: theme.textPrimary }]}>
                  {isPremium
                    ? 'Aproveite clientes ilimitados e comprovantes em PDF.'
                    : 'Toque aqui para liberar clientes ilimitados e recibos em PDF.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Seção Meu Negócio */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              NEGÓCIO & IDENTIDADE
            </Text>
            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={() => {
                onClose();
                onOpenBusinessProfile();
              }}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="storefront-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Perfil da Loja & Chaves Pix
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Nome fantasia, logotipo e contas Pix para recebimento
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Modelos de Mensagem */}
            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={() => {
                onClose();
                onOpenTemplates();
              }}
            >
              <View style={[styles.itemIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Modelos de Mensagem e Recibos
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Edite os textos de cobrança e comprovantes do WhatsApp
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Seção Segurança & Bloqueio */}
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
                <Ionicons name="finger-print" size={18} color={theme.primary} />
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

            {/* Seção Privacidade no Balcão */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              MODO PRIVACIDADE NO BALCÃO
            </Text>
            <View
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="eye-off-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Iniciar Sempre com Privacidade
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Abre o app com nomes e valores mascarados
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
                  Mascarar (Bru***aes)
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

            {/* Aparência e Temas */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              APARÊNCIA & CORES
            </Text>
            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={() => {
                onClose();
                onOpenThemes();
              }}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="color-palette-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Tema Visual</Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Tema atual: {theme.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Notificações e Lembretes */}
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
                <Ionicons name="notifications-outline" size={18} color={theme.warning} />
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

            {/* Backup e Restauração */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              DADOS & BACKUP
            </Text>
            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
              ]}
              onPress={handleExportBackup}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Exportar Backup (.caloteoff)
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Salva cópia segura criptografada
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.itemRow,
                { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight, marginBottom: 30 },
              ]}
              onPress={handleRestoreBackup}
            >
              <View style={[styles.itemIcon, { backgroundColor: theme.incomeBg }]}>
                <Ionicons name="cloud-download-outline" size={18} color={theme.income} />
              </View>
              <View style={styles.itemTextCol}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  Restaurar Backup
                </Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  Importa clientes e histórico de arquivo
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
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
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  planBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  planBannerSub: {
    fontSize: 12,
    marginTop: 2,
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
});
