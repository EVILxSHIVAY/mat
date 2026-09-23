"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { exportToExcel } from "@/lib/exportToExcel";
import { syncSingleToGoogleSheets, getWebhookUrl } from "@/google_sheets_sync/syncClient";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  getTodayDate,
  inferUnit,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";
import "./ledger.css";

const INITIAL_NEEDED = {
  partyName: "",
  materialName: "",
  quantityNeeded: "",
  unit: "Pcs",
  requiredByDate: "",
  priority: "High",
  remarks: "",
};

export default function PartyLedgerPage() {
  // Data States
  const [suppliers, setSuppliers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [neededList, setNeededList] = useState([]);
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Selection & Tab States
  const [selectedParty, setSelectedParty] = useState("All Parties");
  const [activeTab, setActiveTab] = useState("needed"); // 'needed' | 'issued' | 'consumed'

  // Modal States
  const [isNeededModalOpen, setIsNeededModalOpen] = useState(false);
  const [newNeeded, setNewNeeded] = useState(INITIAL_NEEDED);

  // Load datasets on mount
  useEffect(() => {
    setSuppliers(getStorageData(STORAGE_KEYS.SUPPLIERS, []));
    setIssues(getStorageData(STORAGE_KEYS.ISSUES, []));
    setConsumptions(getStorageData(STORAGE_KEYS.CONSUMPTIONS, []));

    // Filter legacy sample placeholders if any
    const rawNeeded = getStorageData(STORAGE_KEYS.NEEDED, []);
    const cleanNeeded = rawNeeded.filter(
      (n) => n && n.partyName !== "Apex Supplies" && n.partyName !== "Vrindavan Site A"
    );
    setNeededList(cleanNeeded);
    if (cleanNeeded.length !== rawNeeded.length) {
      setStorageData(STORAGE_KEYS.NEEDED, cleanNeeded, false);
    }
  }, []);

  useEffect(() => {
    if (isNeededModalOpen) {
      lockScroll();
    }
    return () => {
      if (isNeededModalOpen) unlockScroll();
    };
  }, [isNeededModalOpen]);

  // Sync to Google Sheets
  const syncNeededToSheets = async (list) => {
    if (!getWebhookUrl()) return;
    try {
      const rows = list.map((n) => [
        n.partyName,
        n.materialName,
        n.quantityNeeded,
        n.unit,
        n.requiredByDate,
        n.priority,
        n.status,
        n.remarks,
      ]);
      await syncSingleToGoogleSheets({
        sheetName: "Material_Needed",
        headers: ["Party / Site", "Material Required", "Qty Needed", "Unit", "Required Date", "Priority", "Status", "Remarks"],
        rows,
      });
    } catch (e) {
      console.warn("Could not sync needed list to sheets:", e);
    }
  };

  const handleSyncCurrentTabToSheets = async () => {
    if (!getWebhookUrl()) {
      alert("Please configure your Google Sheets Webhook URL first on the Reports page.");
      return;
    }
    setIsSyncing(true);
    setSyncStatus("Syncing to Google Sheets...");
    try {
      await syncNeededToSheets(neededList);
      setSyncStatus("✓ Material Needed ledger synced to Google Sheets!");
    } catch (e) {
      setSyncStatus("Sync failed: " + e.message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(""), 4000);
    }
  };

  // Extract unique parties
  const uniqueParties = useMemo(() => {
    return Array.from(
      new Set([
        ...suppliers.map((s) => (Array.isArray(s) ? s[1] || s[0] : s.name || s.code)),
        ...issues.map((i) => i.department || i.issuedTo),
        ...consumptions.map((c) => c.department || c.site),
        ...neededList.map((n) => n.partyName),
      ])
    ).filter(Boolean);
  }, [suppliers, issues, consumptions, neededList]);

  // Filter datasets by selected party
  const filteredNeeded = useMemo(() => {
    return selectedParty === "All Parties"
      ? neededList
      : neededList.filter((n) => (n.partyName || "").toLowerCase().includes(selectedParty.toLowerCase()));
  }, [neededList, selectedParty]);

  const filteredIssues = useMemo(() => {
    return selectedParty === "All Parties"
      ? issues
      : issues.filter((i) => (i.department || i.issuedTo || "").toLowerCase().includes(selectedParty.toLowerCase()));
  }, [issues, selectedParty]);

  const filteredConsumptions = useMemo(() => {
    return selectedParty === "All Parties"
      ? consumptions
      : consumptions.filter((c) => (c.department || c.site || "").toLowerCase().includes(selectedParty.toLowerCase()));
  }, [consumptions, selectedParty]);

  // Helper to determine required quantity for an issued material
  const getRequiredQty = (issue, matName) => {
    if (!issue) return null;
    if (issue.requiredQty !== undefined && issue.requiredQty !== null) return issue.requiredQty;
    if (issue.quantityNeeded !== undefined && issue.quantityNeeded !== null) return issue.quantityNeeded;

    if (issue.reqId) {
      const matchById = neededList.find((n) => String(n.id) === String(issue.reqId));
      if (matchById) return matchById.quantityNeeded || matchById.quantity;
    }

    const party = String(issue.department || issue.issuedTo || "").toLowerCase().trim();
    const cleanMat = String(matName || "").toLowerCase().trim();
    const matched = neededList.find((n) => {
      const p = String(n.partyName || n.vendor || "").toLowerCase().trim();
      const m = String(n.materialName || "").toLowerCase().trim();
      const partyMatches = !party || p.includes(party) || party.includes(p);
      const matMatches = cleanMat && (m === cleanMat || cleanMat.includes(m) || m.includes(cleanMat));
      return partyMatches && matMatches;
    });

    if (matched) return matched.quantityNeeded || matched.quantity;
    return null;
  };

  // Save new material needed
  const handleSaveNeeded = (e) => {
    e.preventDefault();
    if (!newNeeded.partyName || !newNeeded.materialName || !newNeeded.quantityNeeded) {
      alert("Please fill in required fields.");
      return;
    }

    const itemToAdd = {
      id: Date.now(),
      partyName: newNeeded.partyName,
      materialName: newNeeded.materialName,
      quantityNeeded: newNeeded.quantityNeeded,
      unit: newNeeded.unit || "Pcs",
      requiredByDate: newNeeded.requiredByDate || new Date().toLocaleDateString("en-GB"),
      priority: newNeeded.priority || "High",
      status: "Requested",
      remarks: newNeeded.remarks || "",
    };

    const updated = [itemToAdd, ...neededList];
    setNeededList(updated);
    setStorageData(STORAGE_KEYS.NEEDED, updated);
    syncNeededToSheets(updated);
    setIsNeededModalOpen(false);
    setNewNeeded(INITIAL_NEEDED);
  };

  // Deletion handler
  const handleDeleteNeeded = (id) => {
    if (confirm("Remove this requirement?")) {
      const updated = neededList.filter((n) => n.id !== id);
      setNeededList(updated);
      setStorageData(STORAGE_KEYS.NEEDED, updated);
      syncNeededToSheets(updated);
    }
  };

  // Export current tab to Excel
  const handleExportStatement = () => {
    const filename = `${selectedParty.replace(/\s+/g, "_")}_Statement`;
    if (activeTab === "needed") {
      exportToExcel({
        filename,
        headers: ["Party Name", "Material Needed", "Quantity", "Unit", "Required Date", "Priority", "Status"],
        rows: filteredNeeded.map((n) => [n.partyName, n.materialName, n.quantityNeeded, n.unit, n.requiredByDate, n.priority, n.status]),
      });
    } else if (activeTab === "issued") {
      exportToExcel({
        filename,
        headers: ["Challan #", "Date", "Issued To", "Material", "Issued Qty", "Required Qty", "Status"],
        rows: filteredIssues.map((i) => {
          const mats =
            (i.materials && i.materials.length > 0)
              ? i.materials
              : (i.items && i.items.length > 0)
              ? i.items
              : (i.materialName
              ? [{ name: i.materialName, quantity: i.quantity || i.qty || 1, unit: i.unit }]
              : []);
          const matNames = mats.map((m) => m.name).join(", ") || i.materialName || "General Materials";
          const issuedQuantities = mats.map((m) => `${m.quantity ?? m.qty ?? 1} ${m.unit || inferUnit(m.name)}`).join(", ");
          const reqQuantities = mats.map((m) => {
            const req = getRequiredQty(i, m.name);
            return req !== null && req !== undefined ? `${req} ${m.unit || inferUnit(m.name)}` : "—";
          }).join(", ");
          return [
            i.number || i.challanNo,
            i.date,
            i.department || i.issuedTo,
            matNames,
            issuedQuantities,
            reqQuantities,
            i.status || "Issued",
          ];
        }),
      });
    } else {
      exportToExcel({
        filename,
        headers: ["Consumption #", "Date", "Department / Party", "Items Count", "Status"],
        rows: filteredConsumptions.map((c) => [c.number, c.date, c.department || c.site, c.itemsCount, c.status]),
      });
    }
  };

  return (
    <Shell>
      <Title
        title="Party Ledger"
        desc="Material requirements, dispatch vouchers, and site consumptions by vendor or site."
        action={
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary"
              disabled={isSyncing}
              onClick={handleSyncCurrentTabToSheets}
            >
              {isSyncing ? "Syncing..." : "Sync to Cloud"}
            </button>
            <button type="button" className="secondary" onClick={handleExportStatement}>
              Export CSV
            </button>
            <button type="button" className="primary" onClick={() => setIsNeededModalOpen(true)}>
              + Request Material
            </button>
          </div>
        }
      />

      {syncStatus && (
        <div style={{ padding: "10px 16px", background: "var(--green-bg)", color: "var(--green-text)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontWeight: "600", fontSize: "13px", border: "1px solid var(--green-border)" }}>
          {syncStatus}
        </div>
      )}

      {/* 1. Party Selector & Material Summary Bar */}
      <section className="card ledgerHeadCard">
        <div className="partySelectorRow">
          <div className="partySelector">
            <label>Party / Site Filter</label>
            <select value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)}>
              <option value="All Parties">All Parties & Sites (Overview)</option>
              {uniqueParties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="kpiGroup">
            <div className="kpiBox">
              <span className="kpiLabel">Material Requested</span>
              <strong className="kpiVal">{filteredNeeded.reduce((a, n) => a + (Number(n.quantityNeeded) || 1), 0)} Units</strong>
            </div>
            <div className="kpiBox success">
              <span className="kpiLabel">Material Issued</span>
              <strong className="kpiVal">{filteredIssues.reduce((a, i) => a + (Number(i.itemsCount) || 1), 0)} Items</strong>
            </div>
            <div className="kpiBox">
              <span className="kpiLabel">Material Consumed</span>
              <strong className="kpiVal">{filteredConsumptions.reduce((a, c) => a + (Number(c.itemsCount) || 1), 0)} Items</strong>
            </div>
            <div className="kpiBox" style={{ background: "var(--brand-50)", borderColor: "var(--brand-200)" }}>
              <span className="kpiLabel">Active Requisitions</span>
              <strong className="kpiVal" style={{ color: "var(--brand-700)" }}>{filteredNeeded.length} Pending</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3-Tab Navigation */}
      <div className="ledgerTabs">
        {[
          { id: "needed", label: `Material Needed (${filteredNeeded.length})` },
          { id: "issued", label: `Material Issued (${filteredIssues.length})` },
          { id: "consumed", label: `Material Consumed (${filteredConsumptions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ledgerTab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Tab Contents */}
      <section className="card tableCard">
        {/* Tab 1: Material Needed */}
        {activeTab === "needed" && (
          <>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Party / Site</th>
                    <th>Material Required</th>
                    <th>Qty Needed</th>
                    <th>Required Date</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNeeded.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="emptyTable">
                        <p>No material requirements recorded for {selectedParty}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNeeded.map((n) => (
                      <tr key={n.id}>
                        <td><strong>{n.partyName}</strong></td>
                        <td>{n.materialName}</td>
                        <td><b>{n.quantityNeeded}</b> {n.unit}</td>
                        <td>{n.requiredByDate}</td>
                        <td>
                          <span className={`priorityBadge ${(n.priority || "high").toLowerCase()}`}>{n.priority}</span>
                        </td>
                        <td><Badge>{n.status}</Badge></td>
                        <td>
                          <button type="button" className="actionBtn delete" onClick={() => handleDeleteNeeded(n.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobileCardList">
              {filteredNeeded.length === 0 ? (
                <div className="emptyTable">
                  <p>No material requirements recorded.</p>
                </div>
              ) : (
                filteredNeeded.map((n) => (
                  <div key={n.id} className="mobileDataCard">
                    <div className="mobileCardHeader">
                      <div className="mobileCardTitleArea">
                        <h3 className="mobileCardTitle">{n.materialName}</h3>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span className={`priorityBadge ${(n.priority || "high").toLowerCase()}`}>{n.priority}</span>
                        <Badge>{n.status}</Badge>
                      </div>
                    </div>
                    <div className="mobileCardBody">
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Party / Site</span>
                        <strong className="mobileMetricVal">{n.partyName}</strong>
                      </div>
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Quantity</span>
                        <strong className="mobileMetricVal highlight">{n.quantityNeeded} {n.unit}</strong>
                      </div>
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Required Date</span>
                        <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{n.requiredByDate || "—"}</span>
                      </div>
                    </div>
                    <div className="mobileCardFooter">
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {n.remarks ? `Remarks: ${n.remarks}` : "Standard requisition"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteNeeded(n.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Tab 2: Material Issued */}
        {activeTab === "issued" && (
          <>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Challan / Sl #</th>
                    <th>Date</th>
                    <th>Issued To</th>
                    <th>Material</th>
                    <th style={{ minWidth: "150px" }}>Issued / Required Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="emptyTable">
                        <p>No material issue records found for {selectedParty}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredIssues.map((i, idx) => {
                      const materials =
                        (i.materials && i.materials.length > 0)
                          ? i.materials
                          : (i.items && i.items.length > 0)
                          ? i.items
                          : (i.materialName
                          ? [{ name: i.materialName, quantity: i.quantity || i.qty || 1, unit: i.unit }]
                          : []);

                      return (
                        <tr key={idx}>
                          <td><strong>{i.number || i.challanNo}</strong></td>
                          <td>{i.date}</td>
                          <td>
                            <strong>{i.department || i.issuedTo || selectedParty}</strong>
                          </td>
                          <td>
                            {materials.length === 0 ? (
                              <span style={{ color: "var(--muted)", fontSize: "13px" }}>
                                {i.materialName || i.name || "General Materials"}
                              </span>
                            ) : materials.length === 1 ? (
                              <strong style={{ color: "var(--foreground)", fontSize: "13px" }}>
                                {materials[0].name}
                              </strong>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {materials.map((m, mIdx) => (
                                  <span key={mIdx} style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            {materials.length === 0 ? (
                              <strong style={{ color: "#059669", fontSize: "13px" }}>
                                {i.quantity || i.qty || i.itemsCount || 1} {i.unit || "Pcs"}
                              </strong>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {materials.map((m, mIdx) => {
                                  const issuedQty = m.quantity ?? m.qty ?? 1;
                                  const unit = m.unit || inferUnit(m.name);
                                  const reqQty = getRequiredQty(i, m.name);
                                  const isFull = reqQty !== null && reqQty !== undefined && Number(issuedQty) >= Number(reqQty);

                                  return (
                                    <div key={mIdx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <strong style={{ color: "#059669", fontSize: "13.5px" }}>
                                          {issuedQty} {unit}
                                        </strong>
                                        {reqQty !== null && reqQty !== undefined && (
                                          <span
                                            style={{
                                              fontSize: "10px",
                                              fontWeight: 700,
                                              padding: "1px 6px",
                                              borderRadius: "10px",
                                              background: isFull ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.14)",
                                              color: isFull ? "#059669" : "#d97706",
                                              border: `1px solid ${isFull ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.3)"}`,
                                            }}
                                          >
                                            {isFull ? "Full" : "Partial"}
                                          </span>
                                        )}
                                      </div>
                                      {reqQty !== null && reqQty !== undefined && (
                                        <div style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                                          <span>Required:</span>
                                          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{reqQty} {unit}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td><Badge>{i.status || "Issued"}</Badge></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobileCardList">
              {filteredIssues.length === 0 ? (
                <div className="emptyTable">
                  <p>No material issue records found.</p>
                </div>
              ) : (
                filteredIssues.map((i, idx) => {
                  const materials =
                    (i.materials && i.materials.length > 0)
                      ? i.materials
                      : (i.items && i.items.length > 0)
                      ? i.items
                      : (i.materialName
                      ? [{ name: i.materialName, quantity: i.quantity || i.qty || 1, unit: i.unit }]
                      : []);

                  return (
                    <div key={idx} className="mobileDataCard">
                      <div className="mobileCardHeader">
                        <div className="mobileCardTitleArea">
                          <code className="codeBadge">{i.number || i.challanNo}</code>
                          <h3 className="mobileCardTitle" style={{ marginTop: "4px" }}>
                            {i.department || i.issuedTo || selectedParty}
                          </h3>
                        </div>
                        <Badge>{i.status || "Issued"}</Badge>
                      </div>
                      <div className="mobileCardBody">
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Material</span>
                          <strong className="mobileMetricVal">
                            {materials.map((m) => m.name).join(", ") || i.materialName || "General Materials"}
                          </strong>
                        </div>
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Issued / Req. Qty</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {materials.map((m, mIdx) => {
                              const issuedQty = m.quantity ?? m.qty ?? 1;
                              const unit = m.unit || inferUnit(m.name);
                              const reqQty = getRequiredQty(i, m.name);
                              return (
                                <div key={mIdx}>
                                  <strong className="mobileMetricVal highlight" style={{ color: "#059669" }}>
                                    {issuedQty} {unit}
                                  </strong>
                                  {reqQty !== null && reqQty !== undefined && (
                                    <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "4px" }}>
                                      (Req: {reqQty} {unit})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Issue Date</span>
                          <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{i.date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Tab 3: Material Consumed */}
        {activeTab === "consumed" && (
          <>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Consumption #</th>
                    <th>Date</th>
                    <th>Site / Department</th>
                    <th>Items Utilized</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConsumptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="emptyTable">
                        <p>No material consumption records found for {selectedParty}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredConsumptions.map((c, idx) => (
                      <tr key={idx}>
                        <td><strong>{c.number}</strong></td>
                        <td>{c.date}</td>
                        <td>{c.department || c.site}</td>
                        <td>{c.itemsCount || (c.items ? c.items.length : 1)} items</td>
                        <td><Badge>{c.status || "Consumed"}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobileCardList">
              {filteredConsumptions.length === 0 ? (
                <div className="emptyTable">
                  <p>No consumption records found.</p>
                </div>
              ) : (
                filteredConsumptions.map((c, idx) => (
                  <div key={idx} className="mobileDataCard">
                    <div className="mobileCardHeader">
                      <div className="mobileCardTitleArea">
                        <code className="codeBadge">{c.number}</code>
                        <h3 className="mobileCardTitle" style={{ marginTop: "4px" }}>{c.department || c.site}</h3>
                      </div>
                      <Badge>{c.status || "Consumed"}</Badge>
                    </div>
                    <div className="mobileCardBody">
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Items Utilized</span>
                        <strong className="mobileMetricVal highlight">{c.itemsCount || (c.items ? c.items.length : 1)} items</strong>
                      </div>
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Consumption Date</span>
                        <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{c.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* MODAL 1: Request Material (Material Needed) */}
      {isNeededModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsNeededModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Request Material</h3>
              <button type="button" className="modalCloseBtn" onClick={() => setIsNeededModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveNeeded}>
              <div className="modalBody formGrid">
                <div>
                  <label>Supplier / Customer / Site Name *</label>
                  <input
                    type="text"
                    required
                    value={newNeeded.partyName}
                    onChange={(e) => setNewNeeded({ ...newNeeded, partyName: e.target.value })}
                  />
                </div>

                <div>
                  <label>Material Specification *</label>
                  <input
                    type="text"
                    required
                    value={newNeeded.materialName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const inferred = inferUnit(val);
                      setNewNeeded({ ...newNeeded, materialName: val, unit: inferred });
                    }}
                  />
                </div>

                <div>
                  <label>Quantity Needed *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newNeeded.quantityNeeded}
                    onChange={(e) => setNewNeeded({ ...newNeeded, quantityNeeded: e.target.value })}
                  />
                </div>

                <div>
                  <label>Unit (Pcs or Meter)</label>
                  <select
                    value={newNeeded.unit === "Meter" ? "Meter" : "Pcs"}
                    onChange={(e) => setNewNeeded({ ...newNeeded, unit: e.target.value })}
                    className="invSelect"
                    style={{ width: "100%", height: "38px" }}
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Meter">Meter</option>
                  </select>
                </div>

                <div>
                  <label>Required By Date</label>
                  <input
                    type="date"
                    value={newNeeded.requiredByDate}
                    onChange={(e) => setNewNeeded({ ...newNeeded, requiredByDate: e.target.value })}
                  />
                </div>

                <div>
                  <label>Priority</label>
                  <select
                    value={newNeeded.priority}
                    onChange={(e) => setNewNeeded({ ...newNeeded, priority: e.target.value })}
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="modalFooter">
                <button type="button" className="secondary" onClick={() => setIsNeededModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Save Requirement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
