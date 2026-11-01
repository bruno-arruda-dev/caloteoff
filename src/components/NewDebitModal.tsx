import React, { useState, useEffect, useCallback } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { Client, DebitEntry } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../utils/currency';
import { formatDateBR, getTodayISO } from '../utils/date';
import { checkCreditLimit } from '../utils/balanceCalculator';
import { addDebitEntry } from '../database/entryRepository';
import { getSetting } from '../database/settingsRepository';
import { DatePickerField } from './DatePickerField';

interface NewDebitModalProps {
  visible: boolean;
  clients: Client[];
  initialClient?: Client | null;
  onClose: () => void;
  onSuccess: (entry: DebitEntry) => void;
  onOpenNewClient: () => void;
}

export const NewDebitModal: React.FC<NewDebitModalProps> = ({
  visible,
  clients,
  initialClient,
  onClose,
  onSuccess,
  onOpenNewClient,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [amountRaw, setAmountRaw] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(getTodayISO());
  const [description, setDescription] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [showMore, setShowMore] = useState<boolean>(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [isSelectingClient, setIsSelectingClient] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const resetForm = useCallback(() => {
    setSelectedClient(initialClient || null);
    setAmountRaw('');
    setDueDate(getTodayISO());
    setDescription('');
    setPhotoUri(null);
    setAttachmentName(null);
    setShowMore(false);
    setIsSelectingClient(false);
    setLoading(false);
    setClientSearch('');
  }, [initialClient]);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePickFromCamera = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoUri(res.assets[0].uri);
        setAttachmentName(res.assets[0].fileName || 'Foto_Canhoto.jpg');
      }
    } catch (err) {
      console.warn('Erro ao abrir câmera:', err);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoUri(res.assets[0].uri);
        setAttachmentName(res.assets[0].fileName || 'Imagem_Galeria.jpg');
      }
    } catch (err) {
      console.warn('Erro ao abrir galeria:', err);
    }
  };

  const handlePickFromStorage = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setPhotoUri(file.uri);
        setAttachmentName(file.name || 'Comprovante_Anexo');
      }
    } catch (err) {
      console.warn('Erro ao abrir arquivos do aparelho:', err);
    }
  };

  const handleOpenAttachOptions = () => {
    Alert.alert(
      'Anexar Comprovante / Arquivo',
      'De onde você deseja selecionar o arquivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '📷 Tirar Foto (Câmera)',
          onPress: handlePickFromCamera,
        },
        {
          text: '🖼️ Escolher da Galeria',
          onPress: handlePickFromGallery,
        },
        {
          text: '📁 Memória do Aparelho (PDF/Arquivo)',
          onPress: handlePickFromStorage,
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!selectedClient) {
      Alert.alert('Atenção', 'Selecione quem está pendurando este fiado.');
      return;
    }

    if (selectedClient.deleted_at) {
      Alert.alert(
        'Cliente Desativado',
        'Este cliente foi inativado e não pode realizar novas compras fiadas. Para liberar novas vendas, reative o cadastro na tela de Clientes.'
      );
      return;
    }

    const amount = parseCurrencyInput(amountRaw);
    if (amount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido maior que zero.');
      return;
    }

    // Checagem de Limite: regra do cliente tem prioridade; se PADRAO_GLOBAL, usa a geral das configurações
    let effectivePolicy = selectedClient.limit_policy;
    if (!effectivePolicy || effectivePolicy === 'PADRAO_GLOBAL') {
      const globalPol = await getSetting('global_limit_policy', 'AVISAR_E_PERMITIR');
      effectivePolicy = globalPol as any;
    }

    const limitCheck = checkCreditLimit(
      selectedClient.current_balance,
      amount,
      selectedClient.credit_limit,
      effectivePolicy
    );

    if (limitCheck.isExceeded) {
      if (!limitCheck.allowed) {
        Alert.alert(
          '⛔ Limite Bloqueado',
          `Este cliente tem limite de ${formatCurrency(selectedClient.credit_limit || 0)}. Com esta compra de ${formatCurrency(amount)}, a conta atingiria ${formatCurrency(limitCheck.projectedBalance)}, estourando o limite em ${formatCurrency(limitCheck.exceededAmount)}. A política configurada bloqueia novas compras fiadas.`
        );
        return;
      } else {
        // AVISAR_E_PERMITIR
        Alert.alert(
          '⚠️ Alerta de Limite Excedido',
          `Esta compra de ${formatCurrency(amount)} vai estourar o limite de fiado em ${formatCurrency(limitCheck.exceededAmount)} (Total: ${formatCurrency(limitCheck.projectedBalance)}). Deseja pendurar mesmo assim?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Pendurar Mesmo Assim',
              style: 'destructive',
              onPress: () => executeSave(amount),
            },
          ]
        );
        return;
      }
    }

    await executeSave(amount);
  };

  const executeSave = async (amount: number) => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const entry = await addDebitEntry({
        client_id: selectedClient.id,
        amount,
        due_date: dueDate,
        description,
        receipt_image_uri: photoUri,
      });

      onSuccess(entry);
      handleClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar fiado.');
    } finally {
      setLoading(false);
    }
  };

  const activeClients = clients.filter((c) => !c.deleted_at);

  const filteredClients = activeClients.filter((c) => {
    if (!clientSearch) return true;
    const term = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.nickname.toLowerCase().includes(term) ||
      c.whatsapp_primary.includes(term)
    );
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
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
              <Text style={[styles.title, { color: theme.textPrimary }]}>Pendurar Fiado</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Novo lançamento no caderno
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Seletor de Cliente */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Quem está pendurando?</Text>
              {selectedClient ? (
                <View
                  style={[
                    styles.clientSelectedBox,
                    { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientSelectedName, { color: theme.textPrimary }]}>
                      {selectedClient.nickname || selectedClient.name}
                    </Text>
                    <Text style={[styles.clientSelectedSub, { color: theme.textSecondary }]}>
                      Saldo atual: {formatCurrency(selectedClient.current_balance)} • WhatsApp:{' '}
                      {selectedClient.whatsapp_primary}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsSelectingClient(true)}
                    style={[styles.changeClientBtn, { backgroundColor: theme.surface }]}
                  >
                    <Text style={[styles.changeClientText, { color: theme.primary }]}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.selectClientTrigger,
                    { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                  ]}
                  onPress={() => setIsSelectingClient(true)}
                >
                  <Ionicons name="person-add-outline" size={18} color={theme.primary} />
                  <Text style={[styles.selectClientText, { color: theme.textPrimary }]}>
                    Toque para escolher o cliente...
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Lista expansível de busca rápida do cliente */}
            {isSelectingClient && (
              <View
                style={[
                  styles.clientPickerContainer,
                  { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                ]}
              >
                <View style={[styles.searchBox, { backgroundColor: theme.surface }]}>
                  <Ionicons name="search" size={16} color={theme.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                    placeholder="Buscar por nome, apelido ou zap..."
                    placeholderTextColor={theme.textMuted}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.quickNewClientRow, { borderBottomColor: theme.borderLight }]}
                  onPress={() => {
                    setIsSelectingClient(false);
                    onOpenNewClient();
                  }}
                >
                  <Ionicons name="add-circle" size={18} color={theme.primary} />
                  <Text style={[styles.quickNewClientText, { color: theme.primary }]}>
                    + Cadastrar Novo Cliente Agora
                  </Text>
                </TouchableOpacity>

                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {filteredClients.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.clientItem, { borderBottomColor: theme.borderLight }]}
                      onPress={() => {
                        setSelectedClient(c);
                        setIsSelectingClient(false);
                        setClientSearch('');
                      }}
                    >
                      <Text style={[styles.clientItemName, { color: theme.textPrimary }]}>
                        {c.nickname || c.name}
                      </Text>
                      <Text style={[styles.clientItemMeta, { color: theme.textSecondary }]}>
                        {formatCurrency(c.current_balance)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Valor (R$) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Valor da Conta (R$)</Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.expense,
                  },
                ]}
                placeholder="0,00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={amountRaw}
                onChangeText={(val) => setAmountRaw(formatCurrencyInput(val))}
              />
            </View>

            {/* Data de Vencimento / Fechamento com DatePickerField (Padrão Minhas Finanças) */}
            <DatePickerField
              value={dueDate}
              onChange={setDueDate}
              label="Data do Fiado"
              helperText="Data do lançamento da dívida"
            />

            {/* Botão Acordeão "Mostrar Mais" */}
            <TouchableOpacity
              style={[styles.showMoreToggle, { backgroundColor: theme.cardSecondary }]}
              onPress={() => setShowMore(!showMore)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showMore ? 'chevron-up' : 'options-outline'}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.showMoreText, { color: theme.primary }]}>
                {showMore ? 'Ocultar opções adicionais' : 'Mostrar mais (Itens, foto do canhoto...)'}
              </Text>
            </TouchableOpacity>

            {/* Opções Avançadas */}
            {showMore && (
              <View style={styles.advancedBox}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Quais produtos ou serviços?
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: theme.cardSecondary,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="Ex: 2 cervejas, 1 marmita, 1 pacote de arroz..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={3}
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Anexo do Canhoto / Comprovante
                  </Text>
                  {photoUri ? (
                    <View style={[styles.photoPreviewContainer, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                      {photoUri.toLowerCase().endsWith('.pdf') || attachmentName?.toLowerCase().endsWith('.pdf') ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, padding: 12 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Ionicons name="document-text" size={24} color="#DC2626" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>
                              {attachmentName || 'Comprovante em PDF'}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>Arquivo da memória do aparelho</Text>
                          </View>
                        </View>
                      ) : (
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                      )}
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => {
                          setPhotoUri(null);
                          setAttachmentName(null);
                        }}
                      >
                        <Ionicons name="trash" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.photoPickerBtn,
                        { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                      ]}
                      onPress={handleOpenAttachOptions}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="attach" size={22} color={theme.primary} />
                        <Text style={[styles.photoPickerText, { color: theme.primary }]}>
                          Anexar Canhoto, Foto ou Arquivo
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                        Câmera, Galeria de Fotos ou Memória do Aparelho (PDF/Docs)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer com Salvar */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={20} color={theme.primaryText} />
              <Text style={[styles.saveButtonText, { color: theme.primaryText }]}>
                {loading ? 'Salvando...' : 'Confirmar e Pendurar'}
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
    maxHeight: '90%',
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
  amountInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '800',
  },
  clientSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  clientSelectedName: {
    fontSize: 16,
    fontWeight: '700',
  },
  clientSelectedSub: {
    fontSize: 12,
    marginTop: 2,
  },
  changeClientBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeClientText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectClientTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  selectClientText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clientPickerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    height: 40,
    marginBottom: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  quickNewClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  quickNewClientText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clientItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  clientItemMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  showMoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  advancedBox: {
    marginBottom: 10,
  },
  textArea: {
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  photoPickerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    height: 140,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    padding: 8,
    borderRadius: 20,
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
