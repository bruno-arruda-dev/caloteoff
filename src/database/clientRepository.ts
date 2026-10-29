import * as Crypto from 'expo-crypto';
import { AddressContact, BillingCycle, Client, LimitPolicy, PhoneContact, SortOption } from '../types';
import { calculateNextBillingDate, getDaysDiffFromToday, getTodayISO } from '../utils/date';
import { getDatabase } from './schema';

export async function getClients(
  sortOption: SortOption = 'collection_queue',
  searchQuery?: string
): Promise<Client[]> {
  const db = await getDatabase();

  let query = `
    SELECT 
      c.*,
      COALESCE((SELECT SUM(amount) FROM entries WHERE client_id = c.id AND status = 'pending'), 0) as total_pending_debits,
      (SELECT MIN(due_date) FROM entries WHERE client_id = c.id AND status = 'pending') as oldest_pending_date
    FROM clients c
  `;

  const params: any[] = [];
  if (searchQuery && searchQuery.trim().length > 0) {
    const pattern = `%${searchQuery.trim().toLowerCase()}%`;
    query += ` WHERE LOWER(c.name) LIKE ? OR LOWER(c.nickname) LIKE ? OR c.whatsapp_primary LIKE ?`;
    params.push(pattern, pattern, pattern);
  }

  const rows = await db.getAllAsync<any>(query, params);

  const clients: (Client & { oldest_pending_date?: string })[] = rows.map((r) => {
    let phones: PhoneContact[] = [];
    try {
      phones = JSON.parse(r.phones_json || '[]');
    } catch {}

    let addresses: AddressContact[] = [];
    try {
      addresses = JSON.parse(r.addresses_json || '[]');
    } catch {}

    const totalPending = Number(r.total_pending_debits || 0);
    const creditBalance = Number(r.credit_balance || 0);
    const currentBalance = Math.round((totalPending - creditBalance) * 100) / 100;

    const nextBillingDate = calculateNextBillingDate(
      r.billing_cycle as BillingCycle,
      Number(r.billing_day || 10)
    );

    return {
      id: r.id,
      name: r.name,
      nickname: r.nickname,
      whatsapp_primary: r.whatsapp_primary,
      phones,
      addresses,
      credit_limit: r.credit_limit !== null ? Number(r.credit_limit) : null,
      limit_policy: r.limit_policy as LimitPolicy,
      billing_cycle: r.billing_cycle as BillingCycle,
      billing_day: Number(r.billing_day || 10),
      notes: r.notes || '',
      current_balance: currentBalance,
      credit_balance: creditBalance,
      next_billing_date: nextBillingDate,
      created_at: r.created_at,
      updated_at: r.updated_at,
      oldest_pending_date: r.oldest_pending_date || undefined,
    };
  });

  // Aplicação da Ordenação
  return sortClientsList(clients, sortOption);
}

