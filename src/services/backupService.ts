import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from '../database/schema';
import { getBusinessProfile, getPixKeys } from '../database/businessRepository';
import { getMessageTemplates } from '../database/messageTemplateRepository';
import { getNotificationRules } from '../database/notificationRepository';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  EncryptedBackupContainer,
} from './backupCryptoService';
import {
  BackupType,
  IrineuBackupHeader,
  IrineuBackupPayloadV2,
} from './backup/backupTypes';
import {
  CURRENT_BACKUP_SCHEMA_VERSION,
  migrateBackupToLatest,
} from './backup/migrationRunner';

export interface ExportBackupOptions {
  userPassword?: string;
  backupType?: BackupType;
}

export interface RestoreBackupResult {
  success: boolean;
  error?: string;
  needsPassword?: boolean;
  pendingFileUri?: string;
  header?: IrineuBackupHeader;
}

/**
 * Exporta o backup do Irineu suportando:
 * - 'FULL': Completo (todas as compras, liquidações, clientes e configs).
 * - 'PENDING_ONLY': Apenas pendências em aberto e seus respectivos devedores.
 * - 'CONSOLIDATED_ARCHIVE': Histórico de quitações e pagamentos (arquivo morto).
 */
export async function exportBackup(
  options?: ExportBackupOptions
): Promise<{ success: boolean; filePath?: string; error?: string; header?: IrineuBackupHeader }> {
  try {
    const backupType: BackupType = options?.backupType || 'FULL';
    const userPassword = options?.userPassword;

    const db = await getDatabase();
    const profile = await getBusinessProfile();
    const pixKeys = await getPixKeys();
    const templates = await getMessageTemplates();
    const rules = await getNotificationRules();
    const settings = await db.getAllAsync('SELECT * FROM settings');

    let clients: any[] = [];
    let entries: any[] = [];
    let payments: any[] = [];
    let clientPhones: any[] = [];
    let clientAddresses: any[] = [];

    if (backupType === 'PENDING_ONLY') {
      // Exporta apenas entradas em aberto e os clientes vinculados
      entries = await db.getAllAsync("SELECT * FROM entries WHERE status = 'pending'");
      const pendingClientIds = Array.from(new Set(entries.map((e) => e.client_id)));

      if (pendingClientIds.length > 0) {
        const placeholders = pendingClientIds.map(() => '?').join(',');
        clients = await db.getAllAsync(`SELECT * FROM clients WHERE id IN (${placeholders})`, pendingClientIds);
        clientPhones = await db.getAllAsync(`SELECT * FROM client_phones WHERE client_id IN (${placeholders})`, pendingClientIds);
        clientAddresses = await db.getAllAsync(`SELECT * FROM client_addresses WHERE client_id IN (${placeholders})`, pendingClientIds);
      }
      payments = []; // Sem pagamentos passados
    } else if (backupType === 'CONSOLIDATED_ARCHIVE') {
      // Exporta histórico de quitações e entradas já pagas
      entries = await db.getAllAsync("SELECT * FROM entries WHERE status = 'paid'");
      payments = await db.getAllAsync('SELECT * FROM payments');
      const involvedClientIds = Array.from(new Set([...entries.map((e) => e.client_id), ...payments.map((p) => p.client_id)]));

      if (involvedClientIds.length > 0) {
        const placeholders = involvedClientIds.map(() => '?').join(',');
        clients = await db.getAllAsync(`SELECT * FROM clients WHERE id IN (${placeholders})`, involvedClientIds);
        clientPhones = await db.getAllAsync(`SELECT * FROM client_phones WHERE client_id IN (${placeholders})`, involvedClientIds);
        clientAddresses = await db.getAllAsync(`SELECT * FROM client_addresses WHERE client_id IN (${placeholders})`, involvedClientIds);
      }
    } else {
      // 'FULL': Tudo
      clients = await db.getAllAsync('SELECT * FROM clients');
      entries = await db.getAllAsync('SELECT * FROM entries');
      payments = await db.getAllAsync('SELECT * FROM payments');
      clientPhones = await db.getAllAsync('SELECT * FROM client_phones');
      clientAddresses = await db.getAllAsync('SELECT * FROM client_addresses');
    }

    let pendingSum = 0;
    entries.forEach((e) => {
      if (e.status === 'pending') {
        pendingSum += Number(e.amount || 0);
      }
    });

    const header: IrineuBackupHeader = {
      app_name: 'Irineu',
      app_version: '1.0.3',
      schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
      backup_type: backupType,
      exported_at: new Date().toISOString(),
      summary: {
        total_clients: clients.length,
        total_entries: entries.length,
        total_payments: payments.length,
        total_pending_amount: Math.round(pendingSum * 100) / 100,
      },
    };

    const payload: IrineuBackupPayloadV2 = {
      header,
      businessProfile: profile,
      pixKeys,
      clients,
      clientPhones,
      clientAddresses,
      entries,
      payments,
      messageTemplates: templates,
      notificationRules: rules,
      settings,
    };

    const jsonContent = JSON.stringify(payload);
    const encryptedContainer = encryptBackupPayload(jsonContent, 'light', userPassword);
    const encryptedFileContent = JSON.stringify(encryptedContainer, null, 2);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const typeTag = backupType === 'PENDING_ONLY' ? 'pendencias' : backupType === 'CONSOLIDATED_ARCHIVE' ? 'consolidado' : 'completo';
    const fileName = `irineu_backup_${typeTag}_${timestamp}.irineu`;

    const backupFile = new File(Paths.document, fileName);
    if (!backupFile.exists) {
      backupFile.create();
    }
    await backupFile.write(encryptedFileContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupFile.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: `Exportar Backup ${typeTag.toUpperCase()} - Irineu`,
        UTI: 'public.data',
      });
    }

    return { success: true, filePath: backupFile.uri, header };
  } catch (err: any) {
    console.warn('Erro ao exportar backup:', err);
    return { success: false, error: err.message || 'Falha ao exportar backup' };
  }
}

