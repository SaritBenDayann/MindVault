import { useState } from "react";
import { savePassword, checkPasswordBreach } from "../services/vault";
import { encryptWithAES, importKeyFromBase64, isValidStrongPassword } from "../utils/CryptoUtils";
import { checkPasswordPwned } from "../utils/PwnedPasswords";
import styles from "./PasswordForm.module.css";

export default function PasswordForm({ onPasswordSaved }) {
  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checkingPwned, setCheckingPwned] = useState(false);
  const [pwnedWarning, setPwnedWarning] = useState(false);
  const [pwnedCount, setPwnedCount] = useState(0);
  const [allowPwnedSave, setAllowPwnedSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setPwnedWarning(false);

    const keyBase64 = sessionStorage.getItem("masterKey");

    if (!keyBase64) {
      setError("Missing master key. Please log in again.");
      return;
    }
    if (!username.includes("@")) {
      setError("Email must contain '@' character.");
      return;
    }

    if (!isValidStrongPassword(password)) {
      setError("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.");
      return;
    }
    if (!allowPwnedSave) {
      try {
        setCheckingPwned(true);
        const result = await checkPasswordPwned(password);
        if (result.isBreached) {
          setPwnedWarning(true);
          setPwnedCount(result.breachCount || 0);
          setCheckingPwned(false);
          return;
        }
      } catch (e) {
      } finally {
        setCheckingPwned(false);
      }
    }

    await performSave(keyBase64);
  };

  const performSave = async (keyBase64) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const key = await importKeyFromBase64(keyBase64);
      const encryptedPassword = await encryptWithAES(password, key);

      await savePassword(site, username, encryptedPassword);
      
      updateBreachStats(site, username, password);
      
      setSuccess("Password saved successfully");
      setSite("");
      setUsername("");
      setPassword("");
      setAllowPwnedSave(false);
      setPwnedWarning(false);
      setPwnedCount(0);
      if (onPasswordSaved) onPasswordSaved();
    } catch (err) {
      setError(err.message || "Failed to save password");
    } finally {
      setIsSaving(false);
    }
  };

  const updateBreachStats = async (site, username, password) => {
    try {
      const result = await checkPasswordBreach(password, site, username);
      const isBreached = result.is_breached;
      
      window.dispatchEvent(new CustomEvent('breachStatsUpdated', { 
        detail: { 
          site, 
          username, 
          isBreached, 
          breachCount: result.breach_count || 0 
        } 
      }));
    } catch (error) {
      console.error('Error updating breach stats:', error);
    }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.heading}>Save New Password</h3>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}
        {pwnedWarning && (
          <div className={styles.warningBox}>
            <p>
              This password appears in {pwnedCount.toLocaleString()} known breaches.
              Using compromised passwords significantly increases account risk.
            </p>
            <div className={styles.warningActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setPwnedWarning(false);
                }}
              >
                Choose Different Password
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={async () => {
                  const keyBase64 = sessionStorage.getItem("masterKey");
                  if (!keyBase64) {
                    setError("Missing master key. Please log in again.");
                    return;
                  }
                  setAllowPwnedSave(true);
                  await performSave(keyBase64);
                }}
              >
                Save Anyway
              </button>
            </div>
          </div>
        )}
        <input
          type="text"
          placeholder="Site"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="password"
          placeholder="Password to save"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={styles.input}
        />
        <button type="submit" className={styles.button} disabled={checkingPwned || isSaving}>
          {checkingPwned ? "Checking..." : isSaving ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
