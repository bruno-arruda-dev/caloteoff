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
  const tabsScrollRef = useRef<ScrollView>(null);

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

  const getTemplateMeta = (key: string): { icon: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (key) {
      case 'friendly_reminder':
        return { icon: 'time-outline', color: '#0284C7' };
      case 'overdue_collection':
        return { icon: 'alert-circle-outline', color: '#DC2626' };
      case 'full_receipt':
        return { icon: 'checkmark-circle-outline', color: '#16A34A' };
      case 'partial_receipt':
        return { icon: 'cash-outline', color: '#7C3AED' };
      default:
        return { icon: 'chatbubble-outline', color: '#64748B' };
    }
  };

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

  const handleSelectTemplate = (t: MessageTemplate, index?: number) => {
    setSelectedKey(t.template_key);
    setCurrentTitle(t.title);
    setEditingBody(t.body);
    setSelection({ start: t.body.length, end: t.body.length });

    const idx = index !== undefined ? index : templates.findIndex((item) => item.template_key === t.template_key);
    if (idx >= 0 && tabsScrollRef.current) {
      tabsScrollRef.current.scrollTo({
        x: Math.max(0, idx * 135 - 20),
        animated: true,
      });
    }
  };

  const currentIndex = templates.findIndex((t) => t.template_key === selectedKey);

  const handlePrevTab = () => {
    if (currentIndex > 0) {
      const prev = templates[currentIndex - 1];
      handleSelectTemplate(prev, currentIndex - 1);
    }
  };

  const handleNextTab = () => {
    if (currentIndex >= 0 && currentIndex < templates.length - 1) {
      const next = templates[currentIndex + 1];
      handleSelectTemplate(next, currentIndex + 1);
    }
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

          {/* Abas Superiores de Seleção de Modelo com Affordance e Dica de Scroll */}
          <View style={[styles.tabsWrapper, { borderBottomColor: theme.borderLight, backgroundColor: theme.cardSecondary }]}>
            {/* Header de Orientação de Rolagem */}
            <View style={styles.tabsHeaderRow}>
              <View style={styles.tabsCountBadge}>
                <Ionicons name="chatbubbles-outline" size={13} color={theme.primary} />
                <Text style={[styles.tabsCountText, { color: theme.textSecondary }]}>
                  MODELO {currentIndex >= 0 ? currentIndex + 1 : 1} DE {templates.length}
                </Text>
              </View>

              <View style={[styles.swipeHintBadge, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                <Ionicons name="swap-horizontal-outline" size={13} color={theme.primary} />
                <Text style={[styles.swipeHintText, { color: theme.textSecondary }]}>
                  Deslize para ver todos 👉
                </Text>
              </View>
            </View>

            {/* Scroll Horizontal com Setas Laterais de Navegação */}
            <View style={styles.tabsScrollOuter}>
              {currentIndex > 0 && (
                <TouchableOpacity
                  style={[styles.arrowButton, styles.arrowLeft, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handlePrevTab}
                  activeOpacity={0.7}
                  accessibilityLabel="Modelo anterior"
                >
                  <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              )}

              <ScrollView
                ref={tabsScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContainer}
              >
                {templates.map((tpl, idx) => {
                  const isSelected = selectedKey === tpl.template_key;
                  const meta = getTemplateMeta(tpl.template_key);
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.tabItem,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.card,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => handleSelectTemplate(tpl, idx)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.tabIconBadge,
                          {
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : `${meta.color}15`,
                          },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={14}
                          color={isSelected ? theme.primaryText : meta.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color: isSelected ? theme.primaryText : theme.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {tpl.title.split('(')[0].trim()}
                      </Text>
                      {isSelected && (
                        <View style={[styles.activePillDot, { backgroundColor: theme.primaryText }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {currentIndex < templates.length - 1 && (
                <TouchableOpacity
                  style={[styles.arrowButton, styles.arrowRight, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handleNextTab}
                  activeOpacity={0.7}
                  accessibilityLabel="Próximo modelo"
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Indicador de Bolinhas Estilo Carrossel */}
            <View style={styles.dotsIndicatorRow}>
              {templates.map((tpl, idx) => {
                const isSelected = selectedKey === tpl.template_key;
                return (
                  <TouchableOpacity
                    key={`dot-${tpl.id}`}
                    onPress={() => handleSelectTemplate(tpl, idx)}
                    activeOpacity={0.7}
                    style={[
                      styles.indicatorDot,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.border,
                        width: isSelected ? 22 : 6,
                      },
                    ]}
                  />
                );
              })}
            </View>
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
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabsCountText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swipeHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabsScrollOuter: {
    position: 'relative',
    justifyContent: 'center',
  },
  arrowButton: {
    position: 'absolute',
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  arrowLeft: {
    left: 6,
  },
  arrowRight: {
    right: 6,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  tabIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
  },
  activePillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: 2,
  },
  dotsIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  indicatorDot: {
    height: 6,
    borderRadius: 3,
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
