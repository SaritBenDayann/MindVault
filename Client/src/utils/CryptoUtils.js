import { CRYPTO_CONFIG, ensureCryptoConfigLoaded } from '../services/api.js';

export function isValidStrongPassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  return regex.test(password);
}

export async function generateMasterKey(masterPassword, userEmail) {
    const encoder = new TextEncoder();
    const saltString = `MindVault-${userEmail}-Salt-2024`;
    const salt = encoder.encode(saltString);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(masterPassword),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: CRYPTO_CONFIG.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: CRYPTO_CONFIG.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }
  
  export async function deriveKeyFromPassword(password, salt = null) {
    const enc = new TextEncoder();
    
    await ensureCryptoConfigLoaded();
    
    const saltToUse = salt || CRYPTO_CONFIG.STATIC_SALT;
    
    if (!saltToUse) {
      throw new Error("Crypto configuration not loaded from server. Please ensure the app is properly initialized.");
    }
  
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
  
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(saltToUse),
        iterations: CRYPTO_CONFIG.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: CRYPTO_CONFIG.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }
  
  export async function encryptWithAES(plaintext, key) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.IV_LENGTH));
    const encoded = enc.encode(plaintext);
  
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
  
    const merged = new Uint8Array(iv.length + ciphertext.byteLength);
    merged.set(iv);
    merged.set(new Uint8Array(ciphertext), iv.length);
  
    return btoa(String.fromCharCode(...merged));
  }
  
  export async function decryptWithAES(base64Ciphertext, key) {
    const data = Uint8Array.from(atob(base64Ciphertext), c => c.charCodeAt(0));
    const iv = data.slice(0, CRYPTO_CONFIG.IV_LENGTH);
    const ciphertext = data.slice(CRYPTO_CONFIG.IV_LENGTH);
  
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
  
    return new TextDecoder().decode(decrypted);
  }
  
  export async function exportKeyToBase64(key) {
    const raw = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  }
  
  export async function importKeyFromBase64(base64) {
    const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }
  