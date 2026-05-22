import { useState, useCallback } from "react";

const FREE_CALLER_REGISTRY = "https://freecallerregistry.com/";
const TRUECALLER_URL = "https://www.truecaller.com/search/us/";
const NOMOROBO_URL = "https://www.nomorobo.com/lookup/";
const HIYA_URL = "https://hiya.com/";

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const getRisk = (score) => {
  if (score >= 75) return { label: "HIGH RISK", color: "#ff3b30", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  if (score >= 40) return { label: "MODERATE", color: "#ff9f0a", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };
  return { label: "CLEAN", color: "#30d158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" };
};

const Flag = ({ warn, children }) => (
  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: warn ? "#ff9f0a" : "#30d158" }}>
    {warn ? "⚠ " : "✓ "}{children}
  </span>
);

const LinkBtn = ({ icon, label, sub, href, accent = "#0a84ff" }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "11px 14px", background: `${accent}0d`,
    border: `1px solid ${accent}2a`, borderRadius: 9,
    textDecoration: "none", flex: 1, minWidth: 140
  }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: accent }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: "#3a4460", fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>{sub}</div>}
    </div>
    <span style={{ marginLeft: "auto", color: accent, fontSize: 11, opacity: 0.6 }}>↗</span>
  </a>
);

export default function App() {
  const [tab, setTab] = useState("single");
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [result, setResult] = useState(null);
  const [bulkResults, setBulkResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState({});
  const [history, setHistory] = useState([]);

  const digits = input.replace(/\D/g, "");

  const checkNumber = useCallback(async (num) => {
    const res = await fetch(`/api/lookup?phone=${num}`);
    return res.json();
  }, []);

  const checkSingle = useCallback(async () => {
    if (digits.length < 10) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await checkNumber(digits);
      if (data.error) { setError(data.error); }
      else if (!data.success) { setError(data.message || "API error"); }
      else {
        setResult(data);
        setHistory(prev => [
          { number: input, digits, score: data.fraud_score, lineType: data.line_type },
          ...prev.filter(h => h.digits !== digits)
        ].slice(0, 10));
      }
    } catch { setError("Network error — check connection."); }
    setLoading(false);
  }, [digits, input, checkNumber]);

  const checkBulk = async () => {
    const numbers = bulkInput
      .split(/[\n,]+/)
      .map(n => n.trim().replace(/\D/g, ""))
      .filter(n => n.length >= 10)
      .slice(0, 20);
    if (!numbers.length) return;
    setBulkLoading(true); setBulkResults([]);
    const out = [];
    for (const num of numbers) {
      try {
        const data = await checkNumber(num);
        out.push({ num, data });
      } catch { out.push({ num, data: null }); }
      setBulkResults([...out]);
      await new Promise(r => setTimeout(r, 350));
    }
    setBulkLoading(false);
  };

  const risk = result ? getRisk(result.fraud_score) : null;
  const needsReg = result && (result.fraud_score >= 40 || result.VOIP || result.recent_abuse || result.spammer);

  return (
    <div style={{
      minHeight: "100vh", background: "#070b12", color: "#c8d0e0",
      fontFamily: "'DM Sans', sans-serif",
      backgroundImage: `
        radial-gradient(ellipse 70% 40% at 50% -5%, rgba(10,132,255,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 40% 30% at 90% 95%, rgba(48,209,88,0.04) 0%, transparent 50%)
      `
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "16px 26px", display: "flex", alignItems: "center", gap: 12,
        background: "rgba(7,11,18,0.9)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: "linear-gradient(135deg,#0a84ff,#30d158)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, boxShadow: "0 0 18px rgba(10,132,255,0.25)"
        }}>📞</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e8edf5" }}>Caddy Number Health</div>
          <div style={{ fontSize: 9, color: "#2a3450", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1.5 }}>POWERED BY GTMCADDY · ALTISALES</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3 }}>
          {[["single", "Single"], ["bulk", "Bulk"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "5px 14px",
              border: tab === k ? "1px solid rgba(10,132,255,0.35)" : "1px solid transparent",
              borderRadius: 6, background: tab === k ? "rgba(10,132,255,0.15)" : "transparent",
              color: tab === k ? "#0a84ff" : "#2a3450",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "34px 18px 60px" }}>

        {/* SINGLE TAB */}
        {tab === "single" && <>
          <div style={{ display: "flex", gap: 9, marginBottom: 26 }}>
            <input
              value={input}
              onChange={e => { setInput(formatPhone(e.target.value)); setResult(null); setError(null); }}
              onKeyDown={e => e.key === "Enter" && checkSingle()}
              placeholder="(720) 000-0000"
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                padding: "14px 16px", fontSize: 24,
                fontFamily: "'IBM Plex Mono', monospace", color: "#e8edf5",
                letterSpacing: 2, outline: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.45)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <button onClick={checkSingle} disabled={loading || digits.length < 10} style={{
              padding: "14px 20px",
              background: loading ? "rgba(10,132,255,0.12)" : "linear-gradient(135deg,#0a84ff,#0060cc)",
              border: "none", borderRadius: 10, color: "#fff",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
              fontWeight: 600, letterSpacing: 1.5,
              cursor: digits.length < 10 ? "not-allowed" : "pointer",
              opacity: digits.length < 10 ? 0.3 : 1,
              boxShadow: digits.length >= 10 ? "0 0 18px rgba(10,132,255,0.2)" : "none"
            }}>{loading ? "SCANNING..." : "CHECK"}</button>
          </div>

          {error && (
            <div style={{ padding: "14px 18px", background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 10, marginBottom: 18, fontSize: 12, color: "#ff3b30" }}>
              ⚠ {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {["IPQS DATABASE", "FRAUD INDEX", "CARRIER DATA", "ABUSE SIGNALS"].map((s, i) => (
                  <div key={s} style={{
                    padding: "4px 11px", background: "rgba(10,132,255,0.07)",
                    border: "1px solid rgba(10,132,255,0.15)", borderRadius: 4,
                    fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                    color: "#0a84ff", letterSpacing: 1.5,
                    animation: `blink 1.2s ${i * 0.25}s infinite`
                  }}>{s}</div>
                ))}
              </div>
              <style>{`@keyframes blink{0%,100%{opacity:.15}50%{opacity:1}}`}</style>
            </div>
          )}

          {result && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Score card */}
              <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 14, padding: "22px 22px", display: "flex", gap: 22, alignItems: "flex-start" }}>
                <div style={{ textAlign: "center", minWidth: 84 }}>
                  <div style={{ fontSize: 56, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: risk.color, lineHeight: 1, textShadow: `0 0 28px ${risk.color}44` }}>
                    {result.fraud_score}
                  </div>
                  <div style={{ fontSize: 8, color: risk.color, opacity: 0.7, letterSpacing: 2, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>FRAUD SCORE</div>
                  <div style={{ marginTop: 8, padding: "2px 8px", background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 4, fontSize: 8, color: risk.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, letterSpacing: 2 }}>{risk.label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#e8edf5", marginBottom: 10 }}>{input}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 20px" }}>
                    {[
                      ["Carrier", result.carrier || "N/A", false],
                      ["Line Type", result.line_type || "N/A", result.line_type === "VOIP"],
                      ["Location", result.city ? `${result.city}, ${result.region}` : result.region || "N/A", false],
                      ["Active", result.active ? "Active" : "Inactive", !result.active],
                      ["VOIP", result.VOIP ? "Yes" : "No", result.VOIP],
                      ["Recent Abuse", result.recent_abuse ? "Yes" : "No", result.recent_abuse],
                      ["Spammer", result.spammer ? "Yes" : "No", result.spammer],
                      ["Leaked", result.leaked ? "Yes" : "No", result.leaked],
                      ["Do Not Call", result.do_not_call ? "Yes" : "No", result.do_not_call],
                      ["Prepaid", result.prepaid ? "Yes" : "No", result.prepaid],
                    ].map(([k, v, warn]) => (
                      <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: "#2a3450", fontFamily: "'IBM Plex Mono', monospace", minWidth: 72 }}>{k}</span>
                        <Flag warn={warn}>{v}</Flag>
                      </div>
                    ))}
                  </div>
                  {result.name && result.name !== "N/A" && (
                    <div style={{ marginTop: 10, padding: "5px 10px", background: "rgba(10,132,255,0.08)", borderRadius: 6, display: "inline-block" }}>
                      <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono', monospace" }}>Owner: </span>
                      <span style={{ fontSize: 10, color: "#0a84ff", fontFamily: "'IBM Plex Mono', monospace" }}>{result.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Registration nudge */}
              {needsReg && (
                <div style={{ padding: "13px 16px", background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 10, display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#ff3b30", marginBottom: 3 }}>Registration Recommended</div>
                    <div style={{ fontSize: 11, color: "#7a3a3a", lineHeight: 1.6 }}>
                      Flagged for: {[result.fraud_score >= 40 && "elevated fraud score", result.VOIP && "VOIP", result.recent_abuse && "recent abuse", result.spammer && "spammer tag", result.do_not_call && "DNC list"].filter(Boolean).join(", ")}.
                      Register at freecallerregistry.com to push verified identity to Hiya, First Orion, and TNS — covering AT&T, T-Mobile, and Verizon.
                    </div>
                  </div>
                </div>
              )}

              {/* Action links */}
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <LinkBtn icon="🛡️" label="Register Number" sub="freecallerregistry.com" href={FREE_CALLER_REGISTRY} accent={needsReg ? "#ff3b30" : "#30d158"} />
                <LinkBtn icon="🔍" label="IPQS Full Report" sub="Deep fraud analysis" href={`https://www.ipqualityscore.com/free-phone-number-lookup/lookup/free/${digits}`} accent="#0a84ff" />
              </div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <LinkBtn icon="👥" label="Truecaller" sub="Crowdsourced spam DB" href={`${TRUECALLER_URL}${digits}`} accent="#5ac8fa" />
                <LinkBtn icon="🚫" label="Nomorobo" sub="Robocall blocklist" href={`${NOMOROBO_URL}${digits}`} accent="#5ac8fa" />
                <LinkBtn icon="📡" label="Hiya" sub="Carrier label check" href={HIYA_URL} accent="#5ac8fa" />
              </div>

              {/* Notes */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 8, color: "#2a3450", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, marginBottom: 7 }}>NOTES</div>
                <textarea
                  placeholder="e.g. Rotated out 5/22 — spam on T-Mobile. Was on BEMO campaign..."
                  value={notes[input] || ""}
                  onChange={e => setNotes(p => ({ ...p, [input]: e.target.value }))}
                  style={{ width: "100%", background: "transparent", border: "none", color: "#5a6480", fontSize: 12, fontFamily: "'DM Sans', sans-serif", resize: "vertical", minHeight: 55, outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                />
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 44, opacity: 0.15, marginBottom: 12 }}>📞</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1e2738", letterSpacing: 3 }}>ENTER A NUMBER TO BEGIN</div>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 8, color: "#1e2738", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, marginBottom: 8 }}>RECENT CHECKS</div>
              {history.map(h => {
                const r = getRisk(h.score ?? 0);
                return (
                  <div key={h.digits} onClick={() => { setInput(h.number); setResult(null); }} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "9px 12px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 7, cursor: "pointer", marginBottom: 4
                  }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#3a4460" }}>{h.number}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1e2738" }}>{h.lineType}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: r.color }}>{h.score}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {/* BULK TAB */}
        {tab === "bulk" && <>
          <div style={{ fontSize: 9, color: "#2a3450", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, marginBottom: 9 }}>PASTE NUMBERS — ONE PER LINE OR COMMA SEPARATED (MAX 20)</div>
          <textarea
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder={"(720) 555-0100\n(646) 555-0200\n(312) 555-0300"}
            style={{
              width: "100%", minHeight: 130, background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10,
              padding: "13px 15px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
              color: "#e8edf5", outline: "none", resize: "vertical",
              boxSizing: "border-box", lineHeight: 1.9, marginBottom: 10
            }}
          />
          <button onClick={checkBulk} disabled={bulkLoading || !bulkInput.trim()} style={{
            padding: "11px 22px", marginBottom: 22,
            background: bulkLoading ? "rgba(10,132,255,0.12)" : "linear-gradient(135deg,#0a84ff,#0060cc)",
            border: "none", borderRadius: 8, color: "#fff",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
            letterSpacing: 1.5, cursor: !bulkInput.trim() ? "not-allowed" : "pointer",
            opacity: !bulkInput.trim() ? 0.3 : 1
          }}>{bulkLoading ? `SCANNING ${bulkResults.length}...` : "RUN BULK CHECK"}</button>

          {bulkResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 1fr 80px", gap: 8, padding: "4px 12px" }}>
                {["NUMBER", "SCORE", "LINE", "CARRIER", "STATUS"].map(h => (
                  <div key={h} style={{ fontSize: 8, color: "#1e2738", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1.5 }}>{h}</div>
                ))}
              </div>
              {bulkResults.map(({ num, data }) => {
                const r = data?.success ? getRisk(data.fraud_score) : null;
                const fmt = num.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
                const flagged = data?.success && (data.fraud_score >= 40 || data.VOIP || data.recent_abuse);
                return (
                  <div key={num} style={{
                    display: "grid", gridTemplateColumns: "1fr 60px 100px 1fr 80px",
                    gap: 8, padding: "11px 12px", alignItems: "center",
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${r ? r.border : "rgba(255,255,255,0.04)"}`,
                    borderRadius: 8
                  }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5a6480" }}>{fmt}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: r?.color || "#2a3450" }}>
                      {data?.success ? data.fraud_score : data ? "ERR" : "…"}
                    </span>
                    <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono', monospace" }}>{data?.line_type || "—"}</span>
                    <span style={{ fontSize: 10, color: "#3a4460", fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data?.carrier || "—"}</span>
                    {flagged
                      ? <a href={FREE_CALLER_REGISTRY} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#ff3b30", fontFamily: "'IBM Plex Mono', monospace", textDecoration: "none", border: "1px solid rgba(255,59,48,0.25)", padding: "3px 7px", borderRadius: 4, background: "rgba(255,59,48,0.08)", textAlign: "center" }}>REGISTER</a>
                      : <span style={{ fontSize: 9, color: r?.color || "#2a3450", fontFamily: "'IBM Plex Mono', monospace" }}>{data?.success ? "CLEAN" : ""}</span>
                    }
                  </div>
                );
              })}
            </div>
          )}

          {!bulkResults.length && !bulkLoading && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1e2738", letterSpacing: 3 }}>PASTE NUMBERS ABOVE TO BEGIN</div>
            </div>
          )}
        </>}

      </div>
    </div>
  );
}
