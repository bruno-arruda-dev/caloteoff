import { IrineuBackupHeader, IrineuBackupPayloadV1, IrineuBackupPayloadV2 } from './backupTypes';

export const CURRENT_BACKUP_SCHEMA_VERSION = 2;

/**
 * Normaliza e executa migrações lineares de qualquer versão antiga
 * de backup para a versão atual do schema.
 */
export function migrateBackupToLatest(rawPayload: any): IrineuBackupPayloadV2 {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Arquivo de backup inválido ou vazio.');
  }

  // Detecta a versão do schema (Backups legados v1.0.0 não tinham header ou schema_version)
  let currentSchema = 1;
  if (rawPayload.header && typeof rawPayload.header.schema_version === 'number') {
    currentSchema = rawPayload.header.schema_version;
  } else if (typeof rawPayload.schema_version === 'number') {
    currentSchema = rawPayload.schema_version;
  }

  let state: any = JSON.parse(JSON.stringify(rawPayload));

  // Pipeline sequencial de migrações
  if (currentSchema === 1) {
    state = migrateV1ToV2(state);
    currentSchema = 2;
  }

  // Futuras migrações entrarão aqui sequencialmente:
  // if (currentSchema === 2) {
  //   state = migrateV2ToV3(state);
  //   currentSchema = 3;
  // }

  return state as IrineuBackupPayloadV2;
}

/**
 * Migração V1 -> V2:
 * - V1: clients tinham apenas whatsapp_primary, phones_json e addresses_json (ou nulo)
 * - V1: não existiam tabelas separadas client_phones e client_addresses
 * - V1: não existia header padronizado com metadados e summary
 * - V1: settings globais não eram salvas
 */
export function migrateV1ToV2(v1: IrineuBackupPayloadV1): IrineuBackupPayloadV2 {
  const clients = Array.isArray(v1.clients) ? v1.clients : [];
  const clientPhones: any[] = [];
  const clientAddresses: any[] = [];

  const migratedClients = clients.map((c) => {
    let phones: any[] = [];
    try {
      phones = typeof c.phones_json === 'string' ? JSON.parse(c.phones_json) : Array.isArray(c.phones) ? c.phones : [];
    } catch {
      phones = [];
    }

    let addresses: any[] = [];
    try {
      addresses = typeof c.addresses_json === 'string' ? JSON.parse(c.addresses_json) : Array.isArray(c.addresses) ? c.addresses : [];
    } catch {
      addresses = [];
    }

    // Se o cliente tem whatsapp principal e não está na lista de telefones, cria registro
    if (c.whatsapp_primary && !phones.some((p: any) => p.number === c.whatsapp_primary)) {
      clientPhones.push({
        id: `ph-mig-${c.id}-main`,
        client_id: c.id,
        label: 'WhatsApp',
        number: String(c.whatsapp_primary).trim(),
        is_whatsapp: 1,
        created_at: c.created_at || new Date().toISOString(),
      });
    }

    // Converte os demais telefones para a tabela client_phones
    phones.forEach((p: any, idx: number) => {
      if (p && p.number) {
        clientPhones.push({
          id: p.id || `ph-mig-${c.id}-${idx}`,
          client_id: c.id,
          label: p.label || 'Celular',
          number: String(p.number).trim(),
          is_whatsapp: p.label === 'WhatsApp' ? 1 : 0,
          created_at: c.created_at || new Date().toISOString(),
        });
      }
    });

    // Converte os endereços para a tabela client_addresses
    addresses.forEach((a: any, idx: number) => {
      if (a && a.street) {
        clientAddresses.push({
          id: a.id || `addr-mig-${c.id}-${idx}`,
          client_id: c.id,
          label: a.label || 'Principal',
          street: String(a.street).trim(),
          number: a.number || '',
          neighborhood: a.neighborhood || '',
          reference: a.reference || '',
          created_at: c.created_at || new Date().toISOString(),
        });
      }
    });

    return {
      ...c,
      limit_policy: c.limit_policy || 'PADRAO_GLOBAL',
      billing_cycle: c.billing_cycle || 'MONTHLY',
      billing_day: Number(c.billing_day || 10),
      notes: c.notes || '',
      credit_balance: Number(c.credit_balance || 0),
      deleted_at: c.deleted_at || null,
    };
  });

  const entries = Array.isArray(v1.entries) ? v1.entries : [];
  const payments = Array.isArray(v1.payments) ? v1.payments : [];

  let pendingSum = 0;
  entries.forEach((e) => {
    if (e.status === 'pending') {
      pendingSum += Number(e.amount || 0);
    }
  });

  const header: IrineuBackupHeader = {
    app_name: 'Irineu',
    app_version: v1.version || '1.0.0',
    schema_version: 2,
    backup_type: 'FULL',
    exported_at: v1.exportedAt || new Date().toISOString(),
    summary: {
      total_clients: migratedClients.length,
      total_entries: entries.length,
      total_payments: payments.length,
      total_pending_amount: Math.round(pendingSum * 100) / 100,
    },
  };

  return {
    header,
    businessProfile: v1.businessProfile || {
      id: 'default',
      trade_name: 'Minha Loja',
      phone: '',
      logo_uri: null,
      primary_color: '#4F46E5',
    },
    pixKeys: Array.isArray(v1.pixKeys) ? v1.pixKeys : [],
    clients: migratedClients,
    clientPhones,
    clientAddresses,
    entries: entries.map((e) => ({
      ...e,
      description: e.description || '',
      receipt_image_uri: e.receipt_image_uri || null,
      status: e.status || 'pending',
      paid_at: e.paid_at || null,
    })),
    payments: payments.map((p) => ({
      ...p,
      notes: p.notes || '',
      payment_type: p.payment_type || 'FULL',
    })),
    messageTemplates: Array.isArray(v1.messageTemplates) ? v1.messageTemplates : [],
    notificationRules: Array.isArray(v1.notificationRules) ? v1.notificationRules : [],
    settings: [],
  };
}
