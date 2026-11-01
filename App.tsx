import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { PrivacyProvider, usePrivacy } from './src/theme/PrivacyContext';
import { LicenseProvider, useLicense } from './src/theme/LicenseContext';
import { Client, DebitEntry, PaymentRecord, SortOption } from './src/types';
import { getClients } from './src/database/clientRepository';
import { getClientDebits } from './src/database/entryRepository';
import { getBusinessProfile } from './src/database/businessRepository';
import { formatCurrency } from './src/utils/currency';
import { ClientCard } from './src/components/ClientCard';
import { SidebarDrawer } from './src/components/SidebarDrawer';
import { SortBottomSheet } from './src/components/SortBottomSheet';
import { ManagePixKeysModal } from './src/components/ManagePixKeysModal';
import { ManageClientsModal } from './src/components/ManageClientsModal';
import { NewDebitModal } from './src/components/NewDebitModal';
import { SettleAccountModal } from './src/components/SettleAccountModal';
import { ReceiptSuccessModal } from './src/components/ReceiptSuccessModal';
import { ClientDetailModal } from './src/components/ClientDetailModal';
import { ClientFormModal } from './src/components/ClientFormModal';
import { BusinessProfileModal } from './src/components/BusinessProfileModal';
import { MessageTemplatesModal } from './src/components/MessageTemplatesModal';
import { ThemeSelectorModal } from './src/components/ThemeSelectorModal';
import { SettingsModal } from './src/components/SettingsModal';
import { NotificationSettingsModal } from './src/components/NotificationSettingsModal';
import { DashboardModal } from './src/components/DashboardModal';
import { PaywallModal } from './src/components/PaywallModal';
import { generateMessageText, sendWhatsAppMessage } from './src/services/whatsappService';
import { authenticateWithBiometrics, isBiometricsAvailable } from './src/services/authService';
import { getSetting } from './src/database/settingsRepository';
import { setupNotificationChannel, scheduleReminders } from './src/services/notificationService';

const SORT_LABELS: Record<SortOption, string> = {
  collection_queue: '🔥 Fila de Cobrança',
  highest_debt: '💰 Maior Dívida',
  lowest_debt: '📉 Menor Dívida',
  oldest_purchase: '⏳ Mais Antiga',
  alphabetical: '🔤 A - Z',
};

