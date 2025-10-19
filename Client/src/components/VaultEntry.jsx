import React, { useState, useEffect, useRef } from "react";
import styles from "./VaultEntry.module.css";
import { Eye, EyeOff, ClipboardCopy, Trash2, Edit3, Check, X } from "lucide-react";
import { checkPasswordPwned } from "../utils/PwnedPasswords";
import { checkPasswordBreach } from "../services/vault";
import { isValidStrongPassword } from "../utils/CryptoUtils";

export default function VaultEntry({ entry, onReveal, onHide, onDelete, onUpdate, index }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isBreached, setIsBreached] = useState(false);
  const [error, setError] = useState("");
  const userTypingRef = useRef(false);

  const handleEdit = () => {
    if (!entry.revealedPassword) {
      onReveal();
      setIsEditing(true);
      setNewPassword("");
    } else {
      setIsEditing(true);
      setNewPassword(entry.revealedPassword || "");
    }
  };

  useEffect(() => {
    if (isEditing && entry.revealedPassword && !newPassword && !userTypingRef.current) {
      setNewPassword(entry.revealedPassword);
    }
  }, [entry.revealedPassword, isEditing, newPassword]);

  useEffect(() => {
    const autoEditIndex = sessionStorage.getItem('autoEditIndex');
    if (autoEditIndex && parseInt(autoEditIndex) === index) {
      sessionStorage.removeItem('autoEditIndex');
      handleEdit();
    }
  }, [index]);

  useEffect(() => {
    const keyId = `${entry.site}|||${entry.username}`;
    const userEmail = sessionStorage.getItem('userEmail') || 'anonymous';
    const userSpecificKey = `vaultBreachStates_${userEmail}`;
    const breachStates = JSON.parse(localStorage.getItem(userSpecificKey) || '{}');
    setIsBreached(breachStates[keyId] || false);
  }, [entry.site, entry.username]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.revealedPassword);
      alert("Password copied to clipboard!");
    } catch (error) {
      alert("Failed to copy password.");
    }
  };

  const handleSave = async () => {
    setError("");
    
    if (!newPassword.trim()) {
      setError("Password cannot be empty");
      return;
    }

    if (!isValidStrongPassword(newPassword)) {
      setError("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.");
      return;
    }

    try {
      const result = await checkPasswordPwned(newPassword);
      if (result.isBreached) {
        const proceed = window.confirm(
          `This password appears in ${result.breachCount.toLocaleString()} known breaches.\n\n` +
          `Using compromised passwords significantly increases account risk.\n\n` +
          `Do you want to save it anyway?`
        );
        if (!proceed) {
          return;
        }
      }
      
      updateBreachStats(entry.site, entry.username, newPassword);
      
      onUpdate(entry.site, entry.username, newPassword);
      setIsEditing(false);
      setNewPassword("");
      setError("");
    } catch (error) {
      onUpdate(entry.site, entry.username, newPassword);
      setIsEditing(false);
      setNewPassword("");
      setError("");
    }
  };

  const updateBreachStats = async (site, username, password) => {
    try {
      const result = await checkPasswordBreach(password, site, username);
      const isBreached = result.is_breached;
      const breachCount = result.breach_count || 0;
      
      window.dispatchEvent(new CustomEvent('breachStatsUpdated', { 
        detail: { 
          site, 
          username, 
          isBreached, 
          breachCount: breachCount 
        } 
      }));
    } catch (error) {
      console.error('Error updating breach stats:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewPassword("");
    setError("");
    userTypingRef.current = false;
  };

  const handlePasswordChange = (e) => {
    userTypingRef.current = true;
    setNewPassword(e.target.value);
  };

  const handlePasswordFocus = () => {
    userTypingRef.current = true;
  };

  const handlePasswordBlur = () => {
    setTimeout(() => {
      userTypingRef.current = false;
    }, 100);
  };

  return (
    <div className={styles.vaultEntry}>
      <div className={styles.info}>
        <div><strong>Site:</strong> {entry.site}</div>
        <div><strong>Username:</strong> {entry.username}</div>
        <div><strong>Tag:</strong> <span className={styles.tag}>{entry.tag || "N/A"}</span></div>
        <div>
          <strong>Password:</strong>{" "}
          {isEditing ? (
            <>
              <input
                type="text"
                value={newPassword}
                onChange={handlePasswordChange}
                onFocus={handlePasswordFocus}
                onBlur={handlePasswordBlur}
                className={styles.passwordInput}
                placeholder={entry.revealedPassword ? "Enter new password" : "Loading current password..."}
                autoFocus
              />
              {error && <div className={styles.errorMessage}>{error}</div>}
            </>
          ) : entry.revealedPassword ? (
            <span className={styles.password}>{entry.revealedPassword}</span>
          ) : (
            "••••••••"
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {isEditing ? (
          <>
            <Check
              className={styles.icon}
              onClick={handleSave}
              title="Save changes"
            />
            <X
              className={styles.icon}
              onClick={handleCancel}
              title="Cancel editing"
            />
          </>
        ) : (
          <>
            {entry.revealedPassword ? (
              <>
                <EyeOff
                  className={styles.icon}
                  onClick={onHide}
                  title="Hide password"
                />
                <ClipboardCopy
                  className={styles.icon}
                  onClick={handleCopy}
                  title="Copy password"
                />
              </>
            ) : (
              <Eye className={styles.icon} onClick={onReveal} title="Reveal password" />
            )}

            <Edit3
              className={styles.icon}
              onClick={handleEdit}
              title="Edit password"
            />

            <Trash2
              className={styles.icon}
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this password?")) {
                  onDelete(entry.site, entry.username);
                }
              }}
              title="Delete entry"
            />
          </>
        )}
      </div>
    </div>
  );
}
