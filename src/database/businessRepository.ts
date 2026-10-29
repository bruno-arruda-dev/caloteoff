import * as Crypto from 'expo-crypto';
import { BusinessProfile, PixKey, PixKeyType } from '../types';
import { getDatabase } from './schema';

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM business_profile WHERE id = ?', ['default']);
  if (!row) {
    const now = new Date().toISOString();
    return {
      id: 'default',
      trade_name: 'Minha Loja',
      phone: '',
      logo_uri: null,
      primary_color: '#4F46E5',
      created_at: now,
      updated_at: now,
    };
  }
  return {
    id: row.id,
    trade_name: row.trade_name,
    phone: row.phone,
    logo_uri: row.logo_uri,
    primary_color: row.primary_color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateBusinessProfile(
  trade_name: string,
  phone: string,
  logo_uri: string | null,
  primary_color: string
): Promise<BusinessProfile> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO business_profile (id, trade_name, phone, logo_uri, primary_color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       trade_name = excluded.trade_name,
       phone = excluded.phone,
       logo_uri = excluded.logo_uri,
       primary_color = excluded.primary_color,
       updated_at = excluded.updated_at`,
    ['default', trade_name, phone, logo_uri, primary_color, now, now]
  );
  return getBusinessProfile();
}

export async function getPixKeys(): Promise<PixKey[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM pix_keys ORDER BY is_primary DESC, created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    key_type: r.key_type as PixKeyType,
    key_value: r.key_value,
    is_primary: r.is_primary === 1 || r.is_primary === true,
    created_at: r.created_at,
  }));
}

export async function addPixKey(
  label: string,
  key_type: PixKeyType,
  key_value: string,
  is_primary: boolean = false
): Promise<PixKey> {
  const db = await getDatabase();
  const id = `pix-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  if (is_primary) {
    await db.runAsync('UPDATE pix_keys SET is_primary = 0');
  } else {
    // Se for a primeira chave, torna primária automaticamente
    const count = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM pix_keys');
    if (!count || count.count === 0) {
      is_primary = true;
    }
  }

  await db.runAsync(
    `INSERT INTO pix_keys (id, label, key_type, key_value, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, label, key_type, key_value, is_primary ? 1 : 0, now]
  );

  return {
    id,
    label,
    key_type,
    key_value,
    is_primary,
    created_at: now,
  };
}

export async function setPrimaryKey(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE pix_keys SET is_primary = 0');
  await db.runAsync('UPDATE pix_keys SET is_primary = 1 WHERE id = ?', [id]);
}

export async function deletePixKey(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pix_keys WHERE id = ?', [id]);

  // Se a chave deletada era a primária e restou alguma, define a primeira como primária
  const primary = await db.getFirstAsync('SELECT id FROM pix_keys WHERE is_primary = 1');
  if (!primary) {
    const first = await db.getFirstAsync<{ id: string }>('SELECT id FROM pix_keys LIMIT 1');
    if (first) {
      await db.runAsync('UPDATE pix_keys SET is_primary = 1 WHERE id = ?', [first.id]);
    }
  }
}
