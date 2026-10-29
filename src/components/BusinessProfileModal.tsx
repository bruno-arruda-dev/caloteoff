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
import { BusinessProfile, PixKey, PixKeyType } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import {
  getBusinessProfile,
  updateBusinessProfile,
  getPixKeys,
  addPixKey,
  setPrimaryKey,
  deletePixKey,
} from '../database/businessRepository';

interface BusinessProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
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
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [tradeName, setTradeName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string>('#4F46E5');
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);

  // Estado para cadastro de nova chave Pix
  const [showAddPix, setShowAddPix] = useState<boolean>(false);
  const [newPixLabel, setNewPixLabel] = useState<string>('');
  const [newPixType, setNewPixType] = useState<PixKeyType>('PHONE');
  const [newPixValue, setNewPixValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const [profile, keys] = await Promise.all([getBusinessProfile(), getPixKeys()]);
      setTradeName(profile.trade_name);
      setPhone(profile.phone);
      setLogoUri(profile.logo_uri);
      setPrimaryColor(profile.primary_color);
      setPixKeys(keys);
      setShowAddPix(false);
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
    }
  };

  const handleSaveProfile = async () => {
    if (!tradeName.trim()) {
      Alert.alert('Atenção', 'Informe o Nome Fantasia do seu negócio.');
      return;
    }

    setLoading(true);
    try {
      await updateBusinessProfile(tradeName, phone, logoUri, primaryColor);
      Alert.alert('Sucesso', 'Perfil da sua loja atualizado com sucesso!');
      if (onProfileUpdated) onProfileUpdated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPix = async () => {
    if (!newPixValue.trim()) {
      Alert.alert('Atenção', 'Informe o valor da chave Pix.');
      return;
    }

    try {
      await addPixKey(
        newPixLabel.trim() || newPixType,
        newPixType,
        newPixValue.trim(),
        pixKeys.length === 0
      );
      setNewPixLabel('');
      setNewPixValue('');
      setShowAddPix(false);
      const updated = await getPixKeys();
      setPixKeys(updated);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao adicionar chave Pix');
    }
  };

  const handleSetPrimaryPix = async (id: string) => {
    await setPrimaryKey(id);
    const updated = await getPixKeys();
    setPixKeys(updated);
  };

  const handleDeletePix = async (id: string) => {
    Alert.alert('Remover Chave', 'Deseja realmente remover esta chave Pix?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deletePixKey(id);
          const updated = await getPixKeys();
          setPixKeys(updated);
        },
      },
    ]);
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
                Perfil, identidade e chaves Pix da sua loja
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Logo do Negócio */}
            <View style={styles.logoSection}>
              <TouchableOpacity onPress={handlePickLogo} style={styles.logoContainer}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImage} />
                ) : (
                  <View
                    style={[
                      styles.logoPlaceholder,
                      { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons name="storefront" size={32} color={theme.primary} />
                    <Text style={[styles.logoText, { color: theme.primary }]}>Adicionar Logo</Text>
                  </View>
                )}
              </TouchableOpacity>
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

            {/* Seletor de Cor Primária da Marca */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Cor da sua Marca (nos recibos e PDFs)
              </Text>
              <View style={styles.paletteRow}>
                {BRAND_PALETTES.map((color) => {
                  const isSelected = primaryColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setPrimaryColor(color)}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Seção de Chaves Pix */}
            <View style={styles.pixSection}>
              <View style={styles.pixHeader}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                  Chaves Pix para Recebimento
                </Text>
                <TouchableOpacity
                  style={[styles.addPixSmallBtn, { backgroundColor: theme.primaryBg }]}
                  onPress={() => setShowAddPix(!showAddPix)}
                >
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={[styles.addPixText, { color: theme.primary }]}>Nova Chave</Text>
                </TouchableOpacity>
              </View>

              {/* Formulário Inline de Nova Chave */}
              {showAddPix && (
                <View
                  style={[
                    styles.addPixForm,
                    { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Chave</Text>
                  <View style={styles.pixTypeRow}>
                    {(['PHONE', 'CPF', 'CNPJ', 'EMAIL', 'RANDOM'] as PixKeyType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pixTypeChip,
                          {
                            backgroundColor:
                              newPixType === type ? theme.primary : theme.surface,
                          },
                        ]}
                        onPress={() => setNewPixType(type)}
                      >
                        <Text
                          style={[
                            styles.pixTypeChipText,
                            {
                              color:
                                newPixType === type ? theme.primaryText : theme.textSecondary,
                            },
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                        marginTop: 10,
                      },
                    ]}
                    placeholder="Valor da chave Pix..."
                    placeholderTextColor={theme.textMuted}
                    value={newPixValue}
                    onChangeText={setNewPixValue}
                  />

                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                        marginTop: 8,
                      },
                    ]}
                    placeholder="Etiqueta (ex: Nubank, Banco Inter)..."
                    placeholderTextColor={theme.textMuted}
                    value={newPixLabel}
                    onChangeText={setNewPixLabel}
                  />

                  <TouchableOpacity
                    style={[styles.savePixBtn, { backgroundColor: theme.primary }]}
                    onPress={handleAddPix}
                  >
                    <Text style={[styles.savePixBtnText, { color: theme.primaryText }]}>
                      Salvar Chave Pix
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Lista de Chaves Cadastradas */}
              {pixKeys.length === 0 ? (
                <Text style={[styles.emptyPixText, { color: theme.textMuted }]}>
                  Nenhuma chave Pix cadastrada. Adicione uma para facilitar a cobrança no Zap!
                </Text>
              ) : (
                pixKeys.map((k) => (
                  <View
                    key={k.id}
                    style={[
                      styles.pixKeyItem,
                      { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.pixLabel, { color: theme.textPrimary }]}>
                          {k.label} ({k.key_type})
                        </Text>
                        {k.is_primary && (
                          <View
                            style={[
                              styles.primaryBadge,
                              { backgroundColor: theme.incomeBg },
                            ]}
                          >
                            <Text style={[styles.primaryBadgeText, { color: theme.income }]}>
                              Principal
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.pixValue, { color: theme.textSecondary }]}>
                        {k.key_value}
                      </Text>
                    </View>

                    <View style={styles.pixItemActions}>
                      {!k.is_primary && (
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleSetPrimaryPix(k.id)}
                        >
                          <Ionicons name="star-outline" size={18} color={theme.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleDeletePix(k.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.expense} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSaveProfile}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={20} color={theme.primaryText} />
              <Text style={[styles.saveButtonText, { color: theme.primaryText }]}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Text>
            </TouchableOpacity>
          </View>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
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
    marginTop: 6,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  pixSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  pixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  addPixSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  addPixText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addPixForm: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  pixTypeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pixTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pixTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  savePixBtn: {
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  savePixBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyPixText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  pixKeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pixLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pixValue: {
    fontSize: 12,
    marginTop: 2,
  },
  pixItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
