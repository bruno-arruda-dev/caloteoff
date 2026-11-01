import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  tradeName: string;
  logoUri?: string | null;
  onOpenDashboard?: () => void;
  onOpenClients: () => void;
  onOpenBusinessProfile: () => void;
  onOpenPixKeys: () => void;
  onOpenTemplates: () => void;
  onOpenNotifications?: () => void;
  onOpenBackup: () => void;
  onOpenThemes: () => void;
  onOpenSettings: () => void;
}

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  visible,
  onClose,
  tradeName,
  logoUri,
  onOpenDashboard,
  onOpenClients,
  onOpenBusinessProfile,
  onOpenPixKeys,
  onOpenTemplates,
  onOpenNotifications,
  onOpenBackup,
  onOpenThemes,
  onOpenSettings,
}) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-DRAWER_WIDTH);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleAction = (callback: () => void) => {
    onClose();
    setTimeout(() => {
      callback();
    }, 150);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Backdrop escurecido */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              backgroundColor: theme.backdrop,
              opacity: fadeAnim,
            },
          ]}
        />

        <View style={styles.contentRow}>
          {/* Gaveta Lateral Deslizante */}
          <Animated.View
            style={[
              styles.drawer,
              {
                backgroundColor: theme.card,
                borderRightColor: theme.border,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Topo do Menu com Marca e Fechar */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={styles.headerBrand}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logoImage} />
              ) : (
                <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
                  <Ionicons name="storefront-outline" size={22} color="#FFFFFF" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.appName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {tradeName || 'Irineu'}
                </Text>
                <Text style={[styles.appSubtitle, { color: theme.textMuted }]}>
                  Offline • Fiado no Zap
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {/* Seção 1: MEU NEGÓCIO & VENDAS */}
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>MEU NEGÓCIO & VENDAS</Text>

            {onOpenDashboard && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: theme.primaryBg,
                    borderColor: theme.primary,
                  },
                ]}
                onPress={() => handleAction(onOpenDashboard)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: theme.primary }]}>
                  <Ionicons name="stats-chart" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.itemTextContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Painel & Métricas</Text>
                    <View style={{ backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>NOVO</Text>
                    </View>
                  </View>
                  <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                    Saúde do fiado, gráficos e indicadores
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenBusinessProfile)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="storefront" size={20} color={theme.primary} />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Meu Negócio</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Nome fantasia, logotipo e cor da marca
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenPixKeys)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#7C3AED" />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Chaves Pix</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Contas de recebimento e chave favorita
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenClients)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="people-outline" size={20} color="#0284C7" />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Clientes</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Cadastro, histórico e gestão da carteira
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenTemplates)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Mensagens & Recibos</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Modelos de cobrança e quitação WhatsApp
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            {onOpenNotifications && (
              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
                onPress={() => handleAction(onOpenNotifications)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="notifications-outline" size={20} color="#D97706" />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Lembretes & Notificações</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                    Regras de cobrança automática e horários
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}

            {/* Seção 2: SEGURANÇA & DADOS */}
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>DADOS & SEGURANÇA</Text>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenBackup)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="cloud-upload-outline" size={20} color="#4338CA" />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Backup Criptografado</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Exportar ou restaurar base protegida
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Seção 3: PREFERÊNCIAS */}
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PREFERÊNCIAS & AJUSTES</Text>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenThemes)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="color-palette-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Aparência & Tema</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Modo claro, escuro ou AMOLED preto puro
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
              onPress={() => handleAction(onOpenSettings)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="settings-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Configurações Gerais</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  Bloqueio digital, notificações e plano PRO
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </ScrollView>

          {/* Rodapé da Gaveta */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <Ionicons name="shield-checkmark" size={16} color={theme.income} />
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Banco de dados 100% offline no celular
            </Text>
          </View>
        </Animated.View>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
      </View>
    </View>
  </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    zIndex: 10,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 36) : 48,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  appName: {
    fontSize: 17,
    fontWeight: '700',
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
