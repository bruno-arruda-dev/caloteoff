import * as Crypto from 'expo-crypto';
import { DebitEntry } from '../types';
import { getDatabase } from './schema';

export async function addDebitEntry(data: {
  client_id: string;
  amount: number;
  due_date: string;
  description: string;
  receipt_image_uri?: string | null;
}): Promise<DebitEntry> {
  const db = await getDatabase();
  const id = `ent-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO entries (
      id, client_id, amount, due_date, description, receipt_image_uri,
      status, paid_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
    [
      id,
      data.client_id,
      data.amount,
      data.due_date,
      data.description || '',
      data.receipt_image_uri || null,
      now,
      now,
    ]
  );

  return {
    id,
    client_id: data.client_id,
    amount: data.amount,
    due_date: data.due_date,
    description: data.description || '',
    receipt_image_uri: data.receipt_image_uri || null,
    status: 'pending',
    paid_at: null,
    created_at: now,
    updated_at: now,
  };
}

export async function getClientDebits(
  clientId: string,
  status: 'pending' | 'paid' | 'all' = 'all'
): Promise<DebitEntry[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM entries WHERE client_id = ?';
  const params: any[] = [clientId];

  if (status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY due_date DESC, created_at DESC';

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    amount: Number(r.amount),
    due_date: r.due_date,
    description: r.description || '',
    receipt_image_uri: r.receipt_image_uri || null,
    status: r.status as 'pending' | 'paid',
    paid_at: r.paid_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function deleteDebitEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function updateDebitEntry(
  id: string,
  data: Partial<{
    amount: number;
    due_date: string;
    description: string;
    receipt_image_uri: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.getFirstAsync<any>('SELECT * FROM entries WHERE id = ?', [id]);
  if (!current) throw new Error('Lançamento não encontrado');

  await db.runAsync(
    `UPDATE entries SET
      amount = ?,
      due_date = ?,
      description = ?,
      receipt_image_uri = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      data.amount !== undefined ? data.amount : current.amount,
      data.due_date !== undefined ? data.due_date : current.due_date,
      data.description !== undefined ? data.description : current.description,
      data.receipt_image_uri !== undefined ? data.receipt_image_uri : current.receipt_image_uri,
      now,
      id,
    ]
  );
}
