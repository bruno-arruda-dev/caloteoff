export type PrivacyMaskType = 'masked' | 'hidden';

export function maskClientName(name: string, maskType: PrivacyMaskType = 'masked'): string {
  if (!name || name.trim().length === 0) return 'Cliente';
  if (maskType === 'hidden') return '••••••••••';

  const trimmed = name.trim();
  if (trimmed.length <= 4) {
    return trimmed[0] + '***' + (trimmed.length > 1 ? trimmed[trimmed.length - 1] : '');
  }

  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-3);
  const middleMask = '*'.repeat(Math.max(4, trimmed.length - 6));
  return `${prefix}${middleMask}${suffix}`;
}
