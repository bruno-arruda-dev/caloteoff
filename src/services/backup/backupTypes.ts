/**
 * Tipos e Contratos Formais de Backup do Irineu.
 * Toda evolução de schema DEVE ser registrada aqui.
 */

export type BackupType = 'FULL' | 'PENDING_ONLY' | 'CONSOLIDATED_ARCHIVE';

export interface IrineuBackupHeader {
  app_name: string;
  app_version: string;
  schema_version: number;
  backup_type: BackupType;
  exported_at: string;
  checksum?: string;
  summary: {
    total_clients: number;
    total_entries: number;
    total_payments: number;
    total_pending_amount: number;
  };
}

export interface IrineuBackupPayloadV1 {
  version?: string;
  schema_version?: number;
  exportedAt?: string;
  businessProfile: any;
  pixKeys: any[];
  clients: any[];
  entries: any[];
  payments: any[];
  messageTemplates?: any[];
  notificationRules?: any[];
}

export interface IrineuBackupPayloadV2 {
  header: IrineuBackupHeader;
  businessProfile: any;
  pixKeys: any[];
  clients: any[];
  clientPhones: any[];
  clientAddresses: any[];
  entries: any[];
  payments: any[];
  messageTemplates: any[];
  notificationRules: any[];
  settings?: any[];
}
