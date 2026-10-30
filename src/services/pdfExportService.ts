import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getBusinessProfile, getPixKeys } from '../database/businessRepository';
import { Client, DebitEntry, PaymentRecord } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateBR, formatDateTimeBR } from '../utils/date';

export async function generateClientStatementPdf(
  client: Client,
  entries: DebitEntry[],
  payments: PaymentRecord[],
  periodLabel?: string
): Promise<string> {
  const profile = await getBusinessProfile();
  const pixKeys = await getPixKeys();
  const primaryPix = pixKeys.find((k) => k.is_primary) || pixKeys[0];

  const accentColor = profile.primary_color || '#4F46E5';
  const storeName = profile.trade_name || 'Comprovante Comercial';
  const storePhone = profile.phone ? `WhatsApp: ${profile.phone}` : '';
  const clientName = client.name || client.nickname;
  const clientNickname = client.nickname && client.nickname !== client.name ? `(${client.nickname})` : '';

  const pendingDebits = entries.filter((e) => e.status === 'pending');
  const paidDebits = entries.filter((e) => e.status === 'paid');

  const rowsEntriesHtml = entries
    .map(
      (e) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 10px 8px; font-size: 13px; color: #334155;">${formatDateBR(e.due_date)}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #0F172A; font-weight: 500;">
          ${e.description || 'Lançamento de compra'}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 11px; ${
            e.status === 'paid'
              ? 'background-color: #DCFCE7; color: #16A34A;'
              : 'background-color: #FEE2E2; color: #DC2626;'
          }">
            ${e.status === 'paid' ? 'Pago' : 'Pendente'}
          </span>
        </td>
        <td style="padding: 10px 8px; font-size: 13px; text-align: right; font-weight: 700; color: #0F172A;">
          ${formatCurrency(e.amount)}
        </td>
      </tr>
    `
    )
    .join('');

  const rowsPaymentsHtml = payments
    .map(
      (p) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px; font-size: 13px; color: #334155;">${formatDateTimeBR(p.created_at)}</td>
        <td style="padding: 8px; font-size: 13px; color: #0F172A;">
          ${p.payment_type === 'FULL' ? 'Quitação Total' : p.payment_type === 'PARTIAL' ? 'Abatimento Parcial' : 'Pagamento com Excedente'}
        </td>
        <td style="padding: 8px; font-size: 13px; text-align: right; font-weight: 700; color: #16A34A;">
          ${formatCurrency(p.amount_paid)}
        </td>
      </tr>
    `
    )
    .join('');

  const pixSectionHtml = primaryPix
    ? `
      <div style="margin-top: 24px; padding: 16px; border: 2px dashed ${accentColor}; border-radius: 12px; background-color: #F8FAFC; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: ${accentColor}; text-transform: uppercase;">
          Pagamento via Pix
        </p>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748B;">
          Chave (${primaryPix.label || primaryPix.key_type}):
        </p>
        <p style="margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; letter-spacing: 0.5px;">
          ${primaryPix.key_value}
        </p>
      </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Extrato de Conta - ${storeName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #0F172A; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: ${accentColor}; margin: 0; }
          .subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0 0; }
          .badge-box { background-color: #F1F5F9; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { text-align: left; padding: 8px; font-size: 12px; text-transform: uppercase; color: #64748B; border-bottom: 2px solid #CBD5E1; }
          .balance-card { margin-top: 24px; background: #0F172A; color: #FFFFFF; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${storeName}</h1>
            <p class="subtitle">${storePhone}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748B;">EXTRATO DE CONTA</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: ${accentColor}; font-weight: 600;">Período: ${periodLabel || 'Todo o Histórico'}</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #94A3B8;">Emitido em: ${formatDateBR(new Date().toISOString().slice(0, 10))}</p>
          </div>
        </div>

        <div class="badge-box">
          <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B;">CLIENTE</p>
          <p style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A;">${clientName} <span style="font-size: 14px; font-weight: 500; color: #64748B;">${clientNickname}</span></p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">WhatsApp: ${client.whatsapp_primary}</p>
        </div>

        <h3 style="font-size: 15px; font-weight: 700; color: #1E293B; margin: 24px 0 8px 0;">Histórico de Compras e Fiados</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">Data</th>
              <th>Descrição</th>
              <th style="width: 90px; text-align: center;">Status</th>
              <th style="width: 110px; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rowsEntriesHtml || '<tr><td colspan="4" style="text-align:center; padding:16px; color:#94A3B8;">Nenhum lançamento registrado</td></tr>'}
          </tbody>
        </table>

        ${
          payments.length > 0
            ? `
          <h3 style="font-size: 15px; font-weight: 700; color: #1E293B; margin: 24px 0 8px 0;">Pagamentos e Abatimentos</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 140px;">Data e Hora</th>
                <th>Tipo</th>
                <th style="width: 110px; text-align: right;">Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              ${rowsPaymentsHtml}
            </tbody>
          </table>
        `
            : ''
        }

        <div class="balance-card">
          <div>
            <p style="margin: 0; font-size: 13px; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Saldo Atual do Cliente</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #CBD5E1;">
              ${client.current_balance > 0 ? 'Total pendente para acerto' : client.current_balance < 0 ? 'Crédito a favor do cliente' : 'Conta totalmente quitada'}
            </p>
          </div>
          <div>
            <span style="font-size: 26px; font-weight: 900; color: ${client.current_balance > 0 ? '#F87171' : client.current_balance < 0 ? '#60A5FA' : '#4ADE80'};">
              ${formatCurrency(client.current_balance)}
            </span>
          </div>
        </div>

        ${pixSectionHtml}

        <div style="margin-top: 36px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
          Documento para simples conferência emitido diretamente por ${storeName}.
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function shareClientStatementPdf(
  client: Client,
  entries: DebitEntry[],
  payments: PaymentRecord[],
  periodLabel?: string
): Promise<void> {
  const uri = await generateClientStatementPdf(client, entries, payments, periodLabel);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Extrato - ${client.nickname || client.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
