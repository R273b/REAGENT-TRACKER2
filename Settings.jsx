import React, { useState } from "react";
import { Trash2, Plus, Save } from "lucide-react";
import { supabase } from "./supabaseClient";

const DEPARTMENTS = ["Chemistry", "Hematology", "Blood Bank"];

export default function Settings({ config, presets, reload }) {
  const [newPreset, setNewPreset] = useState({ name: "", department: "Chemistry", unit: "mL" });
  const [creds, setCreds] = useState({
    lab_username: config.lab_username,
    lab_password: config.lab_password,
    admin_username: config.admin_username,
    admin_password: config.admin_password,
    low_stock_default_percent: config.low_stock_default_percent,
  });
  const [msg, setMsg] = useState("");

  async function addPreset() {
    if (!newPreset.name) return;
    await supabase.from("reagent_presets").insert(newPreset);
    setNewPreset({ name: "", department: "Chemistry", unit: "mL" });
    reload();
  }

  async function deletePreset(id) {
    await supabase.from("reagent_presets").delete().eq("id", id);
    reload();
  }

  async function saveCreds() {
    const { error } = await supabase.from("app_config").update(creds).eq("id", 1);
    setMsg(error ? "Could not save." : "Saved.");
    reload();
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Settings</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 24 }}>Only visible to your admin account.</div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>REAGENT PRESET LIST</div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>
        This is the list staff pick from at the "Details" step when receiving stock.
      </div>

      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Reagent name"
            value={newPreset.name}
            onChange={(e) => setNewPreset((p) => ({ ...p, name: e.target.value }))}
            style={{ ...inputStyle, flex: 2, minWidth: 140, marginTop: 0 }}
          />
          <select
            value={newPreset.department}
            onChange={(e) => setNewPreset((p) => ({ ...p, department: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 120, marginTop: 0 }}
          >
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            placeholder="Unit"
            value={newPreset.unit}
            onChange={(e) => setNewPreset((p) => ({ ...p, unit: e.target.value }))}
            style={{ ...inputStyle, width: 80, marginTop: 0 }}
          />
          <button onClick={addPreset} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 30 }}>
        {presets.length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No presets yet — add your first reagent name above.</div>}
        {presets.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px" }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
            <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>{p.department} · {p.unit}</div>
            <button onClick={() => deletePreset(p.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>LOGIN & DEFAULTS</div>
      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Staff username<input style={inputStyle} value={creds.lab_username} onChange={(e) => setCreds((c) => ({ ...c, lab_username: e.target.value }))} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Staff password<input style={inputStyle} value={creds.lab_password} onChange={(e) => setCreds((c) => ({ ...c, lab_password: e.target.value }))} /></label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Your (admin) username<input style={inputStyle} value={creds.admin_username} onChange={(e) => setCreds((c) => ({ ...c, admin_username: e.target.value }))} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Your (admin) password<input style={inputStyle} value={creds.admin_password} onChange={(e) => setCreds((c) => ({ ...c, admin_password: e.target.value }))} /></label>
        </div>
        <label style={labelStyle}>Default low-stock alert (% of quantity received)
          <input type="number" style={inputStyle} value={creds.low_stock_default_percent} onChange={(e) => setCreds((c) => ({ ...c, low_stock_default_percent: Number(e.target.value) }))} />
        </label>
        <button onClick={saveCreds} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Save size={14} /> Save settings
        </button>
        {msg && <div style={{ fontSize: 12.5, color: "#2F6B4F" }}>{msg}</div>}
      </div>

      <div style={{ fontSize: 11.5, color: "#8A9694", marginTop: 14 }}>
        Note: these credentials are stored as plain text and are visible to anyone with the app link — fine for internal use, not for sensitive data.
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };
