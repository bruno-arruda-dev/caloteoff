import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AddressContact, BillingCycle, Client, LimitPolicy, PhoneContact } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import { parseCurrencyInput } from '../utils/currency';
import { createClient, updateClient, countActiveDebtorClients } from '../database/clientRepository';
import { useLicense } from '../theme/LicenseContext';

interface ClientFormModalProps {
  visible: boolean;
  client?: Client | null;
  onClose: () => void;
  onSuccess: (client: Client) => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  visible,
  client,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();
  const { isPremium, openPaywall } = useLicense();

  const [name, setName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [limitRaw, setLimitRaw] = useState<string>('');
  const [limitPolicy, setLimitPolicy] = useState<LimitPolicy>('AVISAR_E_PERMITIR');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [billingDay, setBillingDay] = useState<string>('10');
  const [notes, setNotes] = useState<string>('');
  const [showMore, setShowMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      if (client) {
        setName(client.name);
        setNickname(client.nickname);
        setWhatsapp(client.whatsapp_primary);
        setLimitRaw(client.credit_limit ? client.credit_limit.toFixed(2).replace('.', ',') : '');
        setLimitPolicy(client.limit_policy);
        setBillingCycle(client.billing_cycle);
        setBillingDay(String(client.billing_day));
        setNotes(client.notes || '');
        setShowMore(true);
      } else {
        setName('');
        setNickname('');
        setWhatsapp('');
        setLimitRaw('');
        setLimitPolicy('AVISAR_E_PERMITIR');
        setBillingCycle('MONTHLY');
        setBillingDay('10');
        setNotes('');
        setShowMore(false);
      }
    }
  }, [visible, client]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe o nome do cliente.');
      return;
    }
    if (!whatsapp.trim()) {
      Alert.alert('Atenção', 'Informe o número do WhatsApp do cliente para cobrança.');
      return;
    }

    // Checagem Freemium para novo cliente
    if (!client && !isPremium) {
      const activeCount = await countActiveDebtorClients();
      if (activeCount >= 5) {
        openPaywall({
          feature: 'clients_limit',
          title: 'Limite do Plano Gratuito',
          description:
            'Você já possui 5 clientes ativos com pendências. Assine o Pro para cadastrar clientes ilimitados!',
        });
        return;
      }
    }

    const limitVal = parseCurrencyInput(limitRaw);
    const bDayVal = parseInt(billingDay, 10) || (billingCycle === 'WEEKLY' ? 1 : 10);

    setLoading(true);
    try {
      if (client) {
        const updated = await updateClient(client.id, {
          name,
          nickname: nickname.trim() || name.trim(),
          whatsapp_primary: whatsapp,
          credit_limit: limitVal > 0 ? limitVal : null,
          limit_policy: limitPolicy,
          billing_cycle: billingCycle,
          billing_day: bDayVal,
          notes,
        });
        onSuccess(updated);
      } else {
        const created = await createClient({
          name,
          nickname: nickname.trim() || name.trim(),
          whatsapp_primary: whatsapp,
          credit_limit: limitVal > 0 ? limitVal : null,
          limit_policy: limitPolicy,
          billing_cycle: billingCycle,
          billing_day: bDayVal,
          notes,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <View
          style={[
            styles.drawerContent,
            {
              backgroundColor: theme.card,
              marginBottom: keyboardHeight,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {client ? 'Editar Cliente' : 'Novo Cliente'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Cadastre quem compra fiado no seu negócio
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Cadastro Rápido: Apelido / Como é conhecido */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Apelido / Como é conhecido no balcão *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                    fontWeight: '700',
                  },
                ]}
                placeholder="Ex: Seu Zé da Padaria, Tonho, Maria do Bolo..."
                placeholderTextColor={theme.textMuted}
                value={nickname}
                onChangeText={setNickname}
                autoFocus={!client}
              />
            </View>

            {/* Nome Completo */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nome Completo *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Nome e Sobrenome"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* WhatsApp Principal */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>WhatsApp Principal *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="(DDD) 99999-9999"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={whatsapp}
                onChangeText={setWhatsapp}
              />
            </View>

            {/* Expansor "Mostrar Mais" */}
            <TouchableOpacity
              style={[styles.showMoreToggle, { backgroundColor: theme.cardSecondary }]}
              onPress={() => setShowMore(!showMore)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showMore ? 'chevron-up' : 'options-outline'}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.showMoreText, { color: theme.primary }]}>
                {showMore ? 'Menos opções' : 'Mostrar mais (Limite de fiado, dia de cobrança...)'}
              </Text>
            </TouchableOpacity>

            {showMore && (
              <View style={styles.advancedBox}>
                {/* Limite de Fiado */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Limite Máximo de Fiado (R$)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.cardSecondary,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="Sem limite (deixe em branco se livre)"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={limitRaw}
                    onChangeText={setLimitRaw}
                  />
                </View>

                {/* Política de Estouro de Limite */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Se o cliente estourar o limite:
                  </Text>
                  <View style={styles.policyRow}>
                    <TouchableOpacity
                      style={[
                        styles.policyOption,
                        {
                          backgroundColor:
                            limitPolicy === 'AVISAR_E_PERMITIR'
                              ? theme.primary
                              : theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setLimitPolicy('AVISAR_E_PERMITIR')}
                    >
                      <Text
                        style={[
                          styles.policyText,
                          {
                            color:
                              limitPolicy === 'AVISAR_E_PERMITIR'
                                ? theme.primaryText
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        Avisar e Permitir
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.policyOption,
                        {
                          backgroundColor:
                            limitPolicy === 'BLOQUEAR_TOTAL'
                              ? theme.expense
                              : theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setLimitPolicy('BLOQUEAR_TOTAL')}
                    >
                      <Text
                        style={[
                          styles.policyText,
                          {
                            color:
                              limitPolicy === 'BLOQUEAR_TOTAL' ? '#FFFFFF' : theme.textSecondary,
                          },
                        ]}
                      >
                        Bloquear Total
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ciclo e Dia de Cobrança */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Frequência de Fechamento / Cobrança
                  </Text>
                  <View style={styles.policyRow}>
                    <TouchableOpacity
                      style={[
                        styles.policyOption,
                        {
                          backgroundColor:
                            billingCycle === 'MONTHLY' ? theme.primary : theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setBillingCycle('MONTHLY')}
                    >
                      <Text
                        style={[
                          styles.policyText,
                          {
                            color:
                              billingCycle === 'MONTHLY'
                                ? theme.primaryText
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        Todo Mês
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.policyOption,
                        {
                          backgroundColor:
                            billingCycle === 'WEEKLY' ? theme.primary : theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setBillingCycle('WEEKLY')}
                    >
                      <Text
                        style={[
                          styles.policyText,
                          {
                            color:
                              billingCycle === 'WEEKLY'
                                ? theme.primaryText
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        Toda Semana
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    {billingCycle === 'MONTHLY'
                      ? 'Dia do Mês para Cobrar (1 a 31)'
                      : 'Dia da Semana (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)'}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.cardSecondary,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder={billingCycle === 'MONTHLY' ? '10' : '1'}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={billingDay}
                    onChangeText={setBillingDay}
                  />
                </View>

                {/* Anotações Gerais */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Anotações Gerais / Endereço / Referência
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: theme.cardSecondary,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="Ex: Mora perto da praça, entregar após as 18h..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={3}
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={20} color={theme.primaryText} />
              <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                {loading ? 'Salvando...' : 'Salvar Cliente'}
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
  drawerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  showMoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  advancedBox: {
    marginBottom: 10,
  },
  policyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  policyOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  policyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
