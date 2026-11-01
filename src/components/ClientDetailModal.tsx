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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client, DebitEntry, PaymentRecord } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { formatCurrency } from '../utils/currency';
import { formatDateBR, formatDateTimeBR, getTodayISO, addDaysToISO } from '../utils/date';
import { getClientDebits } from '../database/entryRepository';
import { getClientPayments } from '../database/paymentRepository';
import { deleteClient } from '../database/clientRepository';
import { generateMessageText, sendWhatsAppMessage } from '../services/whatsappService';
import { shareClientStatementPdf } from '../services/pdfExportService';
import * as Sharing from 'expo-sharing';
import { useLicense } from '../theme/LicenseContext';
import { DatePickerField } from './DatePickerField';

interface ClientDetailModalProps {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
  onEditClient: (client: Client) => void;
  onPassarRegua: (client: Client) => void;
}

type PeriodType = 'all' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';

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
  const [filterPeriod, setFilterPeriod] = useState<PeriodType>('all');
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayISO());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayISO());
  const [visibleCount, setVisibleCount] = useState<number>(15);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState<boolean>(false);
  const [isDeletingClient, setIsDeletingClient] = useState<boolean>(false);

  useEffect(() => {
    if (visible && client) {
      loadHistory();
      setVisibleCount(15);
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

  const getFilterBounds = (): { start: string | null; end: string | null; label: string } => {
    const today = getTodayISO();
    if (filterPeriod === '7days') {
      return { start: addDaysToISO(today, -7), end: today, label: 'Últimos 7 dias' };
    }
    if (filterPeriod === '30days') {
      return { start: addDaysToISO(today, -30), end: today, label: 'Últimos 30 dias' };
    }
    if (filterPeriod === 'this_month') {
      const parts = today.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const start = `${parts[0]}-${parts[1]}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: 'Este Mês' };
    }
    if (filterPeriod === 'last_month') {
      const parts = today.split('-');
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10) - 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      const mStr = String(m).padStart(2, '0');
      const start = `${y}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: 'Mês Anterior' };
    }
    if (filterPeriod === 'custom') {
      return {
        start: customStartDate,
        end: customEndDate,
        label: `${formatDateBR(customStartDate)} a ${formatDateBR(customEndDate)}`,
      };
    }
    return { start: null, end: null, label: 'Todo o Histórico' };
  };

  const { start, end, label: currentPeriodLabel } = getFilterBounds();

  const filteredDebits = debits.filter((d) => {
    if (!start || !end) return true;
    const date = (d.due_date || d.created_at || '').slice(0, 10);
    return date >= start && date <= end;
  });

  const filteredPayments = payments.filter((p) => {
    if (!start || !end) return true;
    const date = (p.created_at || '').slice(0, 10);
    return date >= start && date <= end;
  });

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
      await shareClientStatementPdf(client, filteredDebits, filteredPayments, currentPeriodLabel);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao gerar PDF');
    }
  };

  // Montagem da Timeline Unificada Filtrada
  const timelineEvents: {
    type: 'debit' | 'payment';
    date: string;
    debit?: DebitEntry;
    payment?: PaymentRecord;
  }[] = [
    ...filteredDebits.map((d) => ({ type: 'debit' as const, date: d.created_at, debit: d })),
    ...filteredPayments.map((p) => ({ type: 'payment' as const, date: p.created_at, payment: p })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const pagedEvents = timelineEvents.slice(0, visibleCount);

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
            <TouchableOpacity
              onPress={() => onEditClient(client)}
              style={styles.iconBtn}
              accessibilityLabel="Editar cliente"
            >
              <Ionicons name="pencil" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirmDeleteVisible(true)}
              style={styles.iconBtn}
              accessibilityLabel="Desativar cliente"
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.iconBtn}
              accessibilityLabel="Fechar"
            >
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
                      ? theme.income
                      : theme.income,
                  },
                ]}
              >
                {isCreditor
                  ? `+${maskCurrency(formatCurrency(Math.abs(client.current_balance)))}`
                  : maskCurrency(formatCurrency(client.current_balance))}
              </Text>
              {isCreditor && (
                <View style={{ backgroundColor: theme.incomeBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'center', marginTop: 4 }}>
                  <Text style={{ color: theme.income, fontSize: 11, fontWeight: '700' }}>
                    ✓ Crédito a favor do cliente
                  </Text>
                </View>
              )}
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

            {/* Contatos Adicionais e Endereços */}
            {((client.phones && client.phones.length > 0) || (client.addresses && client.addresses.length > 0) || client.notes) && (
              <View style={[styles.extraInfoBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                {client.phones && client.phones.length > 0 && (
                  <View style={{ marginBottom: client.addresses && client.addresses.length > 0 ? 8 : 0 }}>
                    <Text style={[styles.extraInfoHeading, { color: theme.textSecondary }]}>
                      Outros Telefones:
                    </Text>
                    <View style={styles.chipsWrap}>
                      {client.phones.map((p, i) => (
                        <View key={p.id || i} style={[styles.infoChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Ionicons name="call-outline" size={12} color={theme.primary} />
                          <Text style={[styles.infoChipText, { color: theme.textPrimary }]}>
                            {p.label}: {p.number}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {client.addresses && client.addresses.length > 0 && (
                  <View style={{ marginTop: client.phones && client.phones.length > 0 ? 8 : 0 }}>
                    <Text style={[styles.extraInfoHeading, { color: theme.textSecondary }]}>
                      Endereços:
                    </Text>
                    {client.addresses.map((a, i) => (
                      <View key={a.id || i} style={[styles.addressItem, { borderLeftColor: theme.primary }]}>
                        <Text style={[styles.addressLabel, { color: theme.primary }]}>
                          {a.label || 'Principal'}
                        </Text>
                        <Text style={[styles.addressText, { color: theme.textPrimary }]}>
                          {a.street}{a.number ? `, ${a.number}` : ''}{a.neighborhood ? ` - ${a.neighborhood}` : ''}
                        </Text>
                        {a.reference ? (
                          <Text style={[styles.addressRef, { color: theme.textMuted }]}>
                            Ref: {a.reference}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}

                {client.notes ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.extraInfoHeading, { color: theme.textSecondary }]}>Observações:</Text>
                    <Text style={[styles.notesText, { color: theme.textPrimary }]}>{client.notes}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Cabeçalho do Histórico com Filtro de Período */}
            <View style={styles.historyHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 2 }]}>
                  Histórico e Auditoria
                </Text>
                <Text style={[styles.periodSubtitle, { color: theme.textSecondary }]}>
                  {currentPeriodLabel} • {timelineEvents.length} registro(s)
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: filterPeriod === 'all' ? theme.cardSecondary : theme.primary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons
                  name="filter"
                  size={15}
                  color={filterPeriod === 'all' ? theme.textPrimary : theme.primaryText}
                />
                <Text
                  style={[
                    styles.filterBtnText,
                    { color: filterPeriod === 'all' ? theme.textPrimary : theme.primaryText },
                  ]}
                >
                  Filtro
                </Text>
              </TouchableOpacity>
            </View>

            {timelineEvents.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Nenhum lançamento no período selecionado.
              </Text>
            ) : (
              pagedEvents.map((evt, idx) => {
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
                            onPress={async () => {
                              if (d.receipt_image_uri?.toLowerCase().endsWith('.pdf')) {
                                try {
                                  await Sharing.shareAsync(d.receipt_image_uri);
                                } catch {
                                  Alert.alert('Arquivo', 'Não foi possível abrir o documento PDF.');
                                }
                              } else {
                                setSelectedPhoto(d.receipt_image_uri);
                              }
                            }}
                            style={styles.thumbWrapper}
                          >
                            {d.receipt_image_uri?.toLowerCase().endsWith('.pdf') ? (
                              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="document-text" size={20} color="#DC2626" />
                              </View>
                            ) : (
                              <Image source={{ uri: d.receipt_image_uri }} style={styles.thumbnail} />
                            )}
                            <Text style={[styles.thumbText, { color: theme.primary }]}>
                              {d.receipt_image_uri?.toLowerCase().endsWith('.pdf') ? 'Abrir PDF' : 'Ver Canhoto'}
                            </Text>
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

            {/* Paginação: Carregar Mais */}
            {timelineEvents.length > visibleCount && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                onPress={() => setVisibleCount((prev) => prev + 15)}
                activeOpacity={0.7}
              >
                <Text style={[styles.loadMoreBtnText, { color: theme.primary }]}>
                  Carregar mais ({timelineEvents.length - visibleCount} restantes)
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Modal de Filtro de Período */}
          <Modal
            visible={showFilterModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowFilterModal(false)}
          >
            <View style={[styles.filterOverlay, { backgroundColor: theme.backdrop }]}>
              <View style={[styles.filterSheet, { backgroundColor: theme.card }]}>
                <View style={[styles.filterSheetHeader, { borderBottomColor: theme.borderLight }]}>
                  <Text style={[styles.filterSheetTitle, { color: theme.textPrimary }]}>
                    Filtrar por Período
                  </Text>
                  <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.filterSheetBody} showsVerticalScrollIndicator={false}>
                  {(
                    [
                      { key: 'all', label: 'Todo o histórico' },
                      { key: '7days', label: 'Últimos 7 dias' },
                      { key: '30days', label: 'Últimos 30 dias' },
                      { key: 'this_month', label: 'Este Mês' },
                      { key: 'last_month', label: 'Mês Anterior' },
                      { key: 'custom', label: 'Personalizado' },
                    ] as const
                  ).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterOptionRow,
                        {
                          backgroundColor:
                            filterPeriod === opt.key ? theme.primary + '15' : 'transparent',
                          borderColor: filterPeriod === opt.key ? theme.primary : theme.borderLight,
                        },
                      ]}
                      onPress={() => {
                        setFilterPeriod(opt.key);
                        setVisibleCount(15);
                        if (opt.key !== 'custom') {
                          setShowFilterModal(false);
                        }
                      }}
                    >
                      <Ionicons
                        name={
                          filterPeriod === opt.key
                            ? 'radio-button-on'
                            : 'radio-button-off'
                        }
                        size={20}
                        color={filterPeriod === opt.key ? theme.primary : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.filterOptionLabel,
                          {
                            color:
                              filterPeriod === opt.key ? theme.primary : theme.textPrimary,
                            fontWeight: filterPeriod === opt.key ? '700' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {filterPeriod === 'custom' && (
                    <View style={styles.customDateRangeBox}>
                      <DatePickerField
                        label="Data Inicial"
                        value={customStartDate}
                        onChange={(d) => {
                          setCustomStartDate(d);
                          setVisibleCount(15);
                        }}
                      />
                      <View style={{ height: 10 }} />
                      <DatePickerField
                        label="Data Final"
                        value={customEndDate}
                        onChange={(d) => {
                          setCustomEndDate(d);
                          setVisibleCount(15);
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.applyCustomBtn, { backgroundColor: theme.primary }]}
                        onPress={() => setShowFilterModal(false)}
                      >
                        <Text style={[styles.applyCustomBtnText, { color: theme.primaryText }]}>
                          Aplicar Período
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

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

          {/* MODAL DE CONFIRMAÇÃO DE INATIVAÇÃO DE CLIENTE (100% CROSS-PLATFORM) */}
          <Modal
            visible={confirmDeleteVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!isDeletingClient) setConfirmDeleteVisible(false);
            }}
          >
            <View style={styles.confirmBackdrop}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  if (!isDeletingClient) setConfirmDeleteVisible(false);
                }}
              />
              <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.confirmIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trash-outline" size={28} color="#DC2626" />
                </View>

                <Text style={[styles.confirmTitle, { color: theme.textPrimary }]}>
                  Desativar Cliente
                </Text>

                <Text style={[styles.confirmName, { color: theme.primary }]}>
                  {client ? client.nickname || client.name : ''}
                </Text>

                {client && client.current_balance > 0.001 ? (
                  <View style={[styles.confirmWarningBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.confirmWarningTitle, { color: '#991B1B' }]}>
                        Saldo Devedor: {maskCurrency(formatCurrency(client.current_balance))}
                      </Text>
                      <Text style={[styles.confirmWarningDesc, { color: '#B91C1C' }]}>
                        Este cliente possui débito pendente.
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={[styles.confirmInfoBox, { backgroundColor: theme.cardSecondary }]}>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={[styles.confirmInfoText, { color: theme.textSecondary }]}>
                      Não poderá realizar novas compras fiadas.
                    </Text>
                  </View>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                    <Text style={[styles.confirmInfoText, { color: theme.textSecondary }]}>
                      Cobranças, extratos e acertos continuam normais.
                    </Text>
                  </View>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="refresh-circle-outline" size={16} color="#4F46E5" />
                    <Text style={[styles.confirmInfoText, { color: theme.textSecondary }]}>
                      Pode ser reativado na tela de Gestão de Clientes.
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmActionsRow}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmCancelBtn, { borderColor: theme.border }]}
                    onPress={() => setConfirmDeleteVisible(false)}
                    disabled={isDeletingClient}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.confirmCancelText, { color: theme.textSecondary }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmDeleteBtn, { backgroundColor: '#DC2626' }]}
                    onPress={async () => {
                      if (!client) return;
                      setIsDeletingClient(true);
                      try {
                        await deleteClient(client.id);
                        setConfirmDeleteVisible(false);
                        onClose();
                      } catch (err: any) {
                        console.warn('Erro ao desativar cliente:', err);
                      } finally {
                        setIsDeletingClient(false);
                      }
                    }}
                    disabled={isDeletingClient}
                    activeOpacity={0.8}
                  >
                    {isDeletingClient ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteText}>Sim, Inativar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
  extraInfoBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  extraInfoHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  addressRef: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  periodSubtitle: {
    fontSize: 12,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginVertical: 10,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  filterSheetBody: {
    padding: 20,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  filterOptionLabel: {
    fontSize: 14,
  },
  customDateRangeBox: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  applyCustomBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  applyCustomBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  confirmName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    marginBottom: 12,
  },
  confirmWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmWarningDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  confirmInfoBox: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 18,
  },
  confirmInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  confirmInfoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  confirmCancelBtn: {
    borderWidth: 1,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmDeleteBtn: {},
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
