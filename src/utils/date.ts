export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeBR(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

/**
 * Calcula a próxima data de cobrança com base no ciclo (semanal ou mensal)
 * ciclo: 'WEEKLY' -> day é 0..6 (0=domingo, 1=segunda...)
 * ciclo: 'MONTHLY' -> day é 1..31 (dia do mês)
 */
export function calculateNextBillingDate(
  cycle: 'WEEKLY' | 'MONTHLY',
  billingDay: number,
  refDateStr?: string
): string {
  const ref = refDateStr ? new Date(`${refDateStr}T00:00:00`) : new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const todayDate = ref.getDate();

  if (cycle === 'WEEKLY') {
    const currentDayOfWeek = ref.getDay();
    let diff = billingDay - currentDayOfWeek;
    if (diff <= 0) {
      diff += 7; // Próxima ocorrência na semana que vem
    }
    const next = new Date(ref);
    next.setDate(ref.getDate() + diff);
    const ny = next.getFullYear();
    const nm = String(next.getMonth() + 1).padStart(2, '0');
    const nd = String(next.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } else {
    // Mensal
    const maxDaysThisMonth = new Date(year, month + 1, 0).getDate();
    const clampedDayThisMonth = Math.min(billingDay, maxDaysThisMonth);

    if (clampedDayThisMonth > todayDate) {
      // Ainda este mês
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(clampedDayThisMonth).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    } else {
      // Mês seguinte
      const nextMonthDate = new Date(year, month + 1, 1);
      const nextYear = nextMonthDate.getFullYear();
      const nextMonth = nextMonthDate.getMonth();
      const maxDaysNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
      const clampedDayNextMonth = Math.min(billingDay, maxDaysNextMonth);

      const ny = nextYear;
      const nm = String(nextMonth + 1).padStart(2, '0');
      const nd = String(clampedDayNextMonth).padStart(2, '0');
      return `${ny}-${nm}-${nd}`;
    }
  }
}

/**
 * Retorna a quantidade de dias em um determinado ano e mês (1 a 12).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Adiciona ou subtrai meses a uma data respeitando o dia original alvo (targetDay).
 */
export function addMonthsPreservingDay(
  startYear: number,
  startMonth: number,
  monthOffset: number,
  targetDay: number
): { dateISO: string; year: number; month: number } {
  let targetMonthIndex = startMonth - 1 + monthOffset;
  const targetYear = startYear + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = (((targetMonthIndex % 12) + 12) % 12) + 1;

  const maxDays = getDaysInMonth(targetYear, normalizedMonth);
  const clampedDay = Math.min(targetDay, maxDays);

  const monthStr = String(normalizedMonth).padStart(2, '0');
  const dayStr = String(clampedDay).padStart(2, '0');

  return {
    dateISO: `${targetYear}-${monthStr}-${dayStr}`,
    year: targetYear,
    month: normalizedMonth,
  };
}

/**
 * Adiciona ou subtrai dias de uma data ISO ('YYYY-MM-DD').
 */
export function addDaysToISO(isoDate: string, days: number): string {
  if (!isoDate) return getTodayISO();
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return getTodayISO();
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Retorna a diferença de dias entre uma data e hoje (positivo = atrasado, negativo = a vencer, 0 = hoje)
 */
export function getDaysDiffFromToday(targetIsoDate: string): number {
  if (!targetIsoDate) return 0;
  const today = getTodayISO();
  const dToday = new Date(`${today}T00:00:00`).getTime();
  const dTarget = new Date(`${targetIsoDate}T00:00:00`).getTime();
  const diffTime = dToday - dTarget;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
