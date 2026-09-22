"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  DEFAULT_VENDORS,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";
import "./vendors.css";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [issues, setIssues] = useState([]);
  const [requests, setRequests] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerTab, setDrawerTab] = useState("overview");

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [editIndex, setEditIndex] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    mobile: "",
    email: "",
    gst: "",
    trade: "Site Supervisor",
    status: "Active",
    sitesInput: "",
  });

  useEffect(() => {
    const saved = getStorageData(STORAGE_KEYS.VENDORS, []);
    setVendors(saved);
    setIssues(getStorageData(STORAGE_KEYS.ISSUES, []));
    setRequests(getStorageData(STORAGE_KEYS.NEEDED, []));
    setConsumptions(getStorageData(STORAGE_KEYS.CONSUMPTIONS, []));
    if (saved.length > 0) {
      try {
        fetch("/api/auth/sync-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendors: saved }),
        }).catch(() => {});
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      lockScroll();
    }
    return () => {
      if (isModalOpen) unlockScroll();
    };
  }, [isModalOpen]);

  const saveList = (list) => {
    setVendors(list);
    setStorageData(STORAGE_KEYS.VENDORS, list);
    try {
      fetch("/api/auth/sync-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors: list }),
      }).catch(() => {});
    } catch (e) {}
  };

  const handleOpenAdd = () => {
    setModalMode("add");
    setFormData({
      code: `VND-${String(vendors.length + 1).padStart(3, "0")}`,
      name: "",
      mobile: "",
      email: "",
      gst: "",
      trade: "Site Supervisor",
      status: "Active",
      sitesInput: "Jaipur Project Site, Central Warehouse",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v, idx) => {
    setModalMode("edit");
    setEditIndex(idx);
    const sitesStr = Array.isArray(v.sites)
      ? v.sites.map((s) => (typeof s === "string" ? s : s.name)).join(", ")
      : "";
    setFormData({
      code: v.code || `VND-${String(idx + 1).padStart(3, "0")}`,
      name: v.name || "",
      mobile: v.mobile || "",
      email: v.email || "",
      gst: v.gst || "",
      trade: v.trade || "Site Supervisor",
      status: v.status || "Active",
      sitesInput: sitesStr,
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Vendor Person Name is required.");
      return;
    }

    const sitesArray = formData.sitesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        location: "Project Location",
        status: "Active",
      }));

    const vendorObj = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      gst: formData.gst.trim(),
      trade: formData.trade,
      role: formData.trade,
      sites: sitesArray.length > 0 ? sitesArray : [{ name: "Central Warehouse", location: "Base", status: "Active" }],
      status: formData.status,
      createdAt: modalMode === "add" ? new Date().toISOString() : vendors[editIndex]?.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (modalMode === "add") {
      saveList([...vendors, vendorObj]);
    } else {
      const updated = [...vendors];
      updated[editIndex] = vendorObj;
      saveList(updated);
      if (selectedVendor && selectedVendor.code === vendorObj.code) {
        setSelectedVendor(vendorObj);
      }
    }
    setIsModalOpen(false);
  };

  const handleDeleteVendor = (codeToDelete) => {
    if (
      window.confirm(
        `Are you sure you want to remove vendor "${codeToDelete}" from the registry?`
      )
    ) {
      const updated = vendors.filter((v) => v.code !== codeToDelete);
      saveList(updated);
      if (selectedVendor && selectedVendor.code === codeToDelete) {
        setSelectedVendor(null);
      }
    }
  };

  // Metrics
  const totalVendors = vendors.length;
  const totalSites = vendors.reduce((acc, v) => acc + (v.sites?.length || 0), 0);
  const totalVouchersIssued = issues.length;
  const pendingRequestsCount = requests.filter(
    (r) => String(r.status || "").toLowerCase().includes("pending")
  ).length;

  // Filtered List
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const matchName = String(v.name || "").toLowerCase().includes(q);
      const matchCode = String(v.code || "").toLowerCase().includes(q);
      const matchPhone = String(v.mobile || "").toLowerCase().includes(q);
      const matchEmail = String(v.email || "").toLowerCase().includes(q);
      const matchTrade = String(v.trade || v.role || "").toLowerCase().includes(q);
      const matchSites = Array.isArray(v.sites)
        ? v.sites.some((s) =>
            (typeof s === "string" ? s : s.name || "").toLowerCase().includes(q)
          )
        : false;
      return matchName || matchCode || matchPhone || matchEmail || matchTrade || matchSites;
    });
  }, [vendors, search]);

  // Data for selected vendor drawer
  const vendorIssues = useMemo(() => {
    if (!selectedVendor) return [];
    const vName = selectedVendor.name.toLowerCase();
    return issues.filter((iss) => {
      const dept = String(iss.department || iss.issuedTo || "").toLowerCase();
      return dept.includes(vName) || vName.includes(dept);
    });
  }, [selectedVendor, issues]);

  const vendorRequests = useMemo(() => {
    if (!selectedVendor) return [];
    const vName = selectedVendor.name.toLowerCase();
    return requests.filter((req) => {
      const pName = String(req.partyName || req.vendor || "").toLowerCase();
      return pName.includes(vName) || vName.includes(pName);
    });
  }, [selectedVendor, requests]);

  // Export to Excel
  const handleExport = () => {
    const dataRows = vendors.map((v) => {
      const sitesStr = Array.isArray(v.sites)
        ? v.sites.map((s) => (typeof s === "string" ? s : s.name)).join(", ")
        : "";
      return [
        v.code,
        v.name,
        v.mobile,
        v.email,
        v.trade || v.role || "Site Supervisor",
        sitesStr,
        v.status,
      ];
    });

    exportToExcel(
      ["Vendor Code", "Vendor Name (Person)", "Mobile Phone", "Email", "Role / Scope", "Project Sites", "Status"],
      dataRows,
      "PDV_Vendors_Master.xlsx",
      "Vendors Registry"
    );
  };

  return (
    <Shell>
      <Title
        title="Vendors Registry"
        desc="Master directory of field vendors, assigned project sites, material requisitions, and issued warehouse vouchers."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExport}
              title="Export all vendors to Excel spreadsheet"
            >
              📥 Export Excel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleOpenAdd}
            >
              + Register Vendor
            </button>
          </div>
        }
      />

      {/* KPI Highlight Strip */}
      <div className="vendorsKpiGrid">
        <div className="card vendorKpiCard">
          <div className="vendorKpiIcon" style={{ background: "#ecfdf5", color: "#059669" }}>
            👤
          </div>
          <div>
            <span className="kpiLabel">Total Registered Vendors</span>
            <h2 className="kpiValue">{totalVendors}</h2>
            <span className="kpiSubtext">Approved field personnel</span>
          </div>
        </div>

        <div className="card vendorKpiCard">
          <div className="vendorKpiIcon" style={{ background: "#eff6ff", color: "#2563eb" }}>
            📍
          </div>
          <div>
            <span className="kpiLabel">Attached Project Sites</span>
            <h2 className="kpiValue">{totalSites}</h2>
            <span className="kpiSubtext">Active site work sectors</span>
          </div>
        </div>

        <div className="card vendorKpiCard">
          <div className="vendorKpiIcon" style={{ background: "#fef3c7", color: "#d97706" }}>
            📋
          </div>
          <div>
            <span className="kpiLabel">Pending Requisitions</span>
            <h2 className="kpiValue">{pendingRequestsCount}</h2>
            <span className="kpiSubtext">
              <Link href="/material-requests" style={{ color: "inherit", textDecoration: "underline" }}>
                Review in Requests →
              </Link>
            </span>
          </div>
        </div>

        <div className="card vendorKpiCard">
          <div className="vendorKpiIcon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
            ↗
          </div>
          <div>
            <span className="kpiLabel">Issued Material Vouchers</span>
            <h2 className="kpiValue">{totalVouchersIssued}</h2>
            <span className="kpiSubtext">Dispatched to field vendors</span>
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="tableControls" style={{ borderRadius: "var(--radius-lg)", marginTop: "24px" }}>
        <div className="invSearchBox" style={{ maxWidth: "380px" }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search vendor name, phone, role, site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 500 }}>
            Showing {filteredVendors.length} of {vendors.length} vendors
          </span>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="tableWrapper" style={{ borderRadius: "var(--radius-lg)", marginTop: "12px" }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th style={{ width: "90px" }}>Code</th>
              <th>Vendor Name</th>
              <th>Role / Scope</th>
              <th>Contact Details</th>
              <th>Assigned Sites</th>
              <th style={{ textAlign: "center", width: "100px" }}>Status</th>
              <th style={{ textAlign: "right", width: "150px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="emptyTable">
                  <p>No vendors found matching "{search}".</p>
                </td>
              </tr>
            ) : (
              filteredVendors.map((v, idx) => {
                const siteCount = v.sites?.length || 0;
                return (
                  <tr
                    key={v.code || idx}
                    className="clickableRow"
                    onClick={() => {
                      setSelectedVendor(v);
                      setDrawerTab("overview");
                    }}
                  >
                    <td>
                      <span className="vendorCodeBadge">{v.code}</span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--foreground)", display: "block", fontSize: "14px" }}>
                        {v.name}
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Vendor ID: {v.code}
                      </span>
                    </td>
                    <td>
                      <span className="tradeBadge">{v.trade || v.role || "Site Supervisor"}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 500 }}>
                        📞 {v.mobile || "—"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        ✉ {v.email || "—"}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {Array.isArray(v.sites) && v.sites.length > 0 ? (
                          v.sites.slice(0, 2).map((s, sIdx) => (
                            <span key={sIdx} className="siteTag">
                              {typeof s === "string" ? s : s.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>No sites assigned</span>
                        )}
                        {siteCount > 2 && (
                          <span className="siteTag more">+{siteCount - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Badge variant={v.status === "Active" ? "success" : "secondary"}>
                        {v.status || "Active"}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenEdit(v, idx)}
                          title="Edit Vendor"
                        >
                          ✏ Edit
                        </button>
                        <Link
                          href={`/material-issue?vendor=${encodeURIComponent(v.name)}`}
                          className="btn btn-sm primary"
                          style={{ textDecoration: "none" }}
                          title="Issue material to this vendor"
                        >
                          Issue ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedVendor}
        onClose={() => setSelectedVendor(null)}
        title={selectedVendor?.name || "Vendor Profile"}
        subtitle={`Vendor Code: ${selectedVendor?.code || "—"} · Role: ${selectedVendor?.trade || selectedVendor?.role || "Site Supervisor"}`}
      >
        {selectedVendor && (
          <div className="vendorDrawerContent">
            {/* Drawer Tabs */}
            <div className="drawerTabs">
              <button
                type="button"
                className={`drawerTab ${drawerTab === "overview" ? "active" : ""}`}
                onClick={() => setDrawerTab("overview")}
              >
                Overview & Sites
              </button>
              <button
                type="button"
                className={`drawerTab ${drawerTab === "requests" ? "active" : ""}`}
                onClick={() => setDrawerTab("requests")}
              >
                Requisitions ({vendorRequests.length})
              </button>
              <button
                type="button"
                className={`drawerTab ${drawerTab === "issues" ? "active" : ""}`}
                onClick={() => setDrawerTab("issues")}
              >
                Issued Materials ({vendorIssues.length})
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {drawerTab === "overview" && (
              <div className="drawerSection">
                <div className="detailCard">
                  <h4 className="detailCardTitle">Vendor Details</h4>
                  <div className="drawerInfoGrid">
                    <div className="drawerInfoItem">
                      <span>Vendor Code</span>
                      <strong>{selectedVendor.code}</strong>
                    </div>
                    <div className="drawerInfoItem">
                      <span>Person Name</span>
                      <strong>{selectedVendor.name}</strong>
                    </div>
                    <div className="drawerInfoItem">
                      <span>Role / Scope</span>
                      <strong>{selectedVendor.trade || selectedVendor.role || "Site Supervisor"}</strong>
                    </div>
                    <div className="drawerInfoItem">
                      <span>Mobile Phone</span>
                      <strong>{selectedVendor.mobile || "—"}</strong>
                    </div>
                    <div className="drawerInfoItem">
                      <span>Email</span>
                      <strong>{selectedVendor.email || "—"}</strong>
                    </div>
                    <div className="drawerInfoItem">
                      <span>Status</span>
                      <strong style={{ color: selectedVendor.status === "Active" ? "#059669" : "var(--muted)" }}>
                        {selectedVendor.status || "Active"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="detailCard" style={{ marginTop: "16px" }}>
                  <h4 className="detailCardTitle">
                    Assigned Project Sites ({selectedVendor.sites?.length || 0})
                  </h4>
                  <div className="drawerSitesList">
                    {Array.isArray(selectedVendor.sites) && selectedVendor.sites.length > 0 ? (
                      selectedVendor.sites.map((site, sIdx) => {
                        const sName = typeof site === "string" ? site : site.name;
                        const sLoc = typeof site === "string" ? "Assigned Sector" : site.location;
                        return (
                          <div key={sIdx} className="drawerSiteItem">
                            <div className="drawerSiteIcon">📍</div>
                            <div style={{ flex: 1 }}>
                              <strong>{sName}</strong>
                              <small style={{ display: "block", color: "var(--muted)" }}>
                                {sLoc}
                              </small>
                            </div>
                            <Badge variant="success">Operational</Badge>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                        No project sites registered.
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                  <Link
                    href={`/material-issue?vendor=${encodeURIComponent(selectedVendor.name)}`}
                    className="primary"
                    style={{ textDecoration: "none", flex: 1, textAlign: "center" }}
                  >
                    ↗ Issue Material to {selectedVendor.name}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDeleteVendor(selectedVendor.code)}
                    style={{ color: "var(--red)" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: REQUESTS */}
            {drawerTab === "requests" && (
              <div className="drawerSection">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Material requests submitted by this vendor
                  </span>
                  <Link href="/material-requests" className="btn btn-sm btn-secondary">
                    Open Requests Board →
                  </Link>
                </div>

                {vendorRequests.length === 0 ? (
                  <div className="emptyBox">
                    <p>No material requisitions logged for this vendor yet.</p>
                  </div>
                ) : (
                  <div className="drawerList">
                    {vendorRequests.map((req, rIdx) => {
                      const isFullyIssued = req.status === "Issued";
                      const isPartiallyIssued = req.status === "Partially Issued" || (req.issuedQty > 0 && req.remainingNeeded > 0);
                      const qtyToIssue = req.remainingNeeded || req.quantityNeeded;

                      return (
                        <div key={req.id || rIdx} className="drawerCardItem">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>
                                {req.materialName}
                              </strong>
                              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                                Requested: <b>{req.quantityNeeded} {req.unit || "Pcs"}</b> · Req ID: {req.id}
                              </div>
                              {isPartiallyIssued && (
                                <div style={{ fontSize: "11px", color: "#d97706", marginTop: "3px", fontWeight: 600 }}>
                                  Issued: {req.issuedQty || 0} · Pending Shortage: {req.remainingNeeded} {req.unit || "Pcs"}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant={
                                isFullyIssued
                                  ? "success"
                                  : isPartiallyIssued
                                  ? "warning"
                                  : String(req.status).toLowerCase().includes("approved")
                                  ? "info"
                                  : "warning"
                              }
                            >
                              {req.status}
                            </Badge>
                          </div>
                          {req.remarks && (
                            <div className="reqRemarksBox">
                              "{req.remarks}"
                            </div>
                          )}
                          <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            {isFullyIssued ? (
                              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600, alignSelf: "center" }}>
                                ✓ Fully Dispatched
                              </span>
                            ) : (
                              <Link
                                href={`/material-issue?vendor=${encodeURIComponent(selectedVendor.name)}&material=${encodeURIComponent(req.materialName)}&qty=${qtyToIssue}&unit=${encodeURIComponent(req.unit || "Pcs")}&reqId=${encodeURIComponent(req.id || "")}`}
                                className="btn btn-sm primary"
                                style={{ textDecoration: "none" }}
                              >
                                {isPartiallyIssued ? `Issue Remaining (${qtyToIssue}) ↗` : "Issue Material ↗"}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ISSUED */}
            {drawerTab === "issues" && (
              <div className="drawerSection">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Dispatched warehouse vouchers issued to this vendor
                  </span>
                  <Link
                    href={`/material-issue?vendor=${encodeURIComponent(selectedVendor.name)}`}
                    className="btn btn-sm primary"
                  >
                    + New Issue
                  </Link>
                </div>

                {vendorIssues.length === 0 ? (
                  <div className="emptyBox">
                    <p>No materials issued to this vendor yet.</p>
                  </div>
                ) : (
                  <div className="drawerList">
                    {vendorIssues.map((iss, iIdx) => (
                      <div key={iss.number || iIdx} className="drawerCardItem">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>
                              Challan #{iss.number || iss.challanNo || `MI-${iIdx + 1}`}
                            </strong>
                            <span style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                              Date: {iss.date || "Today"} · Status: {iss.status || "Issued"}
                            </span>
                          </div>
                          <Badge variant="success">Dispatched</Badge>
                        </div>

                        {iss.materials && Array.isArray(iss.materials) && (
                          <div className="issueMaterialsList" style={{ marginTop: "8px" }}>
                            {iss.materials.map((m, mIdx) => (
                              <div key={mIdx} className="issueMatRow">
                                <span>{m.name}</span>
                                <strong>{m.quantity} {m.unit}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Add / Edit Vendor Modal */}
      {isModalOpen && (
        <div className="modalOverlay" onClick={() => setIsModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>{modalMode === "add" ? "Register New Vendor" : "Edit Vendor Details"}</h3>
              <button type="button" className="closeBtn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="modalBody">
                <div className="formRow">
                  <div className="formGroup">
                    <label>Vendor Code</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="formGroup">
                  <label>Vendor Person Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="formRow">
                  <div className="formGroup">
                    <label>Mobile Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876501234"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>Role / Scope of Work</label>
                  <select
                    value={formData.trade}
                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                  >
                    <option value="Site Supervisor">Site Supervisor</option>
                    <option value="Field Technician">Field Technician</option>
                    <option value="Pipeline Engineer">Pipeline Engineer</option>
                    <option value="Installation In-charge">Installation In-charge</option>
                    <option value="Site Maintenance & Fitting">Site Maintenance & Fitting</option>
                    <option value="General Site Works">General Site Works</option>
                  </select>
                </div>

                <div className="formGroup">
                  <label>Assigned Project Sites (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur Project Site, Central Warehouse, Ajmer Sector 2"
                    value={formData.sitesInput}
                    onChange={(e) => setFormData({ ...formData, sitesInput: e.target.value })}
                  />
                  <small style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px", display: "block" }}>
                    Sites where this vendor is operating and authorized to receive materials.
                  </small>
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
                <button type="submit" className="primary">
                  {modalMode === "add" ? "Save Vendor" : "Update Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
