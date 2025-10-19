import React, { useState, useEffect } from 'react';
import styles from './BreachWatchPage.module.css';
import { checkPasswordBreach, getPasswordBreachData } from '../services/vault';
import { 
  Shield, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Lock, 
  Mail, 
  X,
  Check,
  AlertCircle
} from 'lucide-react';

const BreachWatchPage = () => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordResults, setPasswordResults] = useState(null);
  const [error, setError] = useState('');
  const [showBreachPopup, setShowBreachPopup] = useState(false);
  const [breachedPasswords, setBreachedPasswords] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    totalVaultItems: 0,
    breachedCount: 0,
    safeCount: 0,
    lastScanDate: null
  });

  useEffect(() => {
    loadBreachDataFromDatabase();
    
    const handleBreachStatsUpdate = (event) => {
      console.log('Breach stats update event received:', event.detail);
      loadBreachDataFromDatabase();
    };
    
    window.addEventListener('breachStatsUpdated', handleBreachStatsUpdate);
    
    return () => {
      window.removeEventListener('breachStatsUpdated', handleBreachStatsUpdate);
    };
  }, []);

  const loadBreachDataFromDatabase = async () => {
    try {
      const breachData = await getPasswordBreachData();
      
      const totalItems = breachData.length;
      const breachedItems = breachData.filter(item => item.breachData.is_breached);
      const breachedCount = breachedItems.length;
      const safeCount = totalItems - breachedCount;
      
      const lastScanDate = breachData.length > 0 
        ? breachData.reduce((latest, item) => {
            const itemDate = new Date(item.lastChecked);
            return itemDate > latest ? itemDate : latest;
          }, new Date(0))
        : null;
      
      setOverviewStats({
        totalVaultItems: totalItems,
        breachedCount: breachedCount,
        safeCount: safeCount,
        lastScanDate: lastScanDate ? lastScanDate.toISOString() : null
      });
      
      const breachedList = breachedItems.map(item => ({
        site: item.site,
        username: item.username
      }));
      setBreachedPasswords(breachedList);
      
    } catch (error) {
      console.error('Error loading breach data from database:', error);
      setOverviewStats({
        totalVaultItems: 0,
        breachedCount: 0,
        safeCount: 0,
        lastScanDate: null
      });
      setBreachedPasswords([]);
    }
  };


  const handleBreachedClick = () => {
    if (overviewStats.breachedCount > 0) {
      setShowBreachPopup(true);
    }
  };

  const checkEmailBreaches = () => {
    if (!emailInput.trim()) {
      setError('Please enter an email address');
      return;
    }

    setError('');
    
    const hibpUrl = `https://haveibeenpwned.com/account/${encodeURIComponent(emailInput)}`;
    window.open(hibpUrl, '_blank');
  };

  const checkPasswordBreachManual = async () => {
    if (!passwordInput.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await checkPasswordBreach(passwordInput, 'manual_check', 'manual_check');
      setPasswordResults(result);
      
      await loadBreachDataFromDatabase();
    } catch (error) {
      setError(error.error || 'Failed to check password breach');
    } finally {
      setLoading(false);
    }
  };



  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>
          <div className={styles.headerIcon}>
            <Shield size={24} />
          </div>
          Breach Watch
        </h1>
        <p className={styles.headerSubtitle}>
          Monitor your vault's security status with real-time breach detection and comprehensive analytics
        </p>
      </header>

      <section className={styles.statsSection} aria-labelledby="stats-heading">
        <h2 id="stats-heading" className={styles.sectionTitle}>Security Statistics</h2>
        <p className={styles.sectionDescription}>
          Overview of your password vault's security status and breach detection results
        </p>
        <div className={styles.statsGrid}>
          <div className={styles.statCard} role="region" aria-label="Total vault items">
            <div className={styles.statHeader}>
              <div className={styles.statIcon} aria-hidden="true">
                <Database size={24} />
              </div>
              <h3 className={styles.statTitle}>Total Vault Items</h3>
            </div>
            <div className={styles.statValue} aria-live="polite">{overviewStats.totalVaultItems}</div>
            <p className={styles.statLabel}>Passwords Stored</p>
          </div>
          
          <div className={`${styles.statCard} ${styles.safe}`} role="region" aria-label="Secure passwords">
            <div className={styles.statHeader}>
              <div className={styles.statIcon} aria-hidden="true">
                <CheckCircle size={24} />
              </div>
              <h3 className={styles.statTitle}>Secure Passwords</h3>
            </div>
            <div className={styles.statValue} aria-live="polite">{overviewStats.safeCount}</div>
            <p className={styles.statLabel}>No Breaches Found</p>
          </div>
          
          <div 
            className={`${styles.statCard} ${styles.breached} ${overviewStats.breachedCount > 0 ? styles.clickable : ''}`}
            onClick={handleBreachedClick}
            role="button"
            tabIndex={overviewStats.breachedCount > 0 ? 0 : -1}
            aria-label={`${overviewStats.breachedCount} compromised passwords. Click to view details.`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBreachedClick();
              }
            }}
          >
            <div className={styles.statHeader}>
              <div className={styles.statIcon} aria-hidden="true">
                <AlertTriangle size={24} />
              </div>
              <h3 className={styles.statTitle}>Compromised</h3>
            </div>
            <div className={styles.statValue} aria-live="polite">{overviewStats.breachedCount}</div>
            <p className={styles.statLabel}>
              {overviewStats.breachedCount > 0 ? 'Click to view details' : 'Need Immediate Action'}
            </p>
          </div>
          
          <div className={styles.statCard} role="region" aria-label="Last security check">
            <div className={styles.statHeader}>
              <div className={styles.statIcon} aria-hidden="true">
                <Clock size={24} />
              </div>
              <h3 className={styles.statTitle}>Last Security Check</h3>
            </div>
            <div className={styles.statText} aria-live="polite">
              {overviewStats.lastScanDate 
                ? formatDate(overviewStats.lastScanDate)
                : 'Never scanned'
              }
            </div>
            <p className={styles.statLabel}>Automatically Updated</p>
          </div>
        </div>
      </section>

      <section className={styles.toolsSection} aria-labelledby="tools-heading">
        <h2 id="tools-heading" className={styles.sectionTitle}>Security Tools</h2>
        <p className={styles.sectionDescription}>
          Protect your accounts with our advanced security features
        </p>
        

        <div className={styles.toolsGrid}>
          <div className={styles.toolCard} role="region" aria-labelledby="password-checker-title">
            <div className={styles.toolHeader}>
              <div className={styles.toolIcon} aria-hidden="true">
                <Lock size={20} />
              </div>
              <h3 id="password-checker-title" className={styles.toolTitle}>Password Security Check</h3>
            </div>
            <p className={styles.toolDescription}>
              Check if your password has been compromised using HIBP's free API. 
              Your password is never sent to our servers.
            </p>
            
            <div className={styles.toolInput}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password to check"
                aria-label="Password to check for breaches"
              />
              <button 
                onClick={checkPasswordBreachManual}
                disabled={loading}
                className={styles.toolButton}
                aria-describedby="password-checker-title"
              >
                {loading ? 'Checking...' : 'Check Security'}
              </button>
            </div>

            {passwordResults && (
              <div 
                className={`${styles.resultCard} ${passwordResults.is_breached ? styles.danger : styles.safe}`}
                role="alert"
                aria-live="polite"
              >
                <div className={styles.resultHeader}>
                  <div className={styles.resultIcon} aria-hidden="true">
                    {passwordResults.is_breached ? <AlertCircle size={16} /> : <Check size={16} />}
                  </div>
                  <span className={styles.resultTitle}>
                    {passwordResults.is_breached ? 'Compromised' : 'Secure'}
                  </span>
                </div>
                <p className={styles.resultMessage}>{passwordResults.message}</p>
                {passwordResults.is_breached && (
                  <div className={styles.passwordWarning}>
                    <strong>Recommendation:</strong> Change this password immediately and use a unique, strong password.
                  </div>
                )}
              </div>
            )}

            <div className={styles.infoBox}>
              <h4>Password Security Best Practices</h4>
              <ul>
                <li>Use unique passwords for each account</li>
                <li>Enable two-factor authentication when available</li>
                <li>Regularly update passwords for critical accounts</li>
              </ul>
            </div>
          </div>

          <div className={styles.toolCard} role="region" aria-labelledby="email-checker-title">
            <div className={styles.toolHeader}>
              <div className={styles.toolIcon} aria-hidden="true">
                <Mail size={20} />
              </div>
              <h3 id="email-checker-title" className={styles.toolTitle}>Email Breach Check</h3>
            </div>
            <p className={styles.toolDescription}>
              Check if your email has been involved in data breaches. 
              Opens the official Have I Been Pwned website.
            </p>
            
            <div className={styles.toolInput}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter email address"
                aria-label="Email address to check for breaches"
              />
              <button 
                onClick={checkEmailBreaches}
                className={styles.toolButton}
                aria-describedby="email-checker-title"
              >
                ⌕ Check on HIBP
              </button>
            </div>

            <div className={styles.infoBox}>
              <h4>About Email Checking</h4>
              <ul>
                <li>Access the official HIBP database</li>
                <li>Get detailed breach information</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.statusSection} aria-labelledby="status-heading">
        <h2 id="status-heading" className={styles.sectionTitle}>Security Status</h2>
        <p className={styles.sectionDescription}>
          Current security assessment of your password vault
        </p>
        
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            <h3 className={styles.statusTitle}>
              <div className={styles.statusIcon} aria-hidden="true">
                <Shield size={20} />
              </div>
              Security Status
            </h3>
            <div 
              className={`${styles.statusBadge} ${overviewStats.breachedCount > 0 ? styles.warning : styles.secure}`}
              role="status"
              aria-live="polite"
            >
              {overviewStats.breachedCount > 0 ? 'Action Required' : 'All Secure'}
            </div>
          </div>
          <p className={styles.statusMessage}>
            {overviewStats.breachedCount > 0 
              ? `You have ${overviewStats.breachedCount} compromised password${overviewStats.breachedCount !== 1 ? 's' : ''} that need immediate attention.`
              : 'All your passwords are secure and have not been found in any known data breaches.'
            }
          </p>
        </div>
      </section>

      {error && (
        <div className={styles.errorMessage} role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {showBreachPopup && (
        <div 
          className={styles.popupOverlay} 
          onClick={() => setShowBreachPopup(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="popup-title"
          aria-describedby="popup-description"
        >
          <div className={styles.popupContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <h3 id="popup-title">
                <AlertTriangle size={20} style={{ marginRight: '12px', color: 'var(--danger, #FF5C58)' }} />
                Compromised Passwords
              </h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowBreachPopup(false)}
                aria-label="Close breach details popup"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className={styles.popupBody}>
              <p id="popup-description" className={styles.popupDescription}>
                The following passwords have been found in data breaches and need immediate attention:
              </p>
              
              <div className={styles.breachList} role="list">
                {breachedPasswords.map((item, index) => (
                  <div key={index} className={styles.breachItem} role="listitem">
                    <div className={styles.breachInfo}>
                      <div className={styles.breachSite}>{item.site}</div>
                      <div className={styles.breachUsername}>{item.username}</div>
                    </div>
                    <div className={styles.breachActions}>
                      <button 
                        className={styles.actionButton}
                        onClick={() => {
                          setShowBreachPopup(false);
                          sessionStorage.setItem('editVaultItem', JSON.stringify({
                            site: item.site,
                            username: item.username,
                            isBreached: true
                          }));
                          sessionStorage.setItem('activePage', 'vault');
                          window.location.href = '/main';
                        }}
                        aria-label={`Edit password for ${item.site} - ${item.username}`}
                      >
                        Edit Password
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className={styles.popupFooter}>
                <p className={styles.recommendation}>
                  <strong>Recommendation:</strong> Change all compromised passwords immediately and use unique, strong passwords for each account.
                </p>
              </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default BreachWatchPage;