import { getDatabase } from '../database/schema';
import { getClients } from '../database/clientRepository';
import { getDaysDiffFromToday, getTodayISO, MONTH_NAMES_PT } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { Client } from '../types';

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
  percentage: number;
}

export interface MonthlyHistoryItem {
  monthKey: string;      // "2026-10"
  monthLabel: string;    // "Out"
  fullLabel: string;     // "Outubro / 2026"
  debitsCreated: number; // R$
  paymentsReceived: number; // R$
}

export interface TopDebtorItem {
  id: string;
  name: string;
  nickname: string;
  whatsapp: string;
  currentBalance: number;
  percentageOfTotal: number;
  creditLimit: number | null;
  limitUsedPercentage: number;
  oldestPendingDays: number;
}

export interface ActionInsight {
  id: string;
  type: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  badge: string;
}

export interface DashboardMetrics {
  // KPIs do Cabeçalho
  totalReceivables: number;        // Total na Rua
  totalReceivedThisMonth: number;  // Recebido no Mês
  totalDebitsThisMonth: number;    // Fiado Criado no Mês
  recoveryRatePercent: number;     // % de Recuperação
  
  // Carteira de Clientes
  totalClients: number;
  activeDebtorsCount: number;
  zeroBalanceCount: number;
  creditorCount: number;
  averageDebt: number;             // Ticket Médio devedor

  // Aging da Dívida
  aging: {
    upToDate: AgingBucket;
    today: AgingBucket;
    late1to15: AgingBucket;
    late16to30: AgingBucket;
    over30: AgingBucket;
  };

  // Gráfico Histórico dos Últimos 6 Meses
  monthlyHistory: MonthlyHistoryItem[];

  // Top 5 Devedores Concentrados
  topDebtors: TopDebtorItem[];

  // Insights Acionáveis
  actionInsights: ActionInsight[];
}

