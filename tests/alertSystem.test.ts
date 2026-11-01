import { describe, it, expect } from 'vitest';
import { classifyAlertType, AppAlertButton } from '../src/utils/alertUtils';

describe('Standardized Cross-Platform Alert System', () => {
  it('classifies error alerts correctly based on keywords', () => {
    expect(classifyAlertType('Erro', 'Falha ao salvar cliente')).toBe('error');
    expect(classifyAlertType('Falha de Autenticação', 'Não foi possível confirmar PIN')).toBe('error');
    expect(classifyAlertType('⛔ Limite Bloqueado', 'Cliente excedeu o teto')).toBe('error');
    expect(classifyAlertType('Permissão Negada', 'Habilite notificações')).toBe('error');
  });

  it('classifies warning alerts correctly', () => {
    expect(classifyAlertType('Atenção', 'Informe o nome do cliente')).toBe('warning');
    expect(classifyAlertType('Aviso de Vencimento', 'Conta vencendo')).toBe('warning');
    expect(classifyAlertType('⚠️ Limite Excedido', 'Ultrapassou o limite')).toBe('warning');
    expect(classifyAlertType('Desativar Cliente', 'Deseja inativar o cliente?')).toBe('warning');
  });

  it('classifies success alerts correctly', () => {
    expect(classifyAlertType('Sucesso', 'Perfil atualizado')).toBe('success');
    expect(classifyAlertType('Parabéns! 🎉', 'Assinatura PRO ativada')).toBe('success');
    expect(classifyAlertType('Chave Atualizada', 'Chave Pix principal alterada')).toBe('success');
    expect(classifyAlertType('Restaurado', 'Modelo redefinido para o padrão')).toBe('success');
  });

  it('classifies confirmation alerts with destructive buttons as warning/confirm', () => {
    const buttons: AppAlertButton[] = [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {} },
    ];
    expect(classifyAlertType('Confirmar Ação', 'Tem certeza?', buttons)).toBe('warning');
  });

  it('classifies dual action alerts without destructive style as confirm', () => {
    const buttons: AppAlertButton[] = [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', style: 'default', onPress: () => {} },
    ];
    expect(classifyAlertType('Exportar Dados', 'Deseja continuar?', buttons)).toBe('confirm');
  });

  it('defaults to info for general informational alerts', () => {
    expect(classifyAlertType('Informação', 'Nenhuma assinatura anterior encontrada')).toBe('info');
    expect(classifyAlertType('Ajuda', 'Toque no botão para adicionar')).toBe('info');
  });
});
