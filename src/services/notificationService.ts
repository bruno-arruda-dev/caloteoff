import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getNotificationRules } from '../database/notificationRepository';
import { getClients } from '../database/clientRepository';
import { NotificationRule } from '../types';
import { getDaysDiffFromToday, getTodayISO } from '../utils/date';
import { formatCurrency } from '../utils/currency';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NOTIFICATION_CHANNEL_ID = 'caloteoff-cobrancas';

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Lembretes de Fiado e Cobranças',
      description: 'Alertas automáticos de clientes a vencer, vencendo hoje, atrasados e compras antigas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

export async function getNotificationPermissionStatus(): Promise<{
  granted: boolean;
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
}> {
  try {
    const res = await Notifications.getPermissionsAsync();
    return {
      granted: res.granted,
      status: res.status,
      canAskAgain: res.canAskAgain,
    };
  } catch (err) {
    console.warn('Erro ao checar permissão de notificação:', err);
    return {
      granted: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
      canAskAgain: true,
    };
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const res = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return res.granted;
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificação:', err);
    return false;
  }
}

/**
 * Dispara uma notificação imediata de teste para confirmação de som e alerta visual.
 */
export async function sendTestNotification(): Promise<void> {
  await setupNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Teste Imediato do Irineu',
      body: 'As notificações de cobrança e lembretes estão ativas e funcionando perfeitamente!',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      data: { type: 'test' },
    },
    trigger: null,
  });
}

/**
 * Agenda um alarme de teste real para daqui a X segundos (padrão: 10s).
 */
