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
import { MessageTemplate, MessageTemplateKey } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import {
  getMessageTemplates,
  updateMessageTemplate,
  resetMessageTemplate,
} from '../database/messageTemplateRepository';

interface MessageTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
}

const PLACEHOLDERS = [
  { tag: '{cliente}', label: 'Nome do Cliente' },
  { tag: '{valor_total}', label: 'Valor da Dívida' },
  { tag: '{valor_pago}', label: 'Valor Pago' },
  { tag: '{saldo_restante}', label: 'Saldo Restante' },
  { tag: '{chave_pix}', label: 'Chave Pix' },
  { tag: '{tipo_chave}', label: 'Tipo da Chave' },
  { tag: '{nome_loja}', label: 'Nome da Loja' },
  { tag: '{lista_compras}', label: 'Lista de Compras' },
];

export const MessageTemplatesModal: React.FC<MessageTemplatesModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<MessageTemplateKey>('friendly_reminder');
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingBody, setEditingBody] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      const list = await getMessageTemplates();
      setTemplates(list);
      const current = list.find((t) => t.template_key === selectedKey) || list[0];
      if (current) {
        setSelectedKey(current.template_key);
        setEditingTitle(current.title);
        setEditingBody(current.body);
      }
    } catch (err) {
      console.warn('Erro ao carregar templates:', err);
    }
  };

  const handleSelectTemplate = (t: MessageTemplate) => {
    setSelectedKey(t.template_key);
    setEditingTitle(t.title);
    setEditingBody(t.body);
  };

  const handleInsertTag = (tag: string) => {
    setEditingBody((prev) => `${prev} ${tag}`);
  };

  const handleSave = async () => {
    try {
      await updateMessageTemplate(selectedKey, editingTitle, editingBody);
      Alert.alert('Salvo', 'Modelo de mensagem atualizado com sucesso!');
      await loadTemplates();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar template');
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Redefinir Modelo',
      'Deseja restaurar este modelo para o texto padrão original de fábrica?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            await resetMessageTemplate(selectedKey);
            await loadTemplates();
          },
        },
      ]
    );
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
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Modelos de Mensagem no Zap
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Personalize as mensagens e recibos enviados
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Seletor Horizontal de Modelos */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templatesNav}
            >
              {templates.map((t) => {
                const isSelected = selectedKey === t.template_key;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.templateNavChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handleSelectTemplate(t)}
                  >
                    <Text
                      style={[
                        styles.templateNavChipText,
                        {
                          color: isSelected ? theme.primaryText : theme.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t.title.split('(')[0].trim()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Título do Modelo */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Título do Modelo</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                value={editingTitle}
                onChangeText={setEditingTitle}
              />
            </View>

            {/* Inserir Tags Dinâmicas */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Tags Dinâmicas (Toque para inserir no texto)
              </Text>
              <View style={styles.tagsContainer}>
                {PLACEHOLDERS.map((p) => (
                  <TouchableOpacity
                    key={p.tag}
                    style={[styles.tagBadge, { backgroundColor: theme.primaryBg }]}
                    onPress={() => handleInsertTag(p.tag)}
                  >
                    <Ionicons name="add" size={12} color={theme.primary} />
                    <Text style={[styles.tagBadgeText, { color: theme.primary }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Corpo da Mensagem */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Texto da Mensagem</Text>
              <TextInput
                style={[
                  styles.bodyTextArea,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                multiline
                numberOfLines={6}
                value={editingBody}
                onChangeText={setEditingBody}
              />
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={14} color={theme.textMuted} />
              <Text style={[styles.resetBtnText, { color: theme.textMuted }]}>
                Restaurar este modelo para o padrão de fábrica
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Ionicons name="save-outline" size={18} color={theme.primaryText} />
              <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>Salvar Modelo</Text>
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
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  templatesNav: {
    gap: 8,
    marginBottom: 16,
  },
  templateNavChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  templateNavChipText: {
    fontSize: 12,
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
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bodyTextArea: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 10,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
