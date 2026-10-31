# DOUTRINA DE BACKUP & MIGRATIONS — IRINEU

> **STATUS:** LEI FUNDAMENTAL DO SISTEMA. INVARIANTE INVIOLÁVEL.  
> Qualquer modificação em schema, colunas, tabelas ou restauração de dados DEVE obedecer rigorosamente a este documento.

---

## 1. Princípio Sagrado: "Nenhum fiado pode ser perdido"

O **Irineu** é um sistema financeiro offline-first para o pequeno e médio varejista.  
Um lojista guarda anos de registros de compras e pagamentos.  
- Se um backup for corrompido, a loja perde patrimônio líquido real.
- Uma atualização de versão do aplicativo **JAMAIS** pode recusar, quebrar ou descartar dados de backups antigos.
- Todo backup gerado em versões anteriores (mesmo de anos atrás) **tem a obrigação técnica** de ser restaurado com 100% de integridade na versão mais recente do aplicativo.

---

## 2. Invariantes Técnicas de Backup & Migrations

1. **Versionamento Numérico Inteiro e Monotônico Crescente:**
   - Todo backup carrega `schema_version: number` (1, 2, 3...) no topo do JSON descriptografado.
   - A constante `CURRENT_BACKUP_SCHEMA_VERSION` em `src/services/backup/migrationRunner.ts` define a versão atual suportada.

2. **Pipeline Linear de Migrations (Passo a Passo):**
   - É expressamente proibido fazer "pulos" ad-hoc ou `if/else` espalhados.
   - Ao importar um backup antigo na versão `V_backup`, se o app atual estiver na versão `V_app`:
     $$\text{Pipeline} = V_{\text{backup}} \xrightarrow{\text{migração}} V_{\text{backup}+1} \xrightarrow{\text{migração}} \dots \xrightarrow{\text{migração}} V_{\text{app}}$$
   - Cada migração deve ser uma função pura, idempotente e rigorosamente testada com testes unitários em `tests/backupMigrations.test.ts`.

3. **Valores Padrão e Retrocompatibilidade Sem Null Pointer:**
   - Novas colunas adicionadas ao banco de dados devem receber valores de fallback seguros quando restauradas de backups legados:
     - Exemplo: `client_phones` e `client_addresses` não existiam na v1. Ao migrar da v1 para v2+, os campos legados `phones_json` e `whatsapp_primary` são transformados automaticamente nas novas estruturas relacionais.
     - Políticas de limite ausentes herdam `'PADRAO_GLOBAL'`.
     - Ciclos ausentes herdam `'MONTHLY'` com dia `10`.

4. **Transação Atômica com Rollback Obrigatório:**
   - O processo de restauração roda dentro de `BEGIN TRANSACTION;` e `COMMIT;`.
   - Se qualquer migração, inserção ou chave estrangeira falhar, um `ROLLBACK;` imediato é executado.
   - O estado do banco atual **permanece intacto** caso a restauração falhe.

---

## 3. Modularidade do Backup: Completo vs. Pendentes vs. Consolidado

O sistema suporta três modalidades de exportação e restauração:

1. **`FULL` (Completo):**
   - Exporta: Perfil comercial, Chaves Pix, Todos os Clientes, Todas as Pendências em aberto, Histórico completo de Pagamentos/Liquidações, Regras de Cobrança e Modelos de Mensagens.
   - Finalidade: Troca total de aparelho ou cópia de segurança periódica.

2. **`PENDING_ONLY` (Apenas Pendências Atuais / Operacional Rápido):**
   - Exporta: Clientes que possuem débito em aberto (`current_balance > 0`), todas as compras com `status = 'pending'`, perfil da loja e chaves Pix.
   - Finalidade: Restauração rápida em celulares modestos ou envio operacional para um cobrador de rua.

3. **`CONSOLIDATED_ARCHIVE` (Arquivo Morto / Histórico Liquidado):**
   - Exporta: Lançamentos já pagos (`status = 'paid'`) e recibos de liquidação ("Passar a régua").
   - Finalidade: Desafogar a memória interna do smartphone do lojista após anos de operação, mantendo o histórico legal seguro em nuvem ou computador.

---

## 4. Checklist Obrigatório para Agentes ao Alterar o Banco (`schema.ts`)

Antes de commitar qualquer alteração que adicione ou modifique tabelas/colunas:
- [ ] Criar o script de migração no `src/database/schema.ts` (ex: `ALTER TABLE ... ADD COLUMN ...`).
- [ ] Incrementar `CURRENT_BACKUP_SCHEMA_VERSION` em `src/services/backup/migrationRunner.ts`.
- [ ] Criar a função de migração linear `migrateV(N-1)ToV(N)`.
- [ ] Atualizar o gerador de backup para incluir os novos campos.
- [ ] Adicionar teste unitário de migração completa v1 -> vN em `tests/backupMigrations.test.ts`.
- [ ] Validar `npx tsc --noEmit` e `npx vitest run`.
