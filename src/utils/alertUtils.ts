export type AlertType = 'info' | 'warning' | 'error' | 'success' | 'confirm';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AppAlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AppAlertButton[];
}

export function classifyAlertType(
  title: string = '',
  message: string = '',
  buttons?: AppAlertButton[]
): AlertType {
  const lowerTitle = title.toLowerCase();
  const lowerMsg = message.toLowerCase();

  // Se tem botão destrutivo
  if (buttons && buttons.some((b) => b.style === 'destructive')) {
    return 'warning';
  }

  // Erros
  if (
    lowerTitle.includes('erro') ||
    lowerTitle.includes('falha') ||
    lowerTitle.includes('bloqueado') ||
    lowerTitle.includes('negada') ||
    lowerTitle.includes('não foi possível') ||
    lowerTitle.includes('⛔')
  ) {
    return 'error';
  }

  // Sucesso
  if (
    lowerTitle.includes('sucesso') ||
    lowerTitle.includes('parabéns') ||
    lowerTitle.includes('atualizada') ||
    lowerTitle.includes('restaurado') ||
    lowerTitle.includes('salvo') ||
    lowerTitle.includes('reativado') ||
    lowerTitle.includes('🎉') ||
    lowerTitle.includes('✓')
  ) {
    return 'success';
  }

  // Avisos / Confirmações
  if (
    lowerTitle.includes('atenção') ||
    lowerTitle.includes('aviso') ||
    lowerTitle.includes('cuidado') ||
    lowerTitle.includes('excluir') ||
    lowerTitle.includes('remover') ||
    lowerTitle.includes('desativar') ||
    lowerTitle.includes('⚠️')
  ) {
    return 'warning';
  }

  if (buttons && buttons.length > 1) {
    return 'confirm';
  }

  return 'info';
}
