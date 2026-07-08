import React, { useState, useEffect, useMemo } from "react";
import { Beaker, TrendingDown, Plus, Users, FileText, LayoutGrid, ChevronRight, X, Droplet, ScanLine, Pencil, Trash2, Bell, LogOut, SlidersHorizontal, Download, AlertTriangle, ClipboardX } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import Settings from "./Settings";
import BarcodeScanner from "./BarcodeScanner";
import ReceiveWizard from "./ReceiveWizard";

const DEPARTMENTS = ["Chemistry", "Hematology", "Blood Bank"];
const DEPT_COLOR = { Chemistry: "#0F7173", Hematology: "#B5473A", "Blood Bank": "#8A5A2B" };
const INSPECTION_KEYS = ["intact_container", "complete_compound", "expiration_validity", "lot_matches_kit", "storage_condition_ok"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

function statusOf(item) {
  const dExp = daysBetween(item.expiry_date, todayISO());
  const lowStock = item.current_quantity <= item.low_stock_threshold;
  if (dExp < 0 || item.current_quantity <= 0) return "red";
  if (dExp <= 30 || lowStock) return "yellow";
  return "green";
}

function hasInspectionIssue(item) {
  return INSPECTION_KEYS.some((k) => item[k] === false);
}

const STATUS_META = {
  red: { label: "Critical", color: "#C1432B", bg: "#FBEAE6" },
  yellow: { label: "Watch", color: "#B8860B", bg: "#FBF3DF" },
  green: { label: "Stable", color: "#2F6B4F", bg: "#E8F2EC" },
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem("reagent_role") || null);
  const [reagents, setReagents] = useState(null);
  const [logs, setLogs] = useState(null);
  const [presets, setPresets] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [showWizard, setShowWizard] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editReagent, setEditReagent] = useState(null);
  const [editLog, setEditLog] = useState(null);
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  async function ensureConfig() {
    let { data } = await supabase.from("app_config").select("*").eq("id", 1).maybeSingle();
    if (!data) {
      await supabase.from("app_config").insert({ id: 1 });
      const r = await supabase.from("app_config").select("*").eq("id", 1).maybeSingle();
      data = r.data;
    }
    setConfig(data);
  }

  async function loadAll() {
    const { data: r, error: e1 } = await supabase.from("reagents").select("*").order("expiry_date");
    const { data: l, error: e2 } = await supabase.from("consumption_logs").select("*");
    const { data: p } = await supabase.from("reagent_presets").select("*").order("name");
    if (e1 || e2) {
      setError("Could not connect to the database. Check Supabase settings.");
      setReagents([]);
      setLogs([]);
      return;
    }
    setReagents(r || []);
    setLogs(l || []);
    setPresets(p || []);
  }

  useEffect(() => {
    ensureConfig();
    loadAll();
  }, []);

  function handleLogin(newRole) {
    localStorage.setItem("reagent_role", newRole);
    setRole(newRole);
  }
  function logout() {
    localStorage.removeItem("reagent_role");
    setRole(null);
  }

  async function addReagent(entry) {
    await supabase.from("reagents").insert({
      name: entry.name,
      department: entry.department,
      lot_number: entry.lotNumber,
      unit: entry.unit,
      quantity_received: entry.quantityReceived,
      current_quantity: entry.quantityReceived,
      expiry_date: entry.expiryDate,
      date_added: entry.receivedDate,
      added_by: entry.receivedBy,
      low_stock_threshold: entry.lowStockThreshold,
      intact_container: entry.intact_container,
      complete_compound: entry.complete_compound,
      expiration_validity: entry.expiration_validity,
      lot_matches_kit: entry.lot_matches_kit,
      storage_condition_ok: entry.storage_condition_ok,
      tested_by_qc: entry.tested_by_qc,
    });
    setShowWizard(false);
    loadAll();
  }

  async function recordConsumption(entry) {
    const item = reagents.find((r) => r.id === entry.reagentId);
    if (!item) return;
    const newQty = Math.max(0, item.current_quantity - entry.amount);
    await supabase.from("reagents").update({ current_quantity: newQty }).eq("id", item.id);
    await supabase.from("consumption_logs").insert({
      reagent_id: entry.reagentId, amount: entry.amount, date: entry.date, used_by: entry.usedBy, note: entry.note,
    });
    setShowLog(false);
    loadAll();
  }

  async function saveEditedReagent(updated) {
    await supabase.from("reagents").update({
      lot_number: updated.lot_number,
      quantity_received: updated.quantity_received,
      current_quantity: updated.current_quantity,
      expiry_date: updated.expiry_date,
      low_stock_threshold: updated.low_stock_threshold,
    }).eq("id", updated.id);
    setEditReagent(null);
    loadAll();
  }

  async function deleteReagent(id) {
    if (!confirm("Delete this lot and its consumption history?")) return;
    await supabase.from("reagents").delete().eq("id", id);
    loadAll();
  }

  async function saveEditedLog(updated, original) {
    const item = reagents.find((r) => r.id === original.reagent_id);
    if (item) {
      const delta = updated.amount - original.amount;
      const newQty = Math.max(0, item.current_quantity - delta);
      await supabase.from("reagents").update({ current_quantity: newQty }).eq("id", item.id);
    }
    await supabase.from("consumption_logs").update({
      amount: updated.amount, date: updated.date, used_by: updated.used_by, note: updated.note,
    }).eq("id", updated.id);
    setEditLog(null);
    loadAll();
  }

  async function deleteLog(log) {
    if (!confirm("Delete this log entry? The amount will be added back to stock.")) return;
    const item = reagents.find((r) => r.id === log.reagent_id);
    if (item) await supabase.from("reagents").update({ current_quantity: item.current_quantity + log.amount }).eq("id", item.id);
    await supabase.from("consumption_logs").delete().eq("id", log.id);
    loadAll();
  }

  const groups = useMemo(() => {
    if (!reagents) return [];
    const map = {};
    for (const r of reagents) {
      if (!map[r.name]) map[r.name] = [];
      map[r.name].push(r);
    }
    return Object.entries(map).map(([name, items]) => {
      const sorted = [...items].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      const totalQty = items.reduce((s, i) => s + i.current_quantity, 0);
      const worstStatus = items.some((i) => statusOf(i) === "red") ? "red" : items.some((i) => statusOf(i) === "yellow") ? "yellow" : "green";
      const flagged = items.some(hasInspectionIssue);
      return { name, items: sorted, fefo: sorted[0], totalQty, status: worstStatus, department: items[0].department, unit: items[0].unit, flagged };
    });
  }, [reagents]);

  const counts = useMemo(() => {
    const c = { red: 0, yellow: 0, green: 0, flagged: 0 };
    groups.forEach((g) => { c[g.status]++; if (g.flagged) c.flagged++; });
    return c;
  }, [groups]);

  useEffect(() => {
    if (!reagents || Notification?.permission !== "granted") return;
    if (counts.red === 0) return;
    const key = `notified-${todayISO()}`;
    if (localStorage.getItem(key)) return;
    new Notification("Reagent Log — Critical items", { body: `${counts.red} reagent(s) expired or out of stock. Open the app to review.` });
    localStorage.setItem(key, "1");
  }, [counts, reagents]);

  function enableNotifications() { Notification.requestPermission(); }

  if (!config || reagents === null || logs === null) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "IBM Plex Mono, monospace", color: "#4A5A5C" }}>Loading…</div>;
  }
  if (!role) return <Login config={config} onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#F0F3F2", fontFamily: "'IBM Plex Sans', sans-serif", color: "#1B2B2E" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #C7D1CE; border-radius: 4px; }
      `}</style>

      <Header tab={tab} setTab={setTab} role={role} onAdd={() => setShowWizard(true)} onLog={() => setShowLog(true)} onLogout={logout} onEnableNotif={enableNotifications} />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px" }}>
        {counts.red > 0 && !bannerDismissed && tab !== "settings" && (
          <div style={{ background: "#FBEAE6", border: "1px solid #C1432B33", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="#C1432B" />
            <div style={{ flex: 1, fontSize: 13.5, color: "#8A2E1F" }}><b>{counts.red}</b> reagent{counts.red > 1 ? "s" : ""} expired or out of stock — needs attention now.</div>
            <button onClick={() => setBannerDismissed(true)} style={{ background: "none", border: "none", color: "#8A2E1F" }}><X size={16} /></button>
          </div>
        )}
        {counts.flagged > 0 && tab !== "settings" && (
          <div style={{ background: "#FBF3DF", border: "1px solid #B8860B33", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardX size={18} color="#B8860B" />
            <div style={{ flex: 1, fontSize: 13.5, color: "#7A5C08" }}><b>{counts.flagged}</b> reagent{counts.flagged > 1 ? "s" : ""} failed an inspection check on receipt — review before use.</div>
          </div>
        )}

        {tab === "dashboard" && <Dashboard groups={groups} counts={counts} onSelect={(g) => { setSelectedGroup(g); setTab("detail"); }} />}
        {tab === "detail" && selectedGroup && (
          <DetailView
            group={groups.find((g) => g.name === selectedGroup.name) || selectedGroup}
            logs={logs.filter((l) => (groups.find((g) => g.name === selectedGroup.name)?.items || []).some((i) => i.id === l.reagent_id))}
            onBack={() => setTab("dashboard")}
            onEditReagent={setEditReagent} onDeleteReagent={deleteReagent}
            onEditLog={setEditLog} onDeleteLog={deleteLog}
          />
        )}
        {tab === "reports" && <Reports groups={groups} logs={logs} reagents={reagents} />}
        {tab === "settings" && role === "admin" && <Settings config={config} presets={presets} reload={() => { ensureConfig(); loadAll(); }} />}
      </main>

      {showWizard && <ReceiveWizard presets={presets} role={role} onClose={() => setShowWizard(false)} onSubmit={addReagent} />}
      {showLog && <LogConsumptionModal reagents={reagents} onClose={() => setShowLog(false)} onSubmit={recordConsumption} />}
      {editReagent && <EditReagentModal reagent={editReagent} onClose={() => setEditReagent(null)} onSave={saveEditedReagent} />}
      {editLog && <EditLogModal log={editLog} onClose={() => setEditLog(null)} onSave={saveEditedLog} />}
      {error && <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#C1432B", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14 }}>{error}</div>}
    </div>
  );
}

function Header({ tab, setTab, role, onAdd, onLog, onLogout, onEnableNotif }) {
  return (
    <header style={{ borderBottom: "1px solid #D6DEDB", background: "#1B2B2E" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Beaker size={22} color="#5FBFB0" />
          <div>
            <div style={{ color: "#F0F3F2", fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>Reagent Log</div>
            <div style={{ color: "#8FA39E", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>Rabia Hospital · Lab Inventory</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <NavBtn active={tab === "dashboard" || tab === "detail"} onClick={() => setTab("dashboard")} icon={<LayoutGrid size={15} />} label="Dashboard" />
          <NavBtn active={tab === "reports"} onClick={() => setTab("reports")} icon={<FileText size={15} />} label="Reports" />
          {role === "admin" && <NavBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<SlidersHorizontal size={15} />} label="Settings" />}
          <button onClick={onEnableNotif} title="Enable browser alerts" style={{ background: "transparent", border: "1px solid #39494A", color: "#8FA39E", borderRadius: 7, padding: "7px 9px" }}><Bell size={14} /></button>
          <div style={{ width: 1, height: 22, background: "#39494A", margin: "0 4px" }} />
          <button onClick={onLog} style={{ background: "transparent", border: "1px solid #5FBFB0", color: "#5FBFB0", borderRadius: 7, padding: "7px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><TrendingDown size={14} /> Log use</button>
          <button onClick={onAdd} style={{ background: "#5FBFB0", border: "none", color: "#0B2023", borderRadius: 7, padding: "7px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Receive stock</button>
          <button onClick={onLogout} title="Log out" style={{ background: "transparent", border: "1px solid #39494A", color: "#8FA39E", borderRadius: 7, padding: "7px 9px" }}><LogOut size={14} /></button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return <button onClick={onClick} style={{ background: active ? "#2A3B3D" : "transparent", color: active ? "#F0F3F2" : "#8FA39E", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</button>;
}

function StatCard({ status, count, label }) {
  const m = STATUS_META[status];
  return (
    <div style={{ background: m.bg, border: `1px solid ${m.color}22`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: m.color, fontFamily: "'IBM Plex Mono', monospace" }}>{count}</div>
      <div style={{ fontSize: 13, color: "#516361", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function GaugeBar({ pct, color }) {
  return (
    <div style={{ width: 44, height: 64, border: "1.5px solid #C7D1CE", borderRadius: 5, position: "relative", overflow: "hidden", background: "#fff", flexShrink: 0 }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.min(100, Math.max(3, pct))}%`, background: color, transition: "height .3s" }} />
      <div style={{ position: "absolute", top: 4, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(pct)}%</div>
    </div>
  );
}

