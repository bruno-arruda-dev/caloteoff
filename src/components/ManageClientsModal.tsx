import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { getClients, deleteClient, restoreClient } from '../database/clientRepository';
import { formatCurrency } from '../utils/currency';

interface ManageClientsModalProps {
  visible: boolean;
  onClose: () => void;
  onNewClient: () => void;
  onEditClient: (client: Client) => void;
  onViewHistory: (client: Client) => void;
}

type StatusFilter = 'active' | 'deleted' | 'all';

const PAGE_SIZE = 20;

export const ManageClientsModal: React.FC<ManageClientsModalProps> = ({
  visible,
  onClose,
  onNewClient,
  onEditClient,
  onViewHistory,
}) => {
  const { theme } = useTheme();
  const { maskName, maskCurrency } = usePrivacy();

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(
    async (pageToLoad: number = 1, append: boolean = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const fetched = await getClients('alphabetical', searchQuery, {
          status: statusFilter,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });

        if (append) {
          setClients((prev) => [...prev, ...fetched]);
        } else {
          setClients(fetched);
        }

        setHasMore(fetched.length === PAGE_SIZE);
        setPage(pageToLoad);
      } catch (err) {
        console.warn('Erro ao carregar clientes:', err);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, statusFilter]
  );

  useEffect(() => {
    if (visible) {
      loadData(1, false);
    }
  }, [visible, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(1, false);
    setRefreshing(false);
  };

  const handleEndReached = () => {
    if (!loading && hasMore) {
      loadData(page + 1, true);
    }
  };

  const handleSoftDelete = (client: Client) => {
    Alert.alert(
      'Desativar Cliente',
      `Deseja inativar ${client.nickname || client.name}?\n\n• O cliente não poderá realizar novas compras fiadas.\n• As cobranças no WhatsApp, extratos e acertos de contas continuarão funcionando normalmente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClient(client.id);
              await loadData(1, false);
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao desativar cliente');
            }
          },
        },
      ]
    );
  };

  const handleRestore = async (client: Client) => {
    try {
      await restoreClient(client.id);
      Alert.alert(
        'Cliente Reativado',
        `${client.nickname || client.name} foi reativado e já pode realizar compras fiadas novamente!`
      );
      await loadData(1, false);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao reativar cliente');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity
          style={styles.backdropArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.drawerContent, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Clientes</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Cadastro, busca, edição e histórico
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={[styles.headerNewBtn, { backgroundColor: theme.primaryBg }]}
                onPress={() => {
                  onClose();
                  setTimeout(() => onNewClient(), 350);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={theme.primary} />
                <Text style={[styles.headerNewBtnText, { color: theme.primary }]}>Novo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Campo de Busca por Nome ou Telefone */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Buscar por nome ou telefone..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Abas de Filtro de Status (Ativos / Desativados / Todos) */}
          <View style={styles.statusTabsRow}>
            {(
              [
                { id: 'active', label: 'Ativos' },
                { id: 'deleted', label: 'Desativados' },
                { id: 'all', label: 'Todos' },
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => {
              const isSelected = statusFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.statusTabBtn,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                      borderColor: isSelected ? theme.primary : theme.borderLight,
                    },
                  ]}
                  onPress={() => setStatusFilter(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusTabText,
                      {
                        color: isSelected ? theme.primaryText : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lista de Clientes Paginada */}
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isDeleted = Boolean(item.deleted_at);
              const displayName = maskName(item.nickname || item.name);
              const isDebtor = item.current_balance > 0.001;
              const isCreditor = item.current_balance < -0.001;

              return (
                <View
                  style={[
                    styles.clientCard,
                    {
                      backgroundColor: theme.cardSecondary,
                      borderColor: isDeleted ? theme.border : theme.borderLight,
                      opacity: isDeleted ? 0.75 : 1,
                    },
                  ]}
                >
                  {/* Toque no corpo do cliente para Editar */}
                  <TouchableOpacity
                    style={styles.clientMainTouchable}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onEditClient(item), 350);
                    }}
                    activeOpacity={0.7}
                  >
                  {/* Avatar / Inicial */}
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: isDeleted
                          ? '#E2E8F0'
                          : isDebtor
                          ? theme.expenseBg
                          : theme.primaryBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color: isDeleted
                            ? '#64748B'
                            : isDebtor
                            ? theme.expense
                            : theme.primary,
                        },
                      ]}
                    >
                      {item.nickname ? item.nickname[0].toUpperCase() : item.name[0].toUpperCase()}
                    </Text>
                  </View>

                  {/* Informações Centrais (Toque para Editar) */}
                  <View style={styles.clientInfo}>
                    <View style={styles.nameBadgeRow}>
                      <Text
                        style={[
                          styles.clientName,
                          {
                            color: theme.textPrimary,
                            textDecorationLine: isDeleted ? 'line-through' : 'none',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>

                      {isDeleted && (
                        <View style={[styles.badgePill, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.badgePillText, { color: '#64748B' }]}>Desativado</Text>
                        </View>
                      )}
                    </View>

                    {item.name !== item.nickname && (
                      <Text style={[styles.fullNameText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {maskName(item.name)}
                      </Text>
                    )}

                    <View style={styles.phoneRow}>
                      <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                      <Text style={[styles.phoneText, { color: theme.textMuted }]}>
                        {item.whatsapp_primary}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.balanceStatusText,
                        {
                          color: isDebtor
                            ? theme.expense
                            : isCreditor
                            ? '#7C3AED'
                            : theme.income,
                        },
                      ]}
                    >
                      {isDebtor
                        ? `Deve: ${maskCurrency(formatCurrency(item.current_balance))}`
                        : isCreditor
                        ? `Crédito: ${maskCurrency(formatCurrency(Math.abs(item.current_balance)))}`
                        : 'Conta em dia (R$ 0,00)'}
                    </Text>
                  </View>
                </TouchableOpacity>

                  {/* Ações Rápidas: Histórico & Exclusão Lógica */}
                  <View style={styles.cardActionsCol}>
                    {/* Botão de Histórico / Ficha do Cliente */}
                    <TouchableOpacity
                      style={[styles.circleActionBtn, { backgroundColor: theme.primaryBg }]}
                      onPress={() => {
                        onClose();
                        setTimeout(() => onViewHistory(item), 350);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Ver histórico"
                    >
                      <Ionicons name="time-outline" size={18} color={theme.primary} />
                    </TouchableOpacity>

                    {/* Botão de Excluir / Desativar ou Reativar */}
                    {isDeleted ? (
                      <TouchableOpacity
                        style={[styles.circleActionBtn, { backgroundColor: '#DCFCE7' }]}
                        onPress={() => handleRestore(item)}
                        activeOpacity={0.7}
                        accessibilityLabel="Reativar cliente"
                      >
                        <Ionicons name="refresh" size={18} color="#16A34A" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.circleActionBtn, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => handleSoftDelete(item)}
                        activeOpacity={0.7}
                        accessibilityLabel="Desativar cliente"
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  Nenhum cliente encontrado
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  {searchQuery
                    ? 'Tente buscar com outro nome ou número de telefone.'
                    : 'Toque no botão abaixo para cadastrar seu primeiro cliente.'}
                </Text>
              </View>
            }
            ListFooterComponent={
              loading && hasMore ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null
            }
          />

          {/* Botão Flutuante + Novo Cliente */}
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.primary }]}
            onPress={() => {
              onClose();
              setTimeout(() => onNewClient(), 350);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
            <Text style={styles.fabText}>Novo Cliente</Text>
          </TouchableOpacity>
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
  backdropArea: {
    flex: 1,
  },
  drawerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerNewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
  },
  statusTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  statusTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusTabText: {
    fontSize: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  clientMainTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  clientInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  fullNameText: {
    fontSize: 12,
    marginBottom: 2,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
  },
  balanceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardActionsCol: {
    gap: 8,
    alignItems: 'center',
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  loadingFooter: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
