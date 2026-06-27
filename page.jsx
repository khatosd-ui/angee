"use client";
import { useState, useEffect, useMemo, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dvdysiuxylvkxgwesogc.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZHlzaXV4eWx2a3hnd2Vzb2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1ODc4MzMsImV4cCI6MjA5ODE2MzgzM30.ufbX8N5ytfA-eeHA42QpDERw1i6yLHIa3kDwxt1rPaI";
const EDGE_FN = `${SUPABASE_URL}/functions/v1/parse-bank-statement`;

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
};

const CAT_COLORS = {
  "راتب": "#10b981", "عميل": "#3b82f6", "مكتب": "#8b5cf6",
  "فواتير": "#f59e0b", "طعام وترفيه": "#ef4444", "تسوق": "#ec4899",
  "تنقل": "#06b6d4", "صحة": "#84cc16", "برامج": "#6366f1",
  "ترفيه": "#f97316", "تحويل": "#a78bfa", "أخرى": "#9ca3af",
};

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

// ─── DB helpers ─────────────────────────────────────────────────────────────
async function dbGet(table, params = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  return r.json();
}
async function dbPost(table, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}
async function dbDelete(table, id) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE", headers: HEADERS,
  });
}

function fmt(n) {
  return new Intl.NumberFormat("ar-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(Math.abs(n));
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: "#1c1f2e", borderRadius: 16, padding: "18px 22px", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DonutChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  if (!total) return null;
  const r = size * 0.36, cx = size / 2, cy = size / 2, sw = size * 0.15;
  let off = 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2d3148" strokeWidth={sw} />
      {data.map((d, i) => {
        const pct = Math.abs(d.value) / total;
        const circ = 2 * Math.PI * r;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={d.color} strokeWidth={sw}
            strokeDasharray={`${pct * circ} ${circ}`}
            strokeDashoffset={-off * circ} />
        );
        off += pct;
        return el;
      })}
    </svg>
  );
}

function UploadZone({ accounts, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selAccount, setSelAccount] = useState("");
  const fileRef = useRef();

  useEffect(() => { if (accounts[0]) setSelAccount(accounts[0].id); }, [accounts]);

  async function process(file) {
    if (!file || !selAccount) { setMsg("⚠️ اختر الحساب أولاً"); return; }
    setLoading(true); setMsg("⏳ AI يقرأ الكشف...");
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const now = new Date();
      const resp = await fetch(EDGE_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: b64, accountId: selAccount, filename: file.name, month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      const data = await resp.json();
      if (data.success) { setMsg(`✅ تم استخراج ${data.count} معاملة`); onUploaded(); }
      else setMsg(`❌ خطأ: ${data.error}`);
    } catch (e) { setMsg(`❌ ${e.message}`); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <select value={selAccount} onChange={e => setSelAccount(e.target.value)}
        style={{ background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: "10px 14px", color: "#f3f4f6", fontSize: 14, fontFamily: "inherit" }}>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.bank_name}</option>)}
      </select>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragging ? "#818cf8" : "#374151"}`, borderRadius: 16,
          padding: "40px 24px", textAlign: "center", cursor: "pointer",
          background: dragging ? "#1e1b4b22" : "transparent",
          transition: "all 0.2s",
        }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>{loading ? "⏳" : "📄"}</div>
        <div style={{ color: "#9ca3af", fontSize: 14 }}>
          {loading ? msg : "اسحب كشف الحساب PDF هنا أو اضغط للاختيار"}
        </div>
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>يدعم PDF من أي بنك إماراتي</div>
      </div>
      <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => process(e.target.files[0])} />
      {msg && !loading && (
        <div style={{ background: msg.startsWith("✅") ? "#064e3b22" : "#7f1d1d22", border: `1px solid ${msg.startsWith("✅") ? "#065f46" : "#7f1d1d"}`, borderRadius: 10, padding: "10px 16px", color: "#d1fae5", fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterScope, setFilterScope] = useState("all");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear] = useState(new Date().getFullYear());
  const [aiInsights, setAiInsights] = useState([]);
  const [insightLoading, setInsightLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    const [accs, txs, ups] = await Promise.all([
      dbGet("bank_accounts", "order=created_at.asc"),
      dbGet("transactions", "order=date.desc&limit=500"),
      dbGet("pdf_uploads", "order=uploaded_at.desc&limit=20"),
    ]);
    setAccounts(Array.isArray(accs) ? accs : []);
    setTransactions(Array.isArray(txs) ? txs : []);
    setUploads(Array.isArray(ups) ? ups : []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Filter txs
  const filtered = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    const monthMatch = d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
    const scopeMatch = filterScope === "all" || t.scope === filterScope;
    return monthMatch && scopeMatch;
  }), [transactions, filterMonth, filterYear, filterScope]);

  // Stats
  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const personalExp = filtered.filter(t => t.type === "expense" && t.scope === "personal").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const businessExp = filtered.filter(t => t.type === "expense" && t.scope === "business").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const businessIncome = filtered.filter(t => t.type === "income" && t.scope === "business").reduce((s, t) => s + Number(t.amount), 0);
    const catMap = {};
    filtered.filter(t => t.type === "expense").forEach(t => {
      const c = t.category || "أخرى";
      catMap[c] = (catMap[c] || 0) + Math.abs(Number(t.amount));
    });
    const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: k, value: v, color: CAT_COLORS[k] || "#9ca3af" }));
    return { income, expense, personalExp, businessExp, businessIncome, net: income - expense, catData };
  }, [filtered]);

  async function generateInsights() {
    if (!filtered.length) return;
    setInsightLoading(true);
    try {
      const summary = {
        month: MONTHS_AR[filterMonth - 1],
        totalIncome: stats.income,
        totalExpense: stats.expense,
        personalExpense: stats.personalExp,
        businessExpense: stats.businessExp,
        savings: stats.net,
        topCategories: stats.catData.slice(0, 5),
        transactionCount: filtered.length,
      };
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `أنت مستشار مالي شخصي. بناءً على هذا الملخص المالي لشهر ${summary.month}:
${JSON.stringify(summary, null, 2)}

