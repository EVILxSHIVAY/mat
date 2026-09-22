"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { getStorageData, STORAGE_KEYS } from "@/lib/dataService";
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

      {/* KPI Highlight Strip */}
      <div className="vendorKpiGrid">
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

      {/* Issues Table */}
      <div className="tableWrapper" style={{ borderRadius: "var(--radius-lg)" }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th style={{ width: "120px" }}>Challan / Voucher</th>
              <th>Dispatch Date</th>
              <th>Allocated Site / Recipient</th>
              <th style={{ textAlign: "center" }}>Line Items</th>
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
                const materials = iss.materials || [];
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
                      <span className="siteTag">{materials.length || iss.itemsCount || 1} items</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {materials.length > 0 ? (
                          materials.slice(0, 2).map((m, mIdx) => (
                            <span key={mIdx} className="siteTag">
                              {m.name} ({m.quantity} {m.unit})
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>General materials</span>
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
                            Category: {m.category || "General"}
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
