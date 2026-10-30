import React, { useState, useEffect, useRef } from 'react';
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

interface PlaceholderItem {
  tag: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PLACEHOLDERS: PlaceholderItem[] = [
  { tag: '{cliente}', label: 'Nome Cliente', icon: 'person-outline' },
  { tag: '{valor_total}', label: 'Total da Dívida', icon: 'cash-outline' },
  { tag: '{chave_pix}', label: 'Chave Pix Principal', icon: 'qr-code-outline' },
  { tag: '{lista_compras}', label: 'Lista de Compras', icon: 'list-outline' },
  { tag: '{nome_loja}', label: 'Nome da Loja', icon: 'storefront-outline' },
  { tag: '{valor_pago}', label: 'Valor Pago', icon: 'checkmark-circle-outline' },
  { tag: '{saldo_restante}', label: 'Saldo Restante', icon: 'wallet-outline' },
];

export const MessageTemplatesModal: React.FC<MessageTemplatesModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();
  const inputRef = useRef<TextInput>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<MessageTemplateKey>('friendly_reminder');
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [editingBody, setEditingBody] = useState<string>('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [saving, setSaving] = useState<boolean>(false);

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
        setCurrentTitle(current.title);
        setEditingBody(current.body);
        setSelection({ start: current.body.length, end: current.body.length });
      }
    } catch (err) {
      console.warn('Erro ao carregar templates:', err);
    }
  };

  const handleSelectTemplate = (t: MessageTemplate) => {
    setSelectedKey(t.template_key);
    setCurrentTitle(t.title);
    setEditingBody(t.body);
    setSelection({ start: t.body.length, end: t.body.length });
  };

  const handleInsertTag = (tag: string) => {
    const start = selection.start ?? editingBody.length;
    const end = selection.end ?? editingBody.length;
    const before = editingBody.substring(0, start);
    const after = editingBody.substring(end);

    const spaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
    const spaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n') ? ' ' : '';

    const insertion = `${spaceBefore}${tag}${spaceAfter}`;
    const newBody = before + insertion + after;
    const newCursor = start + insertion.length;

    setEditingBody(newBody);
    setSelection({ start: newCursor, end: newCursor });

    // Mantém o foco no input sem sumir o cursor
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSave = async () => {
    if (!editingBody.trim()) {
      Alert.alert('Atenção', 'O texto da mensagem não pode ficar vazio.');
      return;
    }

    setSaving(true);
    try {
      await updateMessageTemplate(selectedKey, currentTitle, editingBody);
      Alert.alert('Sucesso', 'Modelo de mensagem atualizado com sucesso!');
      await loadTemplates();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Restaurar Padrão de Fábrica',
      'Deseja restaurar este modelo para o texto original com emojis e formatação profissional?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            await resetMessageTemplate(selectedKey);
            await loadTemplates();
            Alert.alert('Restaurado', 'Modelo redefinido para o padrão original!');
          },
        },
      ]
    );
  };

  // Preview dinâmico para o lojista ver como o cliente enxergará no Zap
  const previewText = editingBody
    .replace(/{cliente}/g, 'João da Silva')
    .replace(/{nome_loja}/g, 'Minha Loja')
    .replace(/{valor_total}/g, 'R$ 145,00')
    .replace(/{chave_pix}/g, '11999998888')
    .replace(/{tipo_chave}/g, 'Celular')
    .replace(/{valor_pago}/g, 'R$ 145,00')
    .replace(/{saldo_restante}/g, 'R$ 0,00')
    .replace(/{lista_compras}/g, '• 12/10: Queijo e Café - R$ 45,00\n• 20/10: Mercado Geral - R$ 100,00');

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
              <Text style={[styles.title, { color: theme.textPrimary }]}>Modelos de Mensagem</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Textos automáticos para WhatsApp e Recibos
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Abas Superiores de Seleção de Modelo */}
          <View style={[styles.tabsWrapper, { borderBottomColor: theme.borderLight }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
              {templates.map((tpl) => {
                const isSelected = selectedKey === tpl.template_key;
                return (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[
                      styles.tabItem,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handleSelectTemplate(tpl)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: isSelected ? theme.primaryText : theme.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {tpl.title.split('(')[0].trim()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            {/* Título do Modelo (SOMENTE LEITURA conforme solicitado) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Disparo</Text>
              <View
                style={[
                  styles.titleBadgeBox,
                  { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
                ]}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={theme.primary} />
                <Text style={[styles.titleBadgeText, { color: theme.textPrimary }]}>
                  {currentTitle}
                </Text>
              </View>
            </View>

            {/* Barra de Variáveis com Touch Target Amplo (>= 44px) */}
            <View style={styles.fieldGroup}>
              <View style={styles.tagsHeaderRow}>
                <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>
                  Variáveis Disponíveis
                </Text>
                <Text style={[styles.tagsHelp, { color: theme.textMuted }]}>
                  Toque para inserir no cursor
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsScroll}
                keyboardShouldPersistTaps="always"
              >
                {PLACEHOLDERS.map((p) => (
                  <TouchableOpacity
                    key={p.tag}
                    style={[styles.tagChip, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}
                    onPress={() => handleInsertTag(p.tag)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={p.icon} size={15} color={theme.primary} />
                    <Text style={[styles.tagChipLabel, { color: theme.primary }]}>{p.label}</Text>
                    <View style={[styles.tagCodeBadge, { backgroundColor: theme.card }]}>
                      <Text style={[styles.tagCodeText, { color: theme.primary }]}>{p.tag}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Editor de Texto da Mensagem */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Texto do Modelo</Text>
              <TextInput
                ref={inputRef}
                style={[
                  styles.bodyTextArea,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                multiline
                numberOfLines={7}
                textAlignVertical="top"
                value={editingBody}
                onChangeText={setEditingBody}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                placeholder="Escreva a mensagem aqui..."
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {/* Preview ao Vivo do WhatsApp */}
            <View style={styles.fieldGroup}>
              <View style={styles.previewHeaderRow}>
                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                <Text style={[styles.previewHeaderTitle, { color: '#16A34A' }]}>
                  Como o cliente receberá no WhatsApp:
                </Text>
              </View>
              <View style={[styles.previewBox, { backgroundColor: '#E7F7ED', borderColor: '#BBF7D0' }]}>
                <Text style={styles.previewText}>{previewText}</Text>
              </View>
            </View>

            {/* Botões de Ação */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.resetBtn, { borderColor: theme.border }]}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.resetBtnText, { color: theme.textSecondary }]}>
                  Restaurar Padrão
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Text>
              </TouchableOpacity>
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
  tabsWrapper: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
  },
  body: {
    padding: 18,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  titleBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagsHelp: {
    fontSize: 11,
  },
  tagsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagCodeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  bodyTextArea: {
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  previewHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewText: {
    color: '#14532D',
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
