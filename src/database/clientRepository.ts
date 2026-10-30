import * as Crypto from 'expo-crypto';
import { AddressContact, BillingCycle, Client, LimitPolicy, PhoneContact, SortOption } from '../types';
import { calculateNextBillingDate, getDaysDiffFromToday, getTodayISO } from '../utils/date';
import { getDatabase } from './schema';

export interface GetClientsOptions {
  status?: 'all' | 'active' | 'deleted';
  page?: number;
  pageSize?: number;
}

export async function getClients(
  sortOption: SortOption = 'collection_queue',
  searchQuery?: string,
  options?: GetClientsOptions
): Promise<Client[]> {
  const db = await getDatabase();

  const status = options?.status ?? 'active';

  let query = `
    SELECT 
      c.*,
      COALESCE((SELECT SUM(amount) FROM entries WHERE client_id = c.id AND status = 'pending'), 0) as total_pending_debits,
      (SELECT MIN(due_date) FROM entries WHERE client_id = c.id AND status = 'pending') as oldest_pending_date
    FROM clients c
    WHERE 1=1
  `;

  const params: any[] = [];

  if (status === 'active') {
    query += ` AND c.deleted_at IS NULL`;
  } else if (status === 'deleted') {
    query += ` AND c.deleted_at IS NOT NULL`;
  }

  if (searchQuery && searchQuery.trim().length > 0) {
    const pattern = `%${searchQuery.trim().toLowerCase()}%`;
    query += ` AND (LOWER(c.name) LIKE ? OR LOWER(c.nickname) LIKE ? OR c.whatsapp_primary LIKE ?)`;
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
      deleted_at: r.deleted_at || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      oldest_pending_date: r.oldest_pending_date || undefined,
    };
  });

  const sorted = sortClientsList(clients, sortOption);

  // Paginação se informada
  if (options?.page && options?.pageSize) {
    const start = (options.page - 1) * options.pageSize;
    return sorted.slice(start, start + options.pageSize);
  }

  return sorted;
}

function sortClientsList(
  clients: (Client & { oldest_pending_date?: string })[],
  sortOption: SortOption
): Client[] {
  switch (sortOption) {
    case 'collection_queue': {
      return [...clients].sort((a, b) => {
        const aHasDebt = a.current_balance > 0;
        const bHasDebt = b.current_balance > 0;

        if (aHasDebt && !bHasDebt) return -1;
        if (!aHasDebt && bHasDebt) return 1;

        const aDiff = getDaysDiffFromToday(a.next_billing_date);
        const bDiff = getDaysDiffFromToday(b.next_billing_date);

        const aOverdue = aDiff > 0;
        const bOverdue = bDiff > 0;

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (aOverdue && bOverdue) return bDiff - aDiff;

        if (aDiff === 0 && bDiff !== 0) return -1;
        if (aDiff !== 0 && bDiff === 0) return 1;

        return b.current_balance - a.current_balance;
      });
    }

    case 'highest_debt':
      return [...clients].sort((a, b) => b.current_balance - a.current_balance);

    case 'lowest_debt':
      return [...clients].sort((a, b) => {
        if (a.current_balance <= 0 && b.current_balance > 0) return 1;
        if (a.current_balance > 0 && b.current_balance <= 0) return -1;
        return a.current_balance - b.current_balance;
      });

    case 'oldest_purchase':
      return [...clients].sort((a, b) => {
        if (!a.oldest_pending_date && b.oldest_pending_date) return 1;
        if (a.oldest_pending_date && !b.oldest_pending_date) return -1;
        if (a.oldest_pending_date && b.oldest_pending_date) {
          return a.oldest_pending_date.localeCompare(b.oldest_pending_date);
        }
        return b.current_balance - a.current_balance;
      });

    case 'alphabetical':
      return [...clients].sort((a, b) =>
        (a.nickname || a.name).localeCompare(b.nickname || b.name, 'pt-BR')
      );

    default:
      return clients;
  }
}

export async function getClientPhones(clientId: string): Promise<PhoneContact[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string; label: string; number: string }>(
      'SELECT id, label, number FROM client_phones WHERE client_id = ? ORDER BY created_at ASC',
      [clientId]
    );
    return rows.map((r) => ({ id: r.id, label: r.label, number: r.number }));
  } catch {
    return [];
  }
}