/**
 * Lê e descriptografa o arquivo para inspecionar os metadados antes de restaurar.
 */
export async function inspectBackupFile(
  fileUri: string,
  userPassword?: string
): Promise<{ success: boolean; container?: EncryptedBackupContainer; payload?: IrineuBackupPayloadV2; error?: string; needsPassword?: boolean }> {
  try {
    const backupFile = new File(fileUri);
    const fileContent = await backupFile.text();

    let container: EncryptedBackupContainer;
    try {
      container = JSON.parse(fileContent);
    } catch {
      return { success: false, error: 'O arquivo selecionado não é um backup válido do Irineu.' };
    }

    if (container.hasPassword && !userPassword) {
      return { success: false, needsPassword: true, container };
    }

    const decryptResult = decryptBackupPayload(container, userPassword);
    if (!decryptResult.success || !decryptResult.data) {
      return {
        success: false,
        needsPassword: true,
        error: decryptResult.error || 'Senha incorreta ou arquivo de backup corrompido.',
      };
    }

    const rawPayload = JSON.parse(decryptResult.data);
    const migrated = migrateBackupToLatest(rawPayload);

    return { success: true, container, payload: migrated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao inspecionar backup' };
  }
}

/**
 * Restaura o backup aplicando transação atômica e as migrações sequenciais necessárias.
 */
export async function pickAndRestoreBackup(
  userPassword?: string,
  cachedUri?: string,
  restoreMode: 'REPLACE_ALL' | 'MERGE' = 'REPLACE_ALL'
): Promise<RestoreBackupResult> {
  try {
    let fileUri = cachedUri;

    if (!fileUri) {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false, error: 'Seleção cancelada' };
      }
      fileUri = result.assets[0].uri;
    }

    const inspect = await inspectBackupFile(fileUri, userPassword);
    if (!inspect.success || !inspect.payload) {
      return {
        success: false,
        needsPassword: inspect.needsPassword,
        pendingFileUri: fileUri,
        error: inspect.error,
      };
    }

    const payload = inspect.payload;
    const db = await getDatabase();

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      if (restoreMode === 'REPLACE_ALL') {
        // Limpa dados atuais com segurança
        await db.execAsync(`
          DELETE FROM client_addresses;
          DELETE FROM client_phones;
          DELETE FROM payments;
          DELETE FROM entries;
          DELETE FROM clients;
          DELETE FROM pix_keys;
        `);
      }

      // 1. Restaura Business Profile
      if (payload.businessProfile) {
        const bp = payload.businessProfile;
        await db.runAsync(
          `INSERT INTO business_profile (id, trade_name, phone, logo_uri, primary_color, created_at, updated_at)
           VALUES ('default', ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             trade_name = excluded.trade_name,
             phone = excluded.phone,
             logo_uri = excluded.logo_uri,
             primary_color = excluded.primary_color`,
          [
            bp.trade_name || 'Minha Loja',
            bp.phone || '',
            bp.logo_uri || null,
            bp.primary_color || '#4F46E5',
            bp.created_at || new Date().toISOString(),
            bp.updated_at || new Date().toISOString(),
          ]
        );
      }

      // 2. Restaura Chaves Pix
      if (Array.isArray(payload.pixKeys)) {
        for (const pk of payload.pixKeys) {
          await db.runAsync(
            `INSERT INTO pix_keys (id, label, key_type, key_value, is_primary, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               label = excluded.label,
               key_type = excluded.key_type,
               key_value = excluded.key_value,
               is_primary = excluded.is_primary`,
            [pk.id, pk.label, pk.key_type, pk.key_value, pk.is_primary ? 1 : 0, pk.created_at || new Date().toISOString()]
          );
        }
      }

      // 3. Restaura Clientes
      if (Array.isArray(payload.clients)) {
        for (const c of payload.clients) {
          await db.runAsync(
            `INSERT INTO clients (
              id, name, nickname, whatsapp_primary, phones_json, addresses_json,
              credit_limit, limit_policy, billing_cycle, billing_day, notes,
              credit_balance, deleted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              nickname = excluded.nickname,
              whatsapp_primary = excluded.whatsapp_primary,
              phones_json = excluded.phones_json,
              addresses_json = excluded.addresses_json,
              credit_limit = excluded.credit_limit,
              limit_policy = excluded.limit_policy,
              billing_cycle = excluded.billing_cycle,
              billing_day = excluded.billing_day,
              notes = excluded.notes,
              credit_balance = excluded.credit_balance,
              deleted_at = excluded.deleted_at`,
            [
              c.id,
              c.name,
              c.nickname || c.name,
              c.whatsapp_primary || '',
              c.phones_json || '[]',
              c.addresses_json || '[]',
              c.credit_limit !== undefined ? c.credit_limit : null,
              c.limit_policy || 'PADRAO_GLOBAL',
              c.billing_cycle || 'MONTHLY',
              c.billing_day || 10,
              c.notes || '',
              c.credit_balance || 0,
              c.deleted_at || null,
              c.created_at || new Date().toISOString(),
              c.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // 4. Restaura Telefones (Tabela Relacional)
      if (Array.isArray(payload.clientPhones)) {
        for (const ph of payload.clientPhones) {
          await db.runAsync(
            `INSERT INTO client_phones (id, client_id, label, number, is_whatsapp, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               label = excluded.label,
               number = excluded.number,
               is_whatsapp = excluded.is_whatsapp`,
            [ph.id, ph.client_id, ph.label || 'Celular', ph.number, ph.is_whatsapp ? 1 : 0, ph.created_at || new Date().toISOString()]
          );
        }
      }

      // 5. Restaura Endereços (Tabela Relacional)
      if (Array.isArray(payload.clientAddresses)) {
        for (const ad of payload.clientAddresses) {
          await db.runAsync(
            `INSERT INTO client_addresses (id, client_id, label, street, number, neighborhood, reference, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               label = excluded.label,
               street = excluded.street,
               number = excluded.number,
               neighborhood = excluded.neighborhood,
               reference = excluded.reference`,
            [
              ad.id,
              ad.client_id,
              ad.label || 'Principal',
              ad.street,
              ad.number || '',
              ad.neighborhood || '',
              ad.reference || '',
              ad.created_at || new Date().toISOString(),
            ]
          );
        }
      }

      // 6. Restaura Lançamentos (Entries)
      if (Array.isArray(payload.entries)) {
        for (const e of payload.entries) {
          await db.runAsync(
            `INSERT INTO entries (
              id, client_id, amount, due_date, description, receipt_image_uri,
              status, paid_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              amount = excluded.amount,
              due_date = excluded.due_date,
              description = excluded.description,
              receipt_image_uri = excluded.receipt_image_uri,
              status = excluded.status,
              paid_at = excluded.paid_at`,
            [
              e.id,
              e.client_id,
              e.amount,
              e.due_date,
              e.description || '',
              e.receipt_image_uri || null,
              e.status || 'pending',
              e.paid_at || null,
              e.created_at || new Date().toISOString(),
              e.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // 7. Restaura Pagamentos (Payments)
      if (Array.isArray(payload.payments)) {
        for (const p of payload.payments) {
          await db.runAsync(
            `INSERT INTO payments (
              id, client_id, amount_paid, previous_balance, resulting_balance,
              payment_type, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              amount_paid = excluded.amount_paid,
              previous_balance = excluded.previous_balance,
              resulting_balance = excluded.resulting_balance,
              payment_type = excluded.payment_type,
              notes = excluded.notes`,
            [
              p.id,
              p.client_id,
              p.amount_paid,
              p.previous_balance,
              p.resulting_balance,
              p.payment_type || 'FULL',
              p.notes || '',
              p.created_at || new Date().toISOString(),
            ]
          );
        }
      }

      await db.execAsync('COMMIT;');
      return { success: true, header: payload.header };
    } catch (txErr: any) {
      await db.execAsync('ROLLBACK;');
      throw txErr;
    }
  } catch (err: any) {
    console.warn('Erro ao restaurar backup:', err);
    return { success: false, error: err.message || 'Falha ao restaurar backup' };
  }
}
