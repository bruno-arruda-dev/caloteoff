import { Linking } from 'react-native';
import { getBusinessProfile, getPixKeys } from '../database/businessRepository';
import { getTemplateByKey } from '../database/messageTemplateRepository';
import { Client, DebitEntry, MessageTemplateKey, PaymentRecord } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateBR } from '../utils/date';

export interface MessageContext {
  client: Client;
  payment?: PaymentRecord;
  openDebits?: DebitEntry[];
}

export async function generateMessageText(
  templateKey: MessageTemplateKey,
  context: MessageContext
): Promise<string> {
  const template = await getTemplateByKey(templateKey);
  if (!template) return '';

  const profile = await getBusinessProfile();
  const pixKeys = await getPixKeys();
  const primaryPix = pixKeys.find((k) => k.is_primary) || pixKeys[0];

  const clientName = context.client.nickname || context.client.name;
  const storeName = profile.trade_name || 'Nossa Loja';
  const totalAmount = formatCurrency(Math.max(0, context.client.current_balance));
  const pixKey = primaryPix ? primaryPix.key_value : '(Chave Pix não configurada)';
  const pixType = primaryPix ? primaryPix.label || primaryPix.key_type : 'Pix';

  let paidAmount = 'R$ 0,00';
  let remainingAmount = 'R$ 0,00';
  if (context.payment) {
    paidAmount = formatCurrency(context.payment.amount_paid);
    remainingAmount = formatCurrency(Math.abs(context.payment.resulting_balance));
  }

  let purchasesList = '';
  if (context.openDebits && context.openDebits.length > 0) {
    purchasesList = context.openDebits
      .map(
        (d, idx) =>
          `• ${formatDateBR(d.due_date)}: ${d.description || 'Compra'} - ${formatCurrency(d.amount)}`
      )
      .join('\n');
  }

  let text = template.body;
  text = text.replace(/{cliente}/g, clientName);
  text = text.replace(/{nome_loja}/g, storeName);
  text = text.replace(/{valor_total}/g, totalAmount);
  text = text.replace(/{chave_pix}/g, pixKey);
  text = text.replace(/{tipo_chave}/g, pixType);
  text = text.replace(/{valor_pago}/g, paidAmount);
  text = text.replace(/{saldo_restante}/g, remainingAmount);
  text = text.replace(/{lista_compras}/g, purchasesList);

  return text;
}

export function sanitizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    // Adiciona código do país Brasil (55)
    return `55${digits}`;
  }
  return digits;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedMsg = encodeURIComponent(message);

  const nativeUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
  const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err) {
    console.warn('Erro ao abrir WhatsApp:', err);
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      return false;
    }
  }
}
