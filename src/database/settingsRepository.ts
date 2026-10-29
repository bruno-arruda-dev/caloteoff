import { getDatabase } from './schema';

export async function getSetting(key: string, defaultValue?: string): Promise<string | undefined> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  } catch (err) {
    console.warn(`Erro ao obter setting ${key}:`, err);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
