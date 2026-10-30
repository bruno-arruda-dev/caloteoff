export type LimitPolicy = 'AVISAR_E_PERMITIR' | 'BLOQUEAR_TOTAL';
export type BillingCycle = 'WEEKLY' | 'MONTHLY';

export type PixKeyType = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'RANDOM';

export interface PixKey {
  id: string;
  label: string;
  key_type: PixKeyType;
  key_value: string;
  is_primary: boolean;
  created_at: string;
}

export interface BusinessProfile {
  id: string;
  trade_name: string;
  phone: string;
  logo_uri: string | null;
  primary_color: string;
  created_at: string;
  updated_at: string;
}

export interface PhoneContact {
  id: string;
  label: string;
  number: string;
}

export interface AddressContact {
  id: string;
  street: string;
  number: string;
  neighborhood: string;
  reference: string;
}

export interface Client {
  id: string;
  name: string;
  nickname: string;
  whatsapp_primary: string;
  phones: PhoneContact[];
  addresses: AddressContact[];
  credit_limit: number | null;
  limit_policy: LimitPolicy;
  billing_cycle: BillingCycle;
  billing_day: number; // 0..6 para semanal (0=domingo) ou 1..31 para mensal
  notes: string;
  current_balance: number; // >0 deve, ==0 zerado, <0 crédito
  credit_balance: number; // saldo a favor
  next_billing_date: string; // YYYY-MM-DD
  deleted_at: string | null; // Soft delete: cliente inativo não pode comprar, mas pode receber cobranças/recibos
  created_at: string;
  updated_at: string;
}

export interface DebitEntry {
  id: string;
  client_id: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  description: string;
  receipt_image_uri: string | null;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentType = 'FULL' | 'PARTIAL' | 'EXCESS';

export interface PaymentRecord {
  id: string;
  client_id: string;
  amount_paid: number;
  previous_balance: number;
  resulting_balance: number;
  payment_type: PaymentType;
  notes: string;
  created_at: string;
}

export type MessageTemplateKey =
  | 'friendly_reminder'
  | 'overdue_collection'
  | 'full_receipt'
  | 'partial_receipt'
  | 'credit_receipt'
  | 'open_statement';

export interface MessageTemplate {
  id: string;
  template_key: MessageTemplateKey;
  title: string;
  body: string;
  is_default: boolean;
  updated_at: string;
}

export type NotificationRuleType = 'before_due' | 'on_due_date' | 'after_due';

export interface NotificationRule {
  id: string;
  type: NotificationRuleType;
  days_offset: number;
  time: string; // HH:mm
  enabled: boolean;
  created_at: string;
}

export type SortOption =
  | 'collection_queue'
  | 'highest_debt'
  | 'lowest_debt'
  | 'oldest_purchase'
  | 'alphabetical';

export type BalanceStatus = 'debtor' | 'zero' | 'creditor';
