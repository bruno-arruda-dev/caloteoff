import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client, DebitEntry, PaymentRecord } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { formatCurrency } from '../utils/currency';
import { formatDateBR, formatDateTimeBR } from '../utils/date';
import { getClientDebits } from '../database/entryRepository';
import { getClientPayments } from '../database/paymentRepository';
import { generateMessageText, sendWhatsAppMessage } from '../services/whatsappService';
import { shareClientStatementPdf } from '../services/pdfExportService';
import { useLicense } from '../theme/LicenseContext';

interface ClientDetailModalProps {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
  onEditClient: (client: Client) => void;
  onPassarRegua: (client: Client) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  visible,
  client,
  onClose,
  onEditClient,
  onPassarRegua,
}) => {
  const { theme } = useTheme();
  const { maskName, maskCurrency } = usePrivacy();
  const { isPremium, openPaywall } = useLicense();

  const [debits, setDebits] = useState<DebitEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<'30days' | 'all'>('30days');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (visible && client) {
      loadHistory();
    }
  }, [visible, client]);

  const loadHistory = async () => {
    if (!client) return;
    try {
      const [d, p] = await Promise.all([
        getClientDebits(client.id, 'all'),
        getClientPayments(client.id),
      ]);
      setDebits(d);
      setPayments(p);
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    }
  };

  if (!client) return null;

  const isDebtor = client.current_balance > 0.001;
  const isCreditor = client.current_balance < -0.001;

  const handleResendReceipt = async (p: PaymentRecord) => {
    let tplKey: 'full_receipt' | 'partial_receipt' | 'credit_receipt' = 'full_receipt';
    if (p.payment_type === 'PARTIAL') {
      tplKey = 'partial_receipt';
    } else if (p.payment_type === 'EXCESS') {
      tplKey = 'credit_receipt';
    }

    const text = await generateMessageText(tplKey, { client, payment: p });
    await sendWhatsAppMessage(client.whatsapp_primary, text);
  };

  const handleCobrarZap = async () => {
    const open = debits.filter((d) => d.status === 'pending');
    const text = await generateMessageText('overdue_collection', {
      client,
      openDebits: open,
    });
    await sendWhatsAppMessage(client.whatsapp_primary, text);
  };

  const handleExportPdf = async () => {
    if (!isPremium) {
      openPaywall({
        feature: 'pdf_export',
        title: 'Extratos em PDF é Pro',
        description: 'Gere extratos profissionais com logotipo, suas cores e chave Pix em PDF.',
      });
      return;
    }

    try {
      await shareClientStatementPdf(client, debits, payments);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao gerar PDF');
    }
  };

  // Montagem da Timeline Unificada
  const timelineEvents: {
    type: 'debit' | 'payment';
    date: string;
    debit?: DebitEntry;
    payment?: PaymentRecord;
  }[] = [
    ...debits.map((d) => ({ type: 'debit' as const, date: d.created_at, debit: d })),
    ...payments.map((p) => ({ type: 'payment' as const, date: p.created_at, payment: p })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.container, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
                {maskName(client.nickname || client.name)}
              </Text>
              {client.name !== client.nickname && (
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {maskName(client.name)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => onEditClient(client)} style={styles.iconBtn}>
              <Ionicons name="pencil" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Cartão de Saldo */}
            <View style={[styles.balanceCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
              <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                {isDebtor ? 'Total Pendente' : isCreditor ? 'Saldo a Favor' : 'Conta Zerada'}
              </Text>
              <Text
                style={[
                  styles.balanceAmount,
                  {
                    color: isDebtor
                      ? theme.expense
                      : isCreditor
                      ? theme.accent
                      : theme.income,
                  },
                ]}
              >
                {maskCurrency(formatCurrency(client.current_balance))}
              </Text>
              <Text style={[styles.clientZap, { color: theme.textMuted }]}>
                WhatsApp: {client.whatsapp_primary}
              </Text>
            </View>

            {/* Barra de Ações Rápidas */}
            <View style={styles.actionsBar}>
              {isDebtor && (
                <TouchableOpacity
                  style={[styles.quickActionBtn, { backgroundColor: '#25D366' }]}
                  onPress={handleCobrarZap}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Cobrar no Zap</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: theme.primary }]}
                onPress={() => onPassarRegua(client)}
              >
                <Ionicons name="checkmark-done" size={16} color={theme.primaryText} />
                <Text style={[styles.quickActionText, { color: theme.primaryText }]}>Passar a régua</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
                onPress={handleExportPdf}
              >
                <Ionicons name="document-text-outline" size={16} color={theme.textPrimary} />
                <Text style={[styles.quickActionText, { color: theme.textPrimary }]}>Extrato PDF</Text>
              </TouchableOpacity>
            </View>

            {/* Linha do Tempo */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Histórico e Auditoria
            </Text>

            {timelineEvents.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Nenhum lançamento registrado para este cliente.
              </Text>
            ) : (
              timelineEvents.map((evt, idx) => {
                if (evt.type === 'debit' && evt.debit) {
                  const d = evt.debit;
                  return (
                    <View
                      key={d.id}
                      style={[
                        styles.timelineCard,
                        { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
                      ]}
                    >
                      <View style={styles.timelineLeft}>
                        <View style={[styles.typeBadge, { backgroundColor: theme.expenseBg }]}>
                          <Ionicons name="cart" size={14} color={theme.expense} />
                          <Text style={[styles.typeBadgeText, { color: theme.expense }]}>Fiado</Text>
                        </View>
                        <Text style={[styles.timelineDate, { color: theme.textMuted }]}>
                          {formatDateBR(d.due_date)}
                        </Text>
                        <Text style={[styles.timelineDesc, { color: theme.textPrimary }]}>
                          {d.description || 'Lançamento de compra'}
                        </Text>
                        {d.receipt_image_uri && (
                          <TouchableOpacity
                            onPress={() => setSelectedPhoto(d.receipt_image_uri)}
                            style={styles.thumbWrapper}
                          >
                            <Image source={{ uri: d.receipt_image_uri }} style={styles.thumbnail} />
                            <Text style={[styles.thumbText, { color: theme.primary }]}>Ver Canhoto</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.timelineRight}>
                        <Text style={[styles.timelineAmount, { color: theme.expense }]}>
                          -{maskCurrency(formatCurrency(d.amount))}
                        </Text>
                        <Text
                          style={[
                            styles.statusTag,
                            { color: d.status === 'paid' ? theme.income : theme.warning },
                          ]}
                        >
                          {d.status === 'paid' ? 'Liquidado' : 'Pendente'}
                        </Text>
                      </View>
                    </View>
                  );
                } else if (evt.type === 'payment' && evt.payment) {
                  const p = evt.payment;
                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.timelineCard,
                        { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight },
                      ]}
                    >
                      <View style={styles.timelineLeft}>
                        <View style={[styles.typeBadge, { backgroundColor: theme.incomeBg }]}>
                          <Ionicons name="checkmark-circle" size={14} color={theme.income} />
                          <Text style={[styles.typeBadgeText, { color: theme.income }]}>
                            {p.payment_type === 'FULL'
                              ? 'Quitação Total'
                              : p.payment_type === 'EXCESS'
                              ? 'Com Troco'
                              : 'Abatimento'}
                          </Text>
                        </View>
                        <Text style={[styles.timelineDate, { color: theme.textMuted }]}>
                          {formatDateTimeBR(p.created_at)}
                        </Text>
                        {p.notes ? (
                          <Text style={[styles.timelineDesc, { color: theme.textPrimary }]}>
                            {p.notes}
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => handleResendReceipt(p)}
                        >
                          <Ionicons name="logo-whatsapp" size={12} color="#25D366" />
                          <Text style={styles.resendBtnText}>Reenviar Recibo</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timelineRight}>
                        <Text style={[styles.timelineAmount, { color: theme.income }]}>
                          +{formatCurrency(p.amount_paid)}
                        </Text>
                        <Text style={[styles.snapshotText, { color: theme.textMuted }]}>
                          Saldo pós: {formatCurrency(p.resulting_balance)}
                        </Text>
                      </View>
                    </View>
                  );
                }
                return null;
              })
            )}
          </ScrollView>

          {/* Modal de Zoom da Foto */}
          {selectedPhoto && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
              <View style={[styles.photoModalOverlay, { backgroundColor: '#000000' }]}>
                <TouchableOpacity
                  style={styles.closePhotoBtn}
                  onPress={() => setSelectedPhoto(null)}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />
              </View>
            </Modal>
          )}
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
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
  },
  header: {
    flexDirection: 'row',
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
  iconBtn: {
    padding: 8,
    marginLeft: 6,
  },
  scrollContent: {
    padding: 20,
  },
  balanceCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  clientZap: {
    fontSize: 12,
    marginTop: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  timelineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  timelineLeft: {
    flex: 1,
    marginRight: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginBottom: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineDate: {
    fontSize: 11,
    marginBottom: 2,
  },
  timelineDesc: {
    fontSize: 14,
    fontWeight: '500',
  },
  thumbWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  thumbText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineRight: {
    alignItems: 'flex-end',
  },
  timelineAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  snapshotText: {
    fontSize: 10,
    marginTop: 4,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  resendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#25D366',
  },
  photoModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePhotoBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '95%',
    height: '80%',
  },
});
