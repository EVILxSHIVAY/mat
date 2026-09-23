"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  getMasterMaterialCatalog,
  inferUnit,
} from "@/lib/dataService";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";
import "@/components/ui/ui.css";
import "../vendor.css";

const STATUS_TABS = ["All", "Pending", "Approved", "Issued", "Rejected"];

export default function VendorRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Request Form
  const [newReq, setNewReq] = useState({
    materialName: "",
    quantityNeeded: 25,
    unit: "Pcs",
    priority: "Normal",
    siteName: "",
    requiredByDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  const vendorName = user?.vendorName || user?.name || "Vendor";
  const vendorCode = user?.vendorCode || "VND-001";

  useEffect(() => {
    setCatalog(getMasterMaterialCatalog());

    const found = DEFAULT_VENDORS.find(
      (v) =>
        (v.code && v.code.toLowerCase() === vendorCode.toLowerCase()) ||
        (v.name && v.name.toLowerCase() === vendorName.toLowerCase())
    );
    if (found) {
      setVendorProfile(found);
      if (found.sites?.length > 0) {
        const s0 = found.sites[0];
        setNewReq((prev) => ({
          ...prev,
          siteName: typeof s0 === "string" ? s0 : s0.name,
        }));
      }
    }

    const all = getStorageData(STORAGE_KEYS.NEEDED, []);
    setRequests(all);
  }, [user, vendorName, vendorCode]);

  // Filter strictly to requests belonging to this vendor
  const myRequests = useMemo(() => {
    const cleanUser = vendorName.toLowerCase().trim();
    return requests.filter((r) => {
      const p = String(r.partyName || r.vendor || "").toLowerCase().trim();
      return p.includes(cleanUser) || cleanUser.includes(p);
    });
  }, [requests, vendorName]);

  const filteredRequests = useMemo(() => {
    return myRequests.filter((r) => {
      const mat = String(r.materialName || "").toLowerCase();
      const site = String(r.siteName || "").toLowerCase();
      const s = search.toLowerCase();
      const matchesSearch = !search || mat.includes(s) || site.includes(s);

      const status = String(r.status || "Pending Approval").toLowerCase();
      const matchesTab =
        activeTab === "All"
          ? true
          : activeTab === "Pending"
          ? status.includes("pending")
          : activeTab === "Approved"
          ? status.includes("approved")
          : activeTab === "Issued"
          ? status.includes("issued")
          : activeTab === "Rejected"
          ? status.includes("rejected")
          : true;

      return matchesSearch && matchesTab;
    });
  }, [myRequests, search, activeTab]);

  const handleCreateRequest = (e) => {
    e.preventDefault();
    if (!newReq.materialName) return;

    const newItem = {
      id: `REQ-${Date.now().toString().slice(-4)}`,
      partyName: vendorName,
      vendor: vendorName,
      vendorCode: vendorCode,
      siteName: newReq.siteName || "Main Site",
      materialName: newReq.materialName,
      quantityNeeded: Number(newReq.quantityNeeded) || 1,
      unit: inferUnit(newReq.materialName),
      priority: newReq.priority,
      status: "Pending Approval",
      createdAt: "Today · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      requiredByDate: newReq.requiredByDate,
      remarks: newReq.remarks,
    };

    const all = getStorageData(STORAGE_KEYS.NEEDED, []);
    const updated = [newItem, ...all];
    setStorageData(STORAGE_KEYS.NEEDED, updated);
    setRequests(updated);
    setIsModalOpen(false);
    setNewReq({
      materialName: "",
      quantityNeeded: 25,
      unit: "Pcs",
      priority: "Normal",
      siteName: vendorProfile?.sites?.[0]?.name || "Main Site",
      requiredByDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
  };

  return (
    <Shell>
      <Title
        title="Material Requisitions"
        desc="Submit requests for materials needed on field project sites. Track approvals and warehouse dispatch status."
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setIsModalOpen(true)}
            style={{ background: "#059669" }}
          >
            + New Material Requisition
          </button>
        }
      />

      {/* Tabs */}
      <div className="statusTabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`statusTabBtn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="tableControls" style={{ borderRadius: "var(--radius-lg)", marginBottom: "16px" }}>
        <div className="invSearchBox" style={{ maxWidth: "360px" }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search material description or site name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="tableWrapper" style={{ borderRadius: "var(--radius-lg)" }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th style={{ width: "90px" }}>Req ID</th>
              <th>Material Description</th>
              <th style={{ textAlign: "right" }}>Quantity Needed</th>
              <th>Target Site</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Submitted / Needed</th>
              <th style={{ textAlign: "right" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="emptyTable">
                  <p>No material requests found in this category.</p>
                </td>
              </tr>
            ) : (
              filteredRequests.map((req, idx) => {
                const statusStr = String(req.status || "Pending Approval");
                const isApproved = statusStr.toLowerCase().includes("approved");
                const isIssued = statusStr.toLowerCase().includes("issued");
                const isRejected = statusStr.toLowerCase().includes("rejected");

                return (
                  <tr
                    key={req.id || idx}
                    className="clickableRow"
                    onClick={() => setSelectedRequest(req)}
                  >
                    <td>
                      <span className="vendorCodeBadge">{req.id}</span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--foreground)" }}>{req.materialName}</strong>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {req.quantityNeeded} {req.unit || "Pcs"}
                    </td>
                    <td>
                      <span className="siteTag">{req.siteName || "General Site"}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: req.priority === "Urgent" ? "#ef4444" : req.priority === "High" ? "#f59e0b" : "var(--muted)",
                        }}
                      >
                        {req.priority || "Normal"}
                      </span>
                    </td>
                    <td>
                      <Badge
                        variant={
                          isIssued ? "success" : isApproved ? "info" : isRejected ? "danger" : "warning"
                        }
                      >
                        {statusStr}
                      </Badge>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {req.createdAt || "Today"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
                        }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <DetailDrawer
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `Requisition ${selectedRequest.id}` : ""}
        subtitle={selectedRequest?.partyName}
      >
        {selectedRequest && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="detailCard">
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Requisition Status
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                <Badge
                  variant={
                    String(selectedRequest.status).toLowerCase().includes("issued")
                      ? "success"
                      : String(selectedRequest.status).toLowerCase().includes("approved")
                      ? "info"
                      : "warning"
                  }
                >
                  {selectedRequest.status}
                </Badge>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Date: {selectedRequest.createdAt || "Today"}
                </span>
              </div>
            </div>

            <div className="detailCard">
              <h4 className="detailCardTitle">Material & Quantity</h4>
              <div className="drawerInfoGrid">
                <div className="drawerInfoItem">
                  <span>Material Description</span>
                  <strong>{selectedRequest.materialName}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Quantity Needed</span>
                  <strong style={{ color: "#059669" }}>
                    {selectedRequest.quantityNeeded} {selectedRequest.unit || "Pcs"}
                  </strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Target Site</span>
                  <strong>{selectedRequest.siteName || "General Site"}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Priority</span>
                  <strong>{selectedRequest.priority || "Normal"}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Required By Date</span>
                  <strong>{selectedRequest.requiredByDate || "Immediate"}</strong>
                </div>
                {selectedRequest.challanNo && (
                  <div className="drawerInfoItem">
                    <span>Issue Challan #</span>
                    <strong style={{ color: "#2563eb" }}>{selectedRequest.challanNo}</strong>
                  </div>
                )}
              </div>

              {selectedRequest.remarks && (
                <div style={{ marginTop: "12px", padding: "10px", background: "var(--background)", borderRadius: "8px", fontSize: "12.5px" }}>
                  <strong>Vendor Notes:</strong> "{selectedRequest.remarks}"
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="modalOverlay" onClick={() => setIsModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Submit Material Requisition</h3>
              <button type="button" className="closeBtn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>Material Name *</label>
                  <input
                    type="text"
                    required
                    list="catalogDatalist"
                    placeholder="Search material from catalog..."
                    value={newReq.materialName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = catalog.find((c) => c.name.toLowerCase() === val.toLowerCase());
                      const inferred = found?.unit || inferUnit(val);
                      setNewReq({
                        ...newReq,
                        materialName: val,
                        unit: inferred,
                      });
                    }}
                  />
                  <datalist id="catalogDatalist">
                    {catalog.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.category} ({c.unit})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="formRow">
                  <div className="formGroup">
                    <label>Quantity Needed *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newReq.quantityNeeded}
                      onChange={(e) => setNewReq({ ...newReq, quantityNeeded: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Unit of Measure (Pcs or Meter)</label>
                    <select
                      value={newReq.unit === "Meter" ? "Meter" : "Pcs"}
                      onChange={(e) => setNewReq({ ...newReq, unit: e.target.value })}
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Meter">Meter</option>
                    </select>
                  </div>
                </div>

                <div className="formRow">
                  <div className="formGroup">
                    <label>Target Project Site</label>
                    <select
                      value={newReq.siteName}
                      onChange={(e) => setNewReq({ ...newReq, siteName: e.target.value })}
                    >
                      {Array.isArray(vendorProfile?.sites) && vendorProfile.sites.length > 0 ? (
                        vendorProfile.sites.map((s, idx) => {
                          const sName = typeof s === "string" ? s : s.name;
                          return (
                            <option key={idx} value={sName}>
                              {sName}
                            </option>
                          );
                        })
                      ) : (
                        <option value="Main Site">Main Site</option>
                      )}
                    </select>
                  </div>
                  <div className="formGroup">
                    <label>Priority</label>
                    <select
                      value={newReq.priority}
                      onChange={(e) => setNewReq({ ...newReq, priority: e.target.value })}
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent (Critical)</option>
                    </select>
                  </div>
                </div>

                <div className="formGroup">
                  <label>Required By Date</label>
                  <input
                    type="date"
                    value={newReq.requiredByDate}
                    onChange={(e) => setNewReq({ ...newReq, requiredByDate: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>Job Description / Justification</label>
                  <input
                    type="text"
                    placeholder="e.g. For gas pipeline laying sector 7"
                    value={newReq.remarks}
                    onChange={(e) => setNewReq({ ...newReq, remarks: e.target.value })}
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
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
