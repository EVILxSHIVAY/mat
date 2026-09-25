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
  inferUnit,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";
import "./ledger.css";

const INITIAL_NEEDED = {
  vendor: "",
  materialName: "",
  quantityNeeded: "",
  unit: "Pcs",
  requiredByDate: "",
  priority: "High",
  remarks: "",
};

export default function VendorLedgerPage() {
  // Data States
  const [vendors, setVendors] = useState([]);
  const [issues, setIssues] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [neededList, setNeededList] = useState([]);
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Selection & Tab States
  const [selectedVendor, setSelectedVendor] = useState("All Vendors");
  const [activeTab, setActiveTab] = useState("needed"); // 'needed' | 'issued' | 'consumed'
  const [activeCard, setActiveCard] = useState("");

  // Modal States
  const [isNeededModalOpen, setIsNeededModalOpen] = useState(false);
  const [newNeeded, setNewNeeded] = useState(INITIAL_NEEDED);

  // Load datasets on mount
  useEffect(() => {
    setVendors(getStorageData(STORAGE_KEYS.VENDORS, []));
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
        n.vendor || n.partyName,
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
        headers: ["Vendor", "Material Requested", "Qty Needed", "Unit", "Required Date", "Priority", "Status", "Remarks"],
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
      setSyncStatus("✓ Vendor Material Requests synced to Google Sheets!");
    } catch (e) {
      setSyncStatus("Sync failed: " + e.message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(""), 4000);
    }
  };

  // Extract unique vendors strictly without counts
  const vendorList = useMemo(() => {
    const set = new Set();
    vendors.forEach((v) => {
      const name = v.name || (Array.isArray(v) ? v[1] : "");
      if (name) set.add(name);
    });
    neededList.forEach((n) => {
      const name = n.vendor || n.partyName;
      if (name) set.add(name);
    });
    issues.forEach((i) => {
      const name = i.department || i.issuedTo;
      if (name) set.add(name);
    });
    consumptions.forEach((c) => {
      const name = c.department || c.partyName;
      if (name) set.add(name);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [vendors, neededList, issues, consumptions]);

  // Filter helper matching vendor name
  const isVendorMatch = (partyOrVendor, selected) => {
    if (!selected || selected === "All Vendors") return true;
    const target = String(partyOrVendor || "").toLowerCase().trim();
    const sel = selected.toLowerCase().trim();
    return target.includes(sel) || sel.includes(target);
  };

  // Filter datasets by selected vendor
  const filteredNeeded = useMemo(() => {
    return neededList.filter((n) => isVendorMatch(n.vendor || n.partyName, selectedVendor));
  }, [neededList, selectedVendor]);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => isVendorMatch(i.department || i.issuedTo, selectedVendor));
  }, [issues, selectedVendor]);

  const filteredConsumptions = useMemo(() => {
    return consumptions.filter((c) => isVendorMatch(c.department || c.partyName, selectedVendor));
  }, [consumptions, selectedVendor]);

  // Summary Metrics
  const totalRequestedUnits = useMemo(() => {
    return filteredNeeded.reduce((sum, n) => sum + (Number(n.quantityNeeded || n.quantity || n.qty) || 0), 0);
  }, [filteredNeeded]);

  const totalIssuedCount = useMemo(() => {
    return filteredIssues.reduce((sum, i) => {
      if (i.materials && Array.isArray(i.materials) && i.materials.length > 0) {
        return sum + i.materials.length;
      }
      return sum + (Number(i.itemsCount) || 1);
    }, 0);
  }, [filteredIssues]);

  const totalConsumedCount = useMemo(() => {
    return filteredConsumptions.reduce((sum, c) => {
      if (c.items && Array.isArray(c.items) && c.items.length > 0) {
        return sum + c.items.length;
      }
      return sum + (Number(c.itemsCount) || (c.qty ? 1 : 1));
    }, 0);
  }, [filteredConsumptions]);

  const totalRequestsCount = filteredNeeded.length;

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
      const p = String(n.vendor || n.partyName || "").toLowerCase().trim();
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
    if (!newNeeded.vendor || !newNeeded.materialName || !newNeeded.quantityNeeded) {
      alert("Please fill in required fields.");
      return;
    }

    const itemToAdd = {
      id: `REQ-${Date.now().toString().slice(-4)}`,
      vendor: newNeeded.vendor,
      partyName: newNeeded.vendor,
      materialName: newNeeded.materialName,
      quantityNeeded: newNeeded.quantityNeeded,
      unit: newNeeded.unit || "Pcs",
      requiredByDate: newNeeded.requiredByDate || new Date().toISOString().split("T")[0],
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
    if (confirm("Remove this vendor requirement?")) {
      const updated = neededList.filter((n) => n.id !== id);
      setNeededList(updated);
      setStorageData(STORAGE_KEYS.NEEDED, updated);
      syncNeededToSheets(updated);
    }
  };

  // Export current tab to Excel
  const handleExportStatement = () => {
    const filename = `${selectedVendor.replace(/\s+/g, "_")}_Ledger`;
    if (activeTab === "needed") {
      exportToExcel({
        filename,
        headers: ["Vendor", "Material Requested", "Qty Needed", "Unit", "Required Date", "Priority", "Status"],
        rows: filteredNeeded.map((n) => [n.vendor || n.partyName, n.materialName, n.quantityNeeded, n.unit, n.requiredByDate, n.priority, n.status]),
      });
    } else if (activeTab === "issued") {
      exportToExcel({
        filename,
        headers: ["Challan #", "Vendor", "Material", "Issued Qty", "Required Qty", "Site / Sector", "Date", "Status"],
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
            i.department || i.issuedTo || selectedVendor,
            matNames,
            issuedQuantities,
            reqQuantities,
            i.site || "Project Site",
            i.date,
            i.status || "Issued",
          ];
        }),
      });
    } else {
      exportToExcel({
        filename,
        headers: ["Consumption #", "Vendor", "Material Consumed", "Quantity", "Site / Sector", "Date", "Remarks", "Status"],
        rows: filteredConsumptions.map((c) => [
          c.id || c.number,
          c.department || c.partyName || selectedVendor,
          c.materialName || c.name || "Material",
          `${c.qty || c.quantity || 1} ${c.unit || "Units"}`,
          c.site || "Site",
          c.date || "Today",
          c.remarks || "",
          c.status || "Consumed",
        ]),
      });
    }
  };

  return (
    <Shell>
      <Title
        title="Party Ledger"
        desc="Consolidated tracking of material requirements, dispatch vouchers, site consumptions, and financial positions."
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
            <button
              type="button"
              className="primary"
              onClick={() => {
                setNewNeeded({
                  ...INITIAL_NEEDED,
                  vendor: selectedVendor !== "All Vendors" ? selectedVendor : (vendorList[0] || ""),
                });
                setIsNeededModalOpen(true);
              }}
            >
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

      {/* 1. Vendor Selector & 4 Clickable Summary Cards */}
      <section className="card ledgerHeadCard">
        <div className="partySelectorRow">
          <div className="partySelector">
            <label>Vendor Filter</label>
            <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}>
              <option value="All Vendors">All Vendors</option>
              {vendorList.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="kpiGroup">
            {/* 1. Material Requested Card */}
            <div
              className={`kpiBox clickable ${activeCard === "requested" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("needed");
                setActiveCard("requested");
              }}
              title="Click to view Material Requests"
            >
              <span className="kpiLabel">Material Requested</span>
              <strong className="kpiVal">{totalRequestedUnits} Units</strong>
            </div>

            {/* 2. Material Issued Card */}
            <div
              className={`kpiBox clickable ${activeCard === "issued" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("issued");
                setActiveCard("issued");
              }}
              title="Click to view Issued Materials"
            >
              <span className="kpiLabel">Material Issued</span>
              <strong className="kpiVal">{totalIssuedCount} Items</strong>
            </div>

            {/* 3. Material Consumed Card */}
            <div
              className={`kpiBox clickable ${activeCard === "consumed" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("consumed");
                setActiveCard("consumed");
              }}
              title="Click to view Consumed Materials"
            >
              <span className="kpiLabel">Material Consumed</span>
              <strong className="kpiVal">{totalConsumedCount} Items</strong>
            </div>

            {/* 4. Vendor Requests Card */}
            <div
              className={`kpiBox clickable ${activeCard === "requests" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("needed");
                setActiveCard("requests");
              }}
              title="Click to view Vendor Requests"
            >
              <span className="kpiLabel">Vendor Requests</span>
              <strong className="kpiVal">{totalRequestsCount} Requests</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3-Tab Navigation */}
      <div className="ledgerTabs">
        {[
          { id: "needed", cardId: "requested", label: `Material Requested (${filteredNeeded.length})` },
          { id: "issued", cardId: "issued", label: `Material Issued (${filteredIssues.length})` },
          { id: "consumed", cardId: "consumed", label: `Material Consumed (${filteredConsumptions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ledgerTab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setActiveCard(tab.cardId);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Tab Contents */}
      <section className="card tableCard">
        {/* Tab 1: Material Requested (Vendor Requests) */}
        {activeTab === "needed" && (
          <>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Material Requested</th>
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
                        <p>No material requests recorded for {selectedVendor}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNeeded.map((n) => (
                      <tr key={n.id}>
                        <td><strong>{n.vendor || n.partyName}</strong></td>
                        <td>{n.materialName}</td>
                        <td><b>{n.quantityNeeded}</b> {n.unit || "Pcs"}</td>
                        <td>{n.requiredByDate || "—"}</td>
                        <td>
                          <span className={`priorityBadge ${(n.priority || "high").toLowerCase()}`}>{n.priority}</span>
                        </td>
                        <td><Badge>{n.status || "Requested"}</Badge></td>
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
                  <p>No material requests recorded for {selectedVendor}.</p>
                </div>
              ) : (
                filteredNeeded.map((n) => (
                  <div key={n.id} className="mobileDataCard">
                    <div className="mobileCardHeader">
                      <div className="mobileCardTitleArea">
                        <h3 className="mobileCardTitle">{n.materialName}</h3>
                        <span className="mobileCardSubtitle">🏢 {n.vendor || n.partyName}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span className={`priorityBadge ${(n.priority || "high").toLowerCase()}`}>{n.priority}</span>
                        <Badge>{n.status || "Requested"}</Badge>
                      </div>
                    </div>
                    <div className="mobileCardBody">
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Vendor</span>
                        <strong className="mobileMetricVal">{n.vendor || n.partyName}</strong>
                      </div>
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Qty Needed</span>
                        <strong className="mobileMetricVal highlight">{n.quantityNeeded} {n.unit || "Pcs"}</strong>
                      </div>
                      <div className="mobileMetricItem">
                        <span className="mobileMetricLabel">Required Date</span>
                        <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{n.requiredByDate || "—"}</span>
                      </div>
                    </div>
                    <div className="mobileCardFooter">
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {n.remarks ? `Remarks: ${n.remarks}` : "Vendor requisition"}
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
                    <th>Challan #</th>
                    <th>Vendor</th>
                    <th>Material</th>
                    <th style={{ minWidth: "150px" }}>Quantity</th>
                    <th>Site / Sector</th>
                    <th>Issued Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="emptyTable">
                        <p>No material issue records found for {selectedVendor}.</p>
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
                          <td>
                            <strong>{i.department || i.issuedTo || selectedVendor}</strong>
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
                          <td>📍 {i.site || "Project Site"}</td>
                          <td style={{ fontSize: "13px", color: "var(--muted)" }}>{i.date}</td>
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
                  <p>No material issue records found for {selectedVendor}.</p>
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
                            {i.department || i.issuedTo || selectedVendor}
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
                          <span className="mobileMetricLabel">Quantity</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {materials.map((m, mIdx) => {
                              const issuedQty = m.quantity ?? m.qty ?? 1;
                              const unit = m.unit || inferUnit(m.name);
                              return (
                                <strong key={mIdx} className="mobileMetricVal highlight" style={{ color: "#059669" }}>
                                  {issuedQty} {unit}
                                </strong>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Site / Sector</span>
                          <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>📍 {i.site || "Project Site"}</span>
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
                    <th>Vendor</th>
                    <th>Material Consumed</th>
                    <th>Quantity</th>
                    <th>Site / Sector</th>
                    <th>Date</th>
                    <th>Remarks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConsumptions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="emptyTable">
                        <p>No material consumption records found for {selectedVendor}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredConsumptions.map((c, idx) => {
                      const mat = c.materialName || c.name || (c.items ? c.items.map((it) => it.name).join(", ") : "Material");
                      const qty = c.qty || c.quantity || (c.items ? c.items.reduce((s, it) => s + (Number(it.quantityUsed || it.qty) || 0), 0) : 1);
                      const unit = c.unit || "Units";
                      const vendorName = c.department || c.partyName || selectedVendor;

                      return (
                        <tr key={idx}>
                          <td><strong>{c.id || c.number}</strong></td>
                          <td><strong>{vendorName}</strong></td>
                          <td>{mat}</td>
                          <td>
                            <strong style={{ color: "#059669" }}>
                              {qty} {unit}
                            </strong>
                          </td>
                          <td>📍 {c.site || "Site"}</td>
                          <td style={{ fontSize: "13px", color: "var(--muted)" }}>{c.date || "Today"}</td>
                          <td style={{ fontSize: "12.5px", color: "var(--muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.remarks || "—"}
                          </td>
                          <td><Badge variant="success">{c.status || "Consumed"}</Badge></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobileCardList">
              {filteredConsumptions.length === 0 ? (
                <div className="emptyTable">
                  <p>No consumption records found for {selectedVendor}.</p>
                </div>
              ) : (
                filteredConsumptions.map((c, idx) => {
                  const mat = c.materialName || c.name || (c.items ? c.items.map((it) => it.name).join(", ") : "Material");
                  const qty = c.qty || c.quantity || (c.items ? c.items.reduce((s, it) => s + (Number(it.quantityUsed || it.qty) || 0), 0) : 1);
                  const unit = c.unit || "Units";
                  const vendorName = c.department || c.partyName || selectedVendor;

                  return (
                    <div key={idx} className="mobileDataCard">
                      <div className="mobileCardHeader">
                        <div className="mobileCardTitleArea">
                          <h3 className="mobileCardTitle">{mat}</h3>
                          <span className="mobileCardSubtitle">🏢 {vendorName}</span>
                        </div>
                        <Badge variant="success">{c.status || "Consumed"}</Badge>
                      </div>
                      <div className="mobileCardBody">
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Quantity</span>
                          <strong className="mobileMetricVal highlight" style={{ color: "#059669" }}>
                            {qty} {unit}
                          </strong>
                        </div>
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Site / Sector</span>
                          <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>📍 {c.site || "Site"}</span>
                        </div>
                        <div className="mobileMetricItem">
                          <span className="mobileMetricLabel">Date</span>
                          <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{c.date || "Today"}</span>
                        </div>
                      </div>
                      {c.remarks && (
                        <div className="mobileCardFooter">
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            Remarks: {c.remarks}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>

      {/* MODAL: Request Material (Material Needed) */}
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
                  <label>Vendor Name *</label>
                  {vendorList.length > 0 ? (
                    <select
                      required
                      value={newNeeded.vendor}
                      onChange={(e) => setNewNeeded({ ...newNeeded, vendor: e.target.value })}
                      style={{ width: "100%", height: "40px" }}
                    >
                      <option value="">Select Vendor</option>
                      {vendorList.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Enter vendor name"
                      value={newNeeded.vendor}
                      onChange={(e) => setNewNeeded({ ...newNeeded, vendor: e.target.value })}
                    />
                  )}
                </div>

                <div>
                  <label>Material Specification *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GI Pipe 1/2 inch"
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
                    placeholder="Enter quantity"
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
