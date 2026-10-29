import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  PlanType,
  getLicenseState,
  setLicensePlan,
  resetLicenseToFree,
} from '../services/licenseService';

export interface PaywallTriggerInfo {
  feature?: 'clients_limit' | 'pdf_export' | 'cloud_backup' | 'custom_branding' | 'privacy_mode' | 'advanced_metrics' | 'themes';
  title?: string;
  description?: string;
  icon?: string;
}

export interface LicenseContextType {
  isPremium: boolean;
  planType: PlanType;
  isPaywallOpen: boolean;
  triggerInfo?: PaywallTriggerInfo;
  openPaywall: (trigger?: PaywallTriggerInfo) => void;
  closePaywall: () => void;
  purchasePlan: (plan: 'monthly' | 'annual') => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  resetToFree: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType>({
  isPremium: false,
  planType: 'free',
  isPaywallOpen: false,
  triggerInfo: undefined,
  openPaywall: () => {},
  closePaywall: () => {},
  purchasePlan: async () => {},
  restorePurchases: async () => false,
  resetToFree: async () => {},
});

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [planType, setPlanType] = useState<PlanType>('free');
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [triggerInfo, setTriggerInfo] = useState<PaywallTriggerInfo | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const state = await getLicenseState();
        setIsPremium(state.isPremium);
        setPlanType(state.planType);
      } catch (err) {
        console.warn('Erro ao carregar licença no LicenseProvider:', err);
      }
    })();
  }, []);

  const openPaywall = useCallback((trigger?: PaywallTriggerInfo) => {
    setTriggerInfo(trigger);
    setIsPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
    setTriggerInfo(undefined);
  }, []);

  const purchasePlan = useCallback(
    async (plan: 'monthly' | 'annual') => {
      try {
        await setLicensePlan(plan);
        setIsPremium(true);
        setPlanType(plan);
        closePaywall();
      } catch (err) {
        console.warn('Erro ao atualizar plano:', err);
        throw err;
      }
    },
    [closePaywall]
  );

  const restorePurchases = useCallback(async () => {
    try {
      const state = await getLicenseState();
      setIsPremium(state.isPremium);
      setPlanType(state.planType);
      return state.isPremium;
    } catch {
      return false;
    }
  }, []);

  const resetToFree = useCallback(async () => {
    await resetLicenseToFree();
    setIsPremium(false);
    setPlanType('free');
  }, []);

  return (
    <LicenseContext.Provider
      value={{
        isPremium,
        planType,
        isPaywallOpen,
        triggerInfo,
        openPaywall,
        closePaywall,
        purchasePlan,
        restorePurchases,
        resetToFree,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => useContext(LicenseContext);
