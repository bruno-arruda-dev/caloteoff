import * as Crypto from 'expo-crypto';
import { NotificationRule, NotificationRuleType } from '../types';
import { getDatabase } from './schema';

export async function getNotificationRules(): Promise<NotificationRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM notification_rules ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationRuleType,
    days_offset: Number(r.days_offset),
    time: r.time,
    enabled: r.enabled === 1 || r.enabled === true,
    created_at: r.created_at,
  }));
}

export async function createNotificationRule(
  type: NotificationRuleType,
  days_offset: number,
  time: string
): Promise<NotificationRule> {
  const db = await getDatabase();
  const id = `notif-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO notification_rules (id, type, days_offset, time, enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [id, type, days_offset, time, now]
  );

  return {
    id,
    type,
    days_offset,
    time,
    enabled: true,
    created_at: now,
  };
}

export async function updateNotificationRule(
  id: string,
  data: Partial<{
    type: NotificationRuleType;
    days_offset: number;
    time: string;
    enabled: boolean;
  }>
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<any>('SELECT * FROM notification_rules WHERE id = ?', [id]);
  if (!current) throw new Error('Regra de notificação não encontrada');

  await db.runAsync(
    `UPDATE notification_rules SET
      type = ?,
      days_offset = ?,
      time = ?,
      enabled = ?
     WHERE id = ?`,
    [
      data.type !== undefined ? data.type : current.type,
      data.days_offset !== undefined ? data.days_offset : current.days_offset,
      data.time !== undefined ? data.time : current.time,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : current.enabled,
      id,
    ]
  );
}

export async function deleteNotificationRule(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notification_rules WHERE id = ?', [id]);
}