export async function getClientAddresses(clientId: string): Promise<AddressContact[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      label: string;
      street: string;
      number: string;
      neighborhood: string;
      reference: string;
    }>(
      'SELECT id, label, street, number, neighborhood, reference FROM client_addresses WHERE client_id = ? ORDER BY created_at ASC',
      [clientId]
    );
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      street: r.street,
      number: r.number,
      neighborhood: r.neighborhood,
      reference: r.reference,
    }));
  } catch {
    return [];
  }
}

async function saveClientPhonesInternal(
  db: any,
  clientId: string,
  phones: PhoneContact[]
): Promise<void> {
  try {
    await db.runAsync('DELETE FROM client_phones WHERE client_id = ?', [clientId]);
    const now = new Date().toISOString();
    for (const p of phones) {
      if (!p.number || !p.number.trim()) continue;
      const phoneId = p.id || `ph-${Crypto.randomUUID()}`;
      await db.runAsync(
        'INSERT INTO client_phones (id, client_id, label, number, is_whatsapp, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [phoneId, clientId, p.label || 'Celular', p.number.trim(), now]
      );
    }
  } catch (err) {
    console.warn('Erro ao salvar client_phones:', err);
  }
}

async function saveClientAddressesInternal(
  db: any,
  clientId: string,
  addresses: AddressContact[]
): Promise<void> {
  try {
    await db.runAsync('DELETE FROM client_addresses WHERE client_id = ?', [clientId]);
    const now = new Date().toISOString();
    for (const a of addresses) {
      if (!a.street || !a.street.trim()) continue;
      const addrId = a.id || `addr-${Crypto.randomUUID()}`;
      await db.runAsync(
        `INSERT INTO client_addresses (id, client_id, label, street, number, neighborhood, reference, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          addrId,
          clientId,
          a.label || 'Principal',
          a.street.trim(),
          a.number || '',
          a.neighborhood || '',
          a.reference || '',
          now,
        ]
      );
    }
  } catch (err) {
    console.warn('Erro ao salvar client_addresses:', err);
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<any>(
    `SELECT 
       c.*,
       COALESCE((SELECT SUM(amount) FROM entries WHERE client_id = c.id AND status = 'pending'), 0) as total_pending_debits
     FROM clients c 
     WHERE c.id = ?`,
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

  const [tablePhones, tableAddresses] = await Promise.all([
    getClientPhones(id),
    getClientAddresses(id),
  ]);
  const finalPhones = tablePhones.length > 0 ? tablePhones : phones;
  const finalAddresses = tableAddresses.length > 0 ? tableAddresses : addresses;

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
    phones: finalPhones,
    addresses: finalAddresses,
    credit_limit: r.credit_limit !== null ? Number(r.credit_limit) : null,
    limit_policy: r.limit_policy as LimitPolicy,
    billing_cycle: r.billing_cycle as BillingCycle,
    billing_day: Number(r.billing_day || 10),
    notes: r.notes || '',
    current_balance: currentBalance,
    credit_balance: creditBalance,
    next_billing_date: nextBillingDate,
    deleted_at: r.deleted_at || null,
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
      credit_balance, deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
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

  const phonesList = data.phones || [];
  const addressesList = data.addresses || [];
  await Promise.all([
    saveClientPhonesInternal(db, id, phonesList),
    saveClientAddressesInternal(db, id, addressesList),
  ]);

  return (await getClientById(id)) || created;
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
    deleted_at: string | null;
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
      deleted_at = ?,
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
      data.deleted_at !== undefined ? data.deleted_at : current.deleted_at,
      now,
      id,
    ]
  );

  if (data.phones !== undefined) {
    await saveClientPhonesInternal(db, id, data.phones);
  }
  if (data.addresses !== undefined) {
    await saveClientAddressesInternal(db, id, data.addresses);
  }

  const updated = await getClientById(id);
  if (!updated) throw new Error('Falha ao atualizar cliente');
  return updated;
}

/**
 * Delete Lógico (Soft Delete):
 * O cliente é marcado com deleted_at = data atual.
 * Não pode mais realizar compras fiadas, mas as mensagerias e pagamentos continuam funcionando normalmente.
 */
export async function deleteClient(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

/**
 * Restaura um cliente que estava desativado/arquivado
 */
export async function restoreClient(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE clients SET deleted_at = NULL, updated_at = ? WHERE id = ?', [now, id]);
}

export async function countActiveDebtorClients(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT count(DISTINCT c.id) as count
    FROM clients c
    JOIN entries e ON e.client_id = c.id AND e.status = 'pending'
    WHERE c.deleted_at IS NULL AND (e.amount - c.credit_balance) > 0
  `);
  return row ? row.count : 0;
}
