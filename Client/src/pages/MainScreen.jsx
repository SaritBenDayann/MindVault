import React, { useState } from "react";
import DashboardPage from "./DashboardPage";
import VaultPage from "./VaultPage";
import BreachWatchPage from "./BreachWatchPage";
import SettingsPage from "./SettingsPage";
import styles from "./MainScreen.module.css";
import AuditLogPage from "./AuditLogPage";
import logo from "../assets/mindvault-logo.png";
import { logoutUser } from "../services/api";
import {
    Lock,
    LayoutDashboard,
    ShieldAlert,
    ScrollText,
    Settings,
    LogOut,
  } from "lucide-react";
import { useEffect } from "react";
import io from "socket.io-client";

export default function MainScreen() {
  const [activePage, setActivePage] = useState(() => {
    const savedActivePage = sessionStorage.getItem('activePage');
    if (savedActivePage) {
      sessionStorage.removeItem('activePage');
      return savedActivePage;
    }
    return "vault";
  });
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    if (!token) return;

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(API_URL, {
      auth: { token: token }
    });

    socket.on("security_alert", (data) => {
      console.error("CRITICAL ALERT:", data);
      
      if (data.type === "BREACH_DETECTED") {
        alert(`🚨 SECURITY ALERT 🚨\n\n${data.message}`);
      }
    });

    socket.on("connect_error", (err) => {
      console.log("Socket connection failed:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const renderScreen = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "vault":
        return <VaultPage
            showForm={showVaultForm}
            setShowForm={setShowVaultForm}
            searchTerm={searchTerm}
          />
      case "breach-watch":
        return <BreachWatchPage />;
      case "settings":
        return <SettingsPage />;
      case "audit-log":
        return <AuditLogPage />;
      default:
        return <VaultPage />;
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <button
          className={styles.createNewButton}
          onClick={() => {
            setActivePage("vault");
            setShowVaultForm(true);
          }}
        >
          + Create New
        </button>

        <ul className={styles.navList}>
        <li
            className={activePage === "vault" ? styles.active : ""}
            onClick={() => setActivePage("vault")}
        >
            <Lock className={styles.navIcon} size={20} />
            My Vault
        </li>
        <li
            className={activePage === "dashboard" ? styles.active : ""}
            onClick={() => setActivePage("dashboard")}
        >
            <LayoutDashboard className={styles.navIcon} size={20} />
            Dashboard
        </li>
        <li
            className={activePage === "breach-watch" ? styles.active : ""}
            onClick={() => setActivePage("breach-watch")}
        >
            <ShieldAlert className={styles.navIcon} size={20} />
            BreachWatch
        </li>
        <li
            className={activePage === "audit-log" ? styles.active : ""}
            onClick={() => setActivePage("audit-log")}
        >
            <ScrollText className={styles.navIcon} size={20} />
            Audit Log
        </li>
        <li
            className={activePage === "settings" ? styles.active : ""}
            onClick={() => setActivePage("settings")}
        >
            <Settings className={styles.navIcon} size={20} />
            Settings
        </li>
        </ul>

        <button className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={18} style={{ marginRight: "8px", verticalAlign: "middle" }} />
            Logout
        </button>


      </div>

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logoContainer}>
              <div className={styles.logoIcon}>
                <img src={logo} alt="MindVault Logo" className={styles.logoImage} />
              </div>
              <div className={styles.logoTextContainer}>
                <span className={styles.logoText}>
                  MindVault
                </span>
                <span className={styles.logoTagline}>
                  Cybersecurity Starts Here
                </span>
              </div>
            </div>

            <div className={styles.searchBar}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                type="text"
                placeholder="Search"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className={styles.pageContent}>{renderScreen()}</div>
      </div>
    </div>
  );
}
