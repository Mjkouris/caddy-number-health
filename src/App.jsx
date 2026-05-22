import { useState, useCallback, useEffect } from "react";

const FREE_CALLER_REGISTRY = "https://freecallerregistry.com/";
const TRUECALLER_URL = "https://www.truecaller.com/search/us/";
const NOMOROBO_URL = "https://www.nomorobo.com/lookup/";
const HIYA_URL = "https://hiya.com/";

const CLIENTS = ["AltiSales Outbound", "Dili", "Factura", "Modern Campus", "BEMO", "ASAPP", "Other"];
const RECHECK_OPTIONS = [{ label: "30d", days: 30 }, { label: "60d", days: 60 }, { label: "90d", days: 90 }];
const SDR_NAMES = ["Max", "Tito", "SDR 1", "SDR 2", "SDR 3", "SDR 4"];

const LS_KEY = "caddy_numbers_v4";
const loadNumbers = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const saveNumbers = (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} };

const formatPhone = (val) => {
  const d = val.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};
const toDigits = (v) => v.replace(/\D/g, "");
const fmtDigits = (d) => d.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
const daysUntil = (s) => { if (!s) return null; return Math.ceil((new Date(s) - new Date()) / 86400000); };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const daysSince = (s) => { if (!s) return null; return Math.floor((new Date() - new Date(s)) / 86400000); };
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`; };
const today = () => new Date().toISOString().split("T")[0];

const getRisk = (score) => {
  if (score >= 75) return { label: "HIGH RISK", color: "#ff3b30", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  if (score >= 40) return { label: "MODERATE", color: "#ff9f0a", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };
  return { label: "CLEAN", color: "#30d158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" };
};

const getConnectVerdict = (pct) => {
  if (pct === null) return null;
  if (pct >= 10) return { label: "STRONG", color: "#30d158", detail: "Connect rate is healthy. Keep dialing." };
  if (pct >= 5)  return { label: "WATCH", color: "#ff9f0a", detail: "Connect rate is below average. Monitor closely." };
  return { label: "LIKELY BLOCKED", color: "#ff3b30", detail: "Connect rate is too low. Carriers may be blocking this number." };
};

const getRecommendation = (data, registered, connectPct) => {
  if (!data) return null;
  const score = data.fraud_score;

  // Connect rate overrides everything if we have data
  if (connectPct !== null && connectPct < 3) {
    return { action: "RETIRE — LIKELY BLOCKED", detail: "Connect rate under 3% signals carrier blocking regardless of fraud score. Replace this number.", color: "#ff3b30", icon: "🚫", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  }
  if (score >= 75 || data.spammer || (data.recent_abuse && score >= 60)) {
    return { action: "RETIRE THIS NUMBER", detail: "Score too high or abuse flagged. Stop using immediately, provision a new number.", color: "#ff3b30", icon: "🚫", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  }
  if (data.do_not_call) {
    return { action: "DO NOT USE FOR OUTBOUND", detail: "This number is on the DNC list.", color: "#ff3b30", icon: "🚫", bg: "rgba(255,59,48,0.08)", border: "rgba(255,59,48,0.2)" };
  }
  if (score >= 40 || data.VOIP || data.recent_abuse) {
    if (registered) {
      return { action: "REGISTERED — MONITOR CONNECT RATE", detail: "Number is registered. Watch connect rate — if it drops below 5% consider retiring.", color: "#ff9f0a", icon: "⚠️", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };
    }
    return { action: "REGISTER BEFORE DIALING", detail: "Elevated risk detected. Register at freecallerregistry.com first, then monitor connect rate closely.", color: "#ff9f0a", icon: "⚠️", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };
  }
  if (connectPct !== null && connectPct >= 10) {
    return { action: "HEALTHY — KEEP DIALING", detail: "Clean score and strong connect rate. This number is performing well.", color: "#30d158", icon: "✅", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" };
  }
  return { action: "SAFE TO DIAL", detail: "Number looks clean. Dial freely and log connect rates to track performance.", color: "#30d158", icon: "✅", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" };
};

// ── Components ──────────────────────────────────────────────────────────────
const Flag = ({ warn, children }) => (
  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: warn?"#ff9f0a":"#30d158" }}>{warn?"⚠ ":"✓ "}{children}</span>
);

const LinkBtn = ({ icon, label, sub, href, accent="#0a84ff" }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:`${accent}0d`, border:`1px solid ${accent}2a`, borderRadius:9, textDecoration:"none", flex:1, minWidth:130 }}>
    <span style={{ fontSize:17 }}>{icon}</span>
    <div>
      <div style={{ fontSize:12, fontWeight:600, color:accent }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:"#3a4460", fontFamily:"'IBM Plex Mono',monospace", marginTop:1 }}>{sub}</div>}
    </div>
    <span style={{ marginLeft:"auto", color:accent, fontSize:11, opacity:0.5 }}>↗</span>
  </a>
);

const TabBtn = ({ active, onClick, children, badge }) => (
  <button onClick={onClick} style={{ padding:"5px 14px", border:active?"1px solid rgba(10,132,255,0.35)":"1px solid transparent", borderRadius:6, background:active?"rgba(10,132,255,0.15)":"transparent", color:active?"#0a84ff":"#2a3450", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap", position:"relative" }}>
    {children}
    {badge>0 && <span style={{ position:"absolute", top:-4, right:-4, background:"#ff9f0a", borderRadius:"50%", width:14, height:14, fontSize:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#000", fontWeight:700 }}>{badge}</span>}
  </button>
);

const SL = ({ children }) => (
  <div style={{ fontSize:8, color:"#1e2738", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:2, marginBottom:8, textTransform:"uppercase" }}>{children}</div>
);

const Card = ({ children, style={} }) => (
  <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:10, padding:14, ...style }}>{children}</div>
);

const StatPill = ({ label, value, color, sub }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"10px 12px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, flex:1, minWidth:80 }}>
    <span style={{ fontSize:8, color:"#1e2738", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5 }}>{label}</span>
    <span style={{ fontSize:15, fontWeight:700, color:color||"#7a8499", fontFamily:"'IBM Plex Mono',monospace", lineHeight:1 }}>{value}</span>
    {sub && <span style={{ fontSize:9, color:color||"#3a4460", opacity:0.7, fontFamily:"'IBM Plex Mono',monospace" }}>{sub}</span>}
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("single");
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [result, setResult] = useState(null);
  const [bulkResults, setBulkResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState(null);
  const [numbers, setNumbers] = useState(loadNumbers);
  const [auditResults, setAuditResults] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [inventoryClient, setInventoryClient] = useState("all");

  useEffect(() => { saveNumbers(numbers); }, [numbers]);

  const updateNumber = (digits, patch) => setNumbers(prev => ({ ...prev, [digits]: { ...(prev[digits]||{}), ...patch } }));
  const retireNumber = (digits) => updateNumber(digits, { retired:true, retiredDate:new Date().toISOString() });
  const unretireNumber = (digits) => updateNumber(digits, { retired:false, retiredDate:null });

  const digits = toDigits(input);
  const entry = numbers[digits] || {};
  const cr = entry.connectRate || { dials:"", connects:"" };
  const connectPct = cr.dials && cr.connects ? Math.round((parseInt(cr.connects)/parseInt(cr.dials))*100) : null;
  const connectVerdict = getConnectVerdict(connectPct);
  const risk = result ? getRisk(result.fraud_score) : null;
  const rec = result ? getRecommendation(result, entry.registered, connectPct) : null;

  const checkNumber = useCallback(async (num) => {
    const res = await fetch(`/api/lookup?phone=${num}`);
    return res.json();
  }, []);

  const checkSingle = useCallback(async () => {
    if (digits.length < 10) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await checkNumber(digits);
      if (data.error || !data.success) { setError(data.message||data.error||"API error"); }
      else {
        setResult(data);
        updateNumber(digits, { digits, number:input, lastChecked:new Date().toISOString(), lastScore:data.fraud_score, lastData:data, firstSeen:entry.firstSeen||new Date().toISOString() });
      }
    } catch { setError("Network error."); }
    setLoading(false);
  }, [digits, input, checkNumber, entry.firstSeen]);

  const checkBulk = async () => {
    const nums = bulkInput.split(/[\n,]+/).map(n=>toDigits(n.trim())).filter(n=>n.length>=10).slice(0,20);
    if (!nums.length) return;
    setBulkLoading(true); setBulkResults([]);
    const out = [];
    for (const num of nums) {
      try {
        const data = await checkNumber(num);
        out.push({ num, data });
        if (data.success) updateNumber(num, { digits:num, number:fmtDigits(num), lastChecked:new Date().toISOString(), lastScore:data.fraud_score, lastData:data, firstSeen:(numbers[num]?.firstSeen)||new Date().toISOString() });
      } catch { out.push({ num, data:null }); }
      setBulkResults([...out]);
      await new Promise(r=>setTimeout(r,350));
    }
    setBulkLoading(false);
  };

  const activeNumbers = Object.values(numbers).filter(n=>!n.retired);
  const auditNumbers = activeNumbers.filter(n=>n.recheckDate && n.recheckDate<=today());
  const auditDue = auditNumbers.length;

  const runAudit = async () => {
    if (!auditNumbers.length) return;
    setAuditLoading(true); setAuditResults([]);
    const out = [];
    for (const e of auditNumbers) {
      try {
        const data = await checkNumber(e.digits);
        out.push({ entry:e, data });
        if (data.success) updateNumber(e.digits, { lastChecked:new Date().toISOString(), lastScore:data.fraud_score, lastData:data });
      } catch { out.push({ entry:e, data:null }); }
      setAuditResults([...out]);
      await new Promise(r=>setTimeout(r,350));
    }
    setAuditLoading(false);
  };

  const flaggedForReg = auditResults.filter(r=>r.data?.success&&(r.data.fraud_score>=40||r.data.VOIP||r.data.recent_abuse)&&!r.entry.registered);
  const checkedToday = entry.lastChecked && new Date(entry.lastChecked).toISOString().split("T")[0]===today();

  // Inventory filter
  const inventoryNums = activeNumbers.filter(n => inventoryClient==="all" ? true : n.client===inventoryClient);

  return (
    <div style={{ minHeight:"100vh", background:"#070b12", color:"#c8d0e0", fontFamily:"'DM Sans',sans-serif", backgroundImage:`radial-gradient(ellipse 70% 40% at 50% -5%, rgba(10,132,255,0.07) 0%, transparent 60%)` }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"14px 22px", display:"flex", alignItems:"center", gap:12, background:"rgba(7,11,18,0.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexWrap:"wrap" }}>
        <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#0a84ff,#30d158)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:"0 0 16px rgba(10,132,255,0.25)" }}>📞</div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:"#e8edf5" }}>Caddy Number Health</div>
          <div style={{ fontSize:8, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5 }}>POWERED BY GTMCADDY · ALTISALES</div>
        </div>
        {auditDue>0 && <button onClick={()=>setTab("audit")} style={{ marginLeft:8, padding:"4px 10px", background:"rgba(255,159,10,0.12)", border:"1px solid rgba(255,159,10,0.3)", borderRadius:6, color:"#ff9f0a", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>☀ {auditDue} DUE</button>}
        <div style={{ marginLeft:"auto", display:"flex", gap:3, background:"rgba(255,255,255,0.03)", borderRadius:8, padding:3 }}>
          {[["single","Check"],["bulk","Bulk"],["inventory","Inventory"],["audit","Morning Audit"]].map(([k,l])=>(
            <TabBtn key={k} active={tab===k} onClick={()=>setTab(k)} badge={k==="audit"?auditDue:0}>{l}</TabBtn>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"28px 16px 60px" }}>

        {/* ══ SINGLE CHECK ══ */}
        {tab==="single" && <>
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            <input value={input} onChange={e=>{setInput(formatPhone(e.target.value));setResult(null);setError(null);}} onKeyDown={e=>e.key==="Enter"&&checkSingle()} placeholder="(720) 000-0000"
              style={{ flex:1, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"13px 15px", fontSize:22, fontFamily:"'IBM Plex Mono',monospace", color:"#e8edf5", letterSpacing:2, outline:"none" }}
              onFocus={e=>e.target.style.borderColor="rgba(10,132,255,0.45)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"} />
            <button onClick={checkSingle} disabled={loading||digits.length<10} style={{ padding:"13px 18px", background:loading?"rgba(10,132,255,0.12)":"linear-gradient(135deg,#0a84ff,#0060cc)", border:"none", borderRadius:10, color:"#fff", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, letterSpacing:1.5, cursor:digits.length<10?"not-allowed":"pointer", opacity:digits.length<10?0.3:1 }}>
              {loading?"SCANNING...":"CHECK"}
            </button>
          </div>

          {error && <div style={{ padding:"12px 16px", background:"rgba(255,59,48,0.07)", border:"1px solid rgba(255,59,48,0.2)", borderRadius:10, marginBottom:14, fontSize:12, color:"#ff3b30" }}>⚠ {error}</div>}

          {loading && (
            <div style={{ textAlign:"center", padding:"44px 0" }}>
              <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
                {["IPQS DATABASE","FRAUD INDEX","CARRIER DATA","ABUSE SIGNALS"].map((s,i)=>(
                  <div key={s} style={{ padding:"4px 10px", background:"rgba(10,132,255,0.07)", border:"1px solid rgba(10,132,255,0.15)", borderRadius:4, fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#0a84ff", letterSpacing:1.5, animation:`blink 1.2s ${i*0.25}s infinite` }}>{s}</div>
                ))}
              </div>
              <style>{`@keyframes blink{0%,100%{opacity:.12}50%{opacity:1}}`}</style>
            </div>
          )}

          {result && !loading && <>

            {/* ── Recommendation ── */}
            <div style={{ padding:"16px 18px", background:rec.bg, border:`1px solid ${rec.border}`, borderRadius:12, marginBottom:14, display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:26 }}>{rec.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:rec.color, marginBottom:2 }}>{rec.action}</div>
                <div style={{ fontSize:11, color:rec.color, opacity:0.7, lineHeight:1.5 }}>{rec.detail}</div>
              </div>
              {/* Registered toggle */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:80 }}>
                <div style={{ fontSize:8, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5 }}>REGISTERED</div>
                <button
                  onClick={()=>updateNumber(digits,{registered:!entry.registered})}
                  style={{ width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", position:"relative", background:entry.registered?"#30d158":"rgba(255,255,255,0.08)", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:3, left:entry.registered?26:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
                </button>
                <div style={{ fontSize:9, color:entry.registered?"#30d158":"#3a4460", fontFamily:"'IBM Plex Mono',monospace" }}>{entry.registered?"YES":"NO"}</div>
              </div>
            </div>

            {/* ── Stats row ── */}
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              <StatPill label="FRAUD SCORE" value={result.fraud_score} color={risk.color} sub={risk.label} />
              <StatPill label="LINE TYPE" value={result.line_type||"N/A"} color={result.line_type==="VOIP"?"#ff9f0a":"#7a8499"} />
              <StatPill label="CARRIER" value={result.carrier?.replace("INTERNATIONAL, INC.","INTL")||"N/A"} />
              <StatPill label="LOCATION" value={result.city?`${result.city}, ${result.region}`:result.region||"N/A"} />
              <StatPill label="NUMBER AGE" value={entry.firstSeen?`${daysSince(entry.firstSeen)}d`:"New"} color={daysSince(entry.firstSeen)>90?"#ff9f0a":"#7a8499"} />
              <StatPill label="LAST CHECKED" value={entry.lastChecked?fmtDate(entry.lastChecked):"Now"} color={checkedToday?"#30d158":"#ff9f0a"} />
            </div>

            {/* ── Connect Rate — PRIMARY SIGNAL ── */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${connectVerdict?connectVerdict.color+"33":"rgba(255,255,255,0.06)"}`, borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:"#e8edf5", letterSpacing:0.5 }}>Connect Rate</div>
                  <div style={{ fontSize:9, color:"#3a4460", fontFamily:"'IBM Plex Mono',monospace" }}>Primary performance signal</div>
                </div>
                {connectVerdict && (
                  <div style={{ padding:"4px 10px", background:`${connectVerdict.color}15`, border:`1px solid ${connectVerdict.color}33`, borderRadius:5, fontSize:10, fontWeight:700, color:connectVerdict.color, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1 }}>
                    {connectVerdict.label}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                {[["DIALS","dials"],["CONNECTS","connects"]].map(([label,key])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:10, color:"#3a4460", fontFamily:"'IBM Plex Mono',monospace" }}>{label}</span>
                    <input type="number" min="0" value={cr[key]}
                      onChange={e=>updateNumber(digits,{connectRate:{...cr,[key]:e.target.value}})}
                      style={{ width:72, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:6, padding:"7px 10px", color:"#e8edf5", fontSize:15, fontFamily:"'IBM Plex Mono',monospace", outline:"none", textAlign:"center" }} />
                  </div>
                ))}
                {connectPct!==null ? (
                  <div style={{ marginLeft:"auto", textAlign:"center" }}>
                    <div style={{ fontSize:40, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:connectVerdict.color, lineHeight:1 }}>{connectPct}%</div>
                    <div style={{ fontSize:8, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5, marginTop:2 }}>CONNECT RATE</div>
                    <div style={{ fontSize:10, color:connectVerdict.color, opacity:0.7, marginTop:3 }}>{connectVerdict.detail}</div>
                  </div>
                ) : (
                  <div style={{ marginLeft:"auto", fontSize:10, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace" }}>Log dials + connects to track performance</div>
                )}
              </div>
            </div>

            {/* ── Detail flags ── */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"5px 14px" }}>
                {[
                  ["Active",result.active?"Active":"Inactive",!result.active],
                  ["VOIP",result.VOIP?"Yes":"No",result.VOIP],
                  ["Recent Abuse",result.recent_abuse?"Yes":"No",result.recent_abuse],
                  ["Spammer",result.spammer?"Yes":"No",result.spammer],
                  ["Leaked",result.leaked?"Yes":"No",result.leaked],
                  ["Do Not Call",result.do_not_call?"Yes":"No",result.do_not_call],
                  ["Prepaid",result.prepaid?"Yes":"No",result.prepaid],
                  ["Risky",result.risky?"Yes":"No",result.risky],
                ].map(([k,v,w])=>(
                  <div key={k} style={{ display:"flex", gap:5, alignItems:"center" }}>
                    <span style={{ fontSize:9, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", minWidth:66 }}>{k}</span>
                    <Flag warn={w}>{v}</Flag>
                  </div>
                ))}
              </div>
              {result.name && result.name!=="N/A" && (
                <div style={{ marginTop:9, padding:"4px 9px", background:"rgba(10,132,255,0.08)", borderRadius:5, display:"inline-block" }}>
                  <span style={{ fontSize:9, color:"#3a4460", fontFamily:"'IBM Plex Mono',monospace" }}>Owner: </span>
                  <span style={{ fontSize:9, color:"#0a84ff", fontFamily:"'IBM Plex Mono',monospace" }}>{result.name}</span>
                </div>
              )}
            </Card>

            {/* ── Tagging row ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              <Card>
                <SL>Client</SL>
                <select value={entry.client||""} onChange={e=>updateNumber(digits,{client:e.target.value})} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"7px 10px", color:entry.client?"#e8edf5":"#3a4460", fontSize:12, fontFamily:"'DM Sans',sans-serif", outline:"none" }}>
                  <option value="">— Client —</option>
                  {CLIENTS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </Card>
              <Card>
                <SL>SDR</SL>
                <select value={entry.sdr||""} onChange={e=>updateNumber(digits,{sdr:e.target.value})} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"7px 10px", color:entry.sdr?"#e8edf5":"#3a4460", fontSize:12, fontFamily:"'DM Sans',sans-serif", outline:"none" }}>
                  <option value="">— SDR —</option>
                  {SDR_NAMES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Card>
              <Card>
                <SL>Re-check</SL>
                <div style={{ display:"flex", gap:4 }}>
                  {RECHECK_OPTIONS.map(({label,days})=>(
                    <button key={days} onClick={()=>updateNumber(digits,{recheckDate:addDays(days)})} style={{ padding:"5px 8px", background:entry.recheckDate===addDays(days)?"rgba(10,132,255,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${entry.recheckDate===addDays(days)?"rgba(10,132,255,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:5, color:entry.recheckDate===addDays(days)?"#0a84ff":"#3a4460", fontSize:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{label}</button>
                  ))}
                </div>
                {entry.recheckDate && <div style={{ fontSize:9, color:"#3a4460", fontFamily:"'IBM Plex Mono',monospace", marginTop:5 }}>Due in {daysUntil(entry.recheckDate)}d</div>}
              </Card>
            </div>

            {/* ── Links ── */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
              <LinkBtn icon="🛡️" label="Register Number" sub="freecallerregistry.com" href={FREE_CALLER_REGISTRY} accent={entry.registered?"#30d158":"#ff9f0a"} />
              <LinkBtn icon="🔍" label="IPQS Full Report" sub="Deep fraud analysis" href={`https://www.ipqualityscore.com/free-phone-number-lookup/lookup/free/${digits}`} accent="#0a84ff" />
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
              <LinkBtn icon="👥" label="Truecaller" sub="Spam DB" href={`${TRUECALLER_URL}${digits}`} accent="#5ac8fa" />
              <LinkBtn icon="🚫" label="Nomorobo" sub="Robocall list" href={`${NOMOROBO_URL}${digits}`} accent="#5ac8fa" />
              <LinkBtn icon="📡" label="Hiya" sub="Carrier labels" href={HIYA_URL} accent="#5ac8fa" />
            </div>

            {/* ── Retire ── */}
            {!entry.retired ? (
              <button onClick={()=>retireNumber(digits)} style={{ padding:"9px 16px", background:"rgba(255,59,48,0.08)", border:"1px solid rgba(255,59,48,0.2)", borderRadius:8, color:"#ff3b30", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }}>
                🗑 Retire This Number
              </button>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", background:"rgba(255,59,48,0.06)", border:"1px solid rgba(255,59,48,0.15)", borderRadius:8, marginBottom:12 }}>
                <span style={{ fontSize:12, color:"#ff3b30", fontFamily:"'IBM Plex Mono',monospace" }}>RETIRED {fmtDate(entry.retiredDate)}</span>
                <button onClick={()=>unretireNumber(digits)} style={{ marginLeft:"auto", padding:"4px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:5, color:"#5a6480", fontSize:10, cursor:"pointer" }}>Undo</button>
              </div>
            )}

            <Card>
              <SL>Notes</SL>
              <textarea placeholder="e.g. Rotated out 5/22 — spam on T-Mobile. Assigned to BEMO..." value={entry.notes||""} onChange={e=>updateNumber(digits,{notes:e.target.value})} style={{ width:"100%", background:"transparent", border:"none", color:"#5a6480", fontSize:12, fontFamily:"'DM Sans',sans-serif", resize:"vertical", minHeight:52, outline:"none", boxSizing:"border-box", lineHeight:1.6 }} />
            </Card>
          </>}

          {!result&&!loading&&!error && (
            <div style={{ textAlign:"center", padding:"56px 0" }}>
              <div style={{ fontSize:42, opacity:0.12, marginBottom:10 }}>📞</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#1e2738", letterSpacing:3 }}>ENTER A NUMBER TO BEGIN</div>
            </div>
          )}
        </>}

        {/* ══ BULK ══ */}
        {tab==="bulk" && <>
          <SL>Paste Numbers — One Per Line or Comma Separated (Max 20)</SL>
          <textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} placeholder={"(720) 555-0100\n(646) 555-0200\n(312) 555-0300"} style={{ width:"100%", minHeight:120, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"12px 14px", fontSize:13, fontFamily:"'IBM Plex Mono',monospace", color:"#e8edf5", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.9, marginBottom:10 }} />
          <button onClick={checkBulk} disabled={bulkLoading||!bulkInput.trim()} style={{ padding:"10px 20px", marginBottom:20, background:bulkLoading?"rgba(10,132,255,0.12)":"linear-gradient(135deg,#0a84ff,#0060cc)", border:"none", borderRadius:8, color:"#fff", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, letterSpacing:1.5, cursor:!bulkInput.trim()?"not-allowed":"pointer", opacity:!bulkInput.trim()?0.3:1 }}>
            {bulkLoading?`SCANNING ${bulkResults.length}...`:"RUN BULK CHECK"}
          </button>
          {bulkResults.length>0 && <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 55px 1fr 80px 80px", gap:6, padding:"3px 10px", marginBottom:4 }}>
              {["NUMBER","SCORE","ACTION","SDR","CLIENT"].map(h=>(
                <div key={h} style={{ fontSize:7, color:"#1e2738", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5 }}>{h}</div>
              ))}
            </div>
            {bulkResults.map(({num,data})=>{
              const r=data?.success?getRisk(data.fraud_score):null;
              const numCR=numbers[num]?.connectRate;
              const numPct=numCR?.dials&&numCR?.connects?Math.round((parseInt(numCR.connects)/parseInt(numCR.dials))*100):null;
              const rec=data?.success?getRecommendation(data,numbers[num]?.registered,numPct):null;
              const ne=numbers[num]||{};
              return (
                <div key={num} style={{ display:"grid", gridTemplateColumns:"1fr 55px 1fr 80px 80px", gap:6, padding:"10px 10px", background:"rgba(255,255,255,0.02)", border:`1px solid ${r?r.border:"rgba(255,255,255,0.04)"}`, borderRadius:8, marginBottom:5, alignItems:"center" }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#5a6480" }}>{fmtDigits(num)}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:r?.color||"#2a3450" }}>{data?.success?data.fraud_score:data?"ERR":"…"}</span>
                  <span style={{ fontSize:9, color:rec?.color||"#2a3450", fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.3 }}>{rec?rec.action:"—"}</span>
                  <select value={ne.sdr||""} onChange={e=>updateNumber(num,{sdr:e.target.value})} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:"3px 5px", color:ne.sdr?"#e8edf5":"#3a4460", fontSize:10, fontFamily:"'DM Sans',sans-serif", outline:"none" }}>
                    <option value="">SDR...</option>{SDR_NAMES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={ne.client||""} onChange={e=>updateNumber(num,{client:e.target.value})} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:"3px 5px", color:ne.client?"#e8edf5":"#3a4460", fontSize:10, fontFamily:"'DM Sans',sans-serif", outline:"none" }}>
                    <option value="">Client...</option>{CLIENTS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              );
            })}
          </>}
          {!bulkResults.length&&!bulkLoading&&<div style={{ textAlign:"center", padding:"44px 0", fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#1e2738", letterSpacing:3 }}>PASTE NUMBERS ABOVE TO BEGIN</div>}
        </>}

        {/* ══ INVENTORY ══ */}
        {tab==="inventory" && <>
          {/* Client filter tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
            {["all",...CLIENTS].map(c=>{
              const count = c==="all" ? activeNumbers.length : activeNumbers.filter(n=>n.client===c).length;
              if (c!=="all" && count===0) return null;
              return (
                <button key={c} onClick={()=>setInventoryClient(c)} style={{ padding:"5px 12px", border:inventoryClient===c?"1px solid rgba(10,132,255,0.4)":"1px solid rgba(255,255,255,0.06)", borderRadius:6, background:inventoryClient===c?"rgba(10,132,255,0.15)":"rgba(255,255,255,0.02)", color:inventoryClient===c?"#0a84ff":"#3a4460", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  {c==="all"?"All":c} <span style={{ opacity:0.5 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {inventoryNums.length===0 ? (
            <div style={{ textAlign:"center", padding:"44px 0", color:"#1e2738", fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:3 }}>NO NUMBERS YET</div>
          ) : (
            <>
              {/* Header row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 55px 55px 100px 80px 80px 80px", gap:6, padding:"3px 12px", marginBottom:6 }}>
                {["NUMBER","SCORE","CR%","ACTION","SDR","AGE","CHECKED"].map(h=>(
                  <div key={h} style={{ fontSize:7, color:"#1e2738", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5 }}>{h}</div>
                ))}
              </div>
              {inventoryNums.map(n=>{
                const r=n.lastScore!==undefined?getRisk(n.lastScore):null;
                const nCR=n.connectRate;
                const nPct=nCR?.dials&&nCR?.connects?Math.round((parseInt(nCR.connects)/parseInt(nCR.dials))*100):null;
                const nRec=n.lastData?getRecommendation(n.lastData,n.registered,nPct):null;
                const due=daysUntil(n.recheckDate);
                const overdue=due!==null&&due<=0;
                const checkedTodayInv=n.lastChecked&&new Date(n.lastChecked).toISOString().split("T")[0]===today();
                return (
                  <div key={n.digits} onClick={()=>{setInput(n.number||fmtDigits(n.digits));setTab("single");}} style={{ display:"grid", gridTemplateColumns:"1fr 55px 55px 100px 80px 80px 80px", gap:6, padding:"10px 12px", background:overdue?"rgba(255,159,10,0.03)":"rgba(255,255,255,0.02)", border:`1px solid ${overdue?"rgba(255,159,10,0.15)":"rgba(255,255,255,0.04)"}`, borderRadius:8, cursor:"pointer", marginBottom:4, alignItems:"center" }}>
                    <div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#5a6480" }}>{n.number||fmtDigits(n.digits)}</div>
                      {n.sdr&&<div style={{ fontSize:8, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", marginTop:1 }}>{n.sdr}</div>}
                    </div>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:r?.color||"#2a3450" }}>{n.lastScore??"-"}</span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:nPct!==null?(nPct>=10?"#30d158":nPct>=5?"#ff9f0a":"#ff3b30"):"#2a3450" }}>{nPct!==null?`${nPct}%`:"-"}</span>
                    <span style={{ fontSize:9, color:nRec?.color||"#2a3450", fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.3 }}>{nRec?.action||"—"}</span>
                    <span style={{ fontSize:9, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace" }}>{n.sdr||"—"}</span>
                    <span style={{ fontSize:9, color:daysSince(n.firstSeen)>90?"#ff9f0a":"#2a3450", fontFamily:"'IBM Plex Mono',monospace" }}>{n.firstSeen?`${daysSince(n.firstSeen)}d`:"—"}</span>
                    <span style={{ fontSize:9, color:checkedTodayInv?"#30d158":overdue?"#ff9f0a":"#2a3450", fontFamily:"'IBM Plex Mono',monospace" }}>{checkedTodayInv?"today":n.lastChecked?fmtDate(n.lastChecked):"—"}</span>
                  </div>
                );
              })}
            </>
          )}

          {/* Retired */}
          {Object.values(numbers).filter(n=>n.retired).length>0&&(
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5, marginBottom:8, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.03)" }}>RETIRED ({Object.values(numbers).filter(n=>n.retired).length})</div>
              {Object.values(numbers).filter(n=>n.retired).map(n=>(
                <div key={n.digits} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"rgba(255,255,255,0.01)", border:"1px solid rgba(255,255,255,0.03)", borderRadius:8, marginBottom:4, opacity:0.45 }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#3a4460", textDecoration:"line-through" }}>{n.number||fmtDigits(n.digits)}</span>
                  <span style={{ fontSize:9, color:"#2a3450", fontFamily:"'IBM Plex Mono',monospace" }}>Retired {fmtDate(n.retiredDate)}</span>
                  <button onClick={e=>{e.stopPropagation();unretireNumber(n.digits);}} style={{ marginLeft:"auto", padding:"3px 8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:5, color:"#5a6480", fontSize:9, cursor:"pointer" }}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══ MORNING AUDIT ══ */}
        {tab==="audit" && <>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:18, fontWeight:600, color:"#e8edf5", marginBottom:4 }}>☀ Morning Audit</div>
            <div style={{ fontSize:12, color:"#3a4460" }}>{auditDue>0?`${auditDue} number${auditDue>1?"s":""} due for re-check today.`:"Nothing due today. You're all clear."}</div>
          </div>

          {auditDue>0&&<>
            <button onClick={runAudit} disabled={auditLoading} style={{ padding:"11px 22px", marginBottom:20, background:auditLoading?"rgba(10,132,255,0.12)":"linear-gradient(135deg,#0a84ff,#0060cc)", border:"none", borderRadius:8, color:"#fff", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, letterSpacing:1.5, cursor:auditLoading?"not-allowed":"pointer" }}>
              {auditLoading?`SCANNING ${auditResults.length} / ${auditDue}...`:`RUN AUDIT (${auditDue} NUMBERS)`}
            </button>

            {auditResults.length===0&&!auditLoading&&auditNumbers.map(n=>(
              <div key={n.digits} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"rgba(255,159,10,0.04)", border:"1px solid rgba(255,159,10,0.12)", borderRadius:8, marginBottom:4 }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#5a6480" }}>{n.number||fmtDigits(n.digits)}</span>
                <span style={{ fontSize:10, color:"#3a4460" }}>{n.client||"—"}</span>
                {n.sdr&&<span style={{ fontSize:10, color:"#3a4460" }}>{n.sdr}</span>}
                <span style={{ marginLeft:"auto", fontSize:9, color:"#ff9f0a", fontFamily:"'IBM Plex Mono',monospace" }}>DUE TODAY</span>
              </div>
            ))}

            {auditResults.length>0&&<>
              {auditResults.map(({entry:n,data})=>{
                const r=data?.success?getRisk(data.fraud_score):null;
                const nCR=numbers[n.digits]?.connectRate;
                const nPct=nCR?.dials&&nCR?.connects?Math.round((parseInt(nCR.connects)/parseInt(nCR.dials))*100):null;
                const rec=data?.success?getRecommendation(data,n.registered,nPct):null;
                return (
                  <div key={n.digits} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:`1px solid ${r?r.border:"rgba(255,255,255,0.04)"}`, borderRadius:8, marginBottom:5, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#5a6480", minWidth:120 }}>{n.number||fmtDigits(n.digits)}</span>
                    <span style={{ fontSize:10, color:"#3a4460" }}>{n.client||"—"}</span>
                    {n.sdr&&<span style={{ fontSize:9, color:"#3a4460", padding:"1px 6px", background:"rgba(255,255,255,0.04)", borderRadius:3 }}>{n.sdr}</span>}
                    {r&&<span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700, color:r.color }}>{data.fraud_score}</span>}
                    {nPct!==null&&<span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, color:nPct>=10?"#30d158":nPct>=5?"#ff9f0a":"#ff3b30" }}>{nPct}% CR</span>}
                    {rec&&<span style={{ fontSize:11, fontWeight:600, color:rec.color }}>{rec.icon} {rec.action}</span>}
                  </div>
                );
              })}

              {flaggedForReg.length>0?(
                <div style={{ marginTop:16, padding:"14px 16px", background:"rgba(255,59,48,0.06)", border:"1px solid rgba(255,59,48,0.18)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#ff3b30", marginBottom:2 }}>⚠️ {flaggedForReg.length} Number{flaggedForReg.length>1?"s":""} Need Registration</div>
                    <div style={{ fontSize:10, color:"#7a3a3a" }}>{flaggedForReg.map(r=>r.entry.number||fmtDigits(r.entry.digits)).join(", ")}</div>
                  </div>
                  <a href={FREE_CALLER_REGISTRY} target="_blank" rel="noopener noreferrer" style={{ padding:"10px 18px", background:"#ff3b30", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap", fontFamily:"'IBM Plex Mono',monospace" }}>REGISTER ALL ↗</a>
                </div>
              ):auditResults.length===auditDue&&(
                <div style={{ marginTop:16, padding:"14px 16px", background:"rgba(48,209,88,0.07)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:10, fontSize:12, color:"#30d158", fontWeight:600 }}>
                  ✓ All clear — no registration needed today.
                </div>
              )}
            </>}
          </>}

          {auditDue===0&&(
            <div style={{ textAlign:"center", padding:"44px 0" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#1e2738", letterSpacing:2 }}>ALL CLEAR — NOTHING DUE TODAY</div>
            </div>
          )}
        </>}

      </div>
    </div>
  );
}
