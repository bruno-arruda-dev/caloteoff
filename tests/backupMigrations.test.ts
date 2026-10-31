import { describe, it, expect } from 'vitest';
import { migrateBackupToLatest, CURRENT_BACKUP_SCHEMA_VERSION } from '../src/services/backup/migrationRunner';
import { IrineuBackupPayloadV1 } from '../src/services/backup/backupTypes';

describe('Backup Migrations & Backward Compatibility Invariants', () => {
  it('successfully migrates a legacy v1 backup without header to latest v2 schema', () => {
    const legacyV1: IrineuBackupPayloadV1 = {
      version: '1.0.0',
      exportedAt: '2026-01-01T12:00:00Z',
      businessProfile: {
        id: 'default',
        trade_name: 'Padaria do Zé',
        phone: '62999998888',
        logo_uri: null,
        primary_color: '#4F46E5',
      },
      pixKeys: [
        {
          id: 'pix-1',
          label: 'Chave Celular',
          key_type: 'PHONE',
          key_value: '62999998888',
          is_primary: 1,
          created_at: '2026-01-01T12:00:00Z',
        },
      ],
      clients: [
        {
          id: 'cli-1',
          name: 'Carlos Oliveira',
          nickname: 'Carlinhos',
          whatsapp_primary: '62999991111',
          phones_json: JSON.stringify([
            { id: 'p-1', label: 'Recado', number: '62988882222' },
          ]),
          addresses_json: JSON.stringify([
            { id: 'a-1', label: 'Casa', street: 'Rua 10', number: '123', neighborhood: 'Centro', reference: 'Perto do mercado' },
          ]),
          credit_limit: 500,
          notes: 'Cliente antigo',
          created_at: '2026-01-01T12:00:00Z',
          updated_at: '2026-01-01T12:00:00Z',
        },
      ],
      entries: [
        {
          id: 'ent-1',
          client_id: 'cli-1',
          amount: 150.5,
          due_date: '2026-01-10',
          description: 'Pães e queijo',
          status: 'pending',
          created_at: '2026-01-01T12:00:00Z',
          updated_at: '2026-01-01T12:00:00Z',
        },
      ],
      payments: [],
    };

    const latest = migrateBackupToLatest(legacyV1);

    // Verifica versão do schema
    expect(latest.header.schema_version).toBe(CURRENT_BACKUP_SCHEMA_VERSION);
    expect(latest.header.summary.total_clients).toBe(1);
    expect(latest.header.summary.total_entries).toBe(1);
    expect(latest.header.summary.total_pending_amount).toBe(150.5);

    // Verifica se os telefones legados foram normalizados para clientPhones
    expect(latest.clientPhones.length).toBe(2); // whatsapp_primary + recado
    expect(latest.clientPhones.some((p) => p.number === '62999991111')).toBe(true);
    expect(latest.clientPhones.some((p) => p.number === '62988882222')).toBe(true);

    // Verifica se o endereço foi normalizado para clientAddresses
    expect(latest.clientAddresses.length).toBe(1);
    expect(latest.clientAddresses[0].street).toBe('Rua 10');
    expect(latest.clientAddresses[0].neighborhood).toBe('Centro');

    // Verifica campos de fallback obrigatórios
    expect(latest.clients[0].limit_policy).toBe('PADRAO_GLOBAL');
    expect(latest.clients[0].billing_cycle).toBe('MONTHLY');
    expect(latest.clients[0].billing_day).toBe(10);
  });

  it('rejects corrupt or empty backup payload with informative error', () => {
    expect(() => migrateBackupToLatest(null)).toThrow('Arquivo de backup inválido ou vazio.');
    expect(() => migrateBackupToLatest('not-an-object')).toThrow('Arquivo de backup inválido ou vazio.');
  });
});
