import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import styles from "./AuditLogPage.module.css";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDays, setSelectedDays] = useState(0); 
  const navigate = useNavigate();

  const handleAuthFailure = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("masterKey");
    
    navigate("/login", { 
      state: { 
        error: "Your session has expired. Please log in again." 
      } 
    });
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = sessionStorage.getItem("authToken");
        console.log("Auth token exists:", !!token);
        
        console.log(`Fetching audit logs for ${selectedDays} days (type: ${typeof selectedDays})`);
        const url = `/audit/logs/recent?days=${selectedDays}`;
        console.log(`API URL: ${url}`);
        const { data } = await API.get(url);
        console.log(`Received ${data.length} logs`);
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        if (error.response?.status === 401) {
          console.error("Authentication failed - redirecting to login");
          handleAuthFailure();
          return; 
        }
        setLogs([]);
      }
    };
    
    fetchLogs();
  
    socket.on("audit_log", (data) => {
      console.log("Received log:", data);
      try {
        const logTime = new Date(data.timestamp);
        const cutoff = new Date(Date.now() - (selectedDays * 24 * 60 * 60 * 1000));
        
        if (selectedDays === 0 || logTime >= cutoff) {
          setLogs((prevLogs) => [data, ...prevLogs]);
        }
      } catch (error) {
        console.error('Error processing socket log:', error);
      }
    });
  
    return () => {
      socket.off("audit_log");
    };
  }, [selectedDays]);
  
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date(timestamp).toLocaleString();
    }
  };
  


  const getActionColor = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) return '#4ade80';
    if (actionLower.includes('logout')) return '#f87171';
    if (actionLower.includes('create') || actionLower.includes('add')) return '#60a5fa';
    if (actionLower.includes('update') || actionLower.includes('edit')) return '#fbbf24';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return '#f87171';
    if (actionLower.includes('view') || actionLower.includes('read')) return '#a78bfa';
    if (actionLower.includes('export')) return '#34d399';
    if (actionLower.includes('import')) return '#fb7185';
    return '#94a3b8';
  };

  const getTimeAgo = (timestamp) => {
    try {
      const now = new Date();
      const logTime = new Date(timestamp);
      const diffInSeconds = Math.floor((now - logTime) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (error) {
      console.error('Error calculating time ago:', error);
      return 'Unknown';
    }
  };

  const formatActionText = (action) => {
    if (action.includes('password_added:')) {
      const parts = action.split(':');
      if (parts.length > 1) {
        const siteUser = parts[1];
        const [site, username] = siteUser.split('/');
        return {
          action: 'Password Added',
          details: `${site} (${username})`
        };
      }
    }
    
    if (action.includes('password_updated:')) {
      const parts = action.split(':');
      if (parts.length > 1) {
        const siteUser = parts[1];
        const [site, username] = siteUser.split('/');
        return {
          action: 'Password Updated',
          details: `${site} (${username})`
        };
      }
    }
    
    if (action.includes('password_deleted:')) {
      const parts = action.split(':');
      if (parts.length > 1) {
        const siteUser = parts[1];
        const [site, username] = siteUser.split('/');
        return {
          action: 'Password Deleted',
          details: `${site} (${username})`
        };
      }
    }
    
    if (action.includes('password_revealed:')) {
      const parts = action.split(':');
      if (parts.length > 1) {
        const siteUser = parts[1];
        const [site, username] = siteUser.split('/');
        return {
          action: 'Password Revealed',
          details: `${site} (${username})`
        };
      }
    }
    
    return {
      action: action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '),
      details: null
    };
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className={styles.auditLogPage}>
      <div className={styles.header}>
        <h2 className={styles.title}>Audit Log</h2>
        <div className={styles.controls}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.filterBox}>
            <span className={styles.filterIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
            </span>
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(parseFloat(e.target.value))}
              className={styles.filterSelect}
            >
              <option value={0}>All Time</option>
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last Month</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <h3>No logs found</h3>
            <p>No audit logs match your current filters</p>
          </div>
        ) : (
          <div className={styles.logsList}>
            {filteredLogs.map((log, idx) => {
              const formattedAction = formatActionText(log.action);
              return (
                <div key={idx} className={styles.logEntry}>
                  <div className={styles.logContent}>
                    <div className={styles.logHeader}>
                      <div className={styles.logActionContainer}>
                        <span className={styles.logAction}>{formattedAction.action}</span>
                        {formattedAction.details && (
                          <span className={styles.logActionDetails}>{formattedAction.details}</span>
                        )}
                      </div>
                      <span className={styles.logTime}>{getTimeAgo(log.timestamp)}</span>
                    </div>
                    <div className={styles.logDetails}>
                      <span className={styles.logUser}>👤 {log.user}</span>
                      <span className={styles.logTimestamp}>🕒 {formatDate(log.timestamp)}</span>
                      {log.ip && <span className={styles.logIp}>🌐 {log.ip}</span>}
                    </div>
                  </div>
                  <div className={styles.logStatus}>
                    <div className={styles.statusDot}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}