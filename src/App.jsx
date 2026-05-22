import { useState, useCallback, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const FREE_CALLER_REGISTRY = "https://freecallerregistry.com/";
const TRUECALLER_URL = "https://www.truecaller.com/search/us/";
const NOMOROBO_URL = "https://www.nomorobo.com/lookup/";
const HIYA_URL = "https://hiya.com/";

const CLIENTS = ["AltiSales Outbound", "Dili", "Factura", "Modern Campus", "BEMO", "ASAPP", "Other"];
const RECHECK_OPTIONS = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const LS_KEY = "caddy_numbers_v2";
const loadNumbers = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
};
const saveNumbers = (data) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPhone = (val) => {
  const d = val.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const toDigits = (v) => v.replace(/\D/g, "");

const fmtDigits = (d) => d.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");

const getRisk = (score) => {
  if (score >= 75) return { label: "HIGH RISK", color: "#ff3b30", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  if (score >= 40) return { label: "MODERATE", color: "#ff9f0a", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };
  return { label: "CLEAN", color: "#30d158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" };
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Flag = ({ warn, children }) => (
  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: warn ? "#ff9f0a" : "#30d158" }}>
    {warn ? "⚠ " : "✓ "}{children}
  </span>
);

const LinkBtn = ({ icon, label, sub, href, accent = "#0a84ff" }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{
    display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
    background: `${accent}0d`, border: `1px solid ${accent}2a`,
    borderRadius: 9, textDecoration: "none", flex: 1, minWidth: 130
  }}>
    <span style={{ fontSize: 17 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: accent }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace", marginTop: 1 }}>{sub}</div>}
    </div>
    <span style={{ marginLeft: "auto", color: accent, fontSize: 11, opacity: 0.5 }}>↗</span>
  </a>
);

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: "5px 14px",
    border: active ? "1px solid rgba(10,132,255,0.35)" : "1px solid transparent",
    borderRadius: 6, background: active ? "rgba(10,132,255,0.15)" : "transparent",
    color: active ? "#0a84ff" : "#2a3450", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap"
  }}>{children}</button>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 8, color: "#1e2738", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>{children}</div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 14, ...style }}>
    {children}
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("single");
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [result, setResult] = useState(null);
  const [bulkResults, setBulkResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState(null);

  // Persistent number store: { [digits]: { digits, number, lastChecked, lastScore, lastData, client, recheckDate, notes, connectRate } }
  const [numbers, setNumbers] = useState(loadNumbers);

  useEffect(() => { saveNumbers(numbers); }, [numbers]);

  const updateNumber = (digits, patch) => {
    setNumbers(prev => ({
      ...prev,
      [digits]: { ...(prev[digits] || {}), ...patch }
    }));
  };

  const digits = toDigits(input);
  const entry = numbers[digits] || {};

  const checkNumber = useCallback(async (num) => {
    const res = await fetch(`/api/lookup?phone=${num}`);
    return res.json();
  }, []);

  const checkSingle = useCallback(async () => {
    if (digits.length < 10) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await checkNumber(digits);
      if (data.error || !data.success) {
        setError(data.message || data.error || "API error");
      } else {
        setResult(data);
        updateNumber(digits, {
          digits,
          number: input,
          lastChecked: new Date().toISOString(),
          lastScore: data.fraud_score,
          lastData: data,
        });
      }
    } catch { setError("Network error — check connection."); }
    setLoading(false);
  }, [digits, input, checkNumber]);

  const checkBulk = async () => {
    const nums = bulkInput.split(/[\n,]+/).map(n => toDigits(n.trim())).filter(n => n.length >= 10).slice(0, 20);
    if (!nums.length) return;
    setBulkLoading(true); setBulkResults([]);
    const out = [];
    for (const num of nums) {
      try {
        const data = await checkNumber(num);
        out.push({ num, data });
        if (data.success) {
          updateNumber(num, { digits: num, number: fmtDigits(num), lastChecked: new Date().toISOString(), lastScore: data.fraud_score, lastData: data });
        }
      } catch { out.push({ num, data: null }); }
      setBulkResults([...out]);
      await new Promise(r => setTimeout(r, 350));
    }
    setBulkLoading(false);
  };

  // Morning audit: numbers with recheckDate <= today
  const today = new Date().toISOString().split("T")[0];
  const auditNumbers = Object.values(numbers).filter(n => n.recheckDate && n.recheckDate <= today);
  const auditDue = auditNumbers.length;

  const [auditResults, setAuditResults] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const runAudit = async () => {
    if (!auditNumbers.length) return;
    setAuditLoading(true); setAuditResults([]);
    const out = [];
    for (const entry of auditNumbers) {
      try {
        const data = await checkNumber(entry.digits);
        out.push({ entry, data });
        if (data.success) {
          updateNumber(entry.digits, { lastChecked: new Date().toISOString(), lastScore: data.fraud_score, lastData: data });
        }
      } catch { out.push({ entry, data: null }); }
      setAuditResults([...out]);
      await new Promise(r => setTimeout(r, 350));
    }
    setAuditLoading(false);
  };

  const flaggedForReg = auditResults.filter(r => r.data?.success && (r.data.fraud_score >= 40 || r.data.VOIP || r.data.recent_abuse));

  const risk = result ? getRisk(result.fraud_score) : null;
  const needsReg = result && (result.fraud_score >= 40 || result.VOIP || result.recent_abuse || result.spammer);

  // Connect rate helpers
  const cr = entry.connectRate || { dials: "", connects: "" };
  const connectPct = cr.dials && cr.connects ? Math.round((parseInt(cr.connects) / parseInt(cr.dials)) * 100) : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#070b12", color: "#c8d0e0",
      fontFamily: "'DM Sans',sans-serif",
      backgroundImage: `
        radial-gradient(ellipse 70% 40% at 50% -5%, rgba(10,132,255,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 40% 30% at 90% 95%, rgba(48,209,88,0.04) 0%, transparent 50%)
      `
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "14px 22px",
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(7,11,18,0.92)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg,#0a84ff,#30d158)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, boxShadow: "0 0 16px rgba(10,132,255,0.25)"
        }}>📞</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e8edf5" }}>Caddy Number Health</div>
          <div style={{ fontSize: 8, color: "#2a3450", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5 }}>POWERED BY GTMCADDY · ALTISALES</div>
        </div>

        {/* Morning audit badge */}
        {auditDue > 0 && (
          <button onClick={() => setTab("audit")} style={{
            marginLeft: 8, padding: "4px 10px",
            background: "rgba(255,159,10,0.12)", border: "1px solid rgba(255,159,10,0.3)",
            borderRadius: 6, color: "#ff9f0a", fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5
          }}>☀ {auditDue} DUE TODAY</button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3, flexWrap: "wrap" }}>
          {[["single","Check"],["bulk","Bulk"],["inventory","Inventory"],["audit","Morning Audit"]].map(([k,l]) => (
            <TabBtn key={k} active={tab===k} onClick={() => setTab(k)}>{l}</TabBtn>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "30px 16px 60px" }}>

        {/* ══════════════ SINGLE CHECK ══════════════ */}
        {tab === "single" && <>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            <input
              value={input}
              onChange={e => { setInput(formatPhone(e.target.value)); setResult(null); setError(null); }}
              onKeyDown={e => e.key === "Enter" && checkSingle()}
              placeholder="(720) 000-0000"
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                padding: "13px 15px", fontSize: 22,
                fontFamily: "'IBM Plex Mono',monospace", color: "#e8edf5",
                letterSpacing: 2, outline: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.45)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <button onClick={checkSingle} disabled={loading || digits.length < 10} style={{
              padding: "13px 18px",
              background: loading ? "rgba(10,132,255,0.12)" : "linear-gradient(135deg,#0a84ff,#0060cc)",
              border: "none", borderRadius: 10, color: "#fff",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600,
              letterSpacing: 1.5, cursor: digits.length < 10 ? "not-allowed" : "pointer",
              opacity: digits.length < 10 ? 0.3 : 1,
              boxShadow: digits.length >= 10 ? "0 0 16px rgba(10,132,255,0.2)" : "none"
            }}>{loading ? "SCANNING..." : "CHECK"}</button>
          </div>

          {error && <div style={{ padding: "12px 16px", background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "#ff3b30" }}>⚠ {error}</div>}

          {loading && (
            <div style={{ textAlign: "center", padding: "44px 0" }}>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {["IPQS DATABASE","FRAUD INDEX","CARRIER DATA","ABUSE SIGNALS"].map((s,i) => (
                  <div key={s} style={{ padding: "4px 10px", background: "rgba(10,132,255,0.07)", border: "1px solid rgba(10,132,255,0.15)", borderRadius: 4, fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: "#0a84ff", letterSpacing: 1.5, animation: `blink 1.2s ${i*0.25}s infinite` }}>{s}</div>
                ))}
              </div>
              <style>{`@keyframes blink{0%,100%{opacity:.12}50%{opacity:1}}`}</style>
            </div>
          )}

          {result && !loading && <>
            {/* Score card */}
            <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 14, padding: "20px 20px", display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 52, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: risk.color, lineHeight: 1, textShadow: `0 0 24px ${risk.color}44` }}>{result.fraud_score}</div>
                <div style={{ fontSize: 7, color: risk.color, opacity: 0.7, letterSpacing: 2, marginTop: 2, fontFamily: "'IBM Plex Mono',monospace" }}>FRAUD SCORE</div>
                <div style={{ marginTop: 6, padding: "2px 6px", background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 4, fontSize: 7, color: risk.color, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, letterSpacing: 2 }}>{risk.label}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: "#e8edf5", marginBottom: 8 }}>{input}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                  {[
                    ["Carrier", result.carrier||"N/A", false],
                    ["Line Type", result.line_type||"N/A", result.line_type==="VOIP"],
                    ["Location", result.city?`${result.city}, ${result.region}`:result.region||"N/A", false],
                    ["Active", result.active?"Active":"Inactive", !result.active],
                    ["VOIP", result.VOIP?"Yes":"No", result.VOIP],
                    ["Recent Abuse", result.recent_abuse?"Yes":"No", result.recent_abuse],
                    ["Spammer", result.spammer?"Yes":"No", result.spammer],
                    ["Leaked", result.leaked?"Yes":"No", result.leaked],
                    ["Do Not Call", result.do_not_call?"Yes":"No", result.do_not_call],
                    ["Prepaid", result.prepaid?"Yes":"No", result.prepaid],
                  ].map(([k,v,warn]) => (
                    <div key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#2a3450", fontFamily: "'IBM Plex Mono',monospace", minWidth: 70 }}>{k}</span>
                      <Flag warn={warn}>{v}</Flag>
                    </div>
                  ))}
                </div>
                {result.name && result.name !== "N/A" && (
                  <div style={{ marginTop: 8, padding: "4px 9px", background: "rgba(10,132,255,0.08)", borderRadius: 5, display: "inline-block" }}>
                    <span style={{ fontSize: 9, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace" }}>Owner: </span>
                    <span style={{ fontSize: 9, color: "#0a84ff", fontFamily: "'IBM Plex Mono',monospace" }}>{result.name}</span>
                  </div>
                )}
              </div>
            </div>

            {needsReg && (
              <div style={{ padding: "12px 14px", background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 10, display: "flex", gap: 10, marginBottom: 12 }}>
                <span>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ff3b30", marginBottom: 2 }}>Registration Recommended</div>
                  <div style={{ fontSize: 11, color: "#7a3a3a", lineHeight: 1.6 }}>
                    Flagged: {[result.fraud_score>=40&&"elevated score", result.VOIP&&"VOIP", result.recent_abuse&&"recent abuse", result.spammer&&"spammer", result.do_not_call&&"DNC"].filter(Boolean).join(", ")}.
                    Register at freecallerregistry.com to push verified identity to Hiya, First Orion & TNS.
                  </div>
                </div>
              </div>
            )}

            {/* ── Tagging, Recheck, Connect Rate ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {/* Client Tag */}
              <Card>
                <SectionLabel>Client Tag</SectionLabel>
                <select
                  value={entry.client || ""}
                  onChange={e => updateNumber(digits, { client: e.target.value })}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "7px 10px", color: entry.client ? "#e8edf5" : "#3a4460", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                >
                  <option value="">— Assign client —</option>
                  {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Card>

              {/* Re-check Scheduler */}
              <Card>
                <SectionLabel>Schedule Re-check</SectionLabel>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {RECHECK_OPTIONS.map(({ label, days }) => (
                    <button key={days} onClick={() => updateNumber(digits, { recheckDate: addDays(days) })} style={{
                      padding: "5px 10px",
                      background: entry.recheckDate === addDays(days) ? "rgba(10,132,255,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${entry.recheckDate === addDays(days) ? "rgba(10,132,255,0.4)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 5, color: entry.recheckDate === addDays(days) ? "#0a84ff" : "#3a4460",
                      fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif"
                    }}>{label}</button>
                  ))}
                </div>
                {entry.recheckDate && (
                  <div style={{ fontSize: 9, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace", marginTop: 6 }}>
                    Due: {entry.recheckDate} ({daysUntil(entry.recheckDate)}d)
                  </div>
                )}
              </Card>
            </div>

            {/* Connect Rate Tracker */}
            <Card style={{ marginBottom: 12 }}>
              <SectionLabel>Connect Rate Tracker</SectionLabel>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace" }}>DIALS</span>
                  <input
                    type="number" min="0" value={cr.dials}
                    onChange={e => updateNumber(digits, { connectRate: { ...cr, dials: e.target.value } })}
                    style={{ width: 64, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "5px 8px", color: "#e8edf5", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace" }}>CONNECTS</span>
                  <input
                    type="number" min="0" value={cr.connects}
                    onChange={e => updateNumber(digits, { connectRate: { ...cr, connects: e.target.value } })}
                    style={{ width: 64, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "5px 8px", color: "#e8edf5", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none" }}
                  />
                </div>
                {connectPct !== null && (
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: connectPct >= 8 ? "#30d158" : connectPct >= 4 ? "#ff9f0a" : "#ff3b30", lineHeight: 1 }}>{connectPct}%</div>
                    <div style={{ fontSize: 8, color: "#2a3450", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5 }}>CONNECT RATE</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Links */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <LinkBtn icon="🛡️" label="Register Number" sub="freecallerregistry.com" href={FREE_CALLER_REGISTRY} accent={needsReg ? "#ff3b30" : "#30d158"} />
              <LinkBtn icon="🔍" label="IPQS Full Report" sub="Deep fraud analysis" href={`https://www.ipqualityscore.com/free-phone-number-lookup/lookup/free/${digits}`} accent="#0a84ff" />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <LinkBtn icon="👥" label="Truecaller" sub="Spam DB" href={`${TRUECALLER_URL}${digits}`} accent="#5ac8fa" />
              <LinkBtn icon="🚫" label="Nomorobo" sub="Robocall list" href={`${NOMOROBO_URL}${digits}`} accent="#5ac8fa" />
              <LinkBtn icon="📡" label="Hiya" sub="Carrier labels" href={HIYA_URL} accent="#5ac8fa" />
            </div>

            {/* Notes */}
            <Card>
              <SectionLabel>Notes</SectionLabel>
              <textarea
                placeholder="e.g. Rotated out 5/22 — spam on T-Mobile. Assigned to BEMO..."
                value={entry.notes || ""}
                onChange={e => updateNumber(digits, { notes: e.target.value })}
                style={{ width: "100%", background: "transparent", border: "none", color: "#5a6480", fontSize: 12, fontFamily: "'DM Sans',sans-serif", resize: "vertical", minHeight: 52, outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
              />
            </Card>
          </>}

          {!result && !loading && !error && (
            <div style={{ textAlign: "center", padding: "56px 0" }}>
              <div style={{ fontSize: 42, opacity: 0.12, marginBottom: 10 }}>📞</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#1e2738", letterSpacing: 3 }}>ENTER A NUMBER TO BEGIN</div>
            </div>
          )}
        </>}

        {/* ══════════════ BULK CHECK ══════════════ */}
        {tab === "bulk" && <>
          <SectionLabel>Paste Numbers — One Per Line or Comma Separated (Max 20)</SectionLabel>
          <textarea
            value={bulkInput} onChange={e => setBulkInput(e.target.value)}
            placeholder={"(720) 555-0100\n(646) 555-0200\n(312) 555-0300"}
            style={{ width: "100%", minHeight: 120, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", color: "#e8edf5", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.9, marginBottom: 10 }}
          />
          <button onClick={checkBulk} disabled={bulkLoading || !bulkInput.trim()} style={{ padding: "10px 20px", marginBottom: 20, background: bulkLoading ? "rgba(10,132,255,0.12)" : "linear-gradient(135deg,#0a84ff,#0060cc)", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, cursor: !bulkInput.trim() ? "not-allowed" : "pointer", opacity: !bulkInput.trim() ? 0.3 : 1 }}>
            {bulkLoading ? `SCANNING ${bulkResults.length}...` : "RUN BULK CHECK"}
          </button>

          {bulkResults.length > 0 && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 55px 95px 1fr 90px 90px", gap: 6, padding: "3px 10px", marginBottom: 4 }}>
              {["NUMBER","SCORE","LINE","CARRIER","CLIENT","STATUS"].map(h => (
                <div key={h} style={{ fontSize: 7, color: "#1e2738", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5 }}>{h}</div>
              ))}
            </div>
            {bulkResults.map(({ num, data }) => {
              const r = data?.success ? getRisk(data.fraud_score) : null;
              const flagged = data?.success && (data.fraud_score >= 40 || data.VOIP || data.recent_abuse);
              const numEntry = numbers[num] || {};
              return (
                <div key={num} style={{ display: "grid", gridTemplateColumns: "1fr 55px 95px 1fr 90px 90px", gap: 6, padding: "10px 10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${r ? r.border : "rgba(255,255,255,0.04)"}`, borderRadius: 8, marginBottom: 5, alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#5a6480" }}>{fmtDigits(num)}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 700, color: r?.color || "#2a3450" }}>{data?.success ? data.fraud_score : data ? "ERR" : "…"}</span>
                  <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace" }}>{data?.line_type || "—"}</span>
                  <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data?.carrier || "—"}</span>
                  <select value={numEntry.client || ""} onChange={e => updateNumber(num, { client: e.target.value })} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "3px 5px", color: numEntry.client ? "#e8edf5" : "#3a4460", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }}>
                    <option value="">Client...</option>
                    {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {flagged
                    ? <a href={FREE_CALLER_REGISTRY} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#ff3b30", fontFamily: "'IBM Plex Mono',monospace", textDecoration: "none", border: "1px solid rgba(255,59,48,0.25)", padding: "3px 6px", borderRadius: 4, background: "rgba(255,59,48,0.08)", textAlign: "center" }}>REGISTER</a>
                    : <span style={{ fontSize: 9, color: r?.color || "#2a3450", fontFamily: "'IBM Plex Mono',monospace" }}>{data?.success ? "CLEAN" : ""}</span>
                  }
                </div>
              );
            })}
          </>}

          {!bulkResults.length && !bulkLoading && (
            <div style={{ textAlign: "center", padding: "44px 0" }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#1e2738", letterSpacing: 3 }}>PASTE NUMBERS ABOVE TO BEGIN</div>
            </div>
          )}
        </>}

        {/* ══════════════ INVENTORY ══════════════ */}
        {tab === "inventory" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionLabel>All Tracked Numbers ({Object.keys(numbers).length})</SectionLabel>
          </div>

          {Object.keys(numbers).length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 0", color: "#1e2738", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: 3 }}>NO NUMBERS TRACKED YET — CHECK SOME NUMBERS FIRST</div>
          ) : (
            <>
              {/* Group by client */}
              {[...CLIENTS, "Unassigned"].map(client => {
                const clientNums = Object.values(numbers).filter(n =>
                  client === "Unassigned" ? !n.client : n.client === client
                );
                if (!clientNums.length) return null;
                return (
                  <div key={client} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{client.toUpperCase()} ({clientNums.length})</div>
                    {clientNums.map(n => {
                      const r = n.lastScore !== undefined ? getRisk(n.lastScore) : null;
                      const due = daysUntil(n.recheckDate);
                      const overdue = due !== null && due <= 0;
                      const soonDue = due !== null && due > 0 && due <= 7;
                      return (
                        <div key={n.digits} onClick={() => { setInput(n.number || fmtDigits(n.digits)); setTab("single"); }} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                          background: overdue ? "rgba(255,159,10,0.05)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${overdue ? "rgba(255,159,10,0.2)" : "rgba(255,255,255,0.04)"}`,
                          borderRadius: 8, cursor: "pointer", marginBottom: 4
                        }}>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#5a6480", minWidth: 130 }}>{n.number || fmtDigits(n.digits)}</span>
                          {r && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 700, color: r.color }}>{n.lastScore}</span>}
                          <span style={{ fontSize: 10, color: "#2a3450", fontFamily: "'IBM Plex Mono',monospace" }}>{n.lastData?.line_type || ""}</span>
                          <span style={{ fontSize: 10, color: "#2a3450", fontFamily: "'IBM Plex Mono',monospace", flex: 1 }}>{n.lastData?.carrier || ""}</span>
                          {n.recheckDate && (
                            <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: overdue ? "#ff9f0a" : soonDue ? "#ff9f0a" : "#2a3450", border: `1px solid ${overdue ? "rgba(255,159,10,0.3)" : "rgba(255,255,255,0.06)"}`, padding: "2px 6px", borderRadius: 4 }}>
                              {overdue ? `OVERDUE ${Math.abs(due)}d` : `${due}d`}
                            </span>
                          )}
                          {n.connectRate?.dials && n.connectRate?.connects && (
                            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "#3a4460" }}>
                              {Math.round((parseInt(n.connectRate.connects)/parseInt(n.connectRate.dials))*100)}% CR
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </>}

        {/* ══════════════ MORNING AUDIT ══════════════ */}
        {tab === "audit" && <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e8edf5", marginBottom: 4 }}>☀ Morning Audit</div>
            <div style={{ fontSize: 12, color: "#3a4460" }}>
              {auditDue > 0 ? `${auditDue} number${auditDue > 1 ? "s" : ""} scheduled for re-check today.` : "No numbers due for re-check today. You're all clear."}
            </div>
          </div>

          {auditDue > 0 && <>
            <button onClick={runAudit} disabled={auditLoading} style={{ padding: "11px 22px", marginBottom: 20, background: auditLoading ? "rgba(10,132,255,0.12)" : "linear-gradient(135deg,#0a84ff,#0060cc)", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, cursor: auditLoading ? "not-allowed" : "pointer" }}>
              {auditLoading ? `SCANNING ${auditResults.length} / ${auditDue}...` : `RUN AUDIT (${auditDue} NUMBERS)`}
            </button>

            {/* Numbers due list */}
            {auditResults.length === 0 && !auditLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                {auditNumbers.map(n => (
                  <div key={n.digits} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,159,10,0.05)", border: "1px solid rgba(255,159,10,0.15)", borderRadius: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#5a6480" }}>{n.number || fmtDigits(n.digits)}</span>
                    <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono',monospace" }}>{n.client || "—"}</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#ff9f0a", fontFamily: "'IBM Plex Mono',monospace" }}>DUE TODAY</span>
                  </div>
                ))}
              </div>
            )}

            {/* Audit results */}
            {auditResults.length > 0 && <>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                {auditResults.map(({ entry: n, data }) => {
                  const r = data?.success ? getRisk(data.fraud_score) : null;
                  const flagged = data?.success && (data.fraud_score >= 40 || data.VOIP || data.recent_abuse);
                  return (
                    <div key={n.digits} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: `1px solid ${r ? r.border : "rgba(255,255,255,0.04)"}`, borderRadius: 8 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#5a6480", minWidth: 130 }}>{n.number || fmtDigits(n.digits)}</span>
                      <span style={{ fontSize: 10, color: "#3a4460" }}>{n.client || "—"}</span>
                      {r && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 700, color: r.color }}>{data.fraud_score}</span>}
                      <span style={{ fontSize: 9, color: r?.color || "#2a3450", fontFamily: "'IBM Plex Mono',monospace" }}>{r ? r.label : "…"}</span>
                      {flagged && <a href={FREE_CALLER_REGISTRY} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 9, color: "#ff3b30", fontFamily: "'IBM Plex Mono',monospace", textDecoration: "none", border: "1px solid rgba(255,59,48,0.25)", padding: "3px 7px", borderRadius: 4, background: "rgba(255,59,48,0.08)" }}>REGISTER</a>}
                    </div>
                  );
                })}
              </div>

              {/* One-tap registration for all flagged */}
              {flaggedForReg.length > 0 && (
                <div style={{ padding: "14px 16px", background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#ff3b30", marginBottom: 2 }}>⚠️ {flaggedForReg.length} Number{flaggedForReg.length > 1 ? "s" : ""} Need Registration</div>
                    <div style={{ fontSize: 10, color: "#7a3a3a" }}>{flaggedForReg.map(r => fmtDigits(r.entry.digits)).join(", ")}</div>
                  </div>
                  <a href={FREE_CALLER_REGISTRY} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", background: "#ff3b30", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5 }}>
                    REGISTER ALL ↗
                  </a>
                </div>
              )}

              {flaggedForReg.length === 0 && auditResults.length === auditDue && (
                <div style={{ padding: "14px 16px", background: "rgba(48,209,88,0.07)", border: "1px solid rgba(48,209,88,0.2)", borderRadius: 10, fontSize: 12, color: "#30d158", fontWeight: 600 }}>
                  ✓ All numbers are clean — no registration needed today.
                </div>
              )}
            </>}
          </>}

          {auditDue === 0 && (
            <div style={{ textAlign: "center", padding: "44px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#1e2738", letterSpacing: 2 }}>ALL CLEAR — NOTHING DUE TODAY</div>
            </div>
          )}
        </>}

      </div>
    </div>
  );
}
