import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert as RNAlert,
  AlertButton as RNAlertButton,
  AlertOptions as RNAlertOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import {
  AlertType,
  AppAlertButton,
  AppAlertConfig,
  classifyAlertType,
} from '../utils/alertUtils';

export type { AlertType, AppAlertButton, AppAlertConfig };
export { classifyAlertType };

interface AlertContextValue {
  showAlert: (
    titleOrConfig: string | AppAlertConfig,
    message?: string,
    buttons?: AppAlertButton[],
    type?: AlertType
  ) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    isDestructive?: boolean
  ) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string, onOk?: () => void) => void;
  showWarning: (title: string, message?: string, onOk?: () => void) => void;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

// Listener global para permitir chamadas fora do ciclo de vida do React (ex: polyfill do Alert.alert)
type AlertListener = (config: AppAlertConfig) => void;
let globalAlertListener: AlertListener | null = null;

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const [currentAlert, setCurrentAlert] = useState<AppAlertConfig | null>(null);

  const closeAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  const showAlert = useCallback(
    (
      titleOrConfig: string | AppAlertConfig,
      message?: string,
      buttons?: AppAlertButton[],
      type?: AlertType
    ) => {
      let config: AppAlertConfig;
      if (typeof titleOrConfig === 'object') {
        config = {
          ...titleOrConfig,
          type:
            titleOrConfig.type ||
            classifyAlertType(titleOrConfig.title, titleOrConfig.message, titleOrConfig.buttons),
          buttons: titleOrConfig.buttons && titleOrConfig.buttons.length > 0
            ? titleOrConfig.buttons
            : [{ text: 'OK', style: 'default' }],
        };
      } else {
        const title = titleOrConfig;
        const resolvedType = type || classifyAlertType(title, message, buttons);
        const resolvedButtons: AppAlertButton[] =
          buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];
        config = {
          title,
          message,
          type: resolvedType,
          buttons: resolvedButtons,
        };
      }
      setCurrentAlert(config);
    },
    []
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      confirmText: string = 'Confirmar',
      cancelText: string = 'Cancelar',
      isDestructive: boolean = false
    ) => {
      showAlert({
        title,
        message,
        type: isDestructive ? 'warning' : 'confirm',
        buttons: [
          { text: cancelText, style: 'cancel' },
          {
            text: confirmText,
            style: isDestructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    [showAlert]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        title,
        message,
        type: 'success',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showAlert]
  );

  const showError = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        title,
        message,
        type: 'error',
        buttons: [{ text: 'Entendido', style: 'default', onPress: onOk }],
      });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        title,
        message,
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showAlert]
  );

  // Registra ouvinte global para capturar Alert.alert nativo
  useEffect(() => {
    globalAlertListener = (cfg) => {
      setCurrentAlert(cfg);
    };

    // Polyfill elegante do Alert.alert do React Native
    const originalRNAlert = RNAlert.alert;
    RNAlert.alert = (
      title: string,
      message?: string,
      buttons?: RNAlertButton[],
      _options?: RNAlertOptions
    ) => {
      const mappedButtons: AppAlertButton[] =
        buttons && buttons.length > 0
          ? buttons.map((b) => ({
              text: b.text || 'OK',
              style: (b.style as any) || 'default',
              onPress: b.onPress,
            }))
          : [{ text: 'OK', style: 'default' }];

      const detectedType = classifyAlertType(title, message, mappedButtons);
      const config: AppAlertConfig = {
        title,
        message,
        type: detectedType,
        buttons: mappedButtons,
      };

      if (globalAlertListener) {
        globalAlertListener(config);
      } else {
        originalRNAlert(title, message, buttons, _options);
      }
    };

    return () => {
      globalAlertListener = null;
      RNAlert.alert = originalRNAlert;
    };
  }, []);

  const alertType = currentAlert?.type || 'info';

  const getIconConfig = () => {
    switch (alertType) {
      case 'error':
        return {
          name: 'alert-circle' as const,
          color: '#DC2626',
          bg: '#FEE2E2',
        };
      case 'warning':
        return {
          name: 'warning' as const,
          color: '#D97706',
          bg: '#FEF3C7',
        };
      case 'success':
        return {
          name: 'checkmark-circle' as const,
          color: '#16A34A',
          bg: '#DCFCE7',
        };
      case 'confirm':
        return {
          name: 'help-circle' as const,
          color: theme.primary,
          bg: theme.primaryBg,
        };
      case 'info':
      default:
        return {
          name: 'information-circle' as const,
          color: theme.primary,
          bg: theme.primaryBg,
        };
    }
  };

  const iconCfg = getIconConfig();
  const buttonsList = currentAlert?.buttons || [{ text: 'OK', style: 'default' }];
  const isTwoButtons = buttonsList.length === 2;

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showConfirm,
        showSuccess,
        showError,
        showWarning,
        closeAlert,
      }}
    >
      {children}

      {/* MODAL IN-APP PADRONIZADO E 100% CROSS-PLATFORM */}
      <Modal
        visible={!!currentAlert}
        transparent
        animationType="fade"
        onRequestClose={closeAlert}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeAlert}
          />

          <View style={[styles.dialogCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Ícone de Destaque */}
            <View style={[styles.iconBadge, { backgroundColor: iconCfg.bg }]}>
              <Ionicons name={iconCfg.name} size={30} color={iconCfg.color} />
            </View>

            {/* Título */}
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>
              {currentAlert?.title}
            </Text>

            {/* Mensagem / Descrição */}
            {currentAlert?.message ? (
              <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
                {currentAlert.message}
              </Text>
            ) : null}

            {/* Botões de Ação */}
            <View
              style={[
                styles.buttonsContainer,
                isTwoButtons ? styles.twoButtonsRow : styles.verticalButtonsCol,
              ]}
            >
              {buttonsList.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';

                let btnBg = theme.primary;
                let btnTextColor = theme.primaryText;
                let btnBorderColor = 'transparent';

                if (isCancel) {
                  btnBg = theme.cardSecondary;
                  btnTextColor = theme.textSecondary;
                  btnBorderColor = theme.border;
                } else if (isDestructive) {
                  btnBg = '#DC2626';
                  btnTextColor = '#FFFFFF';
                }

                return (
                  <TouchableOpacity
                    key={`${btn.text}-${index}`}
                    style={[
                      styles.btnBase,
                      isTwoButtons && styles.flexBtn,
                      {
                        backgroundColor: btnBg,
                        borderColor: btnBorderColor,
                        borderWidth: isCancel ? 1 : 0,
                      },
                    ]}
                    onPress={() => {
                      closeAlert();
                      if (btn.onPress) {
                        btn.onPress();
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        { color: btnTextColor },
                        isDestructive && { fontWeight: '800' },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert deve ser utilizado dentro de um AlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsContainer: {
    width: '100%',
  },
  twoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  verticalButtonsCol: {
    flexDirection: 'column',
    gap: 10,
  },
  btnBase: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  flexBtn: {
    flex: 1,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
