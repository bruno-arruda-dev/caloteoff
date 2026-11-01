/**
 * Formata um valor numérico em reais (ex: 150.5) para a moeda brasileira (BRL).
 * Exemplo: 150.5 -> "R$ 150,50"
 */
export function formatCurrency(value: number): string {
  const val = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Converte uma sequência de dígitos digitados pelo usuário em valor em centavos.
 * Exemplo: "1250" -> 1250 centavos (R$ 12,50).
 */
export function parseDigitsToCents(text: string): number {
  if (!text) return 0;
  const digitsOnly = text.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte centavos para formato de string editável em reais com separador de milhar.
 * Exemplo: 1250 -> "12,50", 125000 -> "1.250,00"
 */
export function centsToDecimalString(cents: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata em tempo real o valor digitado pelo usuário em campos de formulário de dinheiro
 * (Padrão Minhas Finanças / Fintechs).
 * Conforme o usuário digita números, os centavos vão se deslocando automaticamente da direita para a esquerda:
 * - Digita '1' -> '0,01'
 * - Digita '0' -> '0,10'
 * - Digita '0' -> '1,00'
 * - Digita '5' -> '10,05'
 * - Digita '0' -> '100,50'
 * - Digita '0' -> '1.005,00'
 * - Limpar tudo -> ''
 */
export function formatCurrencyInput(text: string): string {
  if (!text) return '';
  const digitsOnly = text.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const cents = parseInt(digitsOnly, 10);
  if (isNaN(cents) || cents === 0) return '';
  return centsToDecimalString(cents);
}

/**
 * Converte qualquer texto de entrada do usuário em número float (reais).
 * Suporta "150,50", "150.50", "1.250,50", "R$ 150,50", etc.
 */
export function parseCurrencyInput(text: string): number {
  if (!text) return 0;
  // Remove "R$", espaços, etc.
  const clean = text.replace(/[R$\s]/g, '').trim();
  if (!clean) return 0;

  // Se tiver vírgula e ponto (ex: 1.250,50)
  if (clean.includes('.') && clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }

  // Se tiver só vírgula (ex: 150,50)
  if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}