function Dashboard({ groups, counts, onSelect }) {
  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", color: "#7B8E8A" }}>
        <Droplet size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#1B2B2E" }}>No reagents logged yet</div>
        <div style={{ fontSize: 14 }}>Use "Receive stock" above to add your first reagent batch.</div>
      </div>
    );
  }
  const byDept = DEPARTMENTS.map((d) => ({ dept: d, items: groups.filter((g) => g.department === d) })).filter((x) => x.items.length);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard status="red" count={counts.red} label="Critical — expired or out" />
        <StatCard status="yellow" count={counts.yellow} label="Watch — expiring or low" />
        <StatCard status="green" count={counts.green} label="Stable" />
      </div>
      {byDept.map(({ dept, items }) => (
        <div key={dept} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: DEPT_COLOR[dept] }} />
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>{dept}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((g) => {
              const m = STATUS_META[g.status];
              const pct = (g.fefo.current_quantity / g.fefo.quantity_received) * 100;
              const dExp = daysBetween(g.fefo.expiry_date, todayISO());
              return (
                <button key={g.name} onClick={() => onSelect(g)} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #E1E8E5", borderLeft: `4px solid ${m.color}`, borderRadius: 8, padding: "12px 16px", textAlign: "left" }}>
                  <GaugeBar pct={pct} color={m.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {g.name}
                      {g.flagged && <ClipboardX size={13} color="#B8860B" title="Inspection issue on receipt" />}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#7B8E8A", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      Lot {g.fefo.lot_number} · {g.fefo.current_quantity} {g.unit} left · {g.items.length > 1 ? `${g.items.length} lots` : "1 lot"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: 11.5, color: "#8A9694" }}>{dExp < 0 ? `expired ${Math.abs(dExp)}d ago` : `expires in ${dExp}d`}</div>
                  </div>
                  <ChevronRight size={16} color="#B7C3C0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailView({ group, logs, onBack, onEditReagent, onDeleteReagent, onEditLog, onDeleteLog }) {
  const last30 = logs.filter((l) => daysBetween(todayISO(), l.date) <= 30);
  const consumed30 = last30.reduce((s, l) => s + l.amount, 0);
  const avgDaily = consumed30 / 30;
  const daysLeft = avgDaily > 0 ? Math.round(group.totalQty / avgDaily) : null;

  const inspectionLabels = {
    intact_container: "Intact container",
    complete_compound: "Complete compound",
    expiration_validity: "Expiration validity",
    lot_matches_kit: "Lot matches kit",
    storage_condition_ok: "Storage condition",
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#0F7173", fontSize: 13, fontWeight: 600, marginBottom: 18, display: "flex", alignItems: "center", gap: 4 }}>← Back to dashboard</button>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{group.name}</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>{group.department} · {group.totalQty} {group.unit} in stock across {group.items.length} lot(s)</div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Avg daily use (30d)</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{avgDaily.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500 }}>{group.unit}/day</span></div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Projected runout</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{daysLeft !== null ? `${daysLeft}d` : "—"}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Consumed this month</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{consumed30} <span style={{ fontSize: 13, fontWeight: 500 }}>{group.unit}</span></div>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>LOTS — use earliest expiry first (FEFO)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
        {group.items.map((it, idx) => {
          const dExp = daysBetween(it.expiry_date, todayISO());
          const m = STATUS_META[statusOf(it)];
          const failedItems = INSPECTION_KEYS.filter((k) => it[k] === false).map((k) => inspectionLabels[k]);
          return (
            <div key={it.id} style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {idx === 0 && <span style={{ background: "#0F7173", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4 }}>USE FIRST</span>}
                <div style={{ flex: 1, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>Lot {it.lot_number}</div>
                <div style={{ fontSize: 13 }}>{it.current_quantity}/{it.quantity_received} {it.unit}</div>
                <div style={{ fontSize: 12.5, color: m.color, fontWeight: 600 }}>{dExp < 0 ? `expired ${Math.abs(dExp)}d ago` : `${dExp}d left`}</div>
                <div style={{ fontSize: 11.5, color: it.tested_by_qc ? "#2F6B4F" : "#8A9694" }}>{it.tested_by_qc ? "QC ✓" : "QC pending"}</div>
                <button onClick={() => onEditReagent(it)} style={{ background: "none", border: "none", color: "#8A9694" }}><Pencil size={14} /></button>
                <button onClick={() => onDeleteReagent(it.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={14} /></button>
              </div>
              {failedItems.length > 0 && (
                <div style={{ marginTop: 8, background: "#FBF3DF", border: "1px solid #B8860B33", borderRadius: 6, padding: "6px 10px", fontSize: 11.5, color: "#7A5C08" }}>
                  ⚠ Inspection issue: {failedItems.join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>CONSUMPTION HISTORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No usage logged yet.</div>}
        {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, padding: "8px 0", borderBottom: "1px solid #EEF2F0" }}>
            <div style={{ width: 90, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{l.date}</div>
            <div style={{ flex: 1 }}>−{l.amount} {group.unit}</div>
            <div style={{ color: "#7B8E8A", display: "flex", alignItems: "center", gap: 4 }}><Users size={12} /> {l.used_by}</div>
            <button onClick={() => onEditLog(l)} style={{ background: "none", border: "none", color: "#8A9694" }}><Pencil size={13} /></button>
            <button onClick={() => onDeleteLog(l)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reports({ groups, logs, reagents }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const monthLogs = logs.filter((l) => l.date.slice(0, 7) === month);
  const byName = {};
  monthLogs.forEach((l) => {
    const item = reagents.find((r) => r.id === l.reagent_id);
    if (!item) return;
    byName[item.name] = byName[item.name] || { consumed: 0, unit: item.unit, department: item.department };
    byName[item.name].consumed += l.amount;
  });

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = Object.entries(byName).map(([name, d]) => {
      const g = groups.find((gr) => gr.name === name);
      return { Reagent: name, Department: d.department, ["Consumed (" + d.unit + ")"]: d.consumed, ["Current stock (" + d.unit + ")"]: g ? g.totalQty : "" };
    });
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No consumption recorded for this month." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, month);
    XLSX.writeFile(wb, `reagent-report-${month}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Monthly report</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
          <button onClick={exportExcel} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#F0F3F2", textAlign: "left" }}>
            <th style={{ padding: "10px 14px", fontSize: 12, color: "#7B8E8A", fontWeight: 700 }}>REAGENT</th>
            <th style={{ padding: "10px 14px", fontSize: 12, color: "#7B8E8A", fontWeight: 700 }}>DEPARTMENT</th>
            <th style={{ padding: "10px 14px", fontSize: 12, color: "#7B8E8A", fontWeight: 700 }}>CONSUMED</th>
            <th style={{ padding: "10px 14px", fontSize: 12, color: "#7B8E8A", fontWeight: 700 }}>CURRENT STOCK</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byName).length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#8A9694", fontSize: 13 }}>No consumption recorded for this month.</td></tr>}
          {Object.entries(byName).map(([name, d]) => {
            const g = groups.find((gr) => gr.name === name);
            return (
              <tr key={name} style={{ borderTop: "1px solid #EEF2F0" }}>
                <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{name}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{d.department}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{d.consumed} {d.unit}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{g ? g.totalQty : "—"} {d.unit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };

function LogConsumptionModal({ reagents, onClose, onSubmit }) {
  const names = [...new Set(reagents.map((r) => r.name))];
  const [name, setName] = useState(names[0] || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [usedBy, setUsedBy] = useState("");
  const [note, setNote] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const lots = reagents.filter((r) => r.name === name).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  const fefo = lots[0];

  function handleScan(text) {
    const match = reagents.find((r) => r.lot_number === text);
    if (match) setName(match.name);
    setShowScanner(false);
  }

  function submit() {
    if (!fefo || !amount || !usedBy) return;
    onSubmit({ reagentId: fefo.id, amount: Number(amount), date, usedBy, note });
  }

  if (names.length === 0) {
    return <Modal title="Log consumption" onClose={onClose}><div style={{ fontSize: 13.5, color: "#7B8E8A" }}>No reagents in inventory yet. Receive stock first.</div></Modal>;
  }

  return (
    <Modal title="Log daily consumption" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ ...labelStyle, flex: 1 }}>Reagent
            <select style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <button type="button" onClick={() => setShowScanner(true)} style={{ background: "#F0F3F2", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 10px" }}><ScanLine size={16} /></button>
        </div>
        {fefo && (
          <div style={{ background: "#EAF6F4", border: "1px solid #C6E8E3", borderRadius: 7, padding: "9px 12px", fontSize: 12.5, color: "#0F5F5B" }}>
            FEFO suggests <b>Lot {fefo.lot_number}</b> ({fefo.current_quantity} {fefo.unit} left, expires {fefo.expiry_date}){lots.length > 1 ? ` — ${lots.length} lots available` : ""}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Amount used ({fefo?.unit || "unit"})<input type="number" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Date<input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Used by<input style={inputStyle} value={usedBy} onChange={(e) => setUsedBy(e.target.value)} placeholder="Your name" /></label>
        <label style={labelStyle}>Note (optional)<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. daily QC run" /></label>
        <button onClick={submit} style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>Save log</button>
      </div>
      {showScanner && <BarcodeScanner onClose={() => setShowScanner(false)} onDetected={handleScan} />}
    </Modal>
  );
}

function EditReagentModal({ reagent, onClose, onSave }) {
  const [form, setForm] = useState({ ...reagent });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={`Edit lot ${reagent.lot_number}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Lot number<input style={inputStyle} value={form.lot_number} onChange={set("lot_number")} /></label>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Quantity received<input type="number" style={inputStyle} value={form.quantity_received} onChange={set("quantity_received")} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Current quantity<input type="number" style={inputStyle} value={form.current_quantity} onChange={set("current_quantity")} /></label>
        </div>
        <label style={labelStyle}>Expiry date<input type="date" style={inputStyle} value={form.expiry_date} onChange={set("expiry_date")} /></label>
        <label style={labelStyle}>Low stock alert below<input type="number" style={inputStyle} value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
        <button
          onClick={() => onSave({ ...form, quantity_received: Number(form.quantity_received), current_quantity: Number(form.current_quantity), low_stock_threshold: Number(form.low_stock_threshold) })}
          style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}
        >Save changes</button>
      </div>
    </Modal>
  );
}

function EditLogModal({ log, onClose, onSave }) {
  const [form, setForm] = useState({ ...log });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Edit consumption log" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Amount<input type="number" style={inputStyle} value={form.amount} onChange={set("amount")} /></label>
        <label style={labelStyle}>Date<input type="date" style={inputStyle} value={form.date} onChange={set("date")} /></label>
        <label style={labelStyle}>Used by<input style={inputStyle} value={form.used_by} onChange={set("used_by")} /></label>
        <label style={labelStyle}>Note<input style={inputStyle} value={form.note || ""} onChange={set("note")} /></label>
        <button onClick={() => onSave({ ...form, amount: Number(form.amount) }, log)} style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>Save changes</button>
      </div>
    </Modal>
  );
}
