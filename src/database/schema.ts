import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function resetDatabaseConnection(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch {}
    dbInstance = null;
  }
  initPromise = null;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    try {
      await dbInstance.getFirstAsync('SELECT 1');
      return dbInstance;
    } catch (err) {
      console.warn('Conexão SQLite existente inválida ou encerrada pelo sistema. Reconectando...', err);
      try {
        await dbInstance.closeAsync();
      } catch {}
      dbInstance = null;
    }
  }

  if (initPromise) {
    return await initPromise;
  }

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('caloteoff.db');
      await initDatabase(db);
      dbInstance = db;
      return db;
    } finally {
      initPromise = null;
    }
  })();

  return await initPromise;
}

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Tabela de Configurações Gerais
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Perfil do Negócio (Credor)
    CREATE TABLE IF NOT EXISTS business_profile (
      id TEXT PRIMARY KEY,
      trade_name TEXT NOT NULL DEFAULT 'Minha Loja',
      phone TEXT NOT NULL DEFAULT '',
      logo_uri TEXT,
      primary_color TEXT NOT NULL DEFAULT '#4F46E5',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Chaves Pix
    CREATE TABLE IF NOT EXISTS pix_keys (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      key_type TEXT NOT NULL,
      key_value TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Clientes
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT NOT NULL,
      whatsapp_primary TEXT NOT NULL,
      phones_json TEXT DEFAULT '[]',
      addresses_json TEXT DEFAULT '[]',
      credit_limit REAL,
      limit_policy TEXT NOT NULL DEFAULT 'AVISAR_E_PERMITIR',
      billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
      billing_day INTEGER NOT NULL DEFAULT 10,
      notes TEXT DEFAULT '',
      credit_balance REAL NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Lançamentos de Fiado ("Pendurar")
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      receipt_image_uri TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Baixas e Liquidações ("Passar a Régua" com Snapshot Imutável)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount_paid REAL NOT NULL,
      previous_balance REAL NOT NULL,
      resulting_balance REAL NOT NULL,
      payment_type TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- Modelos de Mensagem (Templates WhatsApp)
    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      template_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- Regras de Notificação
    CREATE TABLE IF NOT EXISTS notification_rules (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      days_offset INTEGER NOT NULL DEFAULT 0,
      time TEXT NOT NULL DEFAULT '09:00',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- Índices para Performance Máxima
    CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client_id);
    CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
    CREATE INDEX IF NOT EXISTS idx_entries_due_date ON entries(due_date);
    CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
  `);

  // Migração segura para adicionar coluna deleted_at caso a tabela já exista
  try {
    await db.runAsync('ALTER TABLE clients ADD COLUMN deleted_at TEXT;');
  } catch {
    // Coluna já existe
  }

  // Semente do Perfil do Negócio Inicial se vazio
  const profile = await db.getFirstAsync('SELECT id FROM business_profile WHERE id = ?', ['default']);
  if (!profile) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO business_profile (id, trade_name, phone, primary_color, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['default', 'Minha Loja', '', '#4F46E5', now, now]
    );
  }

  // Semente dos 6 Modelos de Mensagem Padrão de Fábrica
  const tplCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM message_templates');
  if (!tplCount || tplCount.count === 0) {
    const now = new Date().toISOString();
    const defaultTemplates = [
      {
        id: 'tpl-friendly-reminder',
        key: 'friendly_reminder',
        title: 'Lembrete Preventivo (Cobra Hoje / A Vencer)',
        body: 'Olá, *{cliente}*! Tudo bem? 😊\n\nPassando para lembrar do seu fechamento hoje na *{nome_loja}* no valor de *{valor_total}*.\n\n{lista_compras}\n\n📱 *Chave Pix para acerto:*\n{chave_pix}\n\nQualquer dúvida estamos à disposição!',
      },
      {
        id: 'tpl-overdue-collection',
        key: 'overdue_collection',
        title: 'Cobrança Ativa (Vencido / Atrasado)',
        body: 'Olá, *{cliente}*! Tudo bem? 😊\n\nConsta em aberto na *{nome_loja}* um saldo pendente de *{valor_total}*.\n\n{lista_compras}\n\n📱 *Segue nossa chave Pix para acerto:*\n{chave_pix}\n\n_Se já realizou o pagamento, por favor desconsidere esta mensagem._',
      },
      {
        id: 'tpl-full-receipt',
        key: 'full_receipt',
        title: 'Recibo de Quitação Total ("Passou a Régua")',
        body: '🧾 *Comprovante de Pagamento — {nome_loja}*\n\nConfirmamos o recebimento de *{valor_pago}*.\nSua conta está *100% liquidada* (Saldo: R$ 0,00). 🎉\n\nMuito obrigado pela parceria e preferência!',
      },
      {
        id: 'tpl-partial-receipt',
        key: 'partial_receipt',
        title: 'Recibo de Abatimento Parcial',
        body: '🧾 *Comprovante de Abatimento — {nome_loja}*\n\nConfirmamos o recebimento de *{valor_pago}*.\nSeu saldo restante agora é de *{saldo_restante}*.\n\nAgradecemos a atenção e preferência! 👍',
      },
      {
        id: 'tpl-credit-receipt',
        key: 'credit_receipt',
        title: 'Recibo com Saldo a Favor (Adiantamento)',
        body: '🧾 *Comprovante de Crédito — {nome_loja}*\n\nRecebemos o valor de *{valor_pago}*.\nSua conta foi quitada e você ficou com um *saldo a favor de {saldo_restante}* para suas próximas compras! 🌟',
      },
      {
        id: 'tpl-open-statement',
        key: 'open_statement',
        title: 'Extrato Resumido das Compras em Aberto',
        body: '📋 *Extrato de Compras — {nome_loja}*\n\nOlá, *{cliente}*! Segue o detalhamento dos seus lançamentos pendentes:\n\n{lista_compras}\n\n💰 *Total acumulado:* {valor_total}\n📱 *Chave Pix para acerto:* {chave_pix}',
      },
    ];

    for (const tpl of defaultTemplates) {
      await db.runAsync(
        `INSERT INTO message_templates (id, template_key, title, body, is_default, updated_at) 
         VALUES (?, ?, ?, ?, 1, ?)`,
        [tpl.id, tpl.key, tpl.title, tpl.body, now]
      );
    }
  }

  // Semente da Regra de Notificação Padrão (Vencidos depois de 1 dia às 09:00)
  const notifCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM notification_rules');
  if (!notifCount || notifCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO notification_rules (id, type, days_offset, time, enabled, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      ['rule-default-overdue-1day', 'after_due', 1, '09:00', now]
    );
  }
}
