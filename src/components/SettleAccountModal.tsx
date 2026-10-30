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
import { Client, PaymentRecord } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import { formatCurrency, parseCurrencyInput } from '../utils/currency';
import { getTodayISO } from '../utils/date';
import { calculateSettlement } from '../utils/balanceCalculator';
import { processPayment } from '../database/paymentRepository';
import { DatePickerField } from './DatePickerField';

interface SettleAccountModalProps {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
  onSuccess: (payment: PaymentRecord, client: Client) => void;
}

export const SettleAccountModal: React.FC<SettleAccountModalProps> = ({
  visible,
  client,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();

  const [amountRaw, setAmountRaw] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayISO());
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible && client) {
      const debt = Math.max(0, client.current_balance);
      setAmountRaw(debt > 0 ? debt.toFixed(2).replace('.', ',') : '');
      setPaymentDate(getTodayISO());
      setNotes('');
    }
  }, [visible, client]);

  if (!client) return null;

  const currentDebt = Math.max(0, client.current_balance);
  const paidAmount = parseCurrencyInput(amountRaw);
  const settlement = calculateSettlement(currentDebt, paidAmount);

  const handleConfirm = async () => {
    if (paidAmount <= 0) {
      Alert.alert('Atenção', 'Informe o valor que você está recebendo.');
      return;
    }

    setLoading(true);
    try {
      const payment = await processPayment(client.id, paidAmount, notes, paymentDate);
      onSuccess(payment, client);
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao processar quitação.');
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
              <Text style={[styles.title, { color: theme.textPrimary }]}>Passar a Régua</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Acerto de contas de {client.nickname || client.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Resumo da Dívida Atual */}
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Dívida Acumulada
              </Text>
              <Text style={[styles.summaryValue, { color: theme.expense }]}>
                {formatCurrency(currentDebt)}
              </Text>
            </View>

            {/* Campo de Valor Recebido */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Quanto está sendo pago agora? (R$)
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.income,
                  },
                ]}
                placeholder="0,00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={amountRaw}
                onChangeText={setAmountRaw}
                autoFocus
              />
            </View>

            {/* Feedback Dinâmico da Liquidação */}
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor:
                    settlement.paymentType === 'FULL'
                      ? theme.incomeBg
                      : settlement.paymentType === 'EXCESS'
                      ? theme.primaryBg
                      : theme.warningBg,
                },
              ]}
            >
              <Ionicons
                name={
                  settlement.paymentType === 'FULL'
                    ? 'checkmark-circle'
                    : settlement.paymentType === 'EXCESS'
                    ? 'arrow-forward-circle'
                    : 'remove-circle'
                }
                size={22}
                color={
                  settlement.paymentType === 'FULL'
                    ? theme.income
                    : settlement.paymentType === 'EXCESS'
                    ? theme.primary
                    : theme.warning
                }
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color:
                        settlement.paymentType === 'FULL'
                          ? theme.income
                          : settlement.paymentType === 'EXCESS'
                          ? theme.primary
                          : theme.warning,
                    },
                  ]}
                >
                  {settlement.paymentType === 'FULL'
                    ? 'Quitação Total (Conta Zerada)'
                    : settlement.paymentType === 'EXCESS'
                    ? 'Pagamento com Troco / Crédito Futuro'
                    : 'Abatimento Parcial'}
                </Text>
                <Text style={[styles.resultSub, { color: theme.textPrimary }]}>
                  {settlement.paymentType === 'FULL'
                    ? 'O saldo do cliente vai a R$ 0,00.'
                    : settlement.paymentType === 'EXCESS'
                    ? `A dívida é quitada e o cliente fica com ${formatCurrency(settlement.newCreditBalance)} de saldo a favor!`
                    : `Restará uma dívida de ${formatCurrency(settlement.resultingBalance)}.`}
                </Text>
              </View>
            </View>

            {/* Data do Pagamento (Padrão Minhas Finanças) */}
            <DatePickerField
              value={paymentDate}
              onChange={setPaymentDate}
              label="Data do Pagamento"
              helperText="Data do acerto financeiro"
            />

            {/* Observações Opcionais */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Anotação (Opcional - ex: "Pix Nubank", "Dinheiro trocado")
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
                placeholder="Como foi feito o acerto..."
                placeholderTextColor={theme.textMuted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Footer de Ação */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={20} color={theme.primaryText} />
              <Text style={[styles.confirmBtnText, { color: theme.primaryText }]}>
                {loading ? 'Processando...' : 'Confirmar e Passar a Régua'}
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
  summaryBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  amountInput: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '800',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  resultSub: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
