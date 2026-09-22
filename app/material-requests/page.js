"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  calculateLiveInventory,
  getMasterMaterialCatalog,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";

const STATUS_TABS = ["All", "Pending Approval", "Approved", "Partially Issued", "Issued", "Rejected"];

const DEFAULT_PROJECT_SITES = [
  "Jaipur Project Site",
  "Central Warehouse",
  "Ajmer City Gas Site",
  "Vrindavan Site A",
  "Delhi Store & Hub",
  "Kosi Kalan Store",
  "Site Sector 1",
];

export default function VendorRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [materialCatalog, setMaterialCatalog] = useState([]);
  const [liveInventory, setLiveInventory] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("All");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  // Issue Quantity Modal State (For fulfilling requests with exact quantity & shortage control)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueRequestTarget, setIssueRequestTarget] = useState(null);
  const [issueQuantity, setIssueQuantity] = useState("");
  const [issueChallanNo, setIssueChallanNo] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [issueError, setIssueError] = useState("");

  // New Request Form
  const [newReq, setNewReq] = useState({
    vendor: "",
    siteName: "Jaipur Project Site",
    materialName: "",
    quantityNeeded: 25,
    unit: "Pcs",
    priority: "Normal",
    requiredByDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  useEffect(() => {
    // 1. Load Requests
    const rawRequests = getStorageData(STORAGE_KEYS.NEEDED, []);
    setRequests(rawRequests);

    // 2. Load Registered Vendors from STORAGE_KEYS.VENDORS
    const storedVendors = getStorageData(STORAGE_KEYS.VENDORS, []);
    const vList = [];
    storedVendors.forEach((v) => {
      const code = v.code || (Array.isArray(v) ? v[0] : "");
      const name = v.name || (Array.isArray(v) ? v[1] : "");
      if (name && !vList.some((item) => item.name === name)) {
        vList.push({ name, code: code || "" });
      }
    });
    setVendorsList(vList);

    // 3. Load Materials Catalog & Live Inventory
    const catalog = getMasterMaterialCatalog();
    setMaterialCatalog(catalog);
    setLiveInventory(calculateLiveInventory());

    // Preselect first vendor if available
    if (vList.length > 0) {
      setNewReq((prev) => ({ ...prev, vendor: vList[0].name }));
    }
    if (catalog.length > 0) {
      setNewReq((prev) => ({
        ...prev,
        materialName: catalog[0].name,
        unit: catalog[0].unit || "Pcs",
      }));
    }
  }, []);

  useEffect(() => {
    if (isNewModalOpen || isIssueModalOpen) {
      lockScroll();
    }
    return () => {
      if (isNewModalOpen || isIssueModalOpen) unlockScroll();
    };
  }, [isNewModalOpen, isIssueModalOpen]);

  const saveRequestsList = (list) => {
    setRequests(list);
    setStorageData(STORAGE_KEYS.NEEDED, list);
  };

  const handleOpenModal = () => {
    const defaultVendor = vendorsList[0]?.name || "Apex Pipeline Infra";
    const defaultMat = materialCatalog[0] || { name: "GI Pipe 1/2\"", unit: "Meter" };

    setNewReq({
      vendor: defaultVendor,
      siteName: "Jaipur Project Site",
      materialName: defaultMat.name,
      quantityNeeded: 25,
      unit: (defaultMat.unit === "Meter" || defaultMat.name.toLowerCase().includes("pipe")) ? "Meter" : "Pcs",
      priority: "Normal",
      requiredByDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setIsNewModalOpen(true);
  };

  const handleCreateRequest = (e) => {
    e.preventDefault();
    if (!newReq.materialName || !newReq.vendor) return;

    const vendorMatch = vendorsList.find((v) => v.name === newReq.vendor);

    const newItem = {
      id: `REQ-${Date.now().toString().slice(-4)}`,
      vendor: newReq.vendor,
      vendorCode: vendorMatch ? vendorMatch.code : "",
      partyName: newReq.vendor,
      siteName: newReq.siteName || "Central Warehouse",
      materialName: newReq.materialName,
      quantityNeeded: Math.max(1, Number(newReq.quantityNeeded) || 1),
      unit: (newReq.unit === "Meter" || newReq.materialName.toLowerCase().includes("pipe")) ? "Meter" : "Pcs",
      priority: newReq.priority || "Normal",
      status: "Pending Approval",
      createdAt: "Today · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      requiredByDate: newReq.requiredByDate,
      remarks: newReq.remarks,
    };

    const updated = [newItem, ...requests];
    saveRequestsList(updated);
    setIsNewModalOpen(false);
    setActionNotice(`✓ Vendor request [${newItem.id}] created for ${newReq.vendor} successfully!`);
  };

  const handleUpdateStatus = (reqItem, newStatus) => {
    const updated = requests.map((r) => {
      if (r === reqItem || (r.id && r.id === reqItem.id)) {
        return { ...r, status: newStatus };
      }
      return r;
    });
    saveRequestsList(updated);
    if (selectedRequest) {
      setSelectedRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    setActionNotice(`✓ Request [${reqItem.id}] status changed to "${newStatus}".`);
  };

  // Open Issue Quantity Modal with pre-calculated warehouse stock and shortage info
  const handleOpenIssueModal = (reqItem) => {
    if (!reqItem) return;
    setIssueRequestTarget(reqItem);
    const challan = `MI-${Date.now().toString().slice(-4)}`;
    setIssueChallanNo(challan);

    // Look up warehouse available stock for this material
    const sName = (reqItem.materialName || "").toLowerCase().trim();
    const stockItem = liveInventory.find(
      (i) => i?.name && (i.name.toLowerCase().trim() === sName || sName.includes(i.name.toLowerCase().trim()))
    );
    const available = stockItem ? stockItem.availableStock : 0;
    const requested = Number(reqItem.quantityNeeded) || 1;
    const alreadyIssued = Number(reqItem.issuedQty) || 0;
    const remaining = Math.max(0, requested - alreadyIssued);

    // If available stock > 0, suggest available (capped at remaining); else suggest remaining
    const defaultQty = available > 0 ? Math.min(available, remaining) : (remaining > 0 ? remaining : 1);
    setIssueQuantity(String(defaultQty));

    const unit = (reqItem.unit === "Meter" || reqItem.materialName?.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";
    if (available < remaining) {
      setIssueNotes(`Partial dispatch: ${defaultQty} ${unit} issued due to warehouse stock shortage (${remaining - defaultQty} ${unit} pending)`);
    } else {
      setIssueNotes("");
    }
    setIssueError("");
    setIsIssueModalOpen(true);
  };

  // Confirm and Execute Issue with Specified Quantity
  const handleConfirmIssueQuantity = (e) => {
    e.preventDefault();
    if (!issueRequestTarget) return;

    const numToIssue = Number(issueQuantity);
    if (isNaN(numToIssue) || numToIssue <= 0) {
      setIssueError("Please enter a valid quantity greater than 0.");
      return;
    }

    const currentIssues = getStorageData(STORAGE_KEYS.ISSUES, []);
    const req = issueRequestTarget;
    const unit = (req.unit === "Meter" || req.materialName?.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";
    const requestedTotal = Number(req.quantityNeeded) || 1;
    const priorIssued = Number(req.issuedQty) || 0;
    const newTotalIssued = priorIssued + numToIssue;
    const newRemaining = Math.max(0, requestedTotal - newTotalIssued);
    const isFull = newTotalIssued >= requestedTotal;
    const newStatus = isFull ? "Issued" : "Partially Issued";

    const newIssueRecord = {
      number: issueChallanNo || `MI-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split("T")[0],
      department: req.vendor || req.partyName || "Vendor",
      site: req.siteName || "Project Site",
      itemsCount: 1,
      status: "Issued",
      materials: [
        {
          name: req.materialName,
          quantity: numToIssue,
          unit: unit,
          category: "General Materials",
        },
      ],
      reqId: req.id,
      remarks: issueNotes.trim() || (newRemaining > 0 ? `Partial delivery: ${numToIssue} ${unit} issued (${newRemaining} ${unit} shortage remaining)` : `Full issue: ${numToIssue} ${unit}`),
      createdAt: new Date().toISOString(),
    };

    // 1. Save to Issues ledger
    setStorageData(STORAGE_KEYS.ISSUES, [newIssueRecord, ...currentIssues]);

    // 2. Update request in store
    const updatedRequests = requests.map((r) => {
      if (r === req || r.id === req.id) {
        return {
          ...r,
          status: newStatus,
          issuedQty: newTotalIssued,
          remainingNeeded: newRemaining,
          lastIssuedAmount: numToIssue,
          issueChallanNo: newIssueRecord.number,
          lastIssuedAt: new Date().toISOString(),
          issueHistory: [
            {
              challanNo: newIssueRecord.number,
              issuedQty: numToIssue,
              date: new Date().toISOString(),
              notes: issueNotes.trim(),
            },
            ...(r.issueHistory || []),
          ],
        };
      }
      return r;
    });
    saveRequestsList(updatedRequests);

    // 3. Update live inventory state
    const freshInventory = calculateLiveInventory();
    setLiveInventory(freshInventory);

    if (selectedRequest && (selectedRequest === req || selectedRequest.id === req.id)) {
      setSelectedRequest({
        ...selectedRequest,
        status: newStatus,
        issuedQty: newTotalIssued,
        remainingNeeded: newRemaining,
        issueChallanNo: newIssueRecord.number,
      });
    }

    setIsIssueModalOpen(false);
    setActionNotice(
      `✓ Successfully issued ${numToIssue} ${unit} to ${req.vendor || req.partyName}! (Challan: ${newIssueRecord.number})${
        newRemaining > 0 ? ` ⚠️ Shortage: ${newRemaining} ${unit} remaining.` : " All requested quantity fulfilled."
      }`
    );
  };

  // Dynamic Vendor Filter Options
  const vendorOptions = useMemo(() => {
    const set = new Set();
    vendorsList.forEach((v) => set.add(v.name));
    requests.forEach((r) => {
      const p = r.vendor || r.partyName;
      if (p) set.add(p);
    });
    return ["All", ...Array.from(set)];
  }, [vendorsList, requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const mat = String(r.materialName || "").toLowerCase();
      const party = String(r.vendor || r.partyName || "").toLowerCase();
      const site = String(r.siteName || "").toLowerCase();
      const s = search.toLowerCase();
      const matchesSearch = !search || mat.includes(s) || party.includes(s) || site.includes(s);

      const matchesVendor =
        selectedVendorFilter === "All" ||
        party.includes(selectedVendorFilter.toLowerCase()) ||
        selectedVendorFilter.toLowerCase().includes(party);

      const status = String(r.status || "Pending Approval").toLowerCase();
      const matchesTab =
        activeTab === "All"
          ? true
          : activeTab === "Pending Approval"
          ? status.includes("pending") || status.includes("requested")
          : activeTab === "Approved"
          ? status.includes("approved") && !status.includes("pending")
          : activeTab === "Partially Issued"
          ? status.includes("partial")
          : activeTab === "Issued"
          ? status === "issued" || (status.includes("issued") && !status.includes("partial"))
          : activeTab === "Rejected"
          ? status.includes("rejected")
          : true;

      return matchesSearch && matchesVendor && matchesTab;
    });
  }, [requests, search, selectedVendorFilter, activeTab]);

  // Find matching warehouse inventory stock for selected item
  const selectedProductStock = useMemo(() => {
    if (!selectedRequest?.materialName) return null;
    const sName = selectedRequest.materialName.toLowerCase().trim();
    return liveInventory.find(
      (i) => i?.name && (i.name.toLowerCase().trim() === sName || sName.includes(i.name.toLowerCase().trim()))
    );
  }, [selectedRequest, liveInventory]);

  return (
    <Shell>
      <Title
        title="Vendor Requests"
        desc="Material requisitions submitted by field vendors & site teams. Verify warehouse live stock, approve requests, issue materials, or order from suppliers."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenModal}
            >
              + Create Vendor Request
            </button>
          </div>
        }
      />

      {actionNotice && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice("")}
            style={{ background: "transparent", border: "none", color: "#065f46", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <section className="card tableCard">
        <div className="tableControls" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", width: "100%", flexWrap: "wrap" }}>
            <div className="invSearchBox" style={{ flex: "1 1 300px" }}>
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search vendor, site, material or REQ#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="clearBtn" onClick={() => setSearch("")}>
                  ×
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>
                Vendor:
              </span>
              <select
                className="textInput"
                style={{ height: "38px", padding: "0 10px", width: "auto", minWidth: "180px" }}
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
              >
                <option value="All">All Vendors ({vendorOptions.length - 1})</option>
                {vendorOptions.filter((v) => v !== "All").map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`actionBtn ${activeTab === tab ? "view" : ""}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  fontWeight: activeTab === tab ? 700 : 500,
                  background: activeTab === tab ? "var(--primary-forest)" : "transparent",
                  color: activeTab === tab ? "#ffffff" : "var(--text-secondary)",
                  borderColor: activeTab === tab ? "var(--forest-deep)" : "var(--border-default)",
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Mobile-First Cards (Visible on Mobile) */}
        <div className="mobileCardList">
          {filteredRequests.length === 0 ? (
            <div className="emptyTable">
              <p>No vendor material requests found.</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: "8px" }}
                onClick={handleOpenModal}
              >
                + Create Vendor Request
              </button>
            </div>
          ) : (
            filteredRequests.map((req, idx) => {
              const status = req.status || "Pending Approval";
              const vendor = req.vendor || req.partyName || "Vendor";
              const site = req.siteName || "Project Site";

              return (
                <div
                  key={req.id || idx}
                  className="mobileDataCard"
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="mobileCardHeader">
                    <div className="mobileCardTitleArea">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                        <code className="codeBadge">{req.id || `REQ-${idx + 1}`}</code>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-forest)" }}>
                          {vendor}
                        </span>
                      </div>
                      <h3 className="mobileCardTitle">{req.materialName}</h3>
                    </div>
                    <Badge>{status}</Badge>
                  </div>

                  <div className="mobileCardBody">
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Destination Site</span>
                      <strong className="mobileMetricVal">📍 {site}</strong>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Quantity Needed</span>
                      <strong className="mobileMetricVal highlight">
                        {req.quantityNeeded} {req.unit || "Pcs"}
                      </strong>
                      {req.issuedQty > 0 && (
                        <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700, marginTop: "2px" }}>
                          Issued: {req.issuedQty} · Shortage: {req.remainingNeeded || (req.quantityNeeded - req.issuedQty)}
                        </div>
                      )}
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Priority</span>
                      <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>
                        <Badge variant={req.priority === "Urgent" ? "danger" : "warning"}>
                          {req.priority || "Normal"}
                        </Badge>
                      </span>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Requested On</span>
                      <span className="mobileMetricVal" style={{ fontSize: "12.5px" }}>
                        {req.createdAt || req.requiredByDate || "Today"}
                      </span>
                    </div>
                  </div>

                  <div className="mobileCardFooter" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {status !== "Issued" && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          minHeight: "38px",
                          padding: "0 14px",
                          fontSize: "12.5px",
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          fontWeight: 700,
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenIssueModal(req);
                        }}
                      >
                        ⚡ Issue Qty
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ minHeight: "38px", padding: "0 14px", fontSize: "13px", flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(req);
                      }}
                    >
                      Review →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Data Table */}
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>Requisition #</th>
                <th>Vendor</th>
                <th>Destination Site</th>
                <th>Material Requested</th>
                <th>Quantity</th>
                <th>Warehouse Stock</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Requested At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="emptyTable">
                    <p>No vendor requests found.</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: "8px" }}
                      onClick={handleOpenModal}
                    >
                      + Create Vendor Request
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req, idx) => {
                  const vendor = req.vendor || req.partyName || "Vendor";
                  const site = req.siteName || "Project Site";

                  // Live stock check
                  const matStock = liveInventory.find(
                    (i) =>
                      i?.name &&
                      (i.name.toLowerCase().trim() === (req.materialName || "").toLowerCase().trim() ||
                        (req.materialName || "").toLowerCase().includes(i.name.toLowerCase().trim()))
                  );
                  const effectiveRemaining = req.remainingNeeded !== undefined ? req.remainingNeeded : req.quantityNeeded;
                  const isStockEnough = matStock && matStock.availableStock >= effectiveRemaining;

                  return (
                    <tr key={req.id || idx} onClick={() => setSelectedRequest(req)}>
                      <td>
                        <code className="codeBadge">{req.id || `REQ-${idx + 1}`}</code>
                      </td>
                      <td>
                        <strong style={{ color: "var(--text-primary)" }}>{vendor}</strong>
                        {req.vendorCode && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{req.vendorCode}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: "600" }}>📍 {site}</span>
                      </td>
                      <td>{req.materialName}</td>
                      <td>
                        <b>{req.quantityNeeded}</b> {req.unit || "Pcs"}
                        {req.issuedQty > 0 && (
                          <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700, marginTop: "2px" }}>
                            Issued: {req.issuedQty} · Shortage: {req.remainingNeeded || (req.quantityNeeded - req.issuedQty)}
                          </div>
                        )}
                      </td>
                      <td>
                        {matStock ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11.5px",
                              fontWeight: "700",
                              color: isStockEnough ? "#047857" : "#b45309",
                              background: isStockEnough ? "#ecfdf5" : "#fffbeb",
                              padding: "3px 7px",
                              borderRadius: "4px",
                              border: isStockEnough ? "1px solid #a7f3d0" : "1px solid #fde68a",
                            }}
                          >
                            {isStockEnough ? "✓ Stock Ready" : "⚠️ Shortage"} ({matStock.availableStock})
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Catalog item</span>
                        )}
                      </td>
                      <td>
                        <Badge variant={req.priority === "Urgent" ? "danger" : "warning"}>
                          {req.priority || "Normal"}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          variant={
                            req.status === "Partially Issued"
                              ? "warning"
                              : req.status === "Issued"
                              ? "success"
                              : req.status === "Approved"
                              ? "info"
                              : req.status === "Rejected"
                              ? "danger"
                              : "default"
                          }
                        >
                          {req.status || "Pending Approval"}
                        </Badge>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {req.createdAt || req.requiredByDate || "Today"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {req.status !== "Issued" && req.status !== "Rejected" && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: "#059669",
                                color: "#fff",
                                border: "none",
                                padding: "4px 9px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: "700",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenIssueModal(req);
                              }}
                              title="Input custom quantity to issue"
                            >
                              ⚡ Issue Qty
                            </button>
                          )}
                          <button
                            type="button"
                            className="actionBtn view"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
                            }}
                          >
                            Review →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Review Drawer / Bottom Sheet */}
      <DetailDrawer
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `Vendor Request ${selectedRequest.id || ""}` : ""}
        subtitle={`Vendor: ${selectedRequest?.vendor || selectedRequest?.partyName || "Vendor"}`}
        badge={<Badge>{selectedRequest?.status || "Pending Approval"}</Badge>}
        footerActions={
          selectedRequest ? (
            <div style={{ display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" }}>
              {selectedRequest.status !== "Approved" && selectedRequest.status !== "Issued" && selectedRequest.status !== "Partially Issued" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: "44px" }}
                  onClick={() => handleUpdateStatus(selectedRequest, "Approved")}
                >
                  ✓ Approve Request
                </button>
              )}

              {selectedRequest.status !== "Issued" && selectedRequest.status !== "Rejected" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1.5, minHeight: "44px", background: "#059669", borderColor: "#047857" }}
                    onClick={() => handleOpenIssueModal(selectedRequest)}
                  >
                    ⚡ Issue Material (Specify Qty)
                  </button>

                  <Link
                    href={`/material-issue?vendor=${encodeURIComponent(selectedRequest.vendor || selectedRequest.partyName || "")}&material=${encodeURIComponent(selectedRequest.materialName || "")}&qty=${selectedRequest.remainingNeeded || selectedRequest.quantityNeeded || 1}&unit=${encodeURIComponent(selectedRequest.unit || "Pcs")}&reqId=${encodeURIComponent(selectedRequest.id || "")}`}
                    className="btn btn-secondary"
                    style={{ minHeight: "44px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    title="Open custom Issue Voucher form"
                  >
                    ↗ Issue Form
                  </Link>
                </>
              )}

              <Link
                href={`/purchases/new?material=${encodeURIComponent(selectedRequest.materialName || "")}&qty=${encodeURIComponent(selectedRequest.remainingNeeded || selectedRequest.quantityNeeded || 50)}&unit=${encodeURIComponent(selectedRequest.unit || "Pcs")}&location=${encodeURIComponent(selectedRequest.siteName || selectedRequest.partyName || "Central Warehouse")}`}
                className="btn btn-secondary"
                style={{ minHeight: "44px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "600" }}
                title="Request this product from an external supplier"
              >
                📦 Request from Supplier
              </Link>

              {selectedRequest.status !== "Rejected" && selectedRequest.status !== "Issued" && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ minHeight: "44px", padding: "0 14px" }}
                  onClick={() => handleUpdateStatus(selectedRequest, "Rejected")}
                >
                  Reject
                </button>
              )}
            </div>
          ) : null
        }
      >
        {selectedRequest && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Requested Material
              </span>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
                {selectedRequest.materialName}
              </h3>
              <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Requested Total</span>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary-forest)" }}>
                    {selectedRequest.quantityNeeded} {selectedRequest.unit || "Pcs"}
                  </p>
                </div>
                {selectedRequest.issuedQty > 0 && (
                  <div>
                    <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Already Issued</span>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: "#059669" }}>
                      {selectedRequest.issuedQty} {selectedRequest.unit || "Pcs"}
                    </p>
                  </div>
                )}
                {selectedRequest.remainingNeeded > 0 && (
                  <div>
                    <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Pending Shortage</span>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626" }}>
                      {selectedRequest.remainingNeeded} {selectedRequest.unit || "Pcs"}
                    </p>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Current Status</span>
                  <div style={{ marginTop: "2px" }}>
                    <Badge
                      variant={
                        selectedRequest.status === "Partially Issued"
                          ? "warning"
                          : selectedRequest.status === "Issued"
                          ? "success"
                          : selectedRequest.status === "Approved"
                          ? "info"
                          : selectedRequest.status === "Rejected"
                          ? "danger"
                          : "default"
                      }
                    >
                      {selectedRequest.status || "Pending Approval"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Stock Comparison */}
            {(() => {
              const reqQtyEffective = selectedRequest.remainingNeeded !== undefined && selectedRequest.remainingNeeded > 0
                ? selectedRequest.remainingNeeded
                : selectedRequest.quantityNeeded;
              const hasEnough = selectedProductStock && selectedProductStock.availableStock >= reqQtyEffective;

              return (
                <div
                  style={{
                    background: hasEnough ? "var(--green-bg)" : "#fffbeb",
                    border: "1px solid",
                    borderColor: hasEnough ? "var(--green-border)" : "#fde68a",
                    borderRadius: "var(--radius-md)",
                    padding: "14px 16px",
                  }}
                >
                  <span style={{ fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                    Warehouse Live Stock Check
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                    <div>
                      <strong>{selectedProductStock ? `${selectedProductStock.availableStock} ${selectedProductStock.unit}` : "Item not indexed"}</strong>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                        {selectedProductStock ? `Physical stock in warehouse: ${selectedProductStock.availableStock} ${selectedProductStock.unit}` : "Material available in product catalog"}
                      </p>
                    </div>
                    <Badge variant={hasEnough ? "success" : "warning"}>
                      {hasEnough ? "Stock Ready" : "Stock Shortage"}
                    </Badge>
                  </div>
                  {!hasEnough && selectedRequest.status !== "Issued" && (
                    <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: "#059669", color: "#fff", border: "none", fontWeight: 700, padding: "5px 12px", borderRadius: "6px", fontSize: "12px" }}
                        onClick={() => handleOpenIssueModal(selectedRequest)}
                      >
                        ⚡ Issue Available Quantity
                      </button>
                      <Link
                        href={`/purchases/new?material=${encodeURIComponent(selectedRequest.materialName)}&qty=${reqQtyEffective}&unit=${encodeURIComponent(selectedRequest.unit || "Pcs")}&location=${encodeURIComponent(selectedRequest.siteName || "Central Warehouse")}`}
                        className="btn btn-sm btn-secondary"
                        style={{ textDecoration: "none", fontSize: "12px", fontWeight: 600 }}
                      >
                        📦 Order Shortage from Supplier ↗
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div><strong>Vendor:</strong> {selectedRequest.vendor || selectedRequest.partyName}</div>
              <div><strong>Destination Site:</strong> 📍 {selectedRequest.siteName || "Project Site"}</div>
              <div><strong>Urgency:</strong> {selectedRequest.priority || "Normal"}</div>
              <div><strong>Required By Date:</strong> {selectedRequest.requiredByDate || "Immediate"}</div>
              {selectedRequest.issueChallanNo && (
                <div><strong>Issued Under Challan:</strong> <code style={{ fontWeight: 700, color: "#059669" }}>{selectedRequest.issueChallanNo}</code></div>
              )}
              {selectedRequest.remarks && (
                <div><strong>Supervisor / Field Notes:</strong> {selectedRequest.remarks}</div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* New Vendor Request Modal */}
      {isNewModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsNewModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modalHeader">
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>📦 Create Vendor Material Request</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Submit a material requisition for field vendors and project sites.
                </p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsNewModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="modalBody">
                <div className="formGrid" style={{ gridTemplateColumns: "1fr" }}>
                  {/* Vendor Selection */}
                  <label>
                    Vendor Person *
                    {vendorsList.length > 0 ? (
                      <select
                        required
                        value={newReq.vendor}
                        onChange={(e) => setNewReq({ ...newReq, vendor: e.target.value })}
                        style={{ width: "100%", height: "40px" }}
                      >
                        {vendorsList.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} {v.code ? `(${v.code})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Pipeline Infra"
                        value={newReq.vendor}
                        onChange={(e) => setNewReq({ ...newReq, vendor: e.target.value })}
                      />
                    )}
                  </label>

                  {/* Destination Site Selection */}
                  <label>
                    Project Destination Site *
                    <select
                      value={newReq.siteName}
                      onChange={(e) => setNewReq({ ...newReq, siteName: e.target.value })}
                      style={{ width: "100%", height: "40px" }}
                    >
                      {DEFAULT_PROJECT_SITES.map((site) => (
                        <option key={site} value={site}>
                          📍 {site}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Material Selection from Catalog */}
                  <label>
                    Material Requested *
                    {materialCatalog.length > 0 ? (
                      <select
                        required
                        value={newReq.materialName}
                        onChange={(e) => {
                          const matName = e.target.value;
                          const found = materialCatalog.find((m) => m.name === matName);
                          const inferredUnit = (found?.unit === "Meter" || matName.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";
                          setNewReq({
                            ...newReq,
                            materialName: matName,
                            unit: inferredUnit,
                          });
                        }}
                        style={{ width: "100%", height: "40px" }}
                      >
                        {materialCatalog.map((mat) => (
                          <option key={mat.name} value={mat.name}>
                            {mat.name} ({mat.category || "General"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. GI Pipe 1/2 inch"
                        value={newReq.materialName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewReq({
                            ...newReq,
                            materialName: val,
                            unit: val.toLowerCase().includes("pipe") ? "Meter" : "Pcs",
                          });
                        }}
                      />
                    )}
                  </label>

                  {/* Quantity & Unit */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label>
                      Quantity Needed *
                      <input
                        type="number"
                        min="1"
                        required
                        value={newReq.quantityNeeded}
                        onChange={(e) => setNewReq({ ...newReq, quantityNeeded: e.target.value })}
                      />
                    </label>
                    <label>
                      Unit of Measure
                      <select
                        value={newReq.unit === "Meter" ? "Meter" : "Pcs"}
                        onChange={(e) => setNewReq({ ...newReq, unit: e.target.value })}
                        style={{ width: "100%", height: "40px" }}
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Meter">Meter</option>
                      </select>
                    </label>
                  </div>

                  {/* Priority & Required Date */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label>
                      Priority
                      <select
                        value={newReq.priority}
                        onChange={(e) => setNewReq({ ...newReq, priority: e.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent (Critical)</option>
                      </select>
                    </label>
                    <label>
                      Required By Date
                      <input
                        type="date"
                        value={newReq.requiredByDate}
                        onChange={(e) => setNewReq({ ...newReq, requiredByDate: e.target.value })}
                      />
                    </label>
                  </div>

                  <label>
                    Field Notes / Work Purpose
                    <input
                      type="text"
                      value={newReq.remarks}
                      onChange={(e) => setNewReq({ ...newReq, remarks: e.target.value })}
                      placeholder="e.g. Line repair, emergency joint fitting"
                    />
                  </label>
                </div>
              </div>
              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Vendor Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Material to Vendor Modal (With Custom Quantity & Shortage Handling) */}
      {isIssueModalOpen && issueRequestTarget && (() => {
        const req = issueRequestTarget;
        const sName = (req.materialName || "").toLowerCase().trim();
        const stockItem = liveInventory.find(
          (i) => i?.name && (i.name.toLowerCase().trim() === sName || sName.includes(i.name.toLowerCase().trim()))
        );
        const availableStock = stockItem ? stockItem.availableStock : 0;
        const requestedTotal = Number(req.quantityNeeded) || 1;
        const priorIssued = Number(req.issuedQty) || 0;
        const remainingNeeded = Math.max(0, requestedTotal - priorIssued);
        const unit = (req.unit === "Meter" || req.materialName?.toLowerCase().includes("pipe")) ? "Meter" : "Pcs";
        const enteredQty = Number(issueQuantity) || 0;
        const isStockShortage = availableStock < remainingNeeded;
        const resultingIssued = priorIssued + enteredQty;
        const resultingRemaining = Math.max(0, requestedTotal - resultingIssued);

        return (
          <div className="modalBackdrop" onClick={() => setIsIssueModalOpen(false)}>
            <div
              className="modalContent"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "560px", width: "95%" }}
            >
              <div className="modalHeader">
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>
                    ⚡ Issue Material to Vendor
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                    Specify exact quantity to issue from warehouse inventory. Ideal when facing stock shortage.
                  </p>
                </div>
                <button
                  type="button"
                  className="modalCloseBtn"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleConfirmIssueQuantity}>
                <div className="modalBody" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {issueError && (
                    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", color: "#dc2626", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                      {issueError}
                    </div>
                  )}

                  {/* Material & Request Info Card */}
                  <div
                    style={{
                      background: "var(--surface-subtle, #f8fafc)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                          Requisition For
                        </span>
                        <h4 style={{ margin: "2px 0 0", fontSize: "15.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                          {req.materialName}
                        </h4>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          Vendor: <strong>{req.vendor || req.partyName}</strong> · Site: <strong>📍 {req.siteName}</strong>
                        </div>
                      </div>
                      <Badge variant={req.status === "Partially Issued" ? "warning" : "info"}>
                        {req.status || "Approved"}
                      </Badge>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "10px",
                        marginTop: "12px",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--border-default)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Requested Total</div>
                        <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                          {requestedTotal} {unit}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Already Issued</div>
                        <strong style={{ fontSize: "15px", color: "#059669" }}>
                          {priorIssued} {unit}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Pending Shortage</div>
                        <strong style={{ fontSize: "15px", color: "#dc2626" }}>
                          {remainingNeeded} {unit}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Live Stock & Shortage Alert */}
                  <div
                    style={{
                      background: isStockShortage ? "#fffbeb" : "#ecfdf5",
                      border: `1px solid ${isStockShortage ? "#fde68a" : "#a7f3d0"}`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: isStockShortage ? "#92400e" : "#065f46" }}>
                          Warehouse Stock Level
                        </span>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: isStockShortage ? "#b45309" : "#047857", marginTop: "2px" }}>
                          Available in Warehouse: {availableStock} {unit}
                        </div>
                      </div>
                      <Badge variant={isStockShortage ? "warning" : "success"}>
                        {isStockShortage ? `Shortage: -${remainingNeeded - Math.max(0, availableStock)} ${unit}` : "Stock Ready"}
                      </Badge>
                    </div>
                    {isStockShortage && (
                      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#92400e", lineHeight: 1.4 }}>
                        Warehouse has only <strong>{availableStock} {unit}</strong> available for this request of <strong>{remainingNeeded} {unit}</strong>.
                        Enter the quantity you want to issue below.
                      </p>
                    )}
                  </div>

                  {/* Input: Quantity to Issue */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                        Quantity to Issue Now ({unit}) *
                      </label>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Remaining needed: <strong>{remainingNeeded} {unit}</strong>
                      </span>
                    </div>

                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={issueQuantity}
                        onChange={(e) => {
                          setIssueQuantity(e.target.value);
                          setIssueError("");
                        }}
                        style={{
                          width: "100%",
                          padding: "11px 14px",
                          paddingRight: "60px",
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "#059669",
                          borderRadius: "8px",
                          border: "2px solid #10b981",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          right: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                        }}
                      >
                        {unit}
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      {availableStock > 0 && availableStock < remainingNeeded && (
                        <button
                          type="button"
                          onClick={() => setIssueQuantity(String(availableStock))}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #f59e0b",
                            background: "#fffbeb",
                            color: "#b45309",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ⚡ Issue All Available ({availableStock} {unit})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIssueQuantity(String(remainingNeeded))}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-default)",
                          background: "var(--surface-card, #fff)",
                          color: "var(--text-primary)",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Full Pending ({remainingNeeded} {unit})
                      </button>
                      {[5, 10, 20, 50].filter(n => n < remainingNeeded).map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setIssueQuantity(String(amt))}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-default)",
                            background: "var(--surface-card, #fff)",
                            color: "var(--text-muted)",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {amt} {unit}
                        </button>
                      ))}
                    </div>

                    {/* Live preview breakdown */}
                    {enteredQty > 0 && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: resultingRemaining > 0 ? "#fffbeb" : "#ecfdf5",
                          border: `1px solid ${resultingRemaining > 0 ? "#fde68a" : "#a7f3d0"}`,
                          fontSize: "12.5px",
                          color: resultingRemaining > 0 ? "#92400e" : "#065f46",
                          fontWeight: 600,
                        }}
                      >
                        {resultingRemaining > 0 ? (
                          <>
                            ⚠️ <strong>Partial Issue:</strong> {enteredQty} {unit} will be issued now. A shortage of{" "}
                            <strong>{resultingRemaining} {unit}</strong> will remain pending (Status will become <em>"Partially Issued"</em>).
                          </>
                        ) : (
                          <>
                            ✓ <strong>Full Issue:</strong> All remaining {remainingNeeded} {unit} will be fulfilled. Status will become <em>"Issued"</em>.
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Procure Shortage Link if Partial Issue */}
                  {resultingRemaining > 0 && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "rgba(59, 130, 246, 0.08)",
                        border: "1px dashed #3b82f6",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        Need to procure the remaining shortage of <strong>{resultingRemaining} {unit}</strong>?
                      </div>
                      <Link
                        href={`/purchases/new?material=${encodeURIComponent(req.materialName)}&qty=${resultingRemaining}&unit=${encodeURIComponent(unit)}&location=${encodeURIComponent(req.siteName || "Central Warehouse")}`}
                        className="btn btn-sm"
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          textDecoration: "none",
                          padding: "5px 10px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📦 Procure Shortage ↗
                      </Link>
                    </div>
                  )}

                  {/* Dispatch Voucher / Challan No & Remarks */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", fontWeight: 700 }}>
                      Voucher / Challan No
                      <input
                        type="text"
                        value={issueChallanNo}
                        onChange={(e) => setIssueChallanNo(e.target.value)}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", fontWeight: 700 }}>
                      Dispatch Date
                      <input
                        type="date"
                        defaultValue={new Date().toISOString().split("T")[0]}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      />
                    </label>
                  </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", fontWeight: 700 }}>
                    Dispatch / Field Note (Optional)
                    <input
                      type="text"
                      placeholder="e.g. Partial dispatch sent via vehicle DL-10, remainder to follow..."
                      value={issueNotes}
                      onChange={(e) => setIssueNotes(e.target.value)}
                      style={{ padding: "8px 10px", fontSize: "13px" }}
                    />
                  </label>
                </div>

                <div className="modalFooter" style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsIssueModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2, background: "#059669", borderColor: "#047857" }}
                  >
                    ✓ Confirm & Issue {enteredQty > 0 ? `${enteredQty} ${unit}` : "Material"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </Shell>
  );
}
