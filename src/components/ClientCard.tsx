import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client, DebitEntry } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { formatCurrency } from '../utils/currency';
import { formatDateBR, getDaysDiffFromToday } from '../utils/date';
import { getLimitUsageProgress } from '../utils/balanceCalculator';
import { LimitProgressCircle } from './LimitProgressCircle';

interface ClientCardProps {
  client: Client;
  openDebits: DebitEntry[];
  onCobrarZap: (client: Client) => void;
  onPassarRegua: (client: Client) => void;
  onOpenDetails: (client: Client) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  openDebits,
  onCobrarZap,
  onPassarRegua,
  onOpenDetails,
}) => {
  const { theme } = useTheme();
  const { maskName, maskCurrency } = usePrivacy();
  const [expanded, setExpanded] = useState<boolean>(false);

  const displayName = maskName(client.nickname || client.name);
  const fullName = client.name !== client.nickname ? maskName(client.name) : null;

  const isDebtor = client.current_balance > 0.001;
  const isCreditor = client.current_balance < -0.001;
  const isZero = !isDebtor && !isCreditor;

  const balanceColor = isDebtor
    ? theme.expense
    : isCreditor
    ? theme.accent
    : theme.income;

  const daysDiff = getDaysDiffFromToday(client.next_billing_date);
  const isOverdue = isDebtor && daysDiff > 0;
  const isDueToday = isDebtor && daysDiff === 0;

  const limitProgress = getLimitUsageProgress(client.current_balance, client.credit_limit);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onOpenDetails(client)}
        style={styles.cardHeader}
      >
        <View style={styles.headerLeft}>
          <View style={styles.nameRow}>
            <Text style={[styles.nickname, { color: theme.textPrimary }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isOverdue && (
              <View style={[styles.tagBadge, { backgroundColor: theme.expenseBg }]}>
                <Ionicons name="alert-circle" size={12} color={theme.expense} />
                <Text style={[styles.tagBadgeText, { color: theme.expense }]}>
                  {daysDiff === 1 ? '1 dia de atraso' : `${daysDiff} dias de atraso`}
                </Text>
              </View>
            )}
            {isDueToday && (
              <View style={[styles.tagBadge, { backgroundColor: theme.warningBg }]}>
                <Ionicons name="time" size={12} color={theme.warning} />
                <Text style={[styles.tagBadgeText, { color: theme.warning }]}>Cobra Hoje</Text>
              </View>
            )}
          </View>

          {fullName && (
            <Text style={[styles.fullName, { color: theme.textSecondary }]} numberOfLines={1}>
              {fullName}
            </Text>
          )}

          <Text style={[styles.billingDateText, { color: theme.textMuted }]}>
            {isDebtor
              ? `Cobrança: ${formatDateBR(client.next_billing_date)}`
              : isCreditor
              ? 'Saldo a favor do cliente'
              : 'Conta zerada (em dia)'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.headerRightRow}>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={[styles.balanceValue, { color: balanceColor }]}>
                {isCreditor
                  ? `+${maskCurrency(formatCurrency(Math.abs(client.current_balance)))}`
                  : maskCurrency(formatCurrency(client.current_balance))}
              </Text>
              {isCreditor ? (
                <Text style={[styles.creditLimitSub, { color: theme.income, fontWeight: '700' }]}>
                  Crédito a favor
                </Text>
              ) : client.credit_limit && client.credit_limit > 0 ? (
                <Text style={[styles.creditLimitSub, { color: theme.textMuted }]}>
                  Lim: {maskCurrency(formatCurrency(client.credit_limit))}
                </Text>
              ) : null}
            </View>

            {client.credit_limit && client.credit_limit > 0 && (
              <LimitProgressCircle
                currentBalance={client.current_balance}
                creditLimit={client.credit_limit}
                size={44}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Barra de Penduras / Accordion */}
      {openDebits.length > 0 && (
        <TouchableOpacity
          style={[
            styles.accordionBar,
            { borderTopColor: theme.borderLight, backgroundColor: theme.cardSecondary },
          ]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionBarLeft}>
            <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.accordionBarText, { color: theme.textSecondary }]}>
              {openDebits.length} {openDebits.length === 1 ? 'pendura em aberto' : 'penduras em aberto'}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textMuted}
          />
        </TouchableOpacity>
      )}

      {/* Accordion de Lançamentos em Aberto */}
      {expanded && (
        <View style={[styles.accordionBody, { borderTopColor: theme.borderLight }]}>
          {openDebits.length === 0 ? (
            <Text style={[styles.emptyDebitsText, { color: theme.textMuted }]}>
              Nenhum fiado em aberto no momento.
            </Text>
          ) : (
            openDebits.map((item) => (
              <View
                key={item.id}
                style={[styles.debitItemRow, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.debitItemLeft}>
                  <Text style={[styles.debitDate, { color: theme.textMuted }]}>
                    {formatDateBR(item.due_date)}
                  </Text>
                  <Text
                    style={[styles.debitDesc, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.description || 'Fiado registrado'}
                  </Text>
                </View>
                <View style={styles.debitItemRight}>
                  {item.receipt_image_uri && (
                    <Ionicons
                      name="image"
                      size={14}
                      color={theme.primary}
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={[styles.debitAmount, { color: theme.expense }]}>
                    {maskCurrency(formatCurrency(item.amount))}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Ações Rápidas do Card (Dois Botões 50% / 50% com visual limpo e sem cortes) */}
      <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
        {isDebtor ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
              onPress={() => onCobrarZap(client)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Cobrar no Zap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
              onPress={() => onPassarRegua(client)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color={theme.primaryText} />
              <Text style={[styles.actionBtnText, { color: theme.primaryText }]}>
                Passar a Régua
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtnFull, { backgroundColor: theme.cardSecondary }]}
            onPress={() => onOpenDetails(client)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={16} color={theme.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>
              Ver Ficha e Histórico
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  nickname: {
    fontSize: 17,
    fontWeight: '700',
  },
  fullName: {
    fontSize: 13,
    marginBottom: 2,
  },
  billingDateText: {
    fontSize: 12,
    marginTop: 2,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creditLimitSub: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 19,
    fontWeight: '800',
  },
  limitGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  gaugeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  limitPercentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accordionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  accordionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionBarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accordionBody: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyDebitsText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  debitItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  debitItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  debitDate: {
    fontSize: 11,
    marginBottom: 2,
  },
  debitDesc: {
    fontSize: 13,
    fontWeight: '500',
  },
  debitItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debitAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    borderTopWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnFull: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
