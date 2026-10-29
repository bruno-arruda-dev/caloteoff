import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '../database/settingsRepository';
import { maskClientName, PrivacyMaskType } from '../utils/privacy';

export { maskClientName, PrivacyMaskType };

interface PrivacyContextType {
  privacyEnabled: boolean;
  togglePrivacy: () => void;
  maskType: PrivacyMaskType;
  setMaskTypeSetting: (type: PrivacyMaskType) => Promise<void>;
  privacyDefault: boolean;
  setPrivacyDefaultSetting: (enabled: boolean) => Promise<void>;
  maskName: (name: string) => string;
  maskCurrency: (formattedValue: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  privacyEnabled: false,
  togglePrivacy: () => {},
  maskType: 'masked',
  setMaskTypeSetting: async () => {},
  privacyDefault: false,
  setPrivacyDefaultSetting: async () => {},
  maskName: (name) => name,
  maskCurrency: (val) => val,
});

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [privacyEnabled, setPrivacyEnabled] = useState<boolean>(false);
  const [maskType, setMaskType] = useState<PrivacyMaskType>('masked');
  const [privacyDefault, setPrivacyDefault] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const savedDefault = await getSetting('privacy_default', 'false');
        const isDefault = savedDefault === 'true';
        setPrivacyDefault(isDefault);
        if (isDefault) {
          setPrivacyEnabled(true);
        }

        const savedMaskType = await getSetting('privacy_mask_type', 'masked');
        if (savedMaskType === 'masked' || savedMaskType === 'hidden') {
          setMaskType(savedMaskType);
        }
      } catch (e) {
        console.warn('Erro ao carregar preferência de privacidade:', e);
      }
    })();
  }, []);

  const togglePrivacy = useCallback(() => {
    setPrivacyEnabled((prev) => !prev);
  }, []);

  const setMaskTypeSetting = useCallback(async (type: PrivacyMaskType) => {
    setMaskType(type);
    try {
      await setSetting('privacy_mask_type', type);
    } catch (e) {
      console.warn('Erro ao salvar tipo de máscara:', e);
    }
  }, []);

  const setPrivacyDefaultSetting = useCallback(async (enabled: boolean) => {
    setPrivacyDefault(enabled);
    try {
      await setSetting('privacy_default', enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Erro ao salvar preferência de privacidade padrão:', e);
    }
  }, []);

  const maskName = useCallback(
    (name: string) => {
      if (!privacyEnabled) return name;
      return maskClientName(name, maskType);
    },
    [privacyEnabled, maskType]
  );

  const maskCurrency = useCallback(
    (formattedValue: string) => {
      if (!privacyEnabled) return formattedValue;
      return 'R$ ••••••';
    },
    [privacyEnabled]
  );

  return (
    <PrivacyContext.Provider
      value={{
        privacyEnabled,
        togglePrivacy,
        maskType,
        setMaskTypeSetting,
        privacyDefault,
        setPrivacyDefaultSetting,
        maskName,
        maskCurrency,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export function usePrivacy(): PrivacyContextType {
  return useContext(PrivacyContext);
}
