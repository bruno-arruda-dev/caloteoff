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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { DebitEntry } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrencyInput, parseCurrencyInput } from '../utils/currency';
import { updateDebitEntry } from '../database/entryRepository';
import { DatePickerField } from './DatePickerField';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';

interface EditDebitModalProps {
  visible: boolean;
  debit: DebitEntry | null;
  clientName: string;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteRequested?: (debit: DebitEntry) => void;
}

export const EditDebitModal: React.FC<EditDebitModalProps> = ({
  visible,
  debit,
  clientName,
  onClose,
  onSuccess,
  onDeleteRequested,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [amountRaw, setAmountRaw] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && debit) {
      setAmountRaw(formatCurrencyInput(debit.amount.toFixed(2)));
      setDueDate(debit.due_date);
      setDescription(debit.description || '');
      setPhotoUri(debit.receipt_image_uri || null);
      setAttachmentName(debit.receipt_image_uri ? 'Comprovante_Anexo' : null);
      setAttachMenuVisible(false);
      setErrorMessage(null);
    }
  }, [visible, debit]);

  if (!visible || !debit) return null;

  const handlePickFromCamera = async () => {
    setAttachMenuVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
        setAttachmentName('Foto_Camera.jpg');
      }
    } catch (err) {
      console.warn('Erro ao abrir câmera:', err);
    }
  };

  const handlePickFromGallery = async () => {
    setAttachMenuVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
        setAttachmentName('Foto_Galeria.jpg');
      }
    } catch (err) {
      console.warn('Erro ao abrir galeria:', err);
    }
  };

  const handlePickFromStorage = async () => {
    setAttachMenuVisible(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setPhotoUri(file.uri);
        setAttachmentName(file.name || 'Arquivo_Anexo');
      }
    } catch (err) {
      console.warn('Erro ao abrir arquivos do aparelho:', err);
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);
    const amount = parseCurrencyInput(amountRaw);
    if (amount <= 0) {
      setErrorMessage('Informe um valor válido para o lançamento.');
      return;
    }

    setLoading(true);
    try {
      await updateDebitEntry(debit.id, {
        amount,
        due_date: dueDate,
        description,
        receipt_image_uri: photoUri,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao atualizar lançamento.');
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
              borderTopColor: theme.border,
              paddingBottom: Math.max(16, keyboardHeight + 8),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Editar Fiado</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Cliente: <Text style={{ fontWeight: '700', color: theme.primary }}>{clientName}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={[styles.errorText, { color: '#B91C1C' }]}>{errorMessage}</Text>
            </View>
          )}

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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

            {/* Data do Fiado */}
            <DatePickerField
              value={dueDate}
              onChange={setDueDate}
              label="Data do Fiado"
              helperText="Data do lançamento da dívida"
            />

            {/* Descrição / Itens */}
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

            {/* Anexo do Canhoto / Comprovante */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Canhoto / Comprovante Anexo
              </Text>
              {photoUri ? (
                <View
                  style={[
                    styles.photoPreviewContainer,
                    { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
                  ]}
                >
                  {photoUri.toLowerCase().endsWith('.pdf') || attachmentName?.toLowerCase().endsWith('.pdf') ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, padding: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: '#FEE2E2',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name="document-text" size={24} color="#DC2626" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}
                          numberOfLines={1}
                        >
                          {attachmentName || 'Comprovante em PDF'}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textMuted }}>Arquivo anexo</Text>
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
                  onPress={() => setAttachMenuVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="attach-outline" size={22} color={theme.primary} />
                  <Text style={[styles.photoPickerText, { color: theme.primary }]}>
                    Anexar foto ou arquivo do canhoto
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Footer com Ações */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            {onDeleteRequested && (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                onPress={() => onDeleteRequested(debit)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={18} color={theme.primaryText} />
                  <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                    Salvar Alterações
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Menu In-App de Anexo de Arquivo */}
      <Modal
        visible={attachMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachMenuVisible(false)}
      >
        <View style={styles.attachBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAttachMenuVisible(false)}
          />
          <View style={[styles.attachCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.attachTitle, { color: theme.textPrimary }]}>
              Anexar Comprovante / Arquivo
            </Text>
            <Text style={[styles.attachSubtitle, { color: theme.textSecondary }]}>
              Selecione de onde deseja importar:
            </Text>

            <TouchableOpacity
              style={[styles.attachOptionRow, { backgroundColor: theme.cardSecondary }]}
              onPress={handlePickFromCamera}
            >
              <Ionicons name="camera-outline" size={20} color={theme.primary} />
              <Text style={[styles.attachOptionText, { color: theme.textPrimary }]}>
                Tirar Foto com a Câmera
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.attachOptionRow, { backgroundColor: theme.cardSecondary }]}
              onPress={handlePickFromGallery}
            >
              <Ionicons name="images-outline" size={20} color={theme.primary} />
              <Text style={[styles.attachOptionText, { color: theme.textPrimary }]}>
                Escolher da Galeria de Fotos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.attachOptionRow, { backgroundColor: theme.cardSecondary }]}
              onPress={handlePickFromStorage}
            >
              <Ionicons name="folder-open-outline" size={20} color={theme.primary} />
              <Text style={[styles.attachOptionText, { color: theme.textPrimary }]}>
                Memória do Aparelho (PDF / Arquivo)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.attachCancelBtn, { borderColor: theme.border }]}
              onPress={() => setAttachMenuVisible(false)}
            >
              <Text style={[styles.attachCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    padding: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    textAlign: 'center',
  },
  textArea: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  photoPreviewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#DC2626',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  photoPickerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  attachBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  attachCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  attachTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  attachSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  attachOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  attachOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachCancelBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  attachCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
