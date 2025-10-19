import React, { useEffect, useMemo, useState } from "react";
import styles from "./DashboardPage.module.css";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Tags, Eye, History, Plus, Pencil, X } from "lucide-react";
import { fetchVaultEntries, getPasswordBreachData } from "../services/vault";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [breachCount, setBreachCount] = useState(0);
  const [breachTotal, setBreachTotal] = useState(0);
  const [topTags, setTopTags] = useState([]);
  const [revealCount7d, setRevealCount7d] = useState(0);
  const [recentActions, setRecentActions] = useState([]);
  const [revealDaily, setRevealDaily] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [breachTrend, setBreachTrend] = useState([]);
  const [insights, setInsights] = useState({ totalVault: 0, uniqueSites: 0, actions7d: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError("")
      try {
        const [breachData, vaultItems, auditResp] = await Promise.all([
          getPasswordBreachData().catch(() => []),
          fetchVaultEntries().catch(() => []),
          API.get("/audit/logs/recent?days=30").then(r => r.data).catch(() => [])
        ]);

        if (!isMounted) return;

        // Breached passwords
        const breached = Array.isArray(breachData)
          ? breachData.filter(item => item?.breachData?.is_breached)
          : [];
        setBreachCount(breached.length);
        setBreachTotal(Array.isArray(breachData) ? breachData.length : 0);

        // Top tags
        const tagCounts = new Map();
        if (Array.isArray(vaultItems)) {
          for (const item of vaultItems) {
            const tag = (item?.tag || "other").toLowerCase();
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
        const top = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag, count]) => ({ tag, count }));
        setTopTags(top);

        // Insights
        const totalVault = Array.isArray(vaultItems) ? vaultItems.length : 0;
        const uniqueSites = Array.isArray(vaultItems) ? new Set(vaultItems.map(v => v.site)).size : 0;
        const actions7d = Array.isArray(auditResp)
          ? auditResp.filter(l => new Date(l.timestamp) >= new Date(Date.now() - 7*24*60*60*1000)).length
          : 0;
        setInsights({ totalVault, uniqueSites, actions7d });

        // Reveals (7d)
        const revealEvents = Array.isArray(auditResp)
          ? auditResp.filter(l => typeof l?.action === "string" && l.action.includes("password_revealed:"))
          : [];
        setRevealCount7d(revealEvents.length);

        const today = new Date();
        const dayBuckets = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setHours(0,0,0,0);
          d.setDate(d.getDate() - (6 - i));
          return { dateKey: d.toISOString().slice(0,10), count: 0 };
        });
        for (const evt of revealEvents) {
          const t = new Date(evt.timestamp);
          const key = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString().slice(0,10);
          const bucket = dayBuckets.find(b => b.dateKey === key);
          if (bucket) bucket.count += 1;
        }
        setRevealDaily(dayBuckets.map(b => b.count));

        // Recent actions feed
        const recent = Array.isArray(auditResp)
          ? auditResp
              .filter(l => typeof l?.action === "string" && (
                l.action.includes("password_added:") ||
                l.action.includes("password_updated:") ||
                l.action.includes("password_deleted:")
              ))
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 5)
          : [];
        setRecentActions(recent);

        // Logins (not displayed but useful later)
        const logins = Array.isArray(auditResp)
          ? auditResp
              .filter(l => typeof l?.action === "string" && /logged in/i.test(l.action))
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 5)
          : [];
        setLoginEvents(logins);

        // Breach trend 14d (not currently displayed)
        const days = 14;
        const today2 = new Date();
        const breachBuckets = Array.from({ length: days }, (_, i) => {
          const d = new Date(today2);
          d.setHours(0,0,0,0);
          d.setDate(d.getDate() - (days - 1 - i));
          return { dateKey: d.toISOString().slice(0,10), count: 0 };
        });
        const breachedItems = Array.isArray(breachData) ? breachData.filter(b => b?.breachData?.is_breached) : [];
        for (const item of breachedItems) {
          const ts = item?.breachData?.checked_at || item?.lastChecked;
          if (!ts) continue;
          const t = new Date(ts);
          const key = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString().slice(0,10);
          const bucket = breachBuckets.find(b => b.dateKey === key);
          if (bucket) bucket.count += 1;
        }
        setBreachTrend(breachBuckets.map(b => b.count));
      } catch (e) {
        if (!isMounted) return;
        setError("Failed to load dashboard data");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, []);

  const formattedRecent = useMemo(() => {
    return recentActions.map((log) => {
      const action = String(log.action || "");
      let type = "";
      if (action.includes("password_added:")) type = "Added";
      else if (action.includes("password_updated:")) type = "Updated";
      else if (action.includes("password_deleted:")) type = "Deleted";

      let details = "";
      const parts = action.split(":");
      if (parts.length > 1) {
        const siteUser = parts[1];
        const [site, username] = siteUser.split("/");
        details = `${site} (${username})`;
      }
      return {
        id: `${log.timestamp}-${log.action}`,
        type,
        details,
        timestamp: log.timestamp,
      };
    });
  }, [recentActions]);

  const breachPercent = useMemo(() => {
    if (!breachTotal) return 0;
    return Math.round((breachCount / Math.max(1, breachTotal)) * 100);
  }, [breachCount, breachTotal]);

  const renderRing = () => {
    const size = 96; const stroke = 10; const r = (size - stroke) / 2; const c = Math.PI * 2 * r;
    const pct = Math.max(0, Math.min(100, breachPercent));
    const offset = c - (pct / 100) * c;
    return (
      <svg width={size} height={size} className={styles.ring}>
        <circle cx={size/2} cy={size/2} r={r} className={styles.ringBg} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} className={styles.ringFg} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={offset} />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className={styles.ringText}>{loading ? '—' : `${pct}%`}</text>
      </svg>
    );
  };

  function TopTagsBars({ loading, items }) {
    if (loading) return <span className={styles.muted}>Loading…</span>;
    if (!items || items.length === 0) return <span className={styles.muted}>No data</span>;
    const max = Math.max(1, ...items.map(i => i.count));
    const colorFor = (tag) => {
      const t = String(tag || '').toLowerCase();
      if (t.includes('finance')) return styles.tagFinance;
      if (t.includes('social')) return styles.tagSocial;
      if (t.includes('work')) return styles.tagWork;
      return styles.tagOther;
    };
    return (
      <ul className={styles.tagBars}>
        {items.map(({ tag, count }) => {
          const widthPct = Math.round((count / max) * 100);
          return (
            <li key={tag} className={styles.tagBarRow} title={`${tag}: ${count}`}>
              <div className={styles.tagBarLabel}>{tag}</div>
              <div className={styles.tagBarTrack}>
                <div className={`${styles.tagBarFill} ${colorFor(tag)}`} style={{ width: `${widthPct}%` }} />
              </div>
              <div className={styles.tagBarCount}>{count}</div>
            </li>
          );
        })}
      </ul>
    );
  }

  const renderRevealsArea = () => {
    const w = 180; const h = 56; const padding = 2;
    const data = revealDaily.length ? revealDaily : [0,0,0,0,0,0,0];
    const max = Math.max(1, ...data);
    const stepX = (w - padding * 2) / (data.length - 1 || 1);
    const pts = data.map((v, i) => {
      const x = padding + i * stepX;
      const y = h - padding - (v / max) * (h - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    const area = `M ${padding},${h - padding} L ${pts} L ${w - padding},${h - padding} Z`;
    return (
      <svg className={styles.area} width={w} height={h}>
        <defs>
          <linearGradient id="revealGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#revealGradient)" className={styles.areaFill} />
        <polyline fill="none" className={styles.areaLine} points={pts} />
      </svg>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.dashboardContent}>
        <h1 className={styles.title}>Dashboard</h1>
        {error && (
          <div className={styles.error}>{error}</div>
        )}
        <div className={styles.grid}>
          <button
            className={`${styles.card} ${styles.cardBreached} ${styles.linkCard}`}
            onClick={() => {
              navigate("/main", { state: { activePage: "breach-watch" } });
            }}
          >
            <div className={styles.cardHeader}><ShieldAlert size={16} className={styles.icon}/><span>Breached passwords</span></div>
            <div className={styles.metricRow}>
              {renderRing()}
              <div className={styles.metricCol}>
                <div className={styles.metric}>{loading ? "—" : breachCount}</div>
                <div className={styles.mutedSmall}>of {breachTotal} items</div>
              </div>
            </div>
            <div className={styles.cardHint}>Open BreachWatch</div>
          </button>

          <button
            className={`${styles.card} ${styles.cardReveals} ${styles.linkCard}`}
            onClick={() => {
              navigate("/main", { state: { activePage: "audit-log" } });
            }}
          >
            <div className={styles.cardHeader}><Eye size={16} className={styles.icon}/><span>Password reveals (7d)</span></div>
            <div className={styles.metricRow}>
              <div className={styles.metric}>{loading ? "—" : revealCount7d}</div>
              {renderRevealsArea()}
            </div>
            <div className={styles.cardHint}>View Audit Log</div>
          </button>

          <div className={`${styles.card} ${styles.cardTags}`}>
            <div className={styles.cardHeader}><Tags size={16} className={styles.icon}/><span>Top tags</span></div>
            <TopTagsBars loading={loading} items={topTags} />
          </div>

          <button
            className={`${styles.card} ${styles.cardActions} ${styles.linkCard}`}
            onClick={() => {
              navigate("/main", { state: { activePage: "audit-log" } });
            }}
          >
            <div className={styles.cardHeader}><History size={16} className={styles.icon}/><span>Recent actions</span></div>
            <div className={styles.actions}>
              {loading && <span className={styles.muted}>Loading…</span>}
              {!loading && formattedRecent.length === 0 && (
                <span className={styles.muted}>No recent add/update/delete</span>
              )}
              {!loading && formattedRecent.length > 0 && (
                <ul className={styles.actionList}>
                  {formattedRecent.map(item => {
                    const typeLower = item.type.toLowerCase();
                    const Icon = typeLower === 'added' ? Plus : typeLower === 'updated' ? Pencil : X;
                    return (
                      <li key={item.id} className={styles.actionItem}>
                        <span className={`${styles.actionIcon} ${typeLower === 'added' ? styles.iconAdd : typeLower === 'updated' ? styles.iconUpdate : styles.iconDelete}`}>
                          <Icon size={14} />
                        </span>
                        <div className={styles.actionText}>
                          <div className={styles.actionLine}>
                            <span className={styles.actionType}>{item.type}</span>
                            <span className={styles.actionDetails}>{item.details}</span>
                          </div>
                          <div className={styles.actionTimestamp}>{new Date(item.timestamp).toLocaleString()}</div>
                        </div>
                        <span className={`${styles.statusDot} ${typeLower === 'added' ? styles.statusAdd : typeLower === 'updated' ? styles.statusUpdate : styles.statusDelete}`}></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </button>

          <div className={`${styles.card} ${styles.cardInsights}`}>
            <div className={styles.cardHeader}><History size={16} className={styles.icon}/><span>Insights</span></div>
            <div className={styles.insightsRow}>
              <div className={styles.insightChip}>
                <div className={styles.insightLabel}>Total Items</div>
                <div className={styles.insightValue}>{insights.totalVault}</div>
              </div>
              <div className={styles.insightChip}>
                <div className={styles.insightLabel}>Unique Sites</div>
                <div className={styles.insightValue}>{insights.uniqueSites}</div>
              </div>
              <div className={styles.insightChip}>
                <div className={styles.insightLabel}>Events (7d)</div>
                <div className={styles.insightValue}>{insights.actions7d}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
