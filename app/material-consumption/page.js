"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import {
  getStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import "@/components/ui/ui.css";

export default function AdminConsumptionPage() {
  const [consumptions, setConsumptions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("All");
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Reload data from localStorage
  useEffect(() => {
    const load = () => {
      const rawCons = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
      setConsumptions(rawCons);
      setVendors(getStorageData(STORAGE_KEYS.VENDORS, []));
    };
    load();

    // Auto-refresh every 5 seconds so vendor entries appear live
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Build vendor filter options
  const vendorOptions = useMemo(() => {
    const set = new Set();
    consumptions.forEach((c) => {
      const party = c.department || c.partyName;
      if (party) set.add(party);
    });
    vendors.forEach((v) => set.add(v.name));
    return ["All", ...Array.from(set)];
  }, [consumptions, vendors]);

  // Filter consumptions
  const filtered = useMemo(() => {
    return consumptions.filter((c) => {
      const mat = String(c.materialName || c.name || "").toLowerCase();
      const party = String(c.department || c.partyName || "").toLowerCase();
      const site = String(c.site || "").toLowerCase();
      const id = String(c.id || c.number || "").toLowerCase();
      const s = search.toLowerCase();

      const matchesSearch =
        !search || mat.includes(s) || party.includes(s) || site.includes(s) || id.includes(s);

      const matchesVendor =
        selectedVendorFilter === "All" ||
        party.includes(selectedVendorFilter.toLowerCase()) ||
        selectedVendorFilter.toLowerCase().includes(party);

      return matchesSearch && matchesVendor;
    });
  }, [consumptions, search, selectedVendorFilter]);

  // KPI aggregates
  const totalEntries = consumptions.length;
  const totalUnitsConsumed = consumptions.reduce(
    (acc, c) => acc + (Number(c.qty || c.quantity) || 0),
    0
  );
  const uniqueVendors = useMemo(() => {
    const set = new Set();
    consumptions.forEach((c) => {
      const p = c.department || c.partyName;
      if (p) set.add(p.toLowerCase().trim());
    });
    return set.size;
  }, [consumptions]);
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return consumptions.filter((c) => String(c.date || "").startsWith(today)).length;
  }, [consumptions]);

  return (
    <Shell>
      <Title
        title="Vendor Site Consumption"
        desc="Read-only dashboard of material consumption logged by field vendors from their portal. Only vendors can record consumption."
      />

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Total Consumption Logs
          </span>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 2px", color: "var(--foreground)" }}>
            {totalEntries}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Entries submitted by vendors</span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Total Units Consumed
          </span>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 2px", color: "#059669" }}>
            {totalUnitsConsumed}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Across all materials and sites</span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Reporting Vendors
          </span>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 2px", color: "#2563eb" }}>
            {uniqueVendors}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Distinct vendors logging consumption</span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Today's Logs
          </span>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 2px", color: "#7c3aed" }}>
            {todayCount}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Entries recorded today</span>
        </div>
      </div>

      {/* Info Banner */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          color: "#166534",
        }}
      >
        <span style={{ fontSize: "18px" }}>ℹ️</span>
        <span>
          <strong>Consumption entries are recorded by vendors</strong> from their Vendor Portal → Site Consumption page. This admin view is read-only and refreshes automatically.
        </span>
      </div>

      {/* Search & Filter Controls */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div className="invSearchBox" style={{ maxWidth: "380px", flex: 1 }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search material, vendor, site, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={selectedVendorFilter}
          onChange={(e) => setSelectedVendorFilter(e.target.value)}
          style={{
            height: "40px",
            padding: "0 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--card)",
            fontSize: "13px",
            fontWeight: 500,
            minWidth: "200px",
          }}
        >
          {vendorOptions.map((v) => (
            <option key={v} value={v}>
              {v === "All" ? "All Vendors" : v}
            </option>
          ))}
        </select>

        <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 500 }}>
          Showing {filtered.length} of {consumptions.length} entries
        </span>
      </div>

      {/* Mobile Cards */}
      <div className="mobileDataCards">
        {filtered.length === 0 ? (
          <div className="emptyTable" style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>
              {consumptions.length === 0
                ? "No consumption entries yet"
                : `No entries matching "${search}"`}
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
              {consumptions.length === 0
                ? "Vendors will log consumption from their portal. Entries will appear here automatically."
                : "Try adjusting your search or vendor filter."}
            </p>
          </div>
        ) : (
          filtered.map((c, idx) => {
            const party = c.department || c.partyName || "Vendor";
            const mat = c.materialName || c.name || "Material";
            const qty = c.qty || c.quantity || 0;

            return (
              <div
                key={c.id || idx}
                className="mobileDataCard"
                onClick={() => setSelectedEntry(c)}
                style={{ cursor: "pointer" }}
              >
                <div className="mobileCardHeader">
                  <div className="mobileCardTitleArea">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <code className="codeBadge">{c.id || c.number || `CON-${idx + 1}`}</code>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>
                        {party}
                      </span>
                    </div>
                    <h3 className="mobileCardTitle">{mat}</h3>
                  </div>
                  <Badge variant="success">Consumed</Badge>
                </div>

                <div className="mobileCardBody">
                  <div className="mobileMetricItem">
                    <span className="mobileMetricLabel">Quantity Used</span>
                    <strong className="mobileMetricVal highlight">
                      {qty} {c.unit || "Pcs"}
                    </strong>
                  </div>
                  <div className="mobileMetricItem">
                    <span className="mobileMetricLabel">Site</span>
                    <strong className="mobileMetricVal">📍 {c.site || "Field Site"}</strong>
                  </div>
                  <div className="mobileMetricItem">
                    <span className="mobileMetricLabel">Date</span>
                    <span className="mobileMetricVal" style={{ fontSize: "12.5px" }}>
                      {c.date || c.createdAt || "Today"}
                    </span>
                  </div>
                </div>

                {c.remarks && (
                  <div className="mobileCardFooter">
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      &quot;{c.remarks.slice(0, 48)}{c.remarks.length > 48 ? "..." : ""}&quot;
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="tableWrapper" style={{ borderRadius: "var(--radius-lg)", marginTop: "12px" }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th style={{ width: "100px" }}>Entry ID</th>
              <th>Vendor</th>
              <th>Material Consumed</th>
              <th>Quantity</th>
              <th>Site / Sector</th>
              <th>Date</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="emptyTable">
                  <p>
                    {consumptions.length === 0
                      ? "No consumption entries yet. Vendors will log consumption from their portal."
                      : `No entries matching "${search}".`}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((c, idx) => {
                const party = c.department || c.partyName || "Vendor";
                const mat = c.materialName || c.name || "Material";
                const qty = c.qty || c.quantity || 0;

                return (
                  <tr
                    key={c.id || idx}
                    className="clickableRow"
                    onClick={() => setSelectedEntry(c)}
                  >
                    <td>
                      <code
                        style={{
                          background: "var(--surface-subtle)",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {c.id || c.number || `CON-${idx + 1}`}
                      </code>
                    </td>
                    <td>
                      <strong style={{ color: "var(--foreground)" }}>{party}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{mat}</span>
                    </td>
                    <td>
                      <strong style={{ color: "#059669" }}>
                        {qty} {c.unit || "Pcs"}
                      </strong>
                    </td>
                    <td>📍 {c.site || "Field Site"}</td>
                    <td style={{ fontSize: "13px", color: "var(--muted)" }}>
                      {c.date || c.createdAt || "Today"}
                    </td>
                    <td
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        maxWidth: "180px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.remarks || "—"}
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
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={`Consumption ${selectedEntry?.id || selectedEntry?.number || ""}`}
        subtitle={`Vendor: ${selectedEntry?.department || selectedEntry?.partyName || "Vendor"}`}
      >
        {selectedEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Material Info Card */}
            <div
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Material Consumed
              </span>
              <h3
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: "4px",
                }}
              >
                {selectedEntry.materialName || selectedEntry.name || "Material"}
              </h3>
              <div style={{ display: "flex", gap: "20px", marginTop: "12px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Quantity Used</span>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#059669" }}>
                    {selectedEntry.qty || selectedEntry.quantity || 0} {selectedEntry.unit || "Pcs"}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Status</span>
                  <div style={{ marginTop: "2px" }}>
                    <Badge variant="success">Consumed</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                background: "#f8fafc",
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <strong>Vendor:</strong> {selectedEntry.department || selectedEntry.partyName || "Vendor"}
              </div>
              <div>
                <strong>Project Site:</strong> 📍 {selectedEntry.site || "Field Site"}
              </div>
              <div>
                <strong>Date:</strong> {selectedEntry.date || selectedEntry.createdAt || "Today"}
              </div>
              <div>
                <strong>Entry ID:</strong>{" "}
                <code style={{ fontWeight: 700, color: "#059669" }}>
                  {selectedEntry.id || selectedEntry.number || "—"}
                </code>
              </div>
              {selectedEntry.issueVoucher && (
                <div>
                  <strong>Linked Issue Voucher:</strong>{" "}
                  <code style={{ fontWeight: 700, color: "#2563eb" }}>{selectedEntry.issueVoucher}</code>
                </div>
              )}
              {selectedEntry.usedBy && (
                <div>
                  <strong>Used By / Supervisor:</strong> {selectedEntry.usedBy}
                </div>
              )}
              {selectedEntry.remarks && (
                <div>
                  <strong>Vendor Remarks:</strong> {selectedEntry.remarks}
                </div>
              )}

              {/* Items breakdown if present (voucher-style consumption) */}
              {selectedEntry.items && Array.isArray(selectedEntry.items) && selectedEntry.items.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <strong>Materials Breakdown:</strong>
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {selectedEntry.items.map((item, iIdx) => (
                      <div
                        key={iIdx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          fontSize: "13px",
                        }}
                      >
                        <span>{item.name}</span>
                        <strong style={{ color: "#059669" }}>
                          {item.quantityUsed || item.qty} {item.unit || "Pcs"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </Shell>
  );
}
