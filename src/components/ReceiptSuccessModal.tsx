import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client, PaymentRecord } from '../types';
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

  if (!client || !payment) return null;

  const handleSendReceipt = async () => {
    let tplKey: 'full_receipt' | 'partial_receipt' | 'credit_receipt' = 'full_receipt';
    if (payment.payment_type === 'PARTIAL') {
      tplKey = 'partial_receipt';
    } else if (payment.payment_type === 'EXCESS') {
      tplKey = 'credit_receipt';
    }

    const text = await generateMessageText(tplKey, { client, payment });
    await sendWhatsAppMessage(client.whatsapp_primary, text);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.dialogCard, { backgroundColor: theme.card }]}>
          <View style={[styles.iconContainer, { backgroundColor: theme.incomeBg }]}>
            <Ionicons name="checkmark-circle" size={48} color={theme.income} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Régua Passada!</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Acerto registrado com sucesso no histórico de {client.nickname || client.name}.
          </Text>

          <View style={[styles.detailsBox, { backgroundColor: theme.cardSecondary }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Valor Recebido:</Text>
              <Text style={[styles.detailValue, { color: theme.income }]}>
                {formatCurrency(payment.amount_paid)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Saldo Resultante:</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                {formatCurrency(payment.resulting_balance)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.zapBtn, { backgroundColor: '#25D366' }]}
            onPress={handleSendReceipt}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.zapBtnText}>Enviar Recibo no Zap</Text>
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
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  detailsBox: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  zapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    borderRadius: 16,
    gap: 8,
    marginBottom: 10,
  },
  zapBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 10,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
