import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BusinessProfile } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import {
  getBusinessProfile,
  updateBusinessProfile,
} from '../database/businessRepository';

interface BusinessProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
  onOpenPixKeys?: () => void;
}

const BRAND_PALETTES = [
  '#4F46E5', // Indigo Clássico
  '#2563EB', // Azul Cobalto
  '#059669', // Verde Esmeralda
  '#D97706', // Âmbar / Laranja
  '#DC2626', // Vermelho Rubi
  '#7C3AED', // Roxo Violeta
  '#0F172A', // Preto Grafite
];

export const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  visible,
  onClose,
  onProfileUpdated,
  onOpenPixKeys,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [tradeName, setTradeName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string>('#4F46E5');
  const [hexInput, setHexInput] = useState<string>('#4F46E5');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const profile = await getBusinessProfile();
      setTradeName(profile.trade_name);
      setPhone(profile.phone);
      setLogoUri(profile.logo_uri);
      const color = profile.primary_color || '#4F46E5';
      setPrimaryColor(color);
      setHexInput(color);
    } catch (err) {
      console.warn('Erro ao carregar perfil do negócio:', err);
    }
  };

  const handlePickLogo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setLogoUri(res.assets[0].uri);
      }
    } catch (err) {
      console.warn('Erro ao escolher logotipo:', err);
      Alert.alert('Erro', 'Não foi possível carregar a imagem da galeria.');
    }
  };

  const handleRemoveLogo = () => {
    setLogoUri(null);
  };

  const handleHexChange = (text: string) => {
    let cleaned = text.trim();
    if (!cleaned.startsWith('#')) {
      cleaned = '#' + cleaned;
    }
    setHexInput(cleaned.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      setPrimaryColor(cleaned.toUpperCase());
    }
  };

  const handleSelectColorPreset = (color: string) => {
    setPrimaryColor(color);
    setHexInput(color);
  };

  const handleSaveProfile = async () => {
    if (!tradeName.trim()) {
      Alert.alert('Atenção', 'Informe o Nome Fantasia do seu negócio.');
      return;
    }

    let finalColor = primaryColor;
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      finalColor = hexInput;
    }

    setLoading(true);
    try {
      await updateBusinessProfile(tradeName.trim(), phone.trim(), logoUri, finalColor);
      Alert.alert('Sucesso', 'Perfil da sua loja atualizado com sucesso!');
      if (onProfileUpdated) onProfileUpdated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View
          style={[
            styles.drawerContent,
            {
              backgroundColor: theme.card,
              marginBottom: keyboardHeight,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Meu Negócio</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Perfil, identidade e personalização da loja
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Logo do Negócio com Botão de Ação */}
            <View style={styles.logoSection}>
              <TouchableOpacity onPress={handlePickLogo} style={styles.logoContainer} activeOpacity={0.8}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImage} />
                ) : (
                  <View
                    style={[
                      styles.logoPlaceholder,
                      { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons name="storefront" size={34} color={theme.primary} />
                    <Text style={[styles.logoText, { color: theme.primary }]}>Subir Logotipo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.logoActionBtns}>
                <TouchableOpacity
                  style={[styles.logoBtn, { backgroundColor: theme.primaryBg }]}
                  onPress={handlePickLogo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={16} color={theme.primary} />
                  <Text style={[styles.logoBtnText, { color: theme.primary }]}>
                    {logoUri ? 'Alterar Logo' : 'Escolher Imagem'}
                  </Text>
                </TouchableOpacity>

                {logoUri && (
                  <TouchableOpacity
                    style={[styles.logoBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={handleRemoveLogo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={[styles.logoBtnText, { color: "#DC2626" }]}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Nome Fantasia */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Nome Fantasia da Loja / Negócio *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                    fontWeight: '700',
                  },
                ]}
                placeholder="Ex: Mercearia do Zé, Boutique da Ana..."
                placeholderTextColor={theme.textMuted}
                value={tradeName}
                onChangeText={setTradeName}
              />
            </View>

            {/* WhatsApp do Negócio */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                WhatsApp de Contato da Loja
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="(DDD) 99999-9999"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {/* Seletor de Cor Primária da Marca + Input Hexadecimal */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Cor da sua Marca (nos relatórios, recibos e PDFs)
              </Text>

              {/* Bolinhas de Presets */}
              <View style={styles.paletteRow}>
                {BRAND_PALETTES.map((color) => {
                  const isSelected = primaryColor.toUpperCase() === color.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => handleSelectColorPreset(color)}
                      activeOpacity={0.7}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Campo de Código Hexadecimal Customizado */}
              <View style={styles.hexRow}>
                <View style={[styles.colorPreviewSwatch, { backgroundColor: primaryColor }]} />
                <View
                  style={[
                    styles.hexInputWrapper,
                    { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.hexPrefix, { color: theme.textMuted }]}>HEX:</Text>
                  <TextInput
                    style={[styles.hexInput, { color: theme.textPrimary }]}
                    placeholder="#4F46E5"
                    placeholderTextColor={theme.textMuted}
                    maxLength={7}
                    autoCapitalize="characters"
                    value={hexInput}
                    onChangeText={handleHexChange}
                  />
                </View>
              </View>
            </View>

            {/* Atalho para Gerenciamento de Chaves Pix */}
            {onOpenPixKeys && (
              <TouchableOpacity
                style={[
                  styles.pixShortcutCard,
                  { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
                ]}
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenPixKeys(), 200);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.pixIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="qr-code-outline" size={22} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pixCardTitle, { color: theme.textPrimary }]}>
                    Gerenciar Chaves Pix
                  </Text>
                  <Text style={[styles.pixCardSub, { color: theme.textSecondary }]}>
                    Cadastre suas chaves e selecione a conta principal para recebimento
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}

            {/* Botão Salvar Perfil */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveProfile}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="save-outline" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Text>
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
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
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
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    marginBottom: 10,
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoActionBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  paletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPreviewSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  hexInputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  hexPrefix: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  hexInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  pixShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  pixIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pixCardSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
