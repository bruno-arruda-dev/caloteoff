import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useLicense } from '../theme/LicenseContext';

export const PaywallModal: React.FC = () => {
  const { theme } = useTheme();
  const { isPaywallOpen, triggerInfo, closePaywall, purchasePlan, restorePurchases } = useLicense();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isPaywallOpen) return null;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      await purchasePlan(selectedPlan);
      Alert.alert('Parabéns! 🎉', 'Você agora é um assinante CaloteOff PRO!');
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a ativação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Sucesso', 'Sua assinatura Pro foi restaurada!');
      closePaywall();
    } else {
      Alert.alert('Informação', 'Nenhuma assinatura anterior encontrada.');
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={closePaywall}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.container, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closePaywall} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Ícone de Destaque */}
            <View style={styles.badgeWrapper}>
              <View style={[styles.crownBadge, { backgroundColor: theme.warningBg }]}>
                <Ionicons name="star" size={36} color={theme.warning} />
              </View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {triggerInfo?.title || 'Seja CaloteOff PRO'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {triggerInfo?.description ||
                  'Acabe com o calote e profissionalize a cobrança do seu comércio com recursos exclusivos.'}
              </Text>
            </View>

            {/* Lista de Vantagens */}
            <View style={[styles.benefitsCard, { backgroundColor: theme.cardSecondary }]}>
              <View style={styles.benefitRow}>
                <Ionicons name="people" size={20} color={theme.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: theme.textPrimary }]}>
                    Clientes e Fiados Ilimitados
                  </Text>
                  <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                    Sem limite de 5 clientes ativos do plano grátis.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Ionicons name="document-text" size={20} color={theme.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: theme.textPrimary }]}>
                    Extratos e Recibos em PDF
                  </Text>
                  <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                    Gere documentos White Label com seu logotipo e chave Pix.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Ionicons name="shield-checkmark" size={20} color={theme.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: theme.textPrimary }]}>
                    Modo Privacidade e Proteção
                  </Text>
                  <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                    Mascare nomes no balcão e bloqueie o app por digital.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Ionicons name="color-palette" size={20} color={theme.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: theme.textPrimary }]}>
                    Todos os Temas Premium
                  </Text>
                  <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                    Acesso aos temas AMOLED, Drácula, Emerald, Midnight e mais.
                  </Text>
                </View>
              </View>
            </View>

            {/* Planos de Preço */}
            <View style={styles.plansContainer}>
              {/* Anual (Destaque) */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: selectedPlan === 'annual' ? theme.primary : theme.border,
                    borderWidth: selectedPlan === 'annual' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.8}
              >
                <View style={[styles.bestValueBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.bestValueText}>ECONOMIZE 40%</Text>
                </View>

                <View style={styles.planHeader}>
                  <Ionicons
                    name={selectedPlan === 'annual' ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selectedPlan === 'annual' ? theme.primary : theme.textMuted}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.planTitle, { color: theme.textPrimary }]}>Plano Anual</Text>
                    <Text style={[styles.planSub, { color: theme.textSecondary }]}>
                      Cobrado uma vez por ano
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: theme.textPrimary }]}>R$ 179,00</Text>
                    <Text style={[styles.planPeriod, { color: theme.textMuted }]}>/ ano</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Mensal */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: selectedPlan === 'monthly' ? theme.primary : theme.border,
                    borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.planHeader}>
                  <Ionicons
                    name={selectedPlan === 'monthly' ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selectedPlan === 'monthly' ? theme.primary : theme.textMuted}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.planTitle, { color: theme.textPrimary }]}>Plano Mensal</Text>
                    <Text style={[styles.planSub, { color: theme.textSecondary }]}>
                      Cancele quando quiser
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: theme.textPrimary }]}>R$ 24,90</Text>
                    <Text style={[styles.planPeriod, { color: theme.textMuted }]}>/ mês</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer de Ação */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.subscribeBtn, { backgroundColor: theme.primary }]}
              onPress={handlePurchase}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.subscribeBtnText, { color: theme.primaryText }]}>
                {loading ? 'Processando...' : 'Quero Ser PRO Agora'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
              <Text style={[styles.restoreBtnText, { color: theme.textMuted }]}>
                Restaurar assinatura existente
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  badgeWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  crownBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  benefitsCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  benefitDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 16,
  },
  planCard: {
    padding: 16,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  planSub: {
    fontSize: 12,
    marginTop: 2,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  planPeriod: {
    fontSize: 11,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  subscribeBtn: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscribeBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
