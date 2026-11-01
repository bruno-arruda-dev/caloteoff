import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { formatCurrency } from '../utils/currency';
import { sendWhatsAppMessage, generateMessageText } from '../services/whatsappService';
import { getClientDebits } from '../database/entryRepository';
import { getClients } from '../database/clientRepository';
import {
  getDashboardMetrics,
  DashboardMetrics,
  AgingBucket,
  MonthlyHistoryItem,
  TopDebtorItem,
  ActionInsight,
} from '../services/dashboardService';

interface DashboardModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenClientDetails?: (clientId: string) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  visible,
  onClose,
  onOpenClientDetails,
}) => {
  const { theme } = useTheme();
  const { maskCurrency } = usePrivacy();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.warn('Erro ao carregar métricas do dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadMetrics();
    }
  }, [visible, loadMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
  };

  const handleCobrarZap = async (debtor: TopDebtorItem) => {
    try {
      const allClients = await getClients('highest_debt', debtor.name);
      const fullClient = allClients.find((c) => c.id === debtor.id);
      if (!fullClient) return;

      const openDebits = await getClientDebits(debtor.id, 'pending');
      const text = await generateMessageText('overdue_collection', {
        client: fullClient,
        openDebits,
      });
      await sendWhatsAppMessage(debtor.whatsapp, text);
    } catch (err) {
      console.warn('Erro ao disparar cobrança WhatsApp do dashboard:', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          {/* Top Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="stats-chart" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Painel de Controle</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Métricas vitais e saúde financeira do fiado
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleRefresh}
                style={[styles.headerIconBtn, { backgroundColor: theme.cardSecondary }]}
                activeOpacity={0.7}
                accessibilityLabel="Recarregar dados"
              >
                <Ionicons name="refresh-outline" size={18} color={theme.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.headerIconBtn, { backgroundColor: theme.cardSecondary }]}
                activeOpacity={0.7}
                accessibilityLabel="Fechar painel"
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Calculando indicadores em tempo real...
              </Text>
            </View>
          ) : !metrics ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Não foi possível calcular as métricas.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* 1. SEÇÃO DE INSIGHTS & RECOMENDAÇÕES PRIORITÁRIAS */}
              {metrics.actionInsights.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                    DIAGNÓSTICO & INSIGHTS DO NEGÓCIO
                  </Text>
                  {metrics.actionInsights.map((insight) => {
                    const isCrit = insight.type === 'critical';
                    const isWarn = insight.type === 'warning';
                    const isPos = insight.type === 'positive';

                    const borderCol = isCrit ? '#FCA5A5' : isWarn ? '#FDE68A' : isPos ? '#A7F3D0' : '#BFDBFE';
                    const bgCol = isCrit ? '#FEF2F2' : isWarn ? '#FFFBEB' : isPos ? '#ECFDF5' : '#EFF6FF';
                    const iconCol = isCrit ? '#DC2626' : isWarn ? '#D97706' : isPos ? '#059669' : '#2563EB';
                    const iconName = isCrit
                      ? 'alert-circle'
                      : isWarn
                      ? 'time'
                      : isPos
                      ? 'checkmark-circle'
                      : 'information-circle';

                    return (
                      <View
                        key={insight.id}
                        style={[
                          styles.insightCard,
                          { backgroundColor: bgCol, borderColor: borderCol },
                        ]}
                      >
                        <View style={styles.insightHeaderRow}>
                          <Ionicons name={iconName} size={18} color={iconCol} />
                          <Text style={[styles.insightBadgeText, { color: iconCol }]}>
                            {insight.badge}
                          </Text>
                        </View>
                        <Text style={[styles.insightTitle, { color: '#0F172A' }]}>
                          {insight.title}
                        </Text>
                        <Text style={[styles.insightDesc, { color: '#475569' }]}>
                          {insight.description}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* 2. KPIS PRINCIPAIS (GRID 2x2) */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                  INDICADORES PRINCIPAIS
                </Text>

                <View style={styles.kpiGrid}>
                  {/* Card 1: Total na Rua */}
                  <View style={[styles.kpiCard, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                    <View style={styles.kpiTopRow}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total na Rua</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="wallet-outline" size={16} color="#DC2626" />
                      </View>
                    </View>
                    <Text style={[styles.kpiValue, { color: theme.expense }]}>
                      {maskCurrency(formatCurrency(metrics.totalReceivables))}
                    </Text>
                    <View style={styles.kpiFooterRow}>
                      <Text style={[styles.kpiSubText, { color: theme.textMuted }]}>
                        {metrics.activeDebtorsCount} devedores ativos
                      </Text>
                    </View>
                  </View>

                  {/* Card 2: Recebido no Mês */}
                  <View style={[styles.kpiCard, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                    <View style={styles.kpiTopRow}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Recebido no Mês</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="cash-outline" size={16} color="#16A34A" />
                      </View>
                    </View>
                    <Text style={[styles.kpiValue, { color: theme.income }]}>
                      {maskCurrency(formatCurrency(metrics.totalReceivedThisMonth))}
                    </Text>
                    <View style={styles.kpiFooterRow}>
                      <Text style={[styles.kpiSubText, { color: theme.textMuted }]}>
                        +{maskCurrency(formatCurrency(metrics.totalDebitsThisMonth))} vendidos
                      </Text>
                    </View>
                  </View>

                  {/* Card 3: Taxa de Recuperação */}
                  <View style={[styles.kpiCard, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                    <View style={styles.kpiTopRow}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Taxa de Recuperação</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="trending-up-outline" size={16} color="#7C3AED" />
                      </View>
                    </View>
                    <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>
                      {metrics.recoveryRatePercent}%
                    </Text>
                    <View style={styles.kpiProgressTrack}>
                      <View
                        style={[
                          styles.kpiProgressBar,
                          {
                            width: `${Math.min(100, Math.max(5, metrics.recoveryRatePercent))}%`,
                            backgroundColor: '#7C3AED',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Card 4: Ticket Médio da Dívida */}
                  <View style={[styles.kpiCard, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                    <View style={styles.kpiTopRow}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ticket Médio</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
                        <Ionicons name="people-outline" size={16} color="#0284C7" />
                      </View>
                    </View>
                    <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                      {maskCurrency(formatCurrency(metrics.averageDebt))}
                    </Text>
                    <View style={styles.kpiFooterRow}>
                      <Text style={[styles.kpiSubText, { color: theme.textMuted }]}>
                        Base de {metrics.totalClients} clientes
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3. DISTRIBUIÇÃO DA CARTEIRA DE CLIENTES */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                  ESTADO DA CARTEIRA ({metrics.totalClients} CLIENTES)
                </Text>

                <View style={[styles.cardBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                  <View style={styles.walletBarContainer}>
                    {metrics.activeDebtorsCount > 0 && (
                      <View
                        style={{
                          flex: metrics.activeDebtorsCount,
                          backgroundColor: '#EF4444',
                          height: 12,
                          borderTopLeftRadius: 6,
                          borderBottomLeftRadius: 6,
                        }}
                      />
                    )}
                    {metrics.zeroBalanceCount > 0 && (
                      <View
                        style={{
                          flex: metrics.zeroBalanceCount,
                          backgroundColor: '#10B981',
                          height: 12,
                        }}
                      />
                    )}
                    {metrics.creditorCount > 0 && (
                      <View
                        style={{
                          flex: metrics.creditorCount,
                          backgroundColor: '#3B82F6',
                          height: 12,
                          borderTopRightRadius: 6,
                          borderBottomRightRadius: 6,
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.walletLegendRow}>
                    <View style={styles.walletLegendItem}>
                      <View style={[styles.walletDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.walletLegendText, { color: theme.textSecondary }]}>
                        Devendo: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{metrics.activeDebtorsCount}</Text>
                      </Text>
                    </View>

                    <View style={styles.walletLegendItem}>
                      <View style={[styles.walletDot, { backgroundColor: '#10B981' }]} />
                      <Text style={[styles.walletLegendText, { color: theme.textSecondary }]}>
                        Em dia: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{metrics.zeroBalanceCount}</Text>
                      </Text>
                    </View>

                    <View style={styles.walletLegendItem}>
                      <View style={[styles.walletDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={[styles.walletLegendText, { color: theme.textSecondary }]}>
                        Crédito: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{metrics.creditorCount}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 4. CURVA DE RISCO E ENVELHECIMENTO (AGING DA DÍVIDA) */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                    ENVELHECIMENTO DA DÍVIDA (AGING)
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted }}>
                    {maskCurrency(formatCurrency(metrics.totalReceivables))} total
                  </Text>
                </View>

                <View style={[styles.cardBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                  {/* Barra Progressiva Segmentada */}
                  <View style={styles.agingSegmentedBar}>
                    {metrics.aging.upToDate.amount > 0 && (
                      <View style={{ flex: metrics.aging.upToDate.amount, backgroundColor: '#10B981', height: 10 }} />
                    )}
                    {metrics.aging.today.amount > 0 && (
                      <View style={{ flex: metrics.aging.today.amount, backgroundColor: '#3B82F6', height: 10 }} />
                    )}
                    {metrics.aging.late1to15.amount > 0 && (
                      <View style={{ flex: metrics.aging.late1to15.amount, backgroundColor: '#F59E0B', height: 10 }} />
                    )}
                    {metrics.aging.late16to30.amount > 0 && (
                      <View style={{ flex: metrics.aging.late16to30.amount, backgroundColor: '#F97316', height: 10 }} />
                    )}
                    {metrics.aging.over30.amount > 0 && (
                      <View style={{ flex: metrics.aging.over30.amount, backgroundColor: '#EF4444', height: 10 }} />
                    )}
                  </View>

                  {/* Lista de Faixas com Valores e Percentuais */}
                  <View style={styles.agingList}>
                    {[
                      metrics.aging.upToDate,
                      metrics.aging.today,
                      metrics.aging.late1to15,
                      metrics.aging.late16to30,
                      metrics.aging.over30,
                    ].map((bucket: AgingBucket) => (
                      <View key={bucket.label} style={styles.agingRow}>
                        <View style={styles.agingRowLeft}>
                          <View style={[styles.agingColorDot, { backgroundColor: bucket.color }]} />
                          <Text style={[styles.agingRowLabel, { color: theme.textPrimary }]}>
                            {bucket.label}
                          </Text>
                          <Text style={[styles.agingCountTag, { color: theme.textMuted }]}>
                            ({bucket.count})
                          </Text>
                        </View>

                        <View style={styles.agingRowRight}>
                          <Text style={[styles.agingRowAmount, { color: theme.textPrimary }]}>
                            {maskCurrency(formatCurrency(bucket.amount))}
                          </Text>
                          <Text style={[styles.agingRowPct, { color: bucket.color }]}>
                            {bucket.percentage}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* 5. HISTÓRICO COMPARATIVO MENSAL (ÚLTIMOS 6 MESES) */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                    EVOLUÇÃO (ÚLTIMOS 6 MESES)
                  </Text>
                  <View style={styles.chartLegendRow}>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendColor, { backgroundColor: '#4F46E5' }]} />
                      <Text style={[styles.chartLegendText, { color: theme.textMuted }]}>Vendido</Text>
                    </View>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendColor, { backgroundColor: '#10B981' }]} />
                      <Text style={[styles.chartLegendText, { color: theme.textMuted }]}>Recebido</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.cardBox, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}>
                  {/* Gráfico de Barras Elegante com Alturas Proporcionais */}
                  {(() => {
                    const maxVal = Math.max(
                      100,
                      ...metrics.monthlyHistory.map((m) => Math.max(m.debitsCreated, m.paymentsReceived))
                    );

                    return (
                      <View style={styles.chartContainer}>
                        <View style={styles.barsContainer}>
                          {metrics.monthlyHistory.map((item: MonthlyHistoryItem) => {
                            const debHeight = Math.max(4, Math.round((item.debitsCreated / maxVal) * 90));
                            const payHeight = Math.max(4, Math.round((item.paymentsReceived / maxVal) * 90));

                            return (
                              <View key={item.monthKey} style={styles.monthCol}>
                                <View style={styles.barsPair}>
                                  {/* Barra Débito Criado */}
                                  <View
                                    style={[
                                      styles.bar,
                                      {
                                        height: debHeight,
                                        backgroundColor: '#4F46E5',
                                      },
                                    ]}
                                  />
                                  {/* Barra Pagamento Recebido */}
                                  <View
                                    style={[
                                      styles.bar,
                                      {
                                        height: payHeight,
                                        backgroundColor: '#10B981',
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={[styles.monthLabel, { color: theme.textSecondary }]}>
                                  {item.monthLabel}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* 6. CONCENTRAÇÃO DE RISCO: TOP 5 MAIORES DEVEDORES */}
              {metrics.topDebtors.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                    TOP MAIORES DEVEDORES (CONCENTRAÇÃO DE RISCO)
                  </Text>

                  {metrics.topDebtors.map((debtor: TopDebtorItem, index: number) => {
                    const isTop1 = index === 0;
                    return (
                      <View
                        key={debtor.id}
                        style={[
                          styles.debtorCard,
                          {
                            backgroundColor: theme.cardSecondary,
                            borderColor: isTop1 ? theme.expense : theme.borderLight,
                          },
                        ]}
                      >
                        <View style={styles.debtorCardTop}>
                          <View style={styles.debtorInfoLeft}>
                            <View style={[styles.rankBadge, { backgroundColor: isTop1 ? theme.expenseBg : theme.card }]}>
                              <Text
                                style={[
                                  styles.rankText,
                                  { color: isTop1 ? theme.expense : theme.textSecondary },
                                ]}
                              >
                                #{index + 1}
                              </Text>
                            </View>
                            <View>
                              <Text style={[styles.debtorName, { color: theme.textPrimary }]}>
                                {debtor.nickname}
                              </Text>
                              <Text style={[styles.debtorSub, { color: theme.textMuted }]}>
                                {debtor.percentageOfTotal}% de todo fiado na rua
                              </Text>
                            </View>
                          </View>

                          <View style={styles.debtorBalanceBox}>
                            <Text style={[styles.debtorAmount, { color: theme.expense }]}>
                              {maskCurrency(formatCurrency(debtor.currentBalance))}
                            </Text>
                            {debtor.oldestPendingDays > 0 && (
                              <Text style={[styles.debtorOldestTag, { color: theme.textMuted }]}>
                                Há {debtor.oldestPendingDays} dias aberto
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Barra de Uso do Limite se configurado */}
                        {debtor.creditLimit && debtor.creditLimit > 0 && (
                          <View style={styles.limitUsageContainer}>
                            <View style={styles.limitUsageHeader}>
                              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                                Limite: {maskCurrency(formatCurrency(debtor.creditLimit))}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: debtor.limitUsedPercentage >= 100 ? theme.expense : theme.textSecondary,
                                }}
                              >
                                {debtor.limitUsedPercentage}% usado
                              </Text>
                            </View>
                            <View style={styles.limitTrack}>
                              <View
                                style={[
                                  styles.limitFill,
                                  {
                                    width: `${Math.min(100, debtor.limitUsedPercentage)}%`,
                                    backgroundColor: debtor.limitUsedPercentage >= 100 ? theme.expense : theme.primary,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        )}

                        {/* Botão de Cobrança Rápida via WhatsApp */}
                        <View style={styles.debtorCardBottom}>
                          <TouchableOpacity
                            style={[styles.zapQuickBtn, { backgroundColor: '#25D366' }]}
                            onPress={() => handleCobrarZap(debtor)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
                            <Text style={styles.zapQuickBtnText}>Cobrar no Zap</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
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
  modalContent: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  insightCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  insightBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  insightDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  kpiIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  kpiFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiSubText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  kpiProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 4,
  },
  kpiProgressBar: {
    height: 4,
    borderRadius: 2,
  },
  cardBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  walletBarContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  walletLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  walletLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  walletLegendText: {
    fontSize: 12,
  },
  agingSegmentedBar: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  agingList: {
    gap: 10,
  },
  agingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agingColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  agingRowLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  agingCountTag: {
    fontSize: 11,
  },
  agingRowRight: {
    alignItems: 'flex-end',
  },
  agingRowAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  agingRowPct: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chartLegendColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  chartLegendText: {
    fontSize: 11,
  },
  chartContainer: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  monthCol: {
    alignItems: 'center',
    width: 44,
  },
  barsPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 90,
  },
  bar: {
    width: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  monthLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 6,
  },
  debtorCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  debtorCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  debtorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
  },
  debtorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  debtorSub: {
    fontSize: 11,
    marginTop: 2,
  },
  debtorBalanceBox: {
    alignItems: 'flex-end',
  },
  debtorAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  debtorOldestTag: {
    fontSize: 10,
    marginTop: 2,
  },
  limitUsageContainer: {
    marginTop: 10,
  },
  limitUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  limitTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  limitFill: {
    height: 4,
    borderRadius: 2,
  },
  debtorCardBottom: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  zapQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  zapQuickBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
