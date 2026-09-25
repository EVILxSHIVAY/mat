"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  getMasterMaterialCatalog,
  inferUnit,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import DetailDrawer from "@/components/ui/DetailDrawer";
import "@/components/ui/ui.css";
import "./consumption.css";

const DEFAULT_PROJECT_SITES = [
  "Jaipur Project Site",
  "Central Warehouse",
  "Ajmer City Gas Site",
  "Vrindavan Site A",
  "Delhi Store & Hub",
  "Kosi Kalan Store",
  "Site Sector 1",
];

// Helper to load registered vendors strictly from Vendors & Sites (STORAGE_KEYS.VENDORS)
function loadRegisteredVendors() {
  const storedVendors = getStorageData(STORAGE_KEYS.VENDORS, []);
  const vList = [];
  storedVendors.forEach((v) => {
    const code = v.code || (Array.isArray(v) ? v[0] : "");
    const name = v.name || (Array.isArray(v) ? v[1] : "");
    const sites = Array.isArray(v.sites)
      ? v.sites.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean)
      : [];
    if (name && !vList.some((item) => item.name === name)) {
      vList.push({ name, code: code || "", sites });
    }
  });
  return vList;
}

// Mobile-friendly date formatting helper
function formatMobileDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      const datePart = `${day} ${month} ${year}`;
      if (typeof dateStr === "string" && (dateStr.includes("T") || (dateStr.includes(":") && dateStr.length > 10))) {
        const timePart = d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `${datePart}, ${timePart}`;
      }
      return datePart;
    }
  } catch (e) {}
  return String(dateStr);
}

