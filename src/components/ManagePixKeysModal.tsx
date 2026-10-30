import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PixKey, PixKeyType } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import {
  getPixKeys,
  addPixKey,
  setPrimaryKey,
  deletePixKey,
} from '../database/businessRepository';
import { authenticateWithBiometrics } from '../services/authService';

interface ManagePixKeysModalProps {
  visible: boolean;
  onClose: () => void;
  onKeysChanged?: () => void;
}

const PIX_TYPES: { id: PixKeyType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'PHONE', label: 'Celular', icon: 'call-outline' },
  { id: 'CPF', label: 'CPF', icon: 'person-outline' },
  { id: 'CNPJ', label: 'CNPJ', icon: 'business-outline' },
  { id: 'EMAIL', label: 'E-mail', icon: 'mail-outline' },
  { id: 'RANDOM', label: 'Aleatória', icon: 'key-outline' },
];

export const ManagePixKeysModal: React.FC<ManagePixKeysModalProps> = ({
  visible,
  onClose,
  onKeysChanged,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>('');
  const [newType, setNewType] = useState<PixKeyType>('PHONE');
  const [newValue, setNewValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadKeys();
    }
  }, [visible]);

  const loadKeys = async () => {
    try {
      const list = await getPixKeys();
      setPixKeys(list);
    } catch (err) {
      console.warn('Erro ao carregar chaves Pix:', err);
    }
  };

  const handleSetPrimary = async (key: PixKey) => {
    if (key.is_primary) return;

    // Exige autenticação biométrica ou PIN do Android antes de mudar a chave principal
    const authenticated = await authenticateWithBiometrics(
      `Confirme sua digital ou PIN para definir "${key.label || key.key_value}" como chave principal de recebimento.`
    );

    if (!authenticated) {
      Alert.alert('Autenticação Falhou', 'Não foi possível confirmar sua identidade para alterar a chave principal.');
      return;
    }

    try {
      await setPrimaryKey(key.id);
      await loadKeys();
      if (onKeysChanged) onKeysChanged();
      Alert.alert('Chave Atualizada', `"${key.label || key.key_value}" agora é a chave Pix principal do seu negócio!`);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao alterar chave favorita.');
    }
  };

  const handleDelete = async (key: PixKey) => {
    Alert.alert(
      'Remover Chave Pix',
      `Deseja realmente remover a chave "${key.label || key.key_value}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePixKey(key.id);
              await loadKeys();
              if (onKeysChanged) onKeysChanged();
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao remover chave Pix.');
            }
          },
        },
      ]
    );
  };

  const handleAddKey = async () => {
    if (!newValue.trim()) {
      Alert.alert('Atenção', 'Informe o valor da chave Pix (número, e-mail ou código).');
      return;
    }

    setLoading(true);
    try {
      await addPixKey(
        newLabel.trim() || newType,
        newType,
        newValue.trim(),
        pixKeys.length === 0 // se for a primeira chave vira primária automaticamente
      );
      setNewLabel('');
      setNewValue('');
      setShowAddForm(false);
      await loadKeys();
      if (onKeysChanged) onKeysChanged();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar chave Pix.');
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
              <Text style={[styles.title, { color: theme.textPrimary }]}>Minhas Chaves Pix</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Contas para recebimento de débitos e recibos
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Aviso sobre a Chave Principal */}
            <View style={[styles.infoBanner, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
              <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
              <Text style={[styles.infoBannerText, { color: theme.primary }]}>
                A chave marcada como <Text style={{ fontWeight: '700' }}>Principal</Text> é inserida automaticamente na variável <Text style={{ fontWeight: '700' }}>{'{chave_pix}'}</Text> em todas as mensagens de cobrança.
              </Text>
            </View>

            {/* Lista de Chaves Cadastradas */}
            <View style={styles.keysList}>
              {pixKeys.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                  <Ionicons name="qr-code-outline" size={36} color={theme.textMuted} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                    Nenhuma chave cadastrada
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Adicione suas chaves Pix para receber pagamentos e fechar as contas dos clientes.
                  </Text>
                </View>
              ) : (
                pixKeys.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.keyCard,
                      {
                        backgroundColor: theme.cardSecondary,
                        borderColor: item.is_primary ? theme.primary : theme.borderLight,
                        borderWidth: item.is_primary ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.keyCardHeader}>
                      <View style={styles.keyTitleRow}>
                        <View style={[styles.keyTypeBadge, { backgroundColor: theme.primaryBg }]}>
                          <Text style={[styles.keyTypeBadgeText, { color: theme.primary }]}>
                            {item.key_type}
                          </Text>
                        </View>
                        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>
                          {item.label}
                        </Text>
                      </View>

                      {item.is_primary ? (
                        <View style={[styles.primaryBadge, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
                          <Ionicons name="star" size={12} color="#D97706" />
                          <Text style={styles.primaryBadgeText}>Principal</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.setPrimaryBtn, { borderColor: theme.primary }]}
                          onPress={() => handleSetPrimary(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="star-outline" size={14} color={theme.primary} />
                          <Text style={[styles.setPrimaryBtnText, { color: theme.primary }]}>
                            Tornar Principal
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={[styles.keyValueText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.key_value}
                    </Text>

                    <View style={styles.keyCardFooter}>
                      <Text style={[styles.keyDate, { color: theme.textMuted }]}>
                        Cadastrada para cobranças
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDelete(item)}
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.expense} />
                        <Text style={[styles.deleteBtnText, { color: theme.expense }]}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Formulário de Adicionar Nova Chave */}
            {showAddForm ? (
              <View style={[styles.formContainer, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Nova Chave Pix</Text>

                {/* Seletor de Tipo */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Tipo de Chave</Text>
                <View style={styles.typeSelectorRow}>
                  {PIX_TYPES.map((t) => {
                    const isSelected = newType === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.card,
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setNewType(t.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: isSelected ? theme.primaryText : theme.textPrimary },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Apelido / Identificador da Chave */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Identificador / Banco (Opcional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Ex: Nubank da Loja, Sicredi Pessoal..."
                  placeholderTextColor={theme.textMuted}
                  value={newLabel}
                  onChangeText={setNewLabel}
                />

                {/* Valor da Chave */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Chave Pix (Valor) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder={
                    newType === 'PHONE'
                      ? '(DDD) 99999-9999'
                      : newType === 'CPF'
                      ? '000.000.000-00'
                      : newType === 'CNPJ'
                      ? '00.000.000/0000-00'
                      : newType === 'EMAIL'
                      ? 'seuemail@exemplo.com'
                      : 'Cole sua chave aleatória...'
                  }
                  placeholderTextColor={theme.textMuted}
                  keyboardType={
                    newType === 'PHONE'
                      ? 'phone-pad'
                      : newType === 'CPF' || newType === 'CNPJ'
                      ? 'numeric'
                      : newType === 'EMAIL'
                      ? 'email-address'
                      : 'default'
                  }
                  value={newValue}
                  onChangeText={setNewValue}
                />

                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: theme.border }]}
                    onPress={() => setShowAddForm(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleAddKey}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Salvar Chave</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowAddForm(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Cadastrar Nova Chave Pix</Text>
              </TouchableOpacity>
            )}
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
    padding: 18,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  keysList: {
    gap: 12,
    marginBottom: 16,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  keyCard: {
    padding: 14,
    borderRadius: 16,
  },
  keyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  keyTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  keyTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  keyLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  setPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  setPrimaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  keyValueText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  keyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    paddingTop: 8,
  },
  keyDate: {
    fontSize: 11,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
