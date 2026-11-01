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
  SafeAreaView,
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
} from '../services/dashboardService';

interface DashboardModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenClientDetails?: (clientId: string) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  visible,
  onClose,
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Barra Superior / Header Completo */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.borderLight }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.backBtn, { backgroundColor: theme.cardSecondary }]}
              activeOpacity={0.7}
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                Dashboard do Negócio
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Saúde financeira e métricas do fiado
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={[styles.refreshBtn, { backgroundColor: theme.cardSecondary }]}
            activeOpacity={0.7}
            accessibilityLabel="Atualizar métricas"
          >
            <Ionicons name="refresh" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Carregando indicadores em tempo real...
            </Text>
          </View>
        ) : !metrics ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.expense} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Não foi possível carregar as métricas do painel.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. HERO BANNER: VISÃO GERAL DO CAIXA ("NA RUA") */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.borderLight,
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    TOTAL A RECEBER ("NA RUA")
                  </Text>
                  <Text style={[styles.heroValue, { color: theme.expense }]}>
                    {maskCurrency(formatCurrency(metrics.totalReceivables))}
                  </Text>
                </View>
                <View style={[styles.heroBadge, { backgroundColor: theme.expenseBg }]}>
                  <Ionicons name="wallet-outline" size={14} color={theme.expense} />
                  <Text style={[styles.heroBadgeText, { color: theme.expense }]}>
                    {metrics.activeDebtorsCount} {metrics.activeDebtorsCount === 1 ? 'devedor' : 'devedores'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
                Ticket médio da dívida: {maskCurrency(formatCurrency(metrics.averageDebt))} por cliente em aberto
              </Text>

              {/* Grid Interno do Hero (Mês Atual) */}
              <View style={[styles.heroSubGrid, { borderTopColor: theme.borderLight }]}>
                <View style={styles.heroSubItem}>
                  <Text style={[styles.heroSubLabel, { color: theme.textMuted }]}>Recebido no Mês</Text>
                  <Text style={[styles.heroSubVal, { color: theme.income }]}>
                    {maskCurrency(formatCurrency(metrics.totalReceivedThisMonth))}
                  </Text>
                </View>

                <View style={[styles.heroSubDivider, { backgroundColor: theme.borderLight }]} />

                <View style={styles.heroSubItem}>
                  <Text style={[styles.heroSubLabel, { color: theme.textMuted }]}>Vendido no Mês</Text>
                  <Text style={[styles.heroSubVal, { color: theme.textPrimary }]}>
                    {maskCurrency(formatCurrency(metrics.totalDebitsThisMonth))}
                  </Text>
                </View>

                <View style={[styles.heroSubDivider, { backgroundColor: theme.borderLight }]} />

                <View style={styles.heroSubItem}>
                  <Text style={[styles.heroSubLabel, { color: theme.textMuted }]}>Recuperação</Text>
                  <Text style={[styles.heroSubVal, { color: '#7C3AED' }]}>
                    {metrics.recoveryRatePercent}%
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. DIAGNÓSTICO & INSIGHTS EM DESTAQUE */}
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
                        <Ionicons name={iconName} size={16} color={iconCol} />
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

            {/* 3. CARDS DE INDICADORES (LINHAS SIMÉTRICAS 2x2) */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                INDICADORES DE PERFORMANCE
              </Text>

              {/* Linha 1 */}
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <View style={styles.kpiTopRow}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Devedores Ativos</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="people" size={15} color="#DC2626" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                    {metrics.activeDebtorsCount}
                  </Text>
                  <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                    de {metrics.totalClients} clientes cadastrados
                  </Text>
                </View>

                <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <View style={styles.kpiTopRow}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Contas em Dia</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="checkmark-done" size={15} color="#16A34A" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: theme.income }]}>
                    {metrics.zeroBalanceCount}
                  </Text>
                  <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                    {metrics.totalClients > 0
                      ? `${Math.round((metrics.zeroBalanceCount / metrics.totalClients) * 100)}% da base zerada`
                      : 'Sem pendências'}
                  </Text>
                </View>
              </View>

              {/* Linha 2 */}
              <View style={[styles.kpiRow, { marginTop: 10 }]}>
                <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <View style={styles.kpiTopRow}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Cobrança Hoje</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="calendar-outline" size={15} color="#0284C7" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: '#0284C7' }]}>
                    {maskCurrency(formatCurrency(metrics.aging.today.amount))}
                  </Text>
                  <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                    {metrics.aging.today.count} {metrics.aging.today.count === 1 ? 'acerto hoje' : 'acertos hoje'}
                  </Text>
                </View>

                <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <View style={styles.kpiTopRow}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Atraso Crítico (+30d)</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="alert-circle" size={15} color="#EF4444" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: theme.expense }]}>
                    {maskCurrency(formatCurrency(metrics.aging.over30.amount))}
                  </Text>
                  <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
                    {metrics.aging.over30.count} {metrics.aging.over30.count === 1 ? 'cliente com atraso' : 'clientes com atraso'}
                  </Text>
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

              <View style={[styles.cardBox, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                {/* Barra Segmentada de Aging */}
                <View style={styles.agingSegmentedBar}>
                  {metrics.totalReceivables <= 0 ? (
                    <View style={{ flex: 1, backgroundColor: '#10B981', height: 10, borderRadius: 5 }} />
                  ) : (
                    <>
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
                    </>
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

              <View style={[styles.cardBox, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
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
                                <View
                                  style={[
                                    styles.bar,
                                    {
                                      height: debHeight,
                                      backgroundColor: '#4F46E5',
                                    },
                                  ]}
                                />
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

            {/* 6. TOP 5 MAIORES DEVEDORES (CONCENTRAÇÃO DE RISCO) */}
            {metrics.topDebtors.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                  MAIORES DEVEDORES (CONCENTRAÇÃO DE RISCO)
                </Text>

                {metrics.topDebtors.map((debtor: TopDebtorItem, index: number) => {
                  const isTop1 = index === 0;
                  return (
                    <View
                      key={debtor.id}
                      style={[
                        styles.debtorCard,
                        {
                          backgroundColor: theme.card,
                          borderColor: isTop1 ? theme.expense : theme.borderLight,
                        },
                      ]}
                    >
                      <View style={styles.debtorCardTop}>
                        <View style={styles.debtorInfoLeft}>
                          <View style={[styles.rankBadge, { backgroundColor: isTop1 ? theme.expenseBg : theme.cardSecondary }]}>
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
                              {debtor.percentageOfTotal}% de todo o saldo na rua
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
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 12,
    marginBottom: 14,
  },
  heroSubGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
  heroSubItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSubDivider: {
    width: 1,
    height: 24,
  },
  heroSubLabel: {
    fontSize: 10.5,
    marginBottom: 2,
  },
  heroSubVal: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  insightCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  insightBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  insightDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  kpiIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  agingSegmentedBar: {
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  agingList: {
    gap: 8,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agingRowLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  agingCountTag: {
    fontSize: 11,
  },
  agingRowRight: {
    alignItems: 'flex-end',
  },
  agingRowAmount: {
    fontSize: 12.5,
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
    gap: 4,
  },
  chartLegendColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  chartLegendText: {
    fontSize: 10.5,
  },
  chartContainer: {
    paddingTop: 8,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 105,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  monthCol: {
    alignItems: 'center',
    flex: 1,
  },
  barsPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 90,
  },
  bar: {
    width: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  debtorCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  debtorCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  debtorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  debtorName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  debtorSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  debtorBalanceBox: {
    alignItems: 'flex-end',
  },
  debtorAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  debtorOldestTag: {
    fontSize: 10,
    marginTop: 1,
  },
  limitUsageContainer: {
    marginTop: 8,
  },
  limitUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
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
    marginTop: 8,
    alignItems: 'flex-end',
  },
  zapQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  zapQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