export default function AdminConsumptionPage() {
  const [consumptions, setConsumptions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [materialCatalog, setMaterialCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("All");
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Add Consumption Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [registeredVendors, setRegisteredVendors] = useState([]);
  const [newEntry, setNewEntry] = useState({
    vendor: "",
    site: DEFAULT_PROJECT_SITES[0],
    materialName: "",
    qty: 1,
    date: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  // Reload data from localStorage
  const loadData = () => {
    const rawCons = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
    setConsumptions(rawCons);
    setVendors(getStorageData(STORAGE_KEYS.VENDORS, []));
    setMaterialCatalog(getMasterMaterialCatalog());
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 seconds so live vendor submissions appear
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isAddModalOpen) {
      lockScroll();
    }
    return () => {
      if (isAddModalOpen) unlockScroll();
    };
  }, [isAddModalOpen]);

  // Open Add Consumption Modal
  const handleOpenAddModal = () => {
    const vList = loadRegisteredVendors();
    setRegisteredVendors(vList);
    const catalog = getMasterMaterialCatalog();
    setMaterialCatalog(catalog);

    const firstV = vList[0] || null;
    const defaultVendor = firstV?.name || "";
    const defaultSite = firstV?.sites?.[0] || DEFAULT_PROJECT_SITES[0];
    const defaultMat = catalog[0]?.name || "";

    setNewEntry({
      vendor: defaultVendor,
      site: defaultSite,
      materialName: defaultMat,
      qty: 1,
      date: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setIsAddModalOpen(true);
  };

  // Submit Add Consumption
  const handleSaveConsumption = (e) => {
    e.preventDefault();
    const qtyNum = Number(newEntry.qty);

    if (!newEntry.vendor) {
      alert("Please select a vendor.");
      return;
    }
    if (!newEntry.site) {
      alert("Please select a site/sector.");
      return;
    }
    if (!newEntry.materialName) {
      alert("Please select a material.");
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert("Please enter a valid positive quantity.");
      return;
    }
    if (!newEntry.date) {
      alert("Please select a date.");
      return;
    }

    const unit = inferUnit(newEntry.materialName);
    const entry = {
      id: `CON-${Date.now().toString().slice(-4)}`,
      partyName: newEntry.vendor,
      department: newEntry.vendor,
      site: newEntry.site,
      materialName: newEntry.materialName,
      qty: qtyNum,
      quantity: qtyNum,
      unit: unit,
      date: newEntry.date,
      remarks: (newEntry.remarks || "").trim(),
      createdAt: new Date().toISOString(),
    };

    const allCons = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
    const updated = [entry, ...allCons];
    setStorageData(STORAGE_KEYS.CONSUMPTIONS, updated);
    setConsumptions(updated);
    setIsAddModalOpen(false);
  };

  // Build vendor filter options (plain vendor names without counts)
  const vendorFilterOptions = useMemo(() => {
    const set = new Set();
    vendors.forEach((v) => {
      const name = v.name || (Array.isArray(v) ? v[1] : "");
      if (name) set.add(name);
    });
    consumptions.forEach((c) => {
      const party = c.department || c.partyName;
      if (party) set.add(party);
    });
    return Array.from(set).sort();
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
    return consumptions.filter((c) => String(c.date || c.createdAt || "").startsWith(today)).length;
  }, [consumptions]);

  return (
    <Shell>
      {/* 1. Header: Desktop Title with Top-Right Action vs Mobile Title + Top Action */}
      <div className="consumptionDesktopHeader">
        <Title
          title="Vendor Site Consumption"
          desc="Material consumption logged across project sites and vendors."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
            >
              + Add Consumption
            </button>
          }
        />
      </div>

      <div className="consumptionMobileHeader">
        <h1 className="consumptionMobileTitle">Vendor Site Consumption</h1>
        <button
          type="button"
          className="btn btn-primary consumptionMobileAddBtn"
          onClick={handleOpenAddModal}
        >
          + Add Consumption
        </button>
      </div>

      {/* 2. Desktop KPI Strip (4 cards) vs Mobile 2x2 Grid */}
      <div className="consumptionDesktopSummary">
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
            Today&apos;s Logs
          </span>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 2px", color: "#7c3aed" }}>
            {todayCount}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Entries recorded today</span>
        </div>
      </div>

      <div className="consumptionMobileSummaryGrid">
        <div className="consumptionMobMetricCard">
          <span className="consumptionMobMetricLabel">Consumption</span>
          <span className="consumptionMobMetricVal">{totalEntries}</span>
        </div>
        <div className="consumptionMobMetricCard">
          <span className="consumptionMobMetricLabel">Units</span>
          <span className="consumptionMobMetricVal emerald">{totalUnitsConsumed}</span>
        </div>
        <div className="consumptionMobMetricCard">
          <span className="consumptionMobMetricLabel">Vendors</span>
          <span className="consumptionMobMetricVal blue">{uniqueVendors}</span>
        </div>
        <div className="consumptionMobMetricCard">
          <span className="consumptionMobMetricLabel">Today&apos;s Logs</span>
          <span className="consumptionMobMetricVal purple">{todayCount}</span>
        </div>
      </div>

      {/* 3. Search & Filter Area */}
      <div className="consumptionControlsArea">
        <div className="consumptionControlsLeft">
          <div className="consumptionSearchWrapper">
            <span className="consumptionSearchIcon">🔍</span>
            <input
              type="text"
              className="consumptionSearchInput"
              placeholder="Search consumption..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="consumptionClearBtn"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <select
            className="consumptionFilterSelect"
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
          >
            <option value="All">All Vendors</option>
            {vendorFilterOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <span className="consumptionCountLabel">
          Showing {filtered.length} of {consumptions.length} entries
        </span>
      </div>

      {/* 4. Mobile Consumption Cards */}
      <div className="consumptionMobileCards">
        {consumptions.length === 0 || filtered.length === 0 ? (
          <div className="consumptionEmptySimple">
            <p>No consumption recorded yet.</p>
          </div>
        ) : (
          filtered.map((c, idx) => {
            const mat = c.materialName || c.name || "Material";
            const qty = c.qty || c.quantity || 0;
            const unit = c.unit || "Units";
            const vendor = c.department || c.partyName;
            const site = c.site && c.site.trim();
            const rawDate = c.date || c.createdAt;
            const formattedDate = formatMobileDate(rawDate);
            const remarks = c.remarks && c.remarks.trim();

            return (
              <div
                key={c.id || idx}
                className="consumptionCard"
                onClick={() => setSelectedEntry(c)}
              >
                {/* 1. Material + Quantity */}
                <div className="consumptionCardHead">
                  <div className="consumptionCardMat">{mat}</div>
                  <div className="consumptionCardQtyBadge">
                    {qty} {unit}
                  </div>
                </div>

                {/* 2. Vendor, Site, Date */}
                <div className="consumptionCardDetails">
                  {vendor && (
                    <div className="consumptionCardVendor">
                      <span>🏢</span>
                      <span>{vendor}</span>
                    </div>
                  )}
                  {(site || formattedDate) && (
                    <div className="consumptionCardMetaRow">
                      {site && <span className="consumptionCardSite">📍 {site}</span>}
                      {site && formattedDate && <span className="consumptionMetaDot">•</span>}
                      {formattedDate && <span className="consumptionCardDate">{formattedDate}</span>}
                    </div>
                  )}
                </div>

                {/* 3. Remarks (Optional) */}
                {remarks && (
                  <div className="consumptionCardRemarks">
                    <strong>Remarks:</strong> {remarks}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Desktop Table */}
      <div className="consumptionDesktopTable">
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
              {consumptions.length === 0 || filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTable">
                    <p>No consumption recorded yet.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const party = c.department || c.partyName || "Vendor";
                  const mat = c.materialName || c.name || "Material";
                  const qty = c.qty || c.quantity || 0;
                  const unit = c.unit || "Units";

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
                          {qty} {unit}
                        </strong>
                      </td>
                      <td>📍 {c.site || "Field Site"}</td>
                      <td style={{ fontSize: "13px", color: "var(--muted)" }}>
                        {formatMobileDate(c.date || c.createdAt) || "Today"}
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
      </div>

      {/* Detail Drawer for viewing entry details */}
      <DetailDrawer
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={`Consumption ${selectedEntry?.id || selectedEntry?.number || ""}`}
        subtitle={`Vendor: ${selectedEntry?.department || selectedEntry?.partyName || "Vendor"}`}
      >
        {selectedEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                    {selectedEntry.qty || selectedEntry.quantity || 0} {selectedEntry.unit || "Units"}
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
              {selectedEntry.site && (
                <div>
                  <strong>Project Site:</strong> 📍 {selectedEntry.site}
                </div>
              )}
              <div>
                <strong>Date:</strong> {formatMobileDate(selectedEntry.date || selectedEntry.createdAt) || "Today"}
              </div>
              <div>
                <strong>Entry ID:</strong>{" "}
                <code style={{ fontWeight: 700, color: "#059669" }}>
                  {selectedEntry.id || selectedEntry.number || "—"}
                </code>
              </div>
              {selectedEntry.remarks && (
                <div>
                  <strong>Vendor Remarks:</strong> {selectedEntry.remarks}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Add Consumption Modal */}
      {isAddModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modalHeader">
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>+ Add Consumption</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Record site material consumption for a vendor.
                </p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsAddModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveConsumption}>
              <div className="modalBody">
                <div className="formGrid" style={{ gridTemplateColumns: "1fr" }}>
                  {/* Vendor */}
                  <label>
                    Vendor *
                    <select
                      required
                      value={newEntry.vendor}
                      onChange={(e) => {
                        const vName = e.target.value;
                        const vObj = registeredVendors.find((v) => v.name === vName);
                        const firstSite = vObj?.sites?.[0] || DEFAULT_PROJECT_SITES[0];
                        setNewEntry({
                          ...newEntry,
                          vendor: vName,
                          site: firstSite,
                        });
                      }}
                      style={{ width: "100%", height: "40px" }}
                    >
                      <option value="">Select Vendor</option>
                      {registeredVendors.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} {v.code ? `(${v.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Site / Sector */}
                  <label>
                    Site / Sector *
                    <select
                      required
                      value={newEntry.site}
                      onChange={(e) => setNewEntry({ ...newEntry, site: e.target.value })}
                      style={{ width: "100%", height: "40px" }}
                    >
                      <option value="">Select Site / Sector</option>
                      {(() => {
                        const vObj = registeredVendors.find((v) => v.name === newEntry.vendor);
                        const siteList =
                          vObj?.sites && vObj.sites.length > 0 ? vObj.sites : DEFAULT_PROJECT_SITES;
                        return siteList.map((s) => (
                          <option key={s} value={s}>
                            📍 {s}
                          </option>
                        ));
                      })()}
                    </select>
                  </label>

                  {/* Material */}
                  <label>
                    Material *
                    {materialCatalog.length > 0 ? (
                      <select
                        required
                        value={newEntry.materialName}
                        onChange={(e) => setNewEntry({ ...newEntry, materialName: e.target.value })}
                        style={{ width: "100%", height: "40px" }}
                      >
                        <option value="">Select Material</option>
                        {materialCatalog.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name} {m.category ? `(${m.category})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Enter material name"
                        value={newEntry.materialName}
                        onChange={(e) => setNewEntry({ ...newEntry, materialName: e.target.value })}
                      />
                    )}
                  </label>

                  {/* Quantity */}
                  <label>
                    Quantity *
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="Enter quantity"
                        value={newEntry.qty}
                        onChange={(e) => setNewEntry({ ...newEntry, qty: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <span
                        style={{
                          padding: "8px 12px",
                          background: "var(--surface-subtle, #f1f5f9)",
                          border: "1.5px solid var(--border-default, #cbd5e1)",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-secondary, #475569)",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        {inferUnit(newEntry.materialName || "Material")}
                      </span>
                    </div>
                  </label>

                  {/* Date */}
                  <label>
                    Date *
                    <input
                      type="date"
                      required
                      value={newEntry.date}
                      onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    />
                  </label>

                  {/* Remarks */}
                  <label>
                    Remarks (Optional)
                    <input
                      type="text"
                      placeholder="e.g. Regular site work, pipeline fitting..."
                      value={newEntry.remarks}
                      onChange={(e) => setNewEntry({ ...newEntry, remarks: e.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Consumption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