/**
 * Coleta e calcula todas as métricas consolidadas do dashboard em tempo real.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const db = await getDatabase();
  const allClients = await getClients('highest_debt', undefined, { status: 'active' });

  // 1. Métricas da Carteira
  const totalClients = allClients.length;
  const activeDebtors = allClients.filter((c) => c.current_balance > 0.001);
  const zeroBalanceCount = allClients.filter((c) => Math.abs(c.current_balance) <= 0.001).length;
  const creditorCount = allClients.filter((c) => c.current_balance < -0.001).length;

  const totalReceivables = activeDebtors.reduce((sum, c) => sum + c.current_balance, 0);
  const averageDebt = activeDebtors.length > 0 ? totalReceivables / activeDebtors.length : 0;

  // 2. Métricas do Mês Atual
  const todayISO = getTodayISO();
  const currentMonthPrefix = todayISO.substring(0, 7); // ex: "2026-10"

  const paymentRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_paid), 0) as total FROM payments WHERE created_at LIKE ?`,
    [`${currentMonthPrefix}%`]
  );
  const totalReceivedThisMonth = Number(paymentRow?.total || 0);

  const entryRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE created_at LIKE ?`,
    [`${currentMonthPrefix}%`]
  );
  const totalDebitsThisMonth = Number(entryRow?.total || 0);

  const totalCirculating = totalReceivables + totalReceivedThisMonth;
  const recoveryRatePercent = totalCirculating > 0
    ? Math.round((totalReceivedThisMonth / totalCirculating) * 100)
    : 0;

  // 3. Faixas de Envelhecimento (Aging da Dívida)
  let upToDateAmt = 0, upToDateCount = 0;
  let todayAmt = 0, todayCount = 0;
  let late1to15Amt = 0, late1to15Count = 0;
  let late16to30Amt = 0, late16to30Count = 0;
  let over30Amt = 0, over30Count = 0;

  activeDebtors.forEach((c) => {
    const diff = getDaysDiffFromToday(c.next_billing_date);
    if (diff < 0) {
      upToDateAmt += c.current_balance;
      upToDateCount++;
    } else if (diff === 0) {
      todayAmt += c.current_balance;
      todayCount++;
    } else if (diff <= 15) {
      late1to15Amt += c.current_balance;
      late1to15Count++;
    } else if (diff <= 30) {
      late16to30Amt += c.current_balance;
      late16to30Count++;
    } else {
      over30Amt += c.current_balance;
      over30Count++;
    }
  });

  const calcPct = (amt: number) => (totalReceivables > 0 ? Math.round((amt / totalReceivables) * 100) : 0);

  const aging = {
    upToDate: {
      label: 'Em dia / A Vencer',
      amount: upToDateAmt,
      count: upToDateCount,
      color: '#10B981', // Verde
      percentage: calcPct(upToDateAmt),
    },
    today: {
      label: 'Vence Hoje',
      amount: todayAmt,
      count: todayCount,
      color: '#3B82F6', // Azul
      percentage: calcPct(todayAmt),
    },
    late1to15: {
      label: '1 a 15 dias',
      amount: late1to15Amt,
      count: late1to15Count,
      color: '#F59E0B', // Amarelo/Laranja
      percentage: calcPct(late1to15Amt),
    },
    late16to30: {
      label: '16 a 30 dias',
      amount: late16to30Amt,
      count: late16to30Count,
      color: '#F97316', // Laranja Escuro
      percentage: calcPct(late16to30Amt),
    },
    over30: {
      label: '+30 dias (Crítico)',
      amount: over30Amt,
      count: over30Count,
      color: '#EF4444', // Vermelho
      percentage: calcPct(over30Amt),
    },
  };

  // 4. Histórico Mensal (Últimos 6 Meses)
  const monthlyHistory: MonthlyHistoryItem[] = [];
  const nowDate = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`;
    const monthName = MONTH_NAMES_PT[d.getMonth()] || '';
    const monthLabel = monthName.slice(0, 3);
    const fullLabel = `${monthName} / ${yyyy}`;

    const pRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount_paid), 0) as total FROM payments WHERE created_at LIKE ?`,
      [`${monthKey}%`]
    );
    const eRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE created_at LIKE ?`,
      [`${monthKey}%`]
    );

    monthlyHistory.push({
      monthKey,
      monthLabel,
      fullLabel,
      debitsCreated: Number(eRow?.total || 0),
      paymentsReceived: Number(pRow?.total || 0),
    });
  }

  // 5. Top 5 Maiores Devedores
  const topDebtors: TopDebtorItem[] = activeDebtors.slice(0, 5).map((c) => {
    const percentageOfTotal = totalReceivables > 0 ? (c.current_balance / totalReceivables) * 100 : 0;
    const limit = c.credit_limit;
    const limitUsedPercentage = limit && limit > 0 ? Math.min(200, (c.current_balance / limit) * 100) : 0;
    const oldestPendingDays = c.oldest_pending_date ? Math.max(0, getDaysDiffFromToday(c.oldest_pending_date)) : 0;

    return {
      id: c.id,
      name: c.name,
      nickname: c.nickname || c.name,
      whatsapp: c.whatsapp_primary,
      currentBalance: c.current_balance,
      percentageOfTotal: Math.round(percentageOfTotal * 10) / 10,
      creditLimit: limit,
      limitUsedPercentage: Math.round(limitUsedPercentage),
      oldestPendingDays,
    };
  });

  // 6. Insights & Recomendações Automáticas
  const actionInsights: ActionInsight[] = [];

  if (over30Amt > 0) {
    actionInsights.push({
      id: 'insight-over30',
      type: 'critical',
      badge: 'Atenção Imediata',
      title: `${over30Count} ${over30Count === 1 ? 'cliente com fiado' : 'clientes com fiado'} há mais de 30 dias`,
      description: `${formatCurrency(over30Amt)} está retido em atraso crítico. Recomendamos acionar mensagens de cobrança no Zap para evitar perdas.`,
    });
  }

  if (todayCount > 0) {
    actionInsights.push({
      id: 'insight-today',
      type: 'warning',
      badge: 'Cobra Hoje',
      title: `${todayCount} ${todayCount === 1 ? 'acerto programado' : 'acertos programados'} para hoje`,
      description: `Total de ${formatCurrency(todayAmt)} com previsão de recebimento nesta data. Toque na Fila de Cobrança para cobrar.`,
    });
  }

  if (recoveryRatePercent >= 40 && totalReceivedThisMonth > 0) {
    actionInsights.push({
      id: 'insight-recovery',
      type: 'positive',
      badge: 'Boa Recuperação',
      title: `${recoveryRatePercent}% do fiado recuperado no mês`,
      description: `Você já recebeu ${formatCurrency(totalReceivedThisMonth)} em pagamentos neste mês corrente. Continue o ritmo!`,
    });
  }

  if (activeDebtors.length === 0) {
    actionInsights.push({
      id: 'insight-zero-debt',
      type: 'positive',
      badge: '100% em Dia',
      title: 'Nenhum fiado pendente no momento',
      description: 'Todos os clientes cadastrados estão com as contas zeradas ou em dia.',
    });
  } else if (topDebtors.length > 0 && topDebtors[0].percentageOfTotal >= 35) {
    actionInsights.push({
      id: 'insight-concentration',
      type: 'info',
      badge: 'Risco de Concentração',
      title: `${topDebtors[0].nickname} concentra ${topDebtors[0].percentageOfTotal}% da sua carteira`,
      description: `Evite aumentar o limite desse cliente antes de um acerto parcial para diminuir seu risco operacional.`,
    });
  }

  return {
    totalReceivables,
    totalReceivedThisMonth,
    totalDebitsThisMonth,
    recoveryRatePercent,
    totalClients,
    activeDebtorsCount: activeDebtors.length,
    zeroBalanceCount,
    creditorCount,
    averageDebt,
    aging,
    monthlyHistory,
    topDebtors,
    actionInsights,
  };
}
