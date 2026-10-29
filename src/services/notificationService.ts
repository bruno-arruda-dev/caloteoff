import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getNotificationRules } from '../database/notificationRepository';
import { getClients } from '../database/clientRepository';
import { getDaysDiffFromToday } from '../utils/date';
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

export const NOTIFICATION_CHANNEL_ID = 'caloteoff-cobranças';

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Lembretes de Fiado e Cobranças',
      description: 'Alertas de clientes a vencer, vencendo hoje ou atrasados',
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

export async function scheduleReminders(): Promise<void> {
  try {
    const rules = await getNotificationRules();
    const activeRules = rules.filter((r) => r.enabled);
    if (activeRules.length === 0) return;

    const clients = await getClients('collection_queue');
    const overdueClients = clients.filter(
      (c) => c.current_balance > 0 && getDaysDiffFromToday(c.next_billing_date) > 0
    );

    if (overdueClients.length === 0) return;

    // Regra padrão de atraso (ex: 1 dia)
    const overdueRule = activeRules.find((r) => r.type === 'after_due');
    if (overdueRule) {
      const totalOverdueAmount = overdueClients.reduce((acc, c) => acc + c.current_balance, 0);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ ${overdueClients.length} ${overdueClients.length === 1 ? 'cliente em atraso' : 'clientes em atraso'}`,
          body: `Você tem ${formatCurrency(totalOverdueAmount)} a receber. Toque para cobrar no Zap!`,
          data: { type: 'overdue_summary' },
          sound: 'default',
        },
        trigger: null, // Imediato / próximo ciclo
      });
    }
  } catch (err) {
    console.warn('Erro ao agendar lembretes:', err);
  }
}