export async function scheduleQuickTestAlarm(seconds = 10): Promise<Date> {
  await setupNotificationChannel();
  const triggerDate = new Date(Date.now() + seconds * 1000);

  await Notifications.scheduleNotificationAsync({
    identifier: `quick_test_${Date.now()}`,
    content: {
      title: '⏰ Teste de Alarme do Irineu!',
      body: `Este alarme foi agendado há ${seconds} segundos e disparou com sucesso no Android!`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      data: { type: 'quick_test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });

  return triggerDate;
}

/**
 * Calcula quando um horário configurado tocará pela próxima vez (hoje ou amanhã).
 */
export function getNextTriggerInfo(timeStr: string): {
  isToday: boolean;
  triggerDate: Date;
  diffMinutes: number;
  formattedTime: string;
} {
  const [hourStr, minuteStr] = (timeStr || '09:00').split(':');
  const hour = parseInt(hourStr || '9', 10);
  const minute = parseInt(minuteStr || '0', 10);

  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);

  let isToday = true;
  if (trigger.getTime() <= now.getTime() + 20000) {
    trigger.setDate(trigger.getDate() + 1);
    isToday = false;
  }

  const diffMs = trigger.getTime() - now.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  return {
    isToday,
    triggerDate: trigger,
    diffMinutes,
    formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/**
 * Avalia a regra contra os clientes e gera título e corpo contextualizado.
 */
export function evaluateNotificationRuleContent(
  rule: NotificationRule,
  clients: (any)[]
): { title: string; body: string } | null {
  const activeDebtors = clients.filter((c) => c.current_balance > 0.001);
  if (activeDebtors.length === 0) return null;

  const todayISO = getTodayISO();

  if (rule.type === 'on_due_date') {
    const dueToday = activeDebtors.filter(
      (c) => (c.next_billing_date || '').substring(0, 10) === todayISO
    );
    if (dueToday.length === 0) return null;

    if (dueToday.length === 1) {
      const client = dueToday[0];
      return {
        title: '🎯 Acerto Marcado para Hoje!',
        body: `Hoje é o dia recomendado para cobrar ${client.nickname || client.name} (${formatCurrency(client.current_balance)}). Toque para cobrar no Zap!`,
      };
    }

    const total = dueToday.reduce((sum, c) => sum + c.current_balance, 0);
    const names = dueToday.slice(0, 3).map((c) => c.nickname || c.name).join(', ');
    return {
      title: `🎯 ${dueToday.length} Acertos Marcados para Hoje!`,
      body: `Total de ${formatCurrency(total)} com ${names}${dueToday.length > 3 ? '...' : ''}. Toque para abrir a lista!`,
    };
  }

  if (rule.type === 'after_first_purchase') {
    const offset = Math.max(1, rule.days_offset);
    const qualifying = activeDebtors.filter((c) => {
      const oldestDate = c.oldest_pending_date || c.created_at;
      if (!oldestDate) return false;
      const days = getDaysDiffFromToday(oldestDate.substring(0, 10));
      return days >= offset;
    });

    if (qualifying.length === 0) return null;

    if (qualifying.length === 1) {
      const client = qualifying[0];
      return {
        title: `⏳ Fiado Aberto há mais de ${offset} dias!`,
        body: `${client.nickname || client.name} comprou há ${offset} dias e ainda deve ${formatCurrency(client.current_balance)}. Toque para lembrar no WhatsApp!`,
      };
    }

    const total = qualifying.reduce((sum, c) => sum + c.current_balance, 0);
    return {
      title: `⏳ ${qualifying.length} Clientes com Fiado há mais de ${offset} dias`,
      body: `Total de ${formatCurrency(total)} aguardando quitação há mais de um mês. Toque para cobrar!`,
    };
  }

  if (rule.type === 'after_due') {
    const offset = Math.max(1, rule.days_offset);
    const overdue = activeDebtors.filter((c) => {
      if (!c.next_billing_date) return false;
      return getDaysDiffFromToday(c.next_billing_date) >= offset;
    });

    if (overdue.length === 0) return null;

    if (overdue.length === 1) {
      const client = overdue[0];
      return {
        title: `⚠️ Acerto em Atraso (${offset} dias)!`,
        body: `${client.nickname || client.name} está com o acerto atrasado (${formatCurrency(client.current_balance)}). Toque para cobrar no Zap!`,
      };
    }

    const total = overdue.reduce((sum, c) => sum + c.current_balance, 0);
    return {
      title: `⚠️ ${overdue.length} Clientes com Acerto Atrasado (${formatCurrency(total)})`,
      body: `Clientes com atraso superior a ${offset} dias. Toque para enviar cobrança!`,
    };
  }

  if (rule.type === 'before_due') {
    const offset = Math.max(1, rule.days_offset);
    const upcoming = activeDebtors.filter((c) => {
      if (!c.next_billing_date) return false;
      return getDaysDiffFromToday(c.next_billing_date) === -offset;
    });

    if (upcoming.length === 0) return null;

    if (upcoming.length === 1) {
      const client = upcoming[0];
      return {
        title: `📅 Acerto Vence em ${offset} dia(s)`,
        body: `${client.nickname || client.name} tem acerto agendado (${formatCurrency(client.current_balance)}).`,
      };
    }

    const total = upcoming.reduce((sum, c) => sum + c.current_balance, 0);
    return {
      title: `📅 ${upcoming.length} Acertos a Vencer em ${offset} dia(s)`,
      body: `Total de ${formatCurrency(total)} previstos para os próximos dias.`,
    };
  }

  return null;
}

/**
 * Reagenda todas as notificações no sistema Android / iOS com base nas regras do banco.
 */
export async function rescheduleAllNotifications(): Promise<void> {
  try {
    await setupNotificationChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const rules = await getNotificationRules();
    const activeRules = rules.filter((r) => r.enabled);
    if (activeRules.length === 0) return;

    const clients = await getClients('collection_queue');

    for (const rule of activeRules) {
      const content = evaluateNotificationRuleContent(rule, clients);
      if (!content) continue;

      const triggerInfo = getNextTriggerInfo(rule.time);

      await Notifications.scheduleNotificationAsync({
        identifier: `rule_${rule.id}`,
        content: {
          title: content.title,
          body: content.body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          data: { ruleId: rule.id, type: rule.type },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerInfo.triggerDate,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn('Erro ao reagendar notificações:', err);
  }
}

export async function scheduleReminders(): Promise<void> {
  await rescheduleAllNotifications();
}
