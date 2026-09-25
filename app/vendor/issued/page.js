"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { getStorageData, STORAGE_KEYS, inferUnit } from "@/lib/dataService";
import "@/components/ui/ui.css";
import "../vendor.css";

export default function VendorIssuedMaterialsPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);

  const vendorName = user?.vendorName || user?.name || "Vendor";

  useEffect(() => {
    const raw = getStorageData(STORAGE_KEYS.ISSUES, []);
    // Scoped to this vendor
    const cleanUser = vendorName.toLowerCase().trim();
    const myIssues = raw.filter((iss) => {
      const dept = String(iss.department || iss.issuedTo || "").toLowerCase().trim();
      return dept.includes(cleanUser) || cleanUser.includes(dept);
    });
    setIssues(myIssues);
  }, [user, vendorName]);

  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      const q = search.toLowerCase();
      if (!q) return true;
      const num = String(iss.number || iss.challanNo || "").toLowerCase();
      const date = String(iss.date || "").toLowerCase();
      const hasMat =
        iss.materials &&
        Array.isArray(iss.materials) &&
        iss.materials.some((m) => m.name.toLowerCase().includes(q));
      return num.includes(q) || date.includes(q) || hasMat;
    });
  }, [issues, search]);

  const totalItemsCount = useMemo(() => {
    return issues.reduce((acc, iss) => {
      if (iss.materials && Array.isArray(iss.materials)) {
        return acc + iss.materials.reduce((sub, m) => sub + (Number(m.quantity) || 0), 0);
      }
      return acc + (Number(iss.itemsCount) || 1);
    }, 0);
  }, [issues]);

  return (
    <Shell>
      <Title
        title="Materials Issued to Vendor"
        desc="Warehouse material dispatches, delivery vouchers, and received physical stock for project execution."
      />

      {/* Desktop KPI Highlight Strip */}
      <div className="vendorKpiGrid vendorDesktopSummary">
        <div className="vendorKpiCard">
          <div className="vendorKpiIcon purple">↗</div>
          <div>
            <span className="kpiLabel">Total Issue Vouchers</span>
            <h2 className="kpiValue">{issues.length}</h2>
            <span className="kpiSubtext">Dispatched delivery challans</span>
          </div>
        </div>

        <div className="vendorKpiCard">
          <div className="vendorKpiIcon green">📦</div>
          <div>
            <span className="kpiLabel">Total Units Received</span>
            <h2 className="kpiValue">{totalItemsCount}</h2>
            <span className="kpiSubtext">Cumulative physical materials in site custody</span>
          </div>
        </div>
      </div>

      {/* Mobile-first compact 2-column KPI summary (Matching Site Consumption UI) */}
      <div className="vendorMobileSummaryGrid">
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Issue Vouchers</span>
          <span className="vendorMobMetricVal purple">{issues.length}</span>
        </div>
        <div className="vendorMobMetricCard">
          <span className="vendorMobMetricLabel">Units Received</span>
          <span className="vendorMobMetricVal emerald">{totalItemsCount}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="tableControls" style={{ borderRadius: "var(--radius-lg)", marginBottom: "16px" }}>
        <div className="invSearchBox" style={{ maxWidth: "380px" }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search challan #, date, or material name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
          Showing {filteredIssues.length} of {issues.length} vouchers
        </span>
      </div>

      {/* Issues Table (Desktop) */}
      <div className="tableWrapper vendorDesktopTable" style={{ borderRadius: "var(--radius-lg)" }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th style={{ width: "120px" }}>Challan / Voucher</th>
              <th>Dispatch Date</th>
              <th>Allocated Site / Recipient</th>
              <th style={{ textAlign: "center", minWidth: "90px" }}>Qty</th>
              <th>Materials Included</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.length === 0 ? (
              <tr>
                <td colSpan={7} className="emptyTable">
                  <p>
                    {search
                      ? `No issue vouchers found matching "${search}".`
                      : "No materials have been issued to your vendor account yet."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredIssues.map((iss, idx) => {
                const materials =
                  (iss.materials && iss.materials.length > 0)
                    ? iss.materials
                    : (iss.items && iss.items.length > 0)
                    ? iss.items
                    : (iss.materialName
                    ? [{ name: iss.materialName, quantity: iss.quantity || iss.qty || 1, unit: iss.unit }]
                    : []);
                return (
                  <tr
                    key={iss.number || idx}
                    className="clickableRow"
                    onClick={() => setSelectedIssue(iss)}
                  >
                    <td>
                      <span className="vendorCodeBadge">
                        {iss.number || iss.challanNo || `MI-${idx + 1}`}
                      </span>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--foreground)" }}>
                      {iss.date || "Today"}
                    </td>
                    <td>
                      <strong style={{ color: "var(--foreground)", fontSize: "13px" }}>
                        {iss.department || vendorName}
                      </strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {materials.length === 0 ? (
                        <span className="siteTag" style={{ fontWeight: 700, color: "var(--foreground)" }}>
                          {iss.quantity || iss.qty || iss.itemsCount || 1}
                        </span>
                      ) : materials.length === 1 ? (
                        <span className="siteTag" style={{ fontWeight: 700, color: "var(--foreground)" }}>
                          {materials[0].quantity ?? materials[0].qty ?? 1} {materials[0].unit || inferUnit(materials[0].name)}
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                          {materials.slice(0, 2).map((m, mIdx) => (
                            <span key={mIdx} className="siteTag" style={{ fontWeight: 700, color: "var(--foreground)" }}>
                              {m.quantity ?? m.qty ?? 1} {m.unit || inferUnit(m.name)}
                            </span>
                          ))}
                          {materials.length > 2 && (
                            <span className="siteTag more">+{materials.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {materials.length > 0 ? (
                          materials.slice(0, 2).map((m, mIdx) => (
                            <span key={mIdx} className="siteTag">
                              {m.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                            {iss.materialName || iss.name || "General materials"}
                          </span>
                        )}
                        {materials.length > 2 && (
                          <span className="siteTag more">+{materials.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge variant="success">Dispatched</Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIssue(iss);
                        }}
                      >
                        Inspect Voucher →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile-first compact cards (Hidden on desktop) */}
      <div className="vendorMobileList">
        {filteredIssues.length === 0 ? (
          <div className="emptyStateCard" style={{ padding: "36px 16px" }}>
            <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>
              {search
                ? `No issue vouchers found matching "${search}".`
                : "No materials have been issued to your vendor account yet."}
            </p>
            {search && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "12px", minHeight: "40px", padding: "0 16px", fontSize: "13px" }}
                onClick={() => setSearch("")}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredIssues.map((iss, idx) => {
            const materials =
              iss.materials && iss.materials.length > 0
                ? iss.materials
                : iss.items && iss.items.length > 0
                ? iss.items
                : iss.materialName
                ? [{ name: iss.materialName, quantity: iss.quantity || iss.qty || 1, unit: iss.unit }]
                : [];
            const totalQty =
              materials.reduce((acc, m) => acc + (Number(m.quantity ?? m.qty) || 1), 0) ||
              iss.quantity ||
              iss.qty ||
              1;

            return (
              <div
                key={iss.number || idx}
                className="mobileDataCard"
                onClick={() => setSelectedIssue(iss)}
              >
                <div className="mobileCardHeader">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="vendorCodeBadge">
                      {iss.number || iss.challanNo || `MI-${idx + 1}`}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {iss.date || "Today"}
                    </span>
                  </div>
                  <Badge variant="success">Issued</Badge>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--foreground)" }}>
                    🏢 {iss.department || vendorName}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    {materials.map((m, mIdx) => (
                      <span key={mIdx} className="siteTag" style={{ fontSize: "12px" }}>
                        {m.name} ({m.quantity ?? m.qty ?? 1} {m.unit || inferUnit(m.name)})
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "6px",
                      paddingTop: "8px",
                      borderTop: "1px solid var(--border-default, #f1f5f9)",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Total: <strong style={{ color: "#059669" }}>{totalQty} Items</strong>
                    </span>
                    <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                      View Voucher ↗
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer */}
      <DetailDrawer
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        title={selectedIssue ? `Challan #${selectedIssue.number || selectedIssue.challanNo}` : ""}
        subtitle={`Dispatched to: ${selectedIssue?.department || vendorName}`}
      >
        {selectedIssue && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="detailCard">
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Voucher Summary
              </span>
              <div className="drawerInfoGrid" style={{ marginTop: "8px" }}>
                <div className="drawerInfoItem">
                  <span>Challan Number</span>
                  <strong>{selectedIssue.number || selectedIssue.challanNo}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Dispatch Date</span>
                  <strong>{selectedIssue.date || "Today"}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Recipient Vendor</span>
                  <strong>{selectedIssue.department || vendorName}</strong>
                </div>
                <div className="drawerInfoItem">
                  <span>Warehouse Status</span>
                  <strong style={{ color: "#059669" }}>Dispatched & Deducted</strong>
                </div>
              </div>
            </div>

            <div className="detailCard">
              <h4 className="detailCardTitle">
                Materials in this Voucher ({selectedIssue.materials?.length || selectedIssue.itemsCount || 1})
              </h4>
              {selectedIssue.materials && Array.isArray(selectedIssue.materials) ? (
                <div className="drawerList">
                  {selectedIssue.materials.map((m, mIdx) => (
                    <div key={mIdx} className="drawerCardItem">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "var(--foreground)", fontSize: "13.5px" }}>
                            {m.name}
                          </strong>
                          <span style={{ display: "block", fontSize: "11.5px", color: "var(--muted)" }}>
                            Category: {m.category || "General"}{m.company ? ` · 🏢 ${m.company}` : ""}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "16px", fontWeight: 800, color: "#059669" }}>
                            {m.quantity}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "4px" }}>
                            {m.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                  Material items consolidated in warehouse challan record.
                </p>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </Shell>
  );
}
