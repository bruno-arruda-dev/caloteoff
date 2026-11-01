import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('__DEV__', true);

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'uuid-test',
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationPriority: { HIGH: 1, MAX: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

vi.mock('../src/database/clientRepository', () => ({
  getClients: vi.fn(),
}));

vi.mock('../src/database/notificationRepository', () => ({
  getNotificationRules: vi.fn(),
}));

import { evaluateNotificationRuleContent } from '../src/services/notificationService';
import { getTodayISO } from '../src/utils/date';
import { NotificationRule } from '../src/types';

describe('Avaliação de Regras de Notificação do Irineu', () => {
  it('deve disparar no dia recomendado de cobrança (on_due_date)', () => {
    const today = getTodayISO();
    const rule: NotificationRule = {
      id: 'rule-today',
      type: 'on_due_date',
      days_offset: 0,
      time: '09:00',
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const clients = [
      {
        id: 'c1',
        name: 'Maria Silva',
        nickname: 'Dona Maria',
        current_balance: 150.0,
        next_billing_date: today,
      },
    ];

    const content = evaluateNotificationRuleContent(rule, clients);
    expect(content).not.toBeNull();
    expect(content?.title).toContain('Acerto Marcado para Hoje');
    expect(content?.body).toContain('Dona Maria');
    expect(content?.body).toContain('R$');
  });

  it('deve disparar quando fiado ultrapassar X dias da 1ª compra em aberto (after_first_purchase)', () => {
    // 35 dias atrás
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 35);
    const pastDateStr = pastDate.toISOString().slice(0, 10);

    const rule: NotificationRule = {
      id: 'rule-30days',
      type: 'after_first_purchase',
      days_offset: 30,
      time: '10:00',
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const clients = [
      {
        id: 'c2',
        name: 'Carlos Mendes',
        nickname: 'Carlinhos',
        current_balance: 85.0,
        oldest_pending_date: pastDateStr,
      },
    ];

    const content = evaluateNotificationRuleContent(rule, clients);
    expect(content).not.toBeNull();
    expect(content?.title).toContain('30 dias');
    expect(content?.body).toContain('Carlinhos');
  });

  it('não deve disparar se a compra recente for menor que os dias configurados', () => {
    // Comprou há 5 dias apenas, regra exige 30
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastDateStr = pastDate.toISOString().slice(0, 10);

    const rule: NotificationRule = {
      id: 'rule-30days',
      type: 'after_first_purchase',
      days_offset: 30,
      time: '10:00',
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const clients = [
      {
        id: 'c3',
        name: 'João Santos',
        nickname: 'Joãozinho',
        current_balance: 50.0,
        oldest_pending_date: pastDateStr,
      },
    ];

    const content = evaluateNotificationRuleContent(rule, clients);
    expect(content).toBeNull();
  });

  it('não deve disparar para clientes sem débito pendente', () => {
    const today = new Date().toISOString().slice(0, 10);
    const rule: NotificationRule = {
      id: 'rule-today',
      type: 'on_due_date',
      days_offset: 0,
      time: '09:00',
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const clients = [
      {
        id: 'c4',
        name: 'Ana Paula',
        nickname: 'Aninha',
        current_balance: 0, // Quitada
        next_billing_date: today,
      },
      {
        id: 'c5',
        name: 'Pedro Lima',
        nickname: 'Pedrão',
        current_balance: -20, // Saldo a favor
        next_billing_date: today,
      },
    ];

    const content = evaluateNotificationRuleContent(rule, clients);
    expect(content).toBeNull();
  });
});
