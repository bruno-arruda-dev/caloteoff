import { describe, it, expect } from 'vitest';
import { Client } from '../src/types';

describe('Client Management & Soft Delete Invariants', () => {
  const sampleClients: Client[] = [
    {
      id: 'client-1',
      name: 'Susanna Souza',
      nickname: 'Susanna',
      whatsapp_primary: '62999332705',
      phones: [],
      addresses: [],
      credit_limit: 200,
      limit_policy: 'AVISAR_E_PERMITIR',
      billing_cycle: 'MONTHLY',
      billing_day: 10,
      notes: '',
      current_balance: 50,
      credit_balance: 0,
      next_billing_date: '2026-11-10',
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'client-2',
      name: 'João Caloteiro',
      nickname: 'João',
      whatsapp_primary: '62988887777',
      phones: [],
      addresses: [],
      credit_limit: 100,
      limit_policy: 'BLOQUEAR_TOTAL',
      billing_cycle: 'MONTHLY',
      billing_day: 5,
      notes: '',
      current_balance: 100,
      credit_balance: 0,
      next_billing_date: '2026-11-05',
      deleted_at: '2026-10-30T00:00:00Z', // Soft-deleted
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('filters active clients excluding soft-deleted records', () => {
    const active = sampleClients.filter((c) => !c.deleted_at);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('client-1');
  });

  it('filters soft-deleted records correctly for audit and recovery', () => {
    const deleted = sampleClients.filter((c) => Boolean(c.deleted_at));
    expect(deleted.length).toBe(1);
    expect(deleted[0].id).toBe('client-2');
  });

  it('allows soft-deleted clients to maintain debt balance and WhatsApp identity for collections', () => {
    const deletedClient = sampleClients.find((c) => c.id === 'client-2')!;
    expect(deletedClient.current_balance).toBe(100);
    expect(deletedClient.whatsapp_primary).toBe('62988887777');
    // Invariant: soft-deleted client is blocked from new purchases, but debt remains collectible
    const canMakeNewPurchase = !deletedClient.deleted_at;
    expect(canMakeNewPurchase).toBe(false);
  });

  it('strictly isolates debtor clients (> 0) from clients with zero debt for main screen display', () => {
    const clientsWithZeroDebt: Client[] = [
      ...sampleClients,
      {
        id: 'client-3-zero',
        name: 'Suzana Sarah',
        nickname: 'Suzana',
        whatsapp_primary: '62999990000',
        phones: [],
        addresses: [],
        credit_limit: 200,
        limit_policy: 'AVISAR_E_PERMITIR',
        billing_cycle: 'MONTHLY',
        billing_day: 10,
        notes: '',
        current_balance: 0,
        credit_balance: 0,
        next_billing_date: '2026-11-10',
        deleted_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    const activeDebtors = clientsWithZeroDebt.filter((c) => !c.deleted_at && c.current_balance > 0.001);
    expect(activeDebtors.length).toBe(1);
    expect(activeDebtors[0].id).toBe('client-1');
    expect(activeDebtors.some((c) => c.id === 'client-3-zero')).toBe(false);
  });
});
