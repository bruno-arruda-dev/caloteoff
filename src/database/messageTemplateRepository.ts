import { MessageTemplate, MessageTemplateKey } from '../types';
import { getDatabase } from './schema';

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM message_templates ORDER BY rowid ASC');
  return rows.map((r) => ({
    id: r.id,
    template_key: r.template_key as MessageTemplateKey,
    title: r.title,
    body: r.body,
    is_default: r.is_default === 1 || r.is_default === true,
    updated_at: r.updated_at,
  }));
}

export async function getTemplateByKey(key: MessageTemplateKey): Promise<MessageTemplate | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<any>('SELECT * FROM message_templates WHERE template_key = ?', [key]);
  if (!r) return null;
  return {
    id: r.id,
    template_key: r.template_key as MessageTemplateKey,
    title: r.title,
    body: r.body,
    is_default: r.is_default === 1 || r.is_default === true,
    updated_at: r.updated_at,
  };
}

export async function updateMessageTemplate(key: MessageTemplateKey, title: string, body: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE message_templates SET title = ?, body = ?, is_default = 0, updated_at = ? WHERE template_key = ?`,
    [title, body, now, key]
  );
}

export async function resetMessageTemplate(key: MessageTemplateKey): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const defaults: Record<MessageTemplateKey, { title: string; body: string }> = {
    friendly_reminder: {
      title: 'Lembrete Preventivo (Cobra Hoje / A Vencer)',
      body: 'Olá, {cliente}! Passando para lembrar do seu fechamento hoje na {nome_loja} no valor de {valor_total}. Para sua comodidade, você pode pagar via Pix: Chave ({tipo_chave}): {chave_pix}. Qualquer dúvida estamos à disposição!',
    },
    overdue_collection: {
      title: 'Cobrança Ativa (Vencido / Atrasado)',
      body: 'Olá, {cliente}! Tudo bem? Consta em aberto na {nome_loja} um saldo pendente de {valor_total}. Segue nossa chave Pix para acerto: {chave_pix}. Se já realizou o pagamento, por favor desconsidere.',
    },
    full_receipt: {
      title: 'Recibo de Quitação Total ("Passou a Régua")',
      body: 'Comprovante de Pagamento — {nome_loja}\nConfirmamos o recebimento de {valor_pago}. Sua conta está 100% liquidada (Saldo: R$ 0,00). Muito obrigado pela parceria e preferência!',
    },
    partial_receipt: {
      title: 'Recibo de Abatimento Parcial',
      body: 'Comprovante de Abatimento — {nome_loja}\nConfirmamos o recebimento de {valor_pago}. Seu saldo restante agora é de {saldo_restante}. Obrigado!',
    },
    credit_receipt: {
      title: 'Recibo com Saldo a Favor (Adiantamento)',
      body: 'Comprovante de Crédito — {nome_loja}\nRecebemos o valor de {valor_pago}. Sua conta foi quitada e você ficou com um saldo credor de {saldo_restante} para suas próximas compras!',
    },
    open_statement: {
      title: 'Extrato Resumido das Compras em Aberto',
      body: 'Extrato de Compras — {nome_loja}\nOlá, {cliente}! Segue o detalhamento dos seus lançamentos pendentes:\n{lista_compras}\nTotal acumulado: {valor_total}. Chave Pix para acerto: {chave_pix}.',
    },
  };

  const def = defaults[key];
  if (def) {
    await db.runAsync(
      `UPDATE message_templates SET title = ?, body = ?, is_default = 1, updated_at = ? WHERE template_key = ?`,
      [def.title, def.body, now, key]
    );
  }
}