function MainScreen() {
  const { theme, cycleTheme } = useTheme();
  const { privacyEnabled, togglePrivacy, maskCurrency } = usePrivacy();

  // Estados principais
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [openDebitsMap, setOpenDebitsMap] = useState<Record<string, DebitEntry[]>>({});
  const [tradeName, setTradeName] = useState<string>('Irineu');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<SortOption>('collection_queue');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Estados de Gaveta e BottomSheet
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(false);
  const [sortSheetVisible, setSortSheetVisible] = useState<boolean>(false);

  // Estados de Modais
  const [newDebitVisible, setNewDebitVisible] = useState<boolean>(false);
  const [initialClientForDebit, setInitialClientForDebit] = useState<Client | null>(null);

  const [settleModalVisible, setSettleModalVisible] = useState<boolean>(false);
  const [settleTargetClient, setSettleTargetClient] = useState<Client | null>(null);

  const [receiptModalVisible, setReceiptModalVisible] = useState<boolean>(false);
  const [lastPayment, setLastPayment] = useState<PaymentRecord | null>(null);
  const [lastPaymentClient, setLastPaymentClient] = useState<Client | null>(null);

  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);

  const [clientFormVisible, setClientFormVisible] = useState<boolean>(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [businessProfileVisible, setBusinessProfileVisible] = useState<boolean>(false);
  const [clientsModalVisible, setClientsModalVisible] = useState<boolean>(false);
  const [pixKeysVisible, setPixKeysVisible] = useState<boolean>(false);
  const [templatesVisible, setTemplatesVisible] = useState<boolean>(false);
  const [themesVisible, setThemesVisible] = useState<boolean>(false);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [notificationSettingsVisible, setNotificationSettingsVisible] = useState<boolean>(false);
  const [dashboardVisible, setDashboardVisible] = useState<boolean>(false);

  // Carregamento de Dados (Apenas clientes com saldo devedor na tela principal)
  const loadData = useCallback(async () => {
    try {
      const [debtorList, fullList, profile] = await Promise.all([
        getClients(sortOption, searchQuery, { onlyDebtors: true }),
        getClients('alphabetical'),
        getBusinessProfile(),
      ]);
      setClients(debtorList);
      setAllClients(fullList);
      setTradeName(profile.trade_name || 'Irineu');
      setLogoUri(profile.logo_uri);

      // Carrega débitos abertos para os cards
      const debitsEntries: Record<string, DebitEntry[]> = {};
      await Promise.all(
        debtorList.map(async (c) => {
          const debits = await getClientDebits(c.id, 'pending');
          debitsEntries[c.id] = debits;
        })
      );
      setOpenDebitsMap(debitsEntries);
    } catch (err) {
      console.warn('Erro ao carregar lista de clientes:', err);
    }
  }, [sortOption, searchQuery]);

  useEffect(() => {
    loadData();
    setupNotificationChannel();
    scheduleReminders();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Métricas de Topo
  const totalReceivables = clients.reduce(
    (acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0),
    0
  );
  const debtorCount = clients.filter((c) => c.current_balance > 0).length;

  // Ações Rápidas nos Clientes
  const handleCobrarZap = async (client: Client) => {
    const openDebits = openDebitsMap[client.id] || [];
    const text = await generateMessageText('overdue_collection', {
      client,
      openDebits,
    });
    await sendWhatsAppMessage(client.whatsapp_primary, text);
  };

  const handlePassarRegua = (client: Client) => {
    setSettleTargetClient(client);
    setSettleModalVisible(true);
  };

  const handleOpenDetails = (client: Client) => {
    setSelectedClientDetail(client);
    setDetailModalVisible(true);
  };

  const handlePaymentSuccess = (payment: PaymentRecord, client: Client) => {
    setLastPayment(payment);
    setLastPaymentClient(client);
    setReceiptModalVisible(true);
    loadData();
  };

  const handleNewDebitSuccess = () => {
    loadData();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor={theme.background}
      />

      {/* TOP HEADER: MENU SANDUÍCHE (PADRÃO MINHAS FINANÇAS) + MARCA + AÇÕES RÁPIDAS */}
      <View style={[styles.topBar, { borderBottomColor: theme.borderLight }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: theme.cardSecondary }]}
            onPress={() => setSidebarVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Abrir menu lateral"
          >
            <Ionicons name="menu-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.topTitleBox}>
            <Text style={[styles.appName, { color: theme.primary }]}>Irineu</Text>
            <Text style={[styles.tradeNameSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {tradeName}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
          {/* Busca Rápida */}
          <TouchableOpacity
            style={[
              styles.topIconBtn,
              { backgroundColor: isSearchOpen ? theme.primaryBg : theme.cardSecondary },
            ]}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityLabel="Buscar"
          >
            <Ionicons
              name={isSearchOpen ? 'search' : 'search-outline'}
              size={19}
              color={isSearchOpen ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Seletor de Ordenação (Abre Bottom Sheet Deslizante) */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: theme.cardSecondary }]}
            onPress={() => setSortSheetVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Ordenar lista"
          >
            <Ionicons name="swap-vertical-outline" size={19} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Alternador de Privacidade (Ocultar/Exibir Valores) */}
          <TouchableOpacity
            style={[
              styles.topIconBtn,
              { backgroundColor: privacyEnabled ? theme.primaryBg : theme.cardSecondary },
            ]}
            onPress={togglePrivacy}
            activeOpacity={0.7}
            accessibilityLabel="Modo privacidade"
          >
            <Ionicons
              name={privacyEnabled ? 'eye-off' : 'eye-outline'}
              size={19}
              color={privacyEnabled ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Pesquisa Condicional */}
      {isSearchOpen && (
        <View style={[styles.searchBarContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Buscar cliente, apelido ou telefone..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Resumo de Caixa / Total na Rua */}
      <View style={[styles.metricsBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View>
          <Text style={[styles.metricsLabel, { color: theme.textSecondary }]}>
            Total a Receber ("Na Rua")
          </Text>
          <Text style={[styles.metricsValue, { color: theme.expense }]}>
            {maskCurrency(formatCurrency(totalReceivables))}
          </Text>
        </View>
        <View style={[styles.badgeCount, { backgroundColor: theme.expenseBg }]}>
          <Text style={[styles.badgeCountText, { color: theme.expense }]}>
            {debtorCount} {debtorCount === 1 ? 'devedor' : 'devedores'}
          </Text>
        </View>
      </View>

      {/* Barra Sub-header com Filtro Compacto & Contador de Clientes Devedores */}
      <View style={styles.listSubHeader}>
        <Text style={[styles.listCounterText, { color: theme.textMuted }]}>
          {clients.length} {clients.length === 1 ? 'devedor' : 'devedores'}
        </Text>

        <TouchableOpacity
          style={[styles.sortPillBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.borderLight }]}
          onPress={() => setSortSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortPillText, { color: theme.textPrimary }]}>
            {SORT_LABELS[sortOption]}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Lista de Clientes Devedores */}
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            openDebits={openDebitsMap[item.id] || []}
            onCobrarZap={handleCobrarZap}
            onPassarRegua={handlePassarRegua}
            onOpenDetails={handleOpenDetails}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={54} color={theme.income} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {searchQuery ? 'Nenhum Devedor Encontrado' : 'Nenhum Devedor no Momento!'}
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              {searchQuery
                ? 'Nenhum cliente com débito pendente coincide com a busca.'
                : 'Todos os clientes estão com as contas em dia. Toque no botão (+) Pendurar para registrar uma nova compra fiada.'}
            </Text>
          </View>
        }
      />

      {/* Botão Flutuante Principal (+) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          setInitialClientForDebit(null);
          setNewDebitVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={theme.primaryText} />
        <Text style={[styles.fabText, { color: theme.primaryText }]}>Pendurar</Text>
      </TouchableOpacity>

      {/* GAVETA LATERAL SANDUÍCHE (PADRÃO MINHAS FINANÇAS) */}
      <SidebarDrawer
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        tradeName={tradeName}
        logoUri={logoUri}
        onOpenDashboard={() => setDashboardVisible(true)}
        onOpenClients={() => setClientsModalVisible(true)}
        onOpenBusinessProfile={() => setBusinessProfileVisible(true)}
        onOpenPixKeys={() => setPixKeysVisible(true)}
        onOpenTemplates={() => setTemplatesVisible(true)}
        onOpenNotifications={() => setNotificationSettingsVisible(true)}
        onOpenBackup={() => setSettingsVisible(true)}
        onOpenThemes={() => setThemesVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      {/* MODAL DEDICADO DE GESTÃO DA CARTEIRA DE CLIENTES (CRUD PAGINADO) */}
      <ManageClientsModal
        visible={clientsModalVisible}
        onClose={() => {
          setClientsModalVisible(false);
          loadData();
        }}
        onNewClient={() => {
          setClientToEdit(null);
          setClientFormVisible(true);
        }}
        onEditClient={(client) => {
          setClientToEdit(client);
          setClientFormVisible(true);
        }}
        onViewHistory={(client) => {
          setSelectedClientDetail(client);
          setDetailModalVisible(true);
        }}
      />

      {/* FOLHA INFERIOR DE ORDENAÇÃO (BOTTOM SHEET) */}
      <SortBottomSheet
        visible={sortSheetVisible}
        selected={sortOption}
        onSelect={(opt) => setSortOption(opt)}
        onClose={() => setSortSheetVisible(false)}
      />

      {/* MODAL DEDICADO DE GESTÃO DE CHAVES PIX COM BIOMETRIA */}
      <ManagePixKeysModal
        visible={pixKeysVisible}
        onClose={() => setPixKeysVisible(false)}
        onKeysChanged={loadData}
      />

      {/* Modais de Fluxos Financeiros */}
      <NewDebitModal
        visible={newDebitVisible}
        clients={allClients}
        initialClient={initialClientForDebit}
        onClose={() => setNewDebitVisible(false)}
        onSuccess={handleNewDebitSuccess}
        onOpenNewClient={() => {
          setClientToEdit(null);
          setClientFormVisible(true);
        }}
      />

      <SettleAccountModal
        visible={settleModalVisible}
        client={settleTargetClient}
        onClose={() => setSettleModalVisible(false)}
        onSuccess={handlePaymentSuccess}
      />

      <ReceiptSuccessModal
        visible={receiptModalVisible}
        client={lastPaymentClient}
        payment={lastPayment}
        onClose={() => setReceiptModalVisible(false)}
      />

      <ClientDetailModal
        visible={detailModalVisible}
        client={selectedClientDetail}
        onClose={() => {
          setDetailModalVisible(false);
          loadData();
        }}
        onEditClient={(client) => {
          setClientToEdit(client);
          setClientFormVisible(true);
        }}
        onPassarRegua={(client) => {
          setDetailModalVisible(false);
          handlePassarRegua(client);
        }}
      />

      <ClientFormModal
        visible={clientFormVisible}
        client={clientToEdit}
        onClose={() => setClientFormVisible(false)}
        onSuccess={(saved) => {
          loadData();
          if (selectedClientDetail && selectedClientDetail.id === saved.id) {
            setSelectedClientDetail(saved);
          }
        }}
      />

      <BusinessProfileModal
        visible={businessProfileVisible}
        onClose={() => setBusinessProfileVisible(false)}
        onProfileUpdated={loadData}
        onOpenPixKeys={() => setPixKeysVisible(true)}
      />

      <MessageTemplatesModal
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
      />

      <ThemeSelectorModal
        visible={themesVisible}
        onClose={() => setThemesVisible(false)}
      />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onOpenThemes={() => setThemesVisible(true)}
        onOpenTemplates={() => setTemplatesVisible(true)}
        onOpenNotifications={() => setNotificationSettingsVisible(true)}
        onOpenBusinessProfile={() => setBusinessProfileVisible(true)}
        onOpenPixKeys={() => setPixKeysVisible(true)}
        onDataRestored={loadData}
      />

      <NotificationSettingsModal
        visible={notificationSettingsVisible}
        onClose={() => setNotificationSettingsVisible(false)}
        onRulesChanged={scheduleReminders}
      />

      <DashboardModal
        visible={dashboardVisible}
        onClose={() => setDashboardVisible(false)}
        onOpenClientDetails={(clientId) => {
          setDashboardVisible(false);
          const found = allClients.find((c) => c.id === clientId);
          if (found) {
            handleOpenDetails(found);
          }
        }}
      />

      <PaywallModal />
    </SafeAreaView>
  );
}

export default function App() {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    checkBiometricsLock();
  }, []);

  const checkBiometricsLock = async () => {
    try {
      const bioEnabled = await getSetting('biometrics_enabled', 'false');
      if (bioEnabled === 'true') {
        const hasHardware = await isBiometricsAvailable();
        if (hasHardware) {
          setIsLocked(true);
          const success = await authenticateWithBiometrics();
          if (success) {
            setIsLocked(false);
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao verificar bloqueio biométrico:', err);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleUnlock = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      setIsLocked(false);
    }
  };

  if (isLocked) {
    return (
      <View style={styles.lockScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.lockIconBox}>
          <Ionicons name="lock-closed" size={48} color="#6366F1" />
        </View>
        <Text style={styles.lockTitle}>CaloteOff Protegido</Text>
        <Text style={styles.lockSub}>Autentique-se com sua digital ou PIN para acessar seu caderno.</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} activeOpacity={0.8}>
          <Ionicons name="finger-print" size={24} color="#FFFFFF" />
          <Text style={styles.unlockBtnText}>Desbloquear com Biometria</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <PrivacyProvider>
        <LicenseProvider>
          <MainScreen />
        </LicenseProvider>
      </PrivacyProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topTitleBox: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tradeNameSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
  },
  metricsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  metricsLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  listCounterText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '800',
  },
  lockScreen: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  lockSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
    maxWidth: 280,
    lineHeight: 20,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
