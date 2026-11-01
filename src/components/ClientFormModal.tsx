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
import { parseCurrencyInput, formatCurrencyInput, formatCurrency } from '../utils/currency';
import { createClient, updateClient, countActiveDebtorClients } from '../database/clientRepository';
import { getClientDebits } from '../database/entryRepository';
import { getClientPayments } from '../database/paymentRepository';
import { useLicense } from '../theme/LicenseContext';

interface ClientFormModalProps {
  visible: boolean;
  client?: Client | null;
  onClose: () => void;
  onSuccess: (client: Client) => void;
  onViewHistory?: (client: Client) => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  visible,
  client,
  onClose,
  onSuccess,
  onViewHistory,
}) => {
  const { theme } = useTheme();
  const keyboardHeight = useKeyboardBottomInset();
  const { isPremium, openPaywall } = useLicense();

  const [name, setName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [limitRaw, setLimitRaw] = useState<string>('');
  const [limitPolicy, setLimitPolicy] = useState<LimitPolicy>('PADRAO_GLOBAL');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [billingDay, setBillingDay] = useState<string>('10');
  const [notes, setNotes] = useState<string>('');
  const [phones, setPhones] = useState<PhoneContact[]>([]);
  const [addresses, setAddresses] = useState<AddressContact[]>([]);
  const [showMore, setShowMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [historySummary, setHistorySummary] = useState<{
    debitsCount: number;
    paymentsCount: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      if (client) {
        setName(client.name);
        setNickname(client.nickname);
        setWhatsapp(client.whatsapp_primary);
        setLimitRaw(client.credit_limit ? formatCurrencyInput(client.credit_limit.toFixed(2)) : '');
        setLimitPolicy(client.limit_policy || 'PADRAO_GLOBAL');
        setBillingCycle(client.billing_cycle);
        setBillingDay(String(client.billing_day));
        setNotes(client.notes || '');
        setPhones(client.phones ? JSON.parse(JSON.stringify(client.phones)) : []);
        setAddresses(client.addresses ? JSON.parse(JSON.stringify(client.addresses)) : []);
        setShowMore(true);

        getClientDebits(client.id, 'all')
          .then((debits) => {
            return getClientPayments(client.id).then((payments) => {
              setHistorySummary({ debitsCount: debits.length, paymentsCount: payments.length });
            });
          })
          .catch(() => setHistorySummary(null));
      } else {
        setName('');
        setNickname('');
        setWhatsapp('');
        setLimitRaw('');
        setLimitPolicy('PADRAO_GLOBAL');
        setBillingCycle('MONTHLY');
        setBillingDay('10');
        setNotes('');
        setPhones([]);
        setAddresses([]);
        setShowMore(false);
        setHistorySummary(null);
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

    const validPhones = phones
      .map((p) => ({
        id: p.id || `ph-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        label: p.label || 'Celular',
        number: p.number.trim(),
      }))
      .filter((p) => p.number.length > 0);

    const validAddresses = addresses
      .map((a) => ({
        id: a.id || `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        label: a.label || 'Principal',
        street: a.street.trim(),
        number: a.number.trim(),
        neighborhood: a.neighborhood.trim(),
        reference: a.reference.trim(),
      }))
      .filter((a) => a.street.length > 0);

    setLoading(true);
    try {
      if (client) {
        const updated = await updateClient(client.id, {
          name,
          nickname: nickname.trim() || name.trim(),
          whatsapp_primary: whatsapp,
          phones: validPhones,
          addresses: validAddresses,
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
          phones: validPhones,
          addresses: validAddresses,
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
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {client ? 'Editar Cliente' : 'Novo Cliente'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {client ? 'Dados cadastrais e histórico de compras' : 'Cadastre quem compra fiado no seu negócio'}
              </Text>
            </View>
            <View style={styles.headerRightRow}>
              {client && onViewHistory && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onViewHistory(client);
                  }}
                  style={[styles.headerHistoryBtn, { backgroundColor: theme.primaryBg }]}
                  activeOpacity={0.7}
                  accessibilityLabel="Ver histórico do cliente"
                >
                  <Ionicons name="time-outline" size={16} color={theme.primary} />
                  <Text style={[styles.headerHistoryBtnText, { color: theme.primary }]}>
                    Histórico
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Banner/Card de Histórico (Disponível quando cliente já existe) */}
            {client && onViewHistory && (
              <TouchableOpacity
                style={[
                  styles.historyCard,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => {
                  onClose();
                  onViewHistory(client);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.historyCardLeft}>
                  <View
                    style={[
                      styles.historyIconBox,
                      {
                        backgroundColor:
                          client.current_balance > 0.001
                            ? theme.expenseBg
                            : client.current_balance < -0.001
                            ? '#EDE9FE'
                            : theme.incomeBg,
                      },
                    ]}
                  >
                    <Ionicons
                      name="time"
                      size={20}
                      color={
                        client.current_balance > 0.001
                          ? theme.expense
                          : client.current_balance < -0.001
                          ? '#7C3AED'
                          : theme.income
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyCardTitle, { color: theme.textPrimary }]}>
                      Histórico e Lançamentos
                    </Text>
                    <Text
                      style={[
                        styles.historyCardBalance,
                        {
                          color:
                            client.current_balance > 0.001
                              ? theme.expense
                              : client.current_balance < -0.001
                              ? '#7C3AED'
                              : theme.income,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {client.current_balance > 0.001
                        ? `Deve: ${formatCurrency(client.current_balance)}`
                        : client.current_balance < -0.001
                        ? `Crédito: ${formatCurrency(Math.abs(client.current_balance))}`
                        : 'Conta em dia (R$ 0,00)'}
                      {historySummary
                        ? ` • ${historySummary.debitsCount} ${
                            historySummary.debitsCount === 1 ? 'lançamento' : 'lançamentos'
                          } • ${historySummary.paymentsCount} ${
                            historySummary.paymentsCount === 1 ? 'pagamento' : 'pagamentos'
                          }`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyCardRight}>
                  <Text style={[styles.historyCardActionText, { color: theme.primary }]}>Ver</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </View>
              </TouchableOpacity>
            )}
            {/* Nome */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nome *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardSecondary,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: João da Silva"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
                autoFocus={!client}
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
                {showMore ? 'Menos opções' : 'Mostrar mais (Apelido, limite de fiado, dia de cobrança...)'}
              </Text>
            </TouchableOpacity>

            {showMore && (
              <View style={styles.advancedBox}>
                {/* Apelido / Como é conhecido */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Apelido / Como é conhecido no balcão
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
                    placeholder="Ex: Seu Zé da Padaria, Tonho, Maria do Bolo (opcional)"
                    placeholderTextColor={theme.textMuted}
                    value={nickname}
                    onChangeText={setNickname}
                  />
                </View>
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
                    onChangeText={(val) => setLimitRaw(formatCurrencyInput(val))}
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
                            limitPolicy === 'PADRAO_GLOBAL'
                              ? theme.primary
                              : theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setLimitPolicy('PADRAO_GLOBAL')}
                    >
                      <Text
                        style={[
                          styles.policyText,
                          {
                            color:
                              limitPolicy === 'PADRAO_GLOBAL'
                                ? theme.primaryText
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        Padrão do App
                      </Text>
                    </TouchableOpacity>

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
                        Avisar
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
                        Bloquear
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
                    Anotações Gerais
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
                    placeholder="Ex: Parente do seu Zé, entregar após as 18h..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={3}
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>

                {/* Telefones Adicionais */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="call-outline" size={16} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                      Outros Telefones ({phones.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addInlineBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                    onPress={() => {
                      setPhones([
                        ...phones,
                        {
                          id: `ph-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          label: 'Celular',
                          number: '',
                        },
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={theme.primary} />
                    <Text style={[styles.addInlineBtnText, { color: theme.primary }]}>Adicionar</Text>
                  </TouchableOpacity>
                </View>

                {phones.map((phone, idx) => (
                  <View
                    key={phone.id || idx}
                    style={[styles.itemCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.labelChipsRow}>
                        {(['Celular', 'WhatsApp', 'Fixo', 'Recado'] as const).map((l) => (
                          <TouchableOpacity
                            key={l}
                            style={[
                              styles.miniChip,
                              {
                                backgroundColor: phone.label === l ? theme.primary : 'transparent',
                                borderColor: phone.label === l ? theme.primary : theme.border,
                              },
                            ]}
                            onPress={() => {
                              const next = [...phones];
                              next[idx].label = l;
                              setPhones(next);
                            }}
                          >
                            <Text
                              style={[
                                styles.miniChipText,
                                { color: phone.label === l ? theme.primaryText : theme.textSecondary },
                              ]}
                            >
                              {l}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={() => setPhones(phones.filter((_, i) => i !== idx))}
                        style={styles.deleteMiniBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.expense} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                          marginTop: 8,
                        },
                      ]}
                      placeholder="(DDD) 00000-0000"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="phone-pad"
                      value={phone.number}
                      onChangeText={(val) => {
                        const next = [...phones];
                        next[idx].number = val;
                        setPhones(next);
                      }}
                    />
                  </View>
                ))}

                {/* Endereços */}
                <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="location-outline" size={16} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                      Endereços ({addresses.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addInlineBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                    onPress={() => {
                      setAddresses([
                        ...addresses,
                        {
                          id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                          label: 'Principal',
                          street: '',
                          number: '',
                          neighborhood: '',
                          reference: '',
                        },
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={theme.primary} />
                    <Text style={[styles.addInlineBtnText, { color: theme.primary }]}>Adicionar</Text>
                  </TouchableOpacity>
                </View>

                {addresses.map((addr, idx) => (
                  <View
                    key={addr.id || idx}
                    style={[styles.itemCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.labelChipsRow}>
                        {(['Principal', 'Casa', 'Entrega', 'Trabalho'] as const).map((l) => (
                          <TouchableOpacity
                            key={l}
                            style={[
                              styles.miniChip,
                              {
                                backgroundColor: addr.label === l ? theme.primary : 'transparent',
                                borderColor: addr.label === l ? theme.primary : theme.border,
                              },
                            ]}
                            onPress={() => {
                              const next = [...addresses];
                              next[idx].label = l;
                              setAddresses(next);
                            }}
                          >
                            <Text
                              style={[
                                styles.miniChipText,
                                { color: addr.label === l ? theme.primaryText : theme.textSecondary },
                              ]}
                            >
                              {l}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={() => setAddresses(addresses.filter((_, i) => i !== idx))}
                        style={styles.deleteMiniBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.expense} />
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                          marginTop: 8,
                        },
                      ]}
                      placeholder="Rua / Avenida / Travessa"
                      placeholderTextColor={theme.textMuted}
                      value={addr.street}
                      onChangeText={(val) => {
                        const next = [...addresses];
                        next[idx].street = val;
                        setAddresses(next);
                      }}
                    />

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, width: '100%' }}>
                      <View style={{ width: 85, flexShrink: 0 }}>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              width: '100%',
                              backgroundColor: theme.card,
                              borderColor: theme.border,
                              color: theme.textPrimary,
                            },
                          ]}
                          placeholder="Nº"
                          placeholderTextColor={theme.textMuted}
                          value={addr.number}
                          onChangeText={(val) => {
                            const next = [...addresses];
                            next[idx].number = val;
                            setAddresses(next);
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              width: '100%',
                              minWidth: 0,
                              backgroundColor: theme.card,
                              borderColor: theme.border,
                              color: theme.textPrimary,
                            },
                          ]}
                          placeholder="Bairro"
                          placeholderTextColor={theme.textMuted}
                          value={addr.neighborhood}
                          onChangeText={(val) => {
                            const next = [...addresses];
                            next[idx].neighborhood = val;
                            setAddresses(next);
                          }}
                        />
                      </View>
                    </View>

                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                          marginTop: 8,
                        },
                      ]}
                      placeholder="Ponto de referência / Instrução de entrega"
                      placeholderTextColor={theme.textMuted}
                      value={addr.reference}
                      onChangeText={(val) => {
                        const next = [...addresses];
                        next[idx].reference = val;
                        setAddresses(next);
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
            <View style={styles.footerRow}>
              {client && onViewHistory && (
                <TouchableOpacity
                  style={[
                    styles.historyFooterBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.cardSecondary,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    onViewHistory(client);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Ver histórico do cliente"
                >
                  <Ionicons name="time-outline" size={18} color={theme.textPrimary} />
                  <Text style={[styles.historyFooterBtnText, { color: theme.textPrimary }]}>
                    Ver Histórico
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: theme.primary,
                    flex: client && onViewHistory ? 1 : undefined,
                  },
                ]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={20} color={theme.primaryText} />
                <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                  {loading ? 'Salvando...' : client ? 'Salvar Alterações' : 'Salvar Cliente'}
                </Text>
              </TouchableOpacity>
            </View>
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerHistoryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    padding: 20,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  historyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyCardBalance: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  historyCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  historyCardActionText: {
    fontSize: 13,
    fontWeight: '700',
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
    minWidth: 0,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  addInlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  miniChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteMiniBtn: {
    padding: 6,
    marginLeft: 8,
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  historyFooterBtnText: {
    fontSize: 15,
    fontWeight: '700',
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