أعطني 4 توصيات مالية عملية وشخصية باللغة العربية.
أجب بـ JSON فقط هكذا:
{"insights": [{"icon": "emoji", "title": "عنوان قصير", "body": "توصية عملية محددة مع أرقام", "type": "warning|ok|tip|target"}]}`
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text?.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      setAiInsights(parsed.insights || []);
    } catch (e) { console.error(e); }
    setInsightLoading(false);
  }

  // ── Styles ──
  const S = {
    app: { minHeight: "100vh", background: "#0f1117", color: "#f3f4f6", fontFamily: "'Cairo','Segoe UI',sans-serif", direction: "rtl" },
    header: { background: "linear-gradient(135deg,#1a1040 0%,#0f1117 100%)", padding: "20px 28px 0", borderBottom: "1px solid #1f2436" },
    body: { padding: "24px 28px", maxWidth: 1100, margin: "0 auto" },
    grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 24 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 },
    card: { background: "#1c1f2e", borderRadius: 16, padding: 22 },
    cardTitle: { fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 16, marginTop: 0 },
    tab: (a) => ({ padding: "10px 18px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, background: a ? "#0f1117" : "transparent", color: a ? "#818cf8" : "#6b7280", borderBottom: a ? "2px solid #818cf8" : "2px solid transparent", borderRadius: "10px 10px 0 0", transition: "all 0.2s" }),
    pill: (a, c = "#818cf8") => ({ padding: "5px 14px", borderRadius: 20, border: `1px solid ${a ? c : "#2d3148"}`, background: a ? `${c}22` : "transparent", color: a ? c : "#9ca3af", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }),
    insight: (type) => ({ background: type === "warning" ? "#7f1d1d22" : type === "ok" ? "#064e3b22" : "#1e1b4b33", border: `1px solid ${type === "warning" ? "#7f1d1d88" : type === "ok" ? "#065f4688" : "#3730a388"}`, borderRadius: 12, padding: "14px 16px" }),
    txRow: (type) => ({ background: "#1c1f2e", borderRadius: 12, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, borderRight: `3px solid ${type === "income" ? "#10b981" : "#ef4444"}` }),
  };

  if (loading) return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ color: "#818cf8", fontSize: 18 }}>جاري التحميل...</div>
      </div>
    </div>
  );

  const TABS = [
    { id: "dashboard", label: "📊 لوحة التحكم" },
    { id: "upload", label: "📤 رفع كشف" },
    { id: "transactions", label: "📋 المعاملات" },
    { id: "report", label: "📄 التقرير" },
    { id: "accounts", label: "🏦 الحسابات" },
  ];

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#818cf8" }}>💳 مدير المصاريف الذكي</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{transactions.length} معاملة محفوظة · {accounts.length} حساب بنكي</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {MONTHS_AR.map((m, i) => (
              <button key={i} style={S.pill(filterMonth === i + 1)} onClick={() => setFilterMonth(i + 1)}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
      </div>

      <div style={S.body}>

        {/* ─── DASHBOARD ─── */}
        {tab === "dashboard" && (
          <>
            {/* Scope filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[["all","الكل"],["personal","شخصي 🏠"],["business","مشروع 💼"]].map(([v,l]) => (
                <button key={v} style={S.pill(filterScope === v)} onClick={() => setFilterScope(v)}>{l}</button>
              ))}
            </div>

            <div style={S.grid4}>
              <KpiCard icon="💰" label="إجمالي الدخل" value={fmt(stats.income)} color="#10b981" sub={`${MONTHS_AR[filterMonth-1]} ${filterYear}`} />
              <KpiCard icon="💸" label="إجمالي المصاريف" value={fmt(stats.expense)} color="#ef4444" />
              <KpiCard icon="🏠" label="شخصي" value={fmt(stats.personalExp)} color="#f59e0b" />
              <KpiCard icon="💼" label="مشروع" value={fmt(stats.businessExp)} sub={`دخل: ${fmt(stats.businessIncome)}`} color="#6366f1" />
              <KpiCard icon="🏦" label="صافي التوفير" value={fmt(stats.net)} color={stats.net >= 0 ? "#10b981" : "#ef4444"} sub={stats.income > 0 ? `${Math.round((stats.net/stats.income)*100)}% من الدخل` : ""} />
            </div>

            <div style={S.grid2}>
              <div style={S.card}>
                <p style={S.cardTitle}>توزيع المصاريف</p>
                {stats.catData.length ? (
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <DonutChart data={stats.catData.slice(0,7)} size={130} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {stats.catData.slice(0,7).map((d,i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ color: "#9ca3af", fontSize: 12, flex: 1 }}>{d.label}</span>
                          <span style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 20 }}>لا توجد بيانات — ارفع كشف حساب أولاً</div>}
              </div>

              <div style={S.card}>
                <p style={S.cardTitle}>شخصي مقابل مشروع</p>
                {[
                  { label: "مصاريف شخصية", value: stats.personalExp, color: "#f59e0b" },
                  { label: "مصاريف مشروع", value: stats.businessExp, color: "#6366f1" },
                  { label: "دخل مشروع", value: stats.businessIncome, color: "#10b981" },
                ].map((item, i) => {
                  const max = Math.max(stats.personalExp, stats.businessExp, stats.businessIncome, 1);
                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "#9ca3af" }}>
                        <span>{item.label}</span><span style={{ color: item.color, fontWeight: 700 }}>{fmt(item.value)}</span>
                      </div>
                      <div style={{ background: "#2d3148", borderRadius: 6, height: 8 }}>
                        <div style={{ width: `${(item.value/max)*100}%`, height: "100%", background: item.color, borderRadius: 6, transition: "width 0.6s" }} />
                      </div>
                    </div>
                  );
                })}
                {stats.businessIncome > 0 && (
                  <div style={{ background: "#111827", borderRadius: 10, padding: "10px 14px", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#9ca3af", fontSize: 13 }}>هامش ربح المشروع</span>
                    <span style={{ color: "#10b981", fontWeight: 800 }}>
                      {Math.round(((stats.businessIncome - stats.businessExp) / stats.businessIncome) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Insights */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p style={{ ...S.cardTitle, marginBottom: 0 }}>🤖 توصيات الذكاء الاصطناعي</p>
                <button
                  onClick={generateInsights}
                  disabled={insightLoading}
                  style={{ background: "#4f46e5", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: insightLoading ? 0.7 : 1 }}>
                  {insightLoading ? "⏳ جاري التحليل..." : "✨ حلل مصاريفي"}
                </button>
              </div>
              {aiInsights.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {aiInsights.map((ins, i) => (
                    <div key={i} style={S.insight(ins.type)}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e7eb", marginBottom: 6 }}>{ins.icon} {ins.title}</div>
                      <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.7 }}>{ins.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
                  اضغط "حلل مصاريفي" للحصول على توصيات شخصية بالذكاء الاصطناعي
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── UPLOAD ─── */}
        {tab === "upload" && (
          <div style={{ maxWidth: 560 }}>
            <div style={S.card}>
              <p style={S.cardTitle}>📤 رفع كشف الحساب PDF</p>
              <UploadZone accounts={accounts} onUploaded={loadData} />
            </div>
            <div style={{ ...S.card, marginTop: 16 }}>
              <p style={S.cardTitle}>📋 آخر الملفات المرفوعة</p>
              {uploads.length ? uploads.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #2d3148", fontSize: 13 }}>
                  <span style={{ color: "#e5e7eb" }}>📄 {u.filename || "كشف حساب"}</span>
                  <span style={{ color: "#10b981" }}>{u.transactions_extracted} معاملة</span>
                  <span style={{ color: "#6b7280" }}>{new Date(u.uploaded_at).toLocaleDateString("ar-AE")}</span>
                </div>
              )) : <div style={{ color: "#6b7280", fontSize: 13 }}>لا توجد ملفات مرفوعة بعد</div>}
            </div>
          </div>
        )}

        {/* ─── TRANSACTIONS ─── */}
        {tab === "transactions" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {[["all","الكل"],["personal","شخصي"],["business","مشروع"]].map(([v,l]) => (
                <button key={v} style={S.pill(filterScope===v)} onClick={() => setFilterScope(v)}>{l}</button>
              ))}
              <span style={{ color: "#6b7280", fontSize: 13, alignSelf: "center", marginRight: "auto" }}>{filtered.length} معاملة</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length ? filtered.map(t => (
                <div key={t.id} style={S.txRow(t.type)}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${CAT_COLORS[t.category]||"#6366f1"}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {t.type === "income" ? "📥" : "📤"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#e5e7eb" }}>{t.description}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {t.date} · {t.category} · <span style={{ color: t.scope === "business" ? "#818cf8" : "#f59e0b" }}>{t.scope === "business" ? "مشروع" : "شخصي"}</span>
                      {t.merchant && ` · ${t.merchant}`}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                    {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                  </div>
                  <button onClick={() => dbDelete("transactions", t.id).then(loadData)}
                    style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, padding: 4 }}>🗑</button>
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  لا توجد معاملات لهذا الشهر — ارفع كشف حساب من تبويب "رفع كشف"
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── REPORT ─── */}
        {tab === "report" && (
          <>
            <div style={{ ...S.card, background: "linear-gradient(135deg,#1e1b4b,#1c1f2e)", border: "1px solid #3730a3", marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#818cf8", fontSize: 18 }}>📊 تقرير {MONTHS_AR[filterMonth-1]} {filterYear}</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>{filtered.length} معاملة</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: stats.net >= 0 ? "#10b981" : "#ef4444" }}>
                    {stats.income > 0 ? Math.round((stats.net / stats.income) * 100) : 0}%
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>نسبة التوفير</div>
                </div>
              </div>
            </div>

            <div style={S.grid2}>
              {[
                { title: "💼 ملخص المشروع", items: [
                  { l: "الدخل", v: stats.businessIncome, c: "#10b981" },
                  { l: "المصاريف", v: stats.businessExp, c: "#ef4444" },
                  { l: "الصافي", v: stats.businessIncome - stats.businessExp, c: "#818cf8" },
                ]},
                { title: "🏠 ملخص الشخصي", items: [
                  { l: "الدخل", v: stats.income - stats.businessIncome, c: "#10b981" },
                  { l: "المصاريف", v: stats.personalExp, c: "#ef4444" },
                  { l: "الصافي", v: (stats.income - stats.businessIncome) - stats.personalExp, c: "#818cf8" },
                ]},
              ].map((block, bi) => (
                <div key={bi} style={S.card}>
                  <p style={S.cardTitle}>{block.title}</p>
                  {block.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? "1px solid #2d3148" : "none", fontSize: 14 }}>
                      <span style={{ color: "#9ca3af" }}>{item.l}</span>
                      <span style={{ color: item.c, fontWeight: 700 }}>{fmt(item.v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={S.card}>
              <p style={S.cardTitle}>🔥 أعلى بنود الإنفاق</p>
              {stats.catData.slice(0,6).map((d,i) => {
                const max = stats.catData[0]?.value || 1;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: "#e5e7eb" }}>{d.label}</span>
                      <span style={{ color: d.color, fontWeight: 700 }}>{fmt(d.value)}</span>
                    </div>
                    <div style={{ background: "#2d3148", borderRadius: 6, height: 8 }}>
                      <div style={{ width: `${(d.value/max)*100}%`, height: "100%", background: d.color, borderRadius: 6, transition: "width 0.6s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── ACCOUNTS ─── */}
        {tab === "accounts" && (
          <div style={{ maxWidth: 560 }}>
            <div style={S.card}>
              <p style={S.cardTitle}>🏦 حساباتك البنكية</p>
              {accounts.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #2d3148" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: a.account_type === "business" ? "#4f46e522" : "#f59e0b22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {a.account_type === "business" ? "💼" : "🏠"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#e5e7eb" }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{a.bank_name} · {a.currency} · {a.account_type === "business" ? "مشروع" : "شخصي"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...S.card, marginTop: 16, background: "#064e3b22", border: "1px solid #065f46" }}>
              <p style={{ ...S.cardTitle, color: "#10b981" }}>📌 ملاحظة</p>
              <p style={{ color: "#6ee7b7", fontSize: 13, margin: 0, lineHeight: 1.8 }}>
                عند رفع كشف الحساب، اختر الحساب المناسب حتى تُنسب المعاملات بشكل صحيح. يمكنك إضافة حسابات إضافية مباشرة من قاعدة بيانات Supabase.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