function sortClientsList(
  clients: (Client & { oldest_pending_date?: string })[],
  sortOption: SortOption
): Client[] {
  const today = getTodayISO();

  switch (sortOption) {
    case 'collection_queue': {
      // 1. Inadimplentes (data passou, mais atrasados primeiro)
      // 2. Cobra Hoje
      // 3. Próximos dias
      // 4. Sem dívida (zerados / credores no final)
      return [...clients].sort((a, b) => {
        const aHasDebt = a.current_balance > 0;
        const bHasDebt = b.current_balance > 0;

        if (aHasDebt && !bHasDebt) return -1;
        if (!aHasDebt && bHasDebt) return 1;

        const aDiff = getDaysDiffFromToday(a.next_billing_date);
        const bDiff = getDaysDiffFromToday(b.next_billing_date);

        // aDiff > 0 significa atrasado por N dias
        const aOverdue = aDiff > 0;
        const bOverdue = bDiff > 0;

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (aOverdue && bOverdue) {
          // Maior atraso primeiro
          return bDiff - aDiff;
        }

        const aToday = aDiff === 0;
        const bToday = bDiff === 0;
        if (aToday && !bToday) return -1;
        if (!aToday && bToday) return 1;

        // Ambos no futuro: data mais próxima primeiro
        return a.next_billing_date.localeCompare(b.next_billing_date);
      });
    }

    case 'highest_debt':
      return [...clients].sort((a, b) => b.current_balance - a.current_balance);

    case 'lowest_debt':
      return [...clients].sort((a, b) => a.current_balance - b.current_balance);

    case 'oldest_purchase':
      return [...clients].sort((a, b) => {
        if (!a.oldest_pending_date) return 1;
        if (!b.oldest_pending_date) return -1;
        return a.oldest_pending_date.localeCompare(b.oldest_pending_date);
      });

    case 'alphabetical':
    default:
      return [...clients].sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<any>(
    `SELECT 
      c.*,
      COALESCE((SELECT SUM(amount) FROM entries WHERE client_id = c.id AND status = 'pending'), 0) as total_pending_debits
    FROM clients c WHERE c.id = ?`,
    [id]
  );

  if (!r) return null;

  let phones: PhoneContact[] = [];
  try {
    phones = JSON.parse(r.phones_json || '[]');
  } catch {}

  let addresses: AddressContact[] = [];
  try {
    addresses = JSON.parse(r.addresses_json || '[]');
  } catch {}

  const totalPending = Number(r.total_pending_debits || 0);
  const creditBalance = Number(r.credit_balance || 0);
  const currentBalance = Math.round((totalPending - creditBalance) * 100) / 100;

  const nextBillingDate = calculateNextBillingDate(
    r.billing_cycle as BillingCycle,
    Number(r.billing_day || 10)
  );

  return {
    id: r.id,
    name: r.name,
    nickname: r.nickname,
    whatsapp_primary: r.whatsapp_primary,
    phones,
    addresses,
    credit_limit: r.credit_limit !== null ? Number(r.credit_limit) : null,
    limit_policy: r.limit_policy as LimitPolicy,
    billing_cycle: r.billing_cycle as BillingCycle,
    billing_day: Number(r.billing_day || 10),
    notes: r.notes || '',
    current_balance: currentBalance,
    credit_balance: creditBalance,
    next_billing_date: nextBillingDate,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function createClient(data: {
  name: string;
  nickname: string;
  whatsapp_primary: string;
  phones?: PhoneContact[];
  addresses?: AddressContact[];
  credit_limit?: number | null;
  limit_policy?: LimitPolicy;
  billing_cycle?: BillingCycle;
  billing_day?: number;
  notes?: string;
}): Promise<Client> {
  const db = await getDatabase();
  const id = `cli-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO clients (
      id, name, nickname, whatsapp_primary, phones_json, addresses_json,
      credit_limit, limit_policy, billing_cycle, billing_day, notes,
      credit_balance, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      data.name.trim(),
      (data.nickname || data.name).trim(),
      data.whatsapp_primary.trim(),
      JSON.stringify(data.phones || []),
      JSON.stringify(data.addresses || []),
      data.credit_limit !== undefined ? data.credit_limit : null,
      data.limit_policy || 'AVISAR_E_PERMITIR',
      data.billing_cycle || 'MONTHLY',
      data.billing_day || 10,
      data.notes || '',
      now,
      now,
    ]
  );

  const created = await getClientById(id);
  if (!created) throw new Error('Falha ao obter cliente criado');
  return created;
}

export async function updateClient(
  id: string,
  data: Partial<{
    name: string;
    nickname: string;
    whatsapp_primary: string;
    phones: PhoneContact[];
    addresses: AddressContact[];
    credit_limit: number | null;
    limit_policy: LimitPolicy;
    billing_cycle: BillingCycle;
    billing_day: number;
    notes: string;
    credit_balance: number;
  }>
): Promise<Client> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await getClientById(id);
  if (!current) throw new Error('Cliente não encontrado');

  await db.runAsync(
    `UPDATE clients SET
      name = ?,
      nickname = ?,
      whatsapp_primary = ?,
      phones_json = ?,
      addresses_json = ?,
      credit_limit = ?,
      limit_policy = ?,
      billing_cycle = ?,
      billing_day = ?,
      notes = ?,
      credit_balance = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : current.name,
      data.nickname !== undefined ? data.nickname.trim() : current.nickname,
      data.whatsapp_primary !== undefined ? data.whatsapp_primary.trim() : current.whatsapp_primary,
      JSON.stringify(data.phones !== undefined ? data.phones : current.phones),
      JSON.stringify(data.addresses !== undefined ? data.addresses : current.addresses),
      data.credit_limit !== undefined ? data.credit_limit : current.credit_limit,
      data.limit_policy !== undefined ? data.limit_policy : current.limit_policy,
      data.billing_cycle !== undefined ? data.billing_cycle : current.billing_cycle,
      data.billing_day !== undefined ? data.billing_day : current.billing_day,
      data.notes !== undefined ? data.notes : current.notes,
      data.credit_balance !== undefined ? data.credit_balance : current.credit_balance,
      now,
      id,
    ]
  );

  const updated = await getClientById(id);
  if (!updated) throw new Error('Falha ao atualizar cliente');
  return updated;
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM clients WHERE id = ?', [id]);
}

export async function countActiveDebtorClients(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT count(DISTINCT c.id) as count
    FROM clients c
    JOIN entries e ON e.client_id = c.id AND e.status = 'pending'
    WHERE (e.amount - c.credit_balance) > 0
  `);
  return row ? row.count : 0;
}
