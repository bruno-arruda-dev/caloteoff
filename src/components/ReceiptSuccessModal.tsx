import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client, PaymentRecord, MessageTemplateKey } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/currency';
import { generateMessageText, sendWhatsAppMessage } from '../services/whatsappService';

interface ReceiptSuccessModalProps {
  visible: boolean;
  client: Client | null;
  payment: PaymentRecord | null;
  onClose: () => void;
}

export const ReceiptSuccessModal: React.FC<ReceiptSuccessModalProps> = ({
  visible,
  client,
  payment,
  onClose,
}) => {
  const { theme } = useTheme();
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<MessageTemplateKey>('full_receipt');
  const [previewMessage, setPreviewMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  useEffect(() => {
    if (visible && payment && client) {
      // Determina a sugestão inteligente baseada no saldo resultante
      let suggestedKey: MessageTemplateKey = 'full_receipt';
      if (payment.resulting_balance > 0.009) {
        suggestedKey = 'partial_receipt';
      } else if (payment.resulting_balance < -0.009) {
        suggestedKey = 'credit_receipt';
      } else {
        suggestedKey = 'full_receipt';
      }

      setSelectedTemplateKey(suggestedKey);
      loadPreview(suggestedKey, client, payment);
    }
  }, [visible, payment, client]);

  const loadPreview = async (key: MessageTemplateKey, c: Client, p: PaymentRecord) => {
    try {
      const text = await generateMessageText(key, { client: c, payment: p });
      setPreviewMessage(text);
    } catch (err) {
      console.warn('Erro ao carregar preview do recibo:', err);
    }
  };

  if (!client || !payment) return null;

  const isFull = payment.resulting_balance === 0 || Math.abs(payment.resulting_balance) < 0.01;
  const isPartial = payment.resulting_balance > 0.009;
  const isCredit = payment.resulting_balance < -0.009;

  const handleSendReceipt = async () => {
    setSending(true);
    try {
      const text = previewMessage || (await generateMessageText(selectedTemplateKey, { client, payment }));
      await sendWhatsAppMessage(client.whatsapp_primary, text);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.dialogCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: isFull ? theme.incomeBg : isCredit ? '#EDE9FE' : theme.warningBg },
            ]}
          >
            <Ionicons
              name={isFull ? 'checkmark-circle' : isCredit ? 'star' : 'trending-down'}
              size={44}
              color={isFull ? theme.income : isCredit ? '#7C3AED' : theme.warning}
            />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {isFull ? 'Régua Passada! 🎉' : isCredit ? 'Saldo a Favor! 🌟' : 'Abatimento Registrado! 👍'}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Pagamento registrado no histórico de {client.nickname || client.name}.
          </Text>

          {/* Resumo Financeiro */}
          <View style={[styles.detailsBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Valor Recebido:</Text>
              <Text style={[styles.detailValue, { color: theme.income }]}>
                {formatCurrency(payment.amount_paid)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                {isCredit ? 'Crédito Restante:' : 'Saldo Resultante:'}
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: isFull ? theme.income : isCredit ? '#7C3AED' : theme.expense },
                ]}
              >
                {isFull
                  ? 'R$ 0,00 (Quitado)'
                  : isCredit
                  ? formatCurrency(Math.abs(payment.resulting_balance)) + ' (A Favor)'
                  : formatCurrency(payment.resulting_balance) + ' (Pendente)'}
              </Text>
            </View>
          </View>

          {/* Sugestão Inteligente de Recibo */}
          <View style={styles.receiptSuggestionBox}>
            <View style={styles.badgeRow}>
              <Ionicons name="sparkles" size={13} color={theme.primary} />
              <Text style={[styles.badgeText, { color: theme.primary }]}>
                Recibo Sugerido Automaticamente:
              </Text>
            </View>
            <Text style={[styles.receiptTypeTitle, { color: theme.textPrimary }]}>
              {selectedTemplateKey === 'full_receipt'
                ? 'Recibo de Quitação Total'
                : selectedTemplateKey === 'partial_receipt'
                ? 'Recibo de Abatimento Parcial'
                : 'Recibo com Saldo a Favor'}
            </Text>
          </View>

          {/* Preview da Mensagem */}
          <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.previewBubble, { backgroundColor: '#E7F7ED', borderColor: '#BBF7D0' }]}>
              <Text style={styles.previewText}>{previewMessage}</Text>
            </View>
          </ScrollView>

          {/* Botões */}
          <TouchableOpacity
            style={[styles.zapBtn, { backgroundColor: '#25D366' }]}
            onPress={handleSendReceipt}
            disabled={sending}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.zapBtnText}>Enviar Recibo no WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>Agora Não, Concluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  detailsBox: {
    width: '100%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  receiptSuggestionBox: {
    width: '100%',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  receiptTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewScroll: {
    width: '100%',
    maxHeight: 130,
    marginBottom: 16,
  },
  previewBubble: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewText: {
    color: '#14532D',
    fontSize: 12,
    lineHeight: 17,
  },
  zapBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  zapBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 10,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
