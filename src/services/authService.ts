import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(
  promptMessage: string = 'Autentique-se para acessar o Irineu'
): Promise<boolean> {
  try {
    const isAvailable = await isBiometricsAvailable();
    if (!isAvailable) {
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar Senha / PIN',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.warn('Erro ao autenticar com biometria:', error);
    return false;
  }
}
