import { useEffect, useState } from "react";
import {deleteVaultEntry} from "../services/vault";
import styles from "./VaultPage.module.css";
import VaultEntry from "../components/VaultEntry";
import { fetchVaultEntries, revealPassword } from "../services/vault";
import { searchVault, updatePassword } from "../services/api";
import PasswordForm from "../components/PasswordForm";
import {
  importKeyFromBase64,
  decryptWithAES,
  encryptWithAES,
} from "../utils/CryptoUtils";

export default function VaultPage({ showForm, setShowForm, searchTerm }) {
  const [entries, setEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [justDeleted, setJustDeleted] = useState(false);


  useEffect(() => {
    loadVaults();
    
    const editItem = sessionStorage.getItem('editVaultItem');
    if (editItem) {
      try {
        const { site, username } = JSON.parse(editItem);
        sessionStorage.removeItem('editVaultItem');
        
        sessionStorage.setItem('autoEditItem', JSON.stringify({ site, username }));
      } catch (error) {
        console.error('Error parsing editVaultItem:', error);
        sessionStorage.removeItem('editVaultItem');
      }
    }
  }, []);
  
  useEffect(() => {
    if (searchTerm !== undefined) {
      handleSearch(searchTerm);
    }
  }, [searchTerm]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showForm) {
        setShowForm(false);
      }
    };

    if (showForm) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showForm]);
  

  const loadVaults = async (forceReload = false) => {
   
    if (isLoading && !forceReload) {
      return;
    }
    
    if (justDeleted && !forceReload) {
      return;
    }
    
    if (window.vaultDeleteInProgress && !forceReload) {
      return;
    }
    
    try {
      setIsLoading(true);
      const data = await fetchVaultEntries();
      
      if (forceReload || JSON.stringify(entries) !== JSON.stringify(data)) {
        setEntries(data);
        setFilteredItems(data);
      }
      
      const autoEditItem = sessionStorage.getItem('autoEditItem');
      if (autoEditItem) {
        try {
          const { site, username } = JSON.parse(autoEditItem);
          sessionStorage.removeItem('autoEditItem');
          
          const entryIndex = data.findIndex(entry => 
            entry.site === site && entry.username === username
          );
          
          if (entryIndex !== -1) {
            sessionStorage.setItem('autoEditIndex', entryIndex.toString());
          }
        } catch (error) {
          console.error('Error parsing autoEditItem:', error);
          sessionStorage.removeItem('autoEditItem');
        }
      }
    } catch (error) {
      console.error("Error loading vaults:", error);
      alert("Failed to load vault entries.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = async (index) => {
    try {
      const { site, username } = entries[index];

      const encrypted = await revealPassword(site, username);
      const base64Key = sessionStorage.getItem("masterKey");
      if (!base64Key) {
        alert("Missing encryption key. Please log in again.");
        return;
      }
      const key = await importKeyFromBase64(base64Key);
      const decrypted = await decryptWithAES(encrypted, key);

      const updated = [...entries];
      updated[index].revealedPassword = decrypted;
      setEntries(updated);
    } catch (error) {
      console.error("Reveal error:", error);
      alert("Could not reveal password.");
    }
  };
  const handleDelete = async (site, username) => {
    try {      
      window.vaultDeleteInProgress = true;
      
      const updatedEntries = entries.filter(entry => 
        !(entry.site === site && entry.username === username)
      );
      setEntries(updatedEntries);
      setFilteredItems(updatedEntries);
      
      await deleteVaultEntry(site, username);
      
      const userEmail = sessionStorage.getItem('userEmail') || 'anonymous';
      const keyId = `${site}|||${username}`;
      const userSpecificKey = `vaultBreachStates_${userEmail}`;
      const breachStates = JSON.parse(localStorage.getItem(userSpecificKey) || '{}');
      const wasBreached = breachStates[keyId] || false;
      
      delete breachStates[keyId];
      localStorage.setItem(userSpecificKey, JSON.stringify(breachStates));
      
      const userSpecificStatsKey = `vaultOverviewStats_${userEmail}`;
      const currentStats = JSON.parse(localStorage.getItem(userSpecificStatsKey) || '{"totalVaultItems":0,"breachedCount":0,"safeCount":0,"lastScanDate":null}');
      
      currentStats.totalVaultItems = Math.max(0, currentStats.totalVaultItems - 1);
      if (wasBreached) {
        currentStats.breachedCount = Math.max(0, currentStats.breachedCount - 1);
      } else {
        currentStats.safeCount = Math.max(0, currentStats.safeCount - 1);
      }
      currentStats.lastScanDate = new Date().toISOString();
      localStorage.setItem(userSpecificStatsKey, JSON.stringify(currentStats));
      
      window.dispatchEvent(new CustomEvent('breachStatsUpdated', { 
        detail: { 
          site, 
          username, 
          isBreached: false, 
          deleted: true
        } 
      }));
      
      alert("Password deleted.");
      
      setJustDeleted(true);
      setTimeout(() => {
        setJustDeleted(false);
        window.vaultDeleteInProgress = false;
      }, 3000);
      
    } catch (err) {
      console.error("Failed to delete:", err);
      alert(`Failed to delete password: ${err.message || 'Unknown error'}`);
      
      loadVaults();
    }
  };
  
  const handleHide = (index) => {
    const updated = [...entries];
    updated[index].revealedPassword = null;
    setEntries(updated);
  };

  const handleUpdate = async (site, username, newPassword) => {
    try {
      const base64Key = sessionStorage.getItem("masterKey");
      if (!base64Key) {
        alert("Missing encryption key. Please log in again.");
        return;
      }
      
      const key = await importKeyFromBase64(base64Key);
      const encryptedPassword = await encryptWithAES(newPassword, key);
      
      await updatePassword(site, username, encryptedPassword);
      
      alert("Password updated successfully!");
      
      const updatedEntries = entries.map(entry => {
        if (entry.site === site && entry.username === username) {
          return { ...entry, revealedPassword: newPassword };
        }
        return entry;
      });
      setEntries(updatedEntries);
      setFilteredItems(updatedEntries);
      
    } catch (error) {
      console.error("Update error:", error);
      alert(`Failed to update password: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setFilteredItems(entries); 
      return;
    }
  
    const results = await searchVault(query);
    setFilteredItems(results);
  };
  

  return (
    <div className={styles.vaultPage}>
      <div className={styles.header}>
        <h2 className={styles.title}>Vault</h2>
        <button className={styles.addButton} onClick={() => setShowForm(true)}>
          Add Password
        </button>
      </div>
        
      {showForm && (
        <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeButton}
              onClick={() => setShowForm(false)}
              aria-label="Close modal"
            >
              ×
            </button>
            <PasswordForm
              onPasswordSaved={() => {
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}
    <input
        type="text"
        placeholder="⌕ Search by service, username or tags..."
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className={styles.searchInput}
    />

      <div className={styles.vaultList}>
        {filteredItems.map((entry, index) => (
          <VaultEntry
            key={`${entry.site}-${entry.username}`}
            entry={entry}
            index={index}
            onReveal={() => handleReveal(index)}
            onHide={() => handleHide(index)}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  );
}
