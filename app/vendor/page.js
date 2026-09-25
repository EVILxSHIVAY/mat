"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  getMasterMaterialCatalog,
  inferUnit,
} from "@/lib/dataService";
import "./vendor.css";

export default function VendorDashboardPage() {
  const { user } = useAuth();

  const [vendorData, setVendorData] = useState({
    profile: null,
    issues: [],
    requests: [],
    consumptions: [],
  });
  const [catalog, setCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewReqOpen, setIsNewReqOpen] = useState(false);

  // New Request Form
  const [newReq, setNewReq] = useState({
    materialName: "",
    quantityNeeded: 20,
    unit: "Pcs",
    priority: "Normal",
    siteName: "",
    requiredByDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  useEffect(() => {
    setCatalog(getMasterMaterialCatalog());
  }, []);

  // Load server-isolated data for this authenticated vendor
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const clientIssues = getStorageData(STORAGE_KEYS.ISSUES, []);
        const clientRequests = getStorageData(STORAGE_KEYS.NEEDED, []);
        const clientConsumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);

        const res = await fetch("/api/vendor/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issues: clientIssues,
            requests: clientRequests,
            consumptions: clientConsumptions,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setVendorData({
              profile: json.vendor,
              issues: json.data.issues || [],
              requests: json.data.requests || [],
              consumptions: json.data.consumptions || [],
            });

            // Set default site for new request if available
            if (json.vendor?.sites?.length > 0) {
              const firstSite = json.vendor.sites[0];
              setNewReq((prev) => ({
                ...prev,
                siteName: typeof firstSite === "string" ? firstSite : firstSite.name,
              }));
            }
          }
        }
      } catch (err) {
        console.error("[Vendor Portal] Error loading scoped data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const { issues, requests, profile } = vendorData;

  const companyName = profile?.name || user?.vendorName || user?.name || "Vendor Workspace";
  const vendorCode = profile?.code || user?.vendorCode || "VND-001";
  const trade = profile?.trade || profile?.role || "Site Supervisor";

  // KPIs
  const totalRequests = requests.length;
  const pendingRequests = requests.filter((r) =>
    String(r.status || "").toLowerCase().includes("pending")
  ).length;
  const approvedRequests = requests.filter((r) =>
    String(r.status || "").toLowerCase().includes("approved")
  ).length;
  const totalIssuedCount = issues.length;

  // Handle Quick Requisition
  const handleSubmitRequest = (e) => {
    e.preventDefault();
    if (!newReq.materialName) {
      alert("Please select or enter a material name.");
      return;
    }

    const item = {
      id: `REQ-${Date.now().toString().slice(-4)}`,
      partyName: companyName,
      vendor: companyName,
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

    // Save to global storage
    const allReqs = getStorageData(STORAGE_KEYS.NEEDED, []);
    const updated = [item, ...allReqs];
    setStorageData(STORAGE_KEYS.NEEDED, updated);

    // Update local state
    setVendorData((prev) => ({
      ...prev,
      requests: [item, ...prev.requests],
    }));

    setIsNewReqOpen(false);
    setNewReq({
      materialName: "",
      quantityNeeded: 20,
      unit: "Pcs",
      priority: "Normal",
      siteName: profile?.sites?.[0]?.name || "Main Site",
      requiredByDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
  };

  return (
    <Shell>
      {/* 1. Header Banner */}
      <div className="vendorBanner">
        <div className="vendorBannerLeft">
          <div className="vendorBannerTitleRow">
            <h1 className="vendorBannerTitle">{companyName}</h1>
            <div className="vendorMetaBadges">
              <span className="vendorMetaBadge desktopMetaBadge">
                Code: {vendorCode} &bull; {trade}
              </span>
              <span className="vendorMetaBadge mobileMetaBadge">
                Code: {vendorCode}
              </span>
              <span className="vendorMetaBadge mobileMetaBadge">
                {trade}
              </span>
            </div>
          </div>
          <p className="vendorBannerDesc">Vendor Portal · Material requisitions, issued vouchers, and site stock balance.</p>
        </div>

        <div className="vendorBannerActions">
          <button
            type="button"
            className="vendorActionBtnPrimary"
            onClick={() => setIsNewReqOpen(true)}
          >
            <span>+</span> Request Materials
          </button>
          <Link
            href="/vendor/issued"
            className="vendorActionBtnSecondary"
          >
            View Issued Stock ↗
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Strip (Desktop) */}
      <div className="vendorKpiGrid vendorDesktopSummary">
        <div className="vendorKpiCard">
          <div className="vendorKpiIcon green">📋</div>
          <div>
            <span className="kpiLabel">Total Requisitions</span>
            <h2 className="kpiValue">{totalRequests}</h2>
            <span className="kpiSubtext">{pendingRequests} pending approval</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon amber">⏳</div>
          <div>
            <span className="kpiLabel">Pending Approval</span>
            <h2 className="kpiValue">{pendingRequests}</h2>
            <span className="kpiSubtext">Awaiting Admin dispatch authorization</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon blue">📦</div>
          <div>
            <span className="kpiLabel">Approved for Issue</span>
            <h2 className="kpiValue">{approvedRequests}</h2>
            <span className="kpiSubtext">Ready for warehouse pickup</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon purple">↗</div>
          <div>
            <span className="kpiLabel">Materials Issued to Me</span>
            <h2 className="kpiValue">{totalIssuedCount}</h2>
            <span className="kpiSubtext">Vouchers dispatched by warehouse</span>
          </div>
        </div>
      </div>

      {/* 2b. Compact 2x2 Key Metrics (Mobile - matching Site Consumption UI) */}
      <div className="vendorMobileSummaryGrid">
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Requisitions</span>
          <span className="vendorMobMetricVal">{totalRequests}</span>
        </div>
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Pending Approval</span>
          <span className="vendorMobMetricVal amber">{pendingRequests}</span>
        </div>
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Approved for Issue</span>
          <span className="vendorMobMetricVal blue">{approvedRequests}</span>
        </div>
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Issued to Me</span>
          <span className="vendorMobMetricVal purple">{totalIssuedCount}</span>
        </div>
      </div>

      {/* 3. Two-Column Operations Layout */}
      <div className="vendorGridTwo">
        {/* LEFT: Material Requisitions */}
        <div className="sectionCard">
          <div className="sectionCardHeader">
            <h3 className="sectionCardTitle">
              <span>📋</span> My Material Requests
            </h3>
            <Link
              href="/vendor/requests"
              className="btn btn-sm btn-secondary"
              style={{ textDecoration: "none" }}
            >
              All Requests →
            </Link>
          </div>

          {requests.length === 0 ? (
            <div className="emptyStateCard">
              <p>No material requisitions placed yet.</p>
              <button
                type="button"
                className="btn btn-sm primary"
                style={{ marginTop: "10px" }}
                onClick={() => setIsNewReqOpen(true)}
              >
                + Create First Request
              </button>
            </div>
          ) : (
            <div>
              {requests.slice(0, 5).map((req, idx) => {
                const statusStr = String(req.status || "Pending Approval");
                const isApproved = statusStr.toLowerCase().includes("approved");
                const isIssued = statusStr.toLowerCase().includes("issued");
                const isRejected = statusStr.toLowerCase().includes("rejected");

                return (
                  <div key={req.id || idx} className="requestCardItem">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>
                          {req.materialName}
                        </strong>
                        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                          Qty: <b>{req.quantityNeeded} {req.unit || "Pcs"}</b> · Priority: {req.priority || "Normal"}
                        </div>
                      </div>
                      <Badge
                        variant={
                          isIssued ? "success" : isApproved ? "info" : isRejected ? "danger" : "warning"
                        }
                      >
                        {statusStr}
                      </Badge>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "11.5px", color: "var(--muted)" }}>
                      <span>Req ID: {req.id} · {req.createdAt || "Recent"}</span>
                      {req.siteName && <span className="sitePillSmall">{req.siteName}</span>}
                    </div>

                    {req.remarks && (
                      <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "4px", fontStyle: "italic" }}>
                        Note: {req.remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Issued Materials Received */}
        <div className="sectionCard">
          <div className="sectionCardHeader">
            <h3 className="sectionCardTitle">
              <span>↗</span> Materials Issued by Admin
            </h3>
            <Link
              href="/vendor/issued"
              className="btn btn-sm btn-secondary"
              style={{ textDecoration: "none" }}
            >
              View Full History →
            </Link>
          </div>

          {issues.length === 0 ? (
            <div className="emptyStateCard">
              <p>No materials issued to this vendor yet.</p>
              <small style={{ display: "block", marginTop: "6px" }}>
                When Admin issues materials against your requests, the challans will appear here.
              </small>
            </div>
          ) : (
            <div>
              {issues.slice(0, 5).map((iss, idx) => (
                <div key={iss.number || idx} className="requestCardItem">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>
                        Challan #{iss.number || iss.challanNo || `MI-${idx + 1}`}
                      </strong>
                      <span style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                        Issued Date: {iss.date || "Recent"}
                      </span>
                    </div>
                    <Badge variant="success">Dispatched</Badge>
                  </div>

                  {iss.materials && Array.isArray(iss.materials) && (
                    <div style={{ marginTop: "8px", background: "var(--card)", padding: "8px 10px", borderRadius: "6px" }}>
                      {iss.materials.map((m, mIdx) => (
                        <div key={mIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "2px 0" }}>
                          <span style={{ color: "var(--foreground)" }}>
                            {m.name}{m.company ? ` (🏢 ${m.company})` : ""}
                          </span>
                          <strong style={{ color: "#059669" }}>{m.quantity} {m.unit}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Request Modal */}
      {isNewReqOpen && (
        <div className="modalOverlay" onClick={() => setIsNewReqOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Submit Material Request</h3>
              <button type="button" className="closeBtn" onClick={() => setIsNewReqOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>Material Name *</label>
                  <input
                    type="text"
                    required
                    list="materialCatalogList"
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
                  <datalist id="materialCatalogList">
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
                    <label>Unit (Pcs or Meter)</label>
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
                    <label>Project Site</label>
                    <select
                      value={newReq.siteName}
                      onChange={(e) => setNewReq({ ...newReq, siteName: e.target.value })}
                    >
                      {Array.isArray(profile?.sites) && profile.sites.length > 0 ? (
                        profile.sites.map((s, idx) => {
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
                  <label>Work Purpose / Job Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 4 gas pipeline main connection"
                    value={newReq.remarks}
                    onChange={(e) => setNewReq({ ...newReq, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewReqOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: "#059669" }}>
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
