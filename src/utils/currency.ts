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
 * Converte qualquer texto de entrada do usuário em número float (reais).
 * Suporta "150,50", "150.50", "R$ 150,50", etc.
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
