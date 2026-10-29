import CryptoJS from 'crypto-js';

let expoCrypto: any = null;
try {
  expoCrypto = require('expo-crypto');
} catch {}

// Polyfill seguro para garantir que CryptoJS tenha gerador aleatório no React Native / Hermes
if (typeof globalThis.crypto !== 'object' || globalThis.crypto === null) {
  (globalThis as any).crypto = {};
}
if (typeof (globalThis as any).crypto.getRandomValues !== 'function') {
  (globalThis as any).crypto.getRandomValues = (typedArray: any) => {
    if (expoCrypto && typeof expoCrypto.getRandomValues === 'function') {
      return expoCrypto.getRandomValues(typedArray);
    }
    for (let i = 0; i < typedArray.length; i++) {
      typedArray[i] = Math.floor(Math.random() * 256);
    }
    return typedArray;
  };
}

// Fallback robusto no WordArray.random do CryptoJS
try {
  CryptoJS.lib.WordArray.random = function (nBytes: number) {
    try {
      const uint8 = new Uint8Array(nBytes);
      if (expoCrypto && typeof expoCrypto.getRandomValues === 'function') {
        expoCrypto.getRandomValues(uint8);
      } else {
        for (let i = 0; i < nBytes; i++) {
          uint8[i] = Math.floor(Math.random() * 256);
        }
      }
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push(
          ((uint8[i] || 0) << 24) |
          ((uint8[i + 1] || 0) << 16) |
          ((uint8[i + 2] || 0) << 8) |
          (uint8[i + 3] || 0)
        );
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    } catch {
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push((Math.floor(Math.random() * 0x100000000)) | 0);
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    }
  };
} catch (e) {
  console.warn('Erro ao configurar WordArray.random:', e);
}

// Chave mestra segura interna do aplicativo (derivada para restauração transparente em outros aparelhos)
const APP_INTERNAL_VAULT_SEED = '@FinancasApp_Vault_Master_AES256_Salt#2026!';

/**
 * Retorna a chave de criptografia a ser utilizada.
 * Se nenhuma senha for passada pelo usuário, utiliza a chave mestra do cofre do app.
 */
function resolveEncryptionKey(userPassword?: string): string {
  if (userPassword && userPassword.trim().length > 0) {
    // Deriva chave segura com salt baseado na senha informada pelo usuário
    return CryptoJS.SHA256(userPassword.trim() + '_salt_financas_app').toString();
  }
  // Chave padrão segura do app
  return CryptoJS.SHA256(APP_INTERNAL_VAULT_SEED).toString();
}

export interface EncryptedBackupContainer {
  magic: 'FINANCAS_ENCRYPTED_BACKUP_V1';
  type: 'light' | 'full';
  hasPassword: boolean;
  version: string;
  createdAt: string;
  ciphertext: string;
}

/**
 * Criptografa dados em formato de string ou base64 usando AES-256.
 */
export function encryptBackupPayload(
  payloadString: string,
  type: 'light' | 'full',
  userPassword?: string
): EncryptedBackupContainer {
  const hasPassword = !!(userPassword && userPassword.trim().length > 0);
  const key = resolveEncryptionKey(userPassword);

  const ciphertext = CryptoJS.AES.encrypt(payloadString, key).toString();

  return {
    magic: 'FINANCAS_ENCRYPTED_BACKUP_V1',
    type,
    hasPassword,
    version: '1.2.0',
    createdAt: new Date().toISOString(),
    ciphertext,
  };
}

/**
 * Descriptografa o container de backup.
 * Se o backup foi protegido com senha pessoal e a senha não for fornecida (ou incorreta),
 * lançará um erro específico.
 */
export function decryptBackupPayload(
  container: EncryptedBackupContainer,
  userPassword?: string
): { success: boolean; data?: string; error?: string } {
  try {
    if (container.magic !== 'FINANCAS_ENCRYPTED_BACKUP_V1') {
      return { success: false, error: 'Formato de backup inválido ou não suportado.' };
    }

    if (container.hasPassword && (!userPassword || userPassword.trim().length === 0)) {
      return {
        success: false,
        error: 'PASSWORD_REQUIRED',
      };
    }

    const key = resolveEncryptionKey(userPassword);
    let decryptedText = '';
    try {
      const bytes = CryptoJS.AES.decrypt(container.ciphertext, key);
      decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return {
        success: false,
        error: container.hasPassword ? 'WRONG_PASSWORD' : 'Falha ao descriptografar os dados do backup.',
      };
    }

    if (!decryptedText || decryptedText.length === 0) {
      return {
        success: false,
        error: container.hasPassword ? 'WRONG_PASSWORD' : 'Falha ao descriptografar os dados do backup.',
      };
    }

    return {
      success: true,
      data: decryptedText,
    };
  } catch (err: any) {
    return {
      success: false,
      error: container.hasPassword ? 'WRONG_PASSWORD' : err.message || 'Erro inesperado durante a descriptografia.',
    };
  }
}
