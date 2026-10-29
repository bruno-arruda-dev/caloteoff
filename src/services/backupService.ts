import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase, resetDatabaseConnection } from '../database/schema';
import { getBusinessProfile, getPixKeys } from '../database/businessRepository';
import { getClients } from '../database/clientRepository';
import { getMessageTemplates } from '../database/messageTemplateRepository';
import { getNotificationRules } from '../database/notificationRepository';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  EncryptedBackupContainer,
} from './backupCryptoService';

export interface CaloteOffBackupPayload {
  version: string;
  exportedAt: string;
  businessProfile: any;
  pixKeys: any[];
  clients: any[];
  entries: any[];
  payments: any[];
  messageTemplates: any[];
  notificationRules: any[];
}

export async function exportBackup(userPassword?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const db = await getDatabase();
    const profile = await getBusinessProfile();
    const pixKeys = await getPixKeys();
    const clients = await db.getAllAsync('SELECT * FROM clients');
    const entries = await db.getAllAsync('SELECT * FROM entries');
    const payments = await db.getAllAsync('SELECT * FROM payments');
    const templates = await getMessageTemplates();
    const rules = await getNotificationRules();

    const payload: CaloteOffBackupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      businessProfile: profile,
      pixKeys,
      clients,
      entries,
      payments,
      messageTemplates: templates,
      notificationRules: rules,
    };

    const jsonContent = JSON.stringify(payload);
    const encryptedContainer = encryptBackupPayload(jsonContent, 'light', userPassword);
    const encryptedFileContent = JSON.stringify(encryptedContainer, null, 2);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `caloteoff_backup_${timestamp}.caloteoff`;

    const backupFile = new File(Paths.document, fileName);
    if (!backupFile.exists) {
      backupFile.create();
    }
    await backupFile.write(encryptedFileContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupFile.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Exportar Backup do CaloteOff',
        UTI: 'public.data',
      });
    }

    return { success: true, filePath: backupFile.uri };
  } catch (err: any) {
    console.warn('Erro ao exportar backup:', err);
    return { success: false, error: err.message || 'Falha ao exportar backup' };
  }
}

export async function pickAndRestoreBackup(
  userPassword?: string,
  cachedUri?: string
): Promise<{ success: boolean; error?: string; needsPassword?: boolean; pendingFileUri?: string }> {
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

    const backupFile = new File(fileUri);
    const fileContent = await backupFile.text();

    let container: EncryptedBackupContainer;
    try {
      container = JSON.parse(fileContent);
    } catch {
      return { success: false, error: 'O arquivo selecionado não é um backup válido do CaloteOff.' };
    }

    if (container.hasPassword && !userPassword) {
      return {
        success: false,
        needsPassword: true,
        pendingFileUri: fileUri,
        error: 'Este backup é protegido por senha.',
      };
    }

    const decryptResult = decryptBackupPayload(container, userPassword);
    if (!decryptResult.success || !decryptResult.data) {
      return {
        success: false,
        needsPassword: true,
        pendingFileUri: fileUri,
        error: decryptResult.error || 'Senha incorreta ou arquivo de backup corrompido.',
      };
    }

    const payload: CaloteOffBackupPayload = JSON.parse(decryptResult.data);
    const db = await getDatabase();

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      // Limpa dados atuais
      await db.execAsync(`
        DELETE FROM payments;
        DELETE FROM entries;
        DELETE FROM clients;
        DELETE FROM pix_keys;
      `);

      // Restaura business profile
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
          [bp.trade_name, bp.phone, bp.logo_uri, bp.primary_color, bp.created_at || new Date().toISOString(), bp.updated_at || new Date().toISOString()]
        );
      }

      // Restaura chaves Pix
      if (Array.isArray(payload.pixKeys)) {
        for (const pk of payload.pixKeys) {
          await db.runAsync(
            `INSERT INTO pix_keys (id, label, key_type, key_value, is_primary, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pk.id, pk.label, pk.key_type, pk.key_value, pk.is_primary ? 1 : 0, pk.created_at]
          );
        }
      }

      // Restaura clientes
      if (Array.isArray(payload.clients)) {
        for (const c of payload.clients) {
          await db.runAsync(
            `INSERT INTO clients (
              id, name, nickname, whatsapp_primary, phones_json, addresses_json,
              credit_limit, limit_policy, billing_cycle, billing_day, notes,
              credit_balance, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id,
              c.name,
              c.nickname,
              c.whatsapp_primary,
              c.phones_json || '[]',
              c.addresses_json || '[]',
              c.credit_limit,
              c.limit_policy || 'AVISAR_E_PERMITIR',
              c.billing_cycle || 'MONTHLY',
              c.billing_day || 10,
              c.notes || '',
              c.credit_balance || 0,
              c.created_at,
              c.updated_at,
            ]
          );
        }
      }

      // Restaura lançamentos
      if (Array.isArray(payload.entries)) {
        for (const e of payload.entries) {
          await db.runAsync(
            `INSERT INTO entries (
              id, client_id, amount, due_date, description, receipt_image_uri,
              status, paid_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              e.id,
              e.client_id,
              e.amount,
              e.due_date,
              e.description || '',
              e.receipt_image_uri || null,
              e.status || 'pending',
              e.paid_at || null,
              e.created_at,
              e.updated_at,
            ]
          );
        }
      }

      // Restaura pagamentos
      if (Array.isArray(payload.payments)) {
        for (const p of payload.payments) {
          await db.runAsync(
            `INSERT INTO payments (
              id, client_id, amount_paid, previous_balance, resulting_balance,
              payment_type, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.client_id,
              p.amount_paid,
              p.previous_balance,
              p.resulting_balance,
              p.payment_type,
              p.notes || '',
              p.created_at,
            ]
          );
        }
      }

      await db.execAsync('COMMIT;');
      return { success: true };
    } catch (txErr: any) {
      await db.execAsync('ROLLBACK;');
      throw txErr;
    }
  } catch (err: any) {
    console.warn('Erro ao restaurar backup:', err);
    return { success: false, error: err.message || 'Falha ao restaurar backup' };
  }
}
