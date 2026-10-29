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
import { SortFilterTabs } from './src/components/SortFilterTabs';
import { NewDebitModal } from './src/components/NewDebitModal';
import { SettleAccountModal } from './src/components/SettleAccountModal';
import { ReceiptSuccessModal } from './src/components/ReceiptSuccessModal';
import { ClientDetailModal } from './src/components/ClientDetailModal';
import { ClientFormModal } from './src/components/ClientFormModal';
import { BusinessProfileModal } from './src/components/BusinessProfileModal';
import { MessageTemplatesModal } from './src/components/MessageTemplatesModal';
import { ThemeSelectorModal } from './src/components/ThemeSelectorModal';
import { SettingsModal } from './src/components/SettingsModal';
import { PaywallModal } from './src/components/PaywallModal';
import { generateMessageText, sendWhatsAppMessage } from './src/services/whatsappService';
import { authenticateWithBiometrics, isBiometricsAvailable } from './src/services/authService';
import { getSetting } from './src/database/settingsRepository';
import { setupNotificationChannel, scheduleReminders } from './src/services/notificationService';

function MainScreen() {
  const { theme, cycleTheme } = useTheme();
  const { privacyEnabled, togglePrivacy, maskCurrency } = usePrivacy();

  // Estados principais
  const [clients, setClients] = useState<Client[]>([]);
  const [openDebitsMap, setOpenDebitsMap] = useState<Record<string, DebitEntry[]>>({});
  const [tradeName, setTradeName] = useState<string>('CaloteOff');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('collection_queue');
  const [refreshing, setRefreshing] = useState<boolean>(false);

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
  const [templatesVisible, setTemplatesVisible] = useState<boolean>(false);
  const [themesVisible, setThemesVisible] = useState<boolean>(false);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);

  // Carregamento de Dados
  const loadData = useCallback(async () => {
    try {
      const [list, profile] = await Promise.all([
        getClients(sortOption, searchQuery),
        getBusinessProfile(),
      ]);
      setClients(list);
      setTradeName(profile.trade_name || 'CaloteOff');

      // Carrega débitos abertos para os cards
      const debitsEntries: Record<string, DebitEntry[]> = {};
      await Promise.all(
        list.map(async (c) => {
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

      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.borderLight }]}>
        <View style={styles.storeBranding}>
          <Text style={[styles.appName, { color: theme.primary }]}>CaloteOff</Text>
          <Text style={[styles.tradeNameSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {tradeName}
          </Text>
        </View>

        <View style={styles.topActions}>
          {/* Alternador de Privacidade */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: theme.cardSecondary }]}
            onPress={togglePrivacy}
            activeOpacity={0.7}
          >
            <Ionicons
              name={privacyEnabled ? 'eye-off' : 'eye'}
              size={18}
              color={privacyEnabled ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Troca Rápida de Tema */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: theme.cardSecondary }]}
            onPress={cycleTheme}
            activeOpacity={0.7}
          >
            <Ionicons name="contrast-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Configurações */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: theme.cardSecondary }]}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

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

      {/* Barra de Pesquisa */}
      <View style={[styles.searchBarContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Buscar cliente, apelido ou zap..."
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

      {/* Abas de Ordenação */}
      <SortFilterTabs selected={sortOption} onSelect={setSortOption} />

      {/* Lista de Clientes */}
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
            <Ionicons name="book-outline" size={54} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              Caderno de Fiado Limpo!
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Nenhum cliente ou fiado encontrado. Toque no botão (+) abaixo para pendurar a primeira conta.
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
        <Ionicons name="add" size={30} color={theme.primaryText} />
        <Text style={[styles.fabText, { color: theme.primaryText }]}>Pendurar</Text>
      </TouchableOpacity>

      {/* Modais da Aplicação */}
      <NewDebitModal
        visible={newDebitVisible}
        clients={clients}
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
        onOpenBusinessProfile={() => setBusinessProfileVisible(true)}
        onDataRestored={loadData}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  storeBranding: {
    flex: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricsValue: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  badgeCount: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 90,
    paddingTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    gap: 6,
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
    padding: 32,
  },
  lockIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  lockSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
