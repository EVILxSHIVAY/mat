"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import "@/components/ui/ui.css";
import "../vendor.css";

export default function VendorConsumptionPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const vendorName = user?.vendorName || user?.name || "Vendor";

  // New Consumption Entry
  const [newLog, setNewLog] = useState({
    site: "Main Site",
    materialName: "",
    qty: 5,
    unit: "Pcs",
    date: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  useEffect(() => {
    const rawIssues = getStorageData(STORAGE_KEYS.ISSUES, []);
    const rawCons = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);

    const cleanUser = vendorName.toLowerCase().trim();
    const myIssues = rawIssues.filter((iss) => {
      const dept = String(iss.department || iss.issuedTo || "").toLowerCase().trim();
      return dept.includes(cleanUser) || cleanUser.includes(dept);
    });

    const myCons = rawCons.filter((con) => {
      const dept = String(con.department || con.partyName || "").toLowerCase().trim();
      return dept.includes(cleanUser) || cleanUser.includes(dept);
    });

    setIssues(myIssues);
    setConsumptions(myCons);
  }, [user, vendorName]);

  // Aggregate On-Hand Stock (Issued minus Consumed)
  const siteStock = useMemo(() => {
    const stockMap = new Map();

    issues.forEach((iss) => {
      if (iss.materials && Array.isArray(iss.materials)) {
        iss.materials.forEach((m) => {
          const key = m.name.toLowerCase().trim();
          const cur = stockMap.get(key) || {
            name: m.name,
            unit: (m.unit === "Meter" || m.name.toLowerCase().includes("pipe")) ? "Meter" : "Pcs",
            issued: 0,
            consumed: 0,
          };
          cur.issued += Number(m.quantity) || 0;
          stockMap.set(key, cur);
        });
      }
    });

    consumptions.forEach((c) => {
      const mat = (c.materialName || c.name || "").toLowerCase().trim();
      const cur = stockMap.get(mat);
      const qty = Number(c.quantity || c.qty) || 0;
      if (cur) {
        cur.consumed += qty;
      } else if (mat) {
        stockMap.set(mat, {
          name: c.materialName || c.name,
          unit: (c.unit === "Meter" || mat.includes("pipe")) ? "Meter" : "Pcs",
          issued: 0,
          consumed: qty,
        });
      }
    });

    return Array.from(stockMap.values()).map((item) => ({
      ...item,
      balance: Math.max(0, item.issued - item.consumed),
    }));
  }, [issues, consumptions]);

  const handleSaveConsumption = (e) => {
    e.preventDefault();
    if (!newLog.materialName) {
      alert("Please specify the material consumed.");
      return;
    }

    const validatedUnit = (newLog.unit === "Meter" || newLog.materialName.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";

    const entry = {
      id: `CON-${Date.now().toString().slice(-4)}`,
      partyName: vendorName,
      department: vendorName,
      site: newLog.site,
      materialName: newLog.materialName,
      qty: Number(newLog.qty) || 1,
      quantity: Number(newLog.qty) || 1,
      unit: validatedUnit,
      date: newLog.date,
      remarks: newLog.remarks,
      createdAt: new Date().toISOString(),
    };

    const allCons = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
    const updated = [entry, ...allCons];
    setStorageData(STORAGE_KEYS.CONSUMPTIONS, updated);
    setConsumptions((prev) => [entry, ...prev]);
    setIsModalOpen(false);
    setNewLog({
      site: "Main Site",
      materialName: "",
      qty: 5,
      unit: "Pcs",
      date: new Date().toISOString().split("T")[0],
      remarks: "",
    });
  };

  return (
    <Shell>
      <Title
        title="Site Inventory & Material Consumption"
        desc="Track materials held in field site custody, log physical installation/consumption, and monitor balance."
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setIsModalOpen(true)}
            style={{ background: "#059669" }}
          >
            + Log Site Consumption
          </button>
        }
      />

      {/* KPI Grid */}
      <div className="vendorKpiGrid">
        <div className="vendorKpiCard">
          <div className="vendorKpiIcon green">📦</div>
          <div>
            <span className="kpiLabel">Distinct Material Types</span>
            <h2 className="kpiValue">{siteStock.length}</h2>
            <span className="kpiSubtext">Materials received for site work</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon blue">🔨</div>
          <div>
            <span className="kpiLabel">Consumption Logs</span>
            <h2 className="kpiValue">{consumptions.length}</h2>
            <span className="kpiSubtext">Installation entries recorded</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon purple">⚖</div>
          <div>
            <span className="kpiLabel">Total Units Remaining</span>
            <h2 className="kpiValue">
              {siteStock.reduce((acc, s) => acc + s.balance, 0)}
            </h2>
            <span className="kpiSubtext">Uninstalled site stock balance</span>
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="vendorGridTwo">
        {/* Current Site Stock Balance */}
        <div className="sectionCard">
          <div className="sectionCardHeader">
            <h3 className="sectionCardTitle">
              <span>📊</span> Current On-Site Balance
            </h3>
          </div>

          {siteStock.length === 0 ? (
            <div className="emptyStateCard">
              <p>No material stock currently assigned to this vendor.</p>
            </div>
          ) : (
            <div className="tableWrapper">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th style={{ textAlign: "right" }}>Issued</th>
                    <th style={{ textAlign: "right" }}>Consumed</th>
                    <th style={{ textAlign: "right" }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {siteStock.map((s, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ color: "var(--foreground)" }}>{s.name}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.issued} {s.unit}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        {s.consumed} {s.unit}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: s.balance > 0 ? "#059669" : "var(--muted)",
                          }}
                        >
                          {s.balance} {s.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Consumption Entries */}
        <div className="sectionCard">
          <div className="sectionCardHeader">
            <h3 className="sectionCardTitle">
              <span>🕒</span> Recent Site Installation Logs
            </h3>
          </div>

          {consumptions.length === 0 ? (
            <div className="emptyStateCard">
              <p>No site consumption logged yet.</p>
              <button
                type="button"
                className="btn btn-sm primary"
                style={{ marginTop: "10px", background: "#059669" }}
                onClick={() => setIsModalOpen(true)}
              >
                + Record Daily Consumption
              </button>
            </div>
          ) : (
            <div className="drawerList">
              {consumptions.slice(0, 8).map((c, idx) => (
                <div key={c.id || idx} className="requestCardItem">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ color: "var(--foreground)", fontSize: "14px" }}>
                        {c.materialName || c.name}
                      </strong>
                      <span style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                        Date: {c.date || "Today"} · Site: {c.site || "General"}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, color: "#2563eb", fontSize: "14px" }}>
                      -{c.qty || c.quantity} {c.unit || "Pcs"}
                    </span>
                  </div>
                  {c.remarks && (
                    <div style={{ fontSize: "11.5px", color: "var(--muted)", fontStyle: "italic", marginTop: "4px" }}>
                      "{c.remarks}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consumption Modal */}
      {isModalOpen && (
        <div className="modalOverlay" onClick={() => setIsModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Log Material Consumption on Site</h3>
              <button type="button" className="closeBtn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConsumption}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>Material Installed / Consumed *</label>
                  <select
                    required
                    value={newLog.materialName}
                    onChange={(e) => {
                      const selected = siteStock.find((s) => s.name === e.target.value);
                      const inferred = (selected?.unit === "Meter" || e.target.value.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";
                      setNewLog({
                        ...newLog,
                        materialName: e.target.value,
                        unit: inferred,
                      });
                    }}
                  >
                    <option value="">-- Select Material from On-Hand Stock --</option>
                    {siteStock.map((s, idx) => (
                      <option key={idx} value={s.name}>
                        {s.name} (Balance: {s.balance} {s.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formRow">
                  <div className="formGroup">
                    <label>Quantity Installed / Used *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newLog.qty}
                      onChange={(e) => setNewLog({ ...newLog, qty: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Unit (Pcs or Meter)</label>
                    <select
                      value={newLog.unit === "Meter" ? "Meter" : "Pcs"}
                      onChange={(e) => setNewLog({ ...newLog, unit: e.target.value })}
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Meter">Meter</option>
                    </select>
                  </div>
                </div>

                <div className="formRow">
                  <div className="formGroup">
                    <label>Project Site / Sector</label>
                    <input
                      type="text"
                      value={newLog.site}
                      onChange={(e) => setNewLog({ ...newLog, site: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Consumption Date</label>
                    <input
                      type="date"
                      value={newLog.date}
                      onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>Job Execution Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 4 main pipeline pressure testing and connection"
                    value={newLog.remarks}
                    onChange={(e) => setNewLog({ ...newLog, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" style={{ background: "#059669" }}>
                  Record Consumption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
