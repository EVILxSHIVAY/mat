"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { exportToExcel } from "@/lib/exportToExcel";
import { calculateLiveInventory } from "@/lib/dataService";
import StockAdjustModal from "./StockAdjustModal";
import "@/components/ui/ui.css";
import "./inventory.css";

const CATEGORIES = [
  "All",
  "Pipes & Fittings",
  "Valves & Meters",
  "Tools & Equipment",
  "Safety & PPE",
  "Fasteners & Hardware",
  "General Materials",
];

const STATUS_FILTERS = ["All", "Good", "Low", "Critical", "Out of Stock"];

function getStockStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("good") || s === "in stock") {
    return {
      label: "In Stock",
      dotClass: "green",
      badgeClass: "inStock",
      icon: "🟢",
    };
  }
  if (s.includes("low")) {
    return {
      label: "Low Stock",
      dotClass: "amber",
      badgeClass: "lowStock",
      icon: "🟡",
    };
  }
  return {
    label: "Out of Stock",
    dotClass: "red",
    badgeClass: "outStock",
    icon: "🔴",
  };
}

export default function InventoryView({ initialFilter = "" }) {
  const [inventoryList, setInventoryList] = useState(() => calculateLiveInventory());
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState(
    initialFilter === "low" ? "Low" : "All"
  );
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [drawerTab, setDrawerTab] = useState("overview");

  // Stock Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustingCompany, setAdjustingCompany] = useState("");

  const refreshInventory = () => {
    const fresh = calculateLiveInventory();
    setInventoryList(fresh);
    if (selectedProduct) {
      const updatedSelected = fresh.find(
        (p) => p.code === selectedProduct.code || p.name === selectedProduct.name
      );
      if (updatedSelected) setSelectedProduct(updatedSelected);
    }
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  // Listen for custom stock update events
  useEffect(() => {
    const handleStockUpdated = () => {
      refreshInventory();
    };
    window.addEventListener("pdv_stock_updated", handleStockUpdated);
    return () => window.removeEventListener("pdv_stock_updated", handleStockUpdated);
  }, [selectedProduct]);

  const handleOpenAdjustModal = (product = null, company = "") => {
    setAdjustingProduct(product);
    setAdjustingCompany(company);
    setIsAdjustModalOpen(true);
  };

  // Filtered dataset
  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const cat = String(item.category || "").toLowerCase();
      const comp = String(item.company || "").toLowerCase();
      const s = search.toLowerCase().trim();

      const matchesSearch = !s || name.includes(s) || cat.includes(s) || comp.includes(s);

      const matchesCat =
        selectedCategory === "All" ||
        selectedCategory === "All Categories" ||
        item.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All" || selectedStatus === "All Statuses"
          ? true
          : selectedStatus === "Good"
          ? item.status === "Good"
          : selectedStatus === "Low"
          ? item.status === "Low"
          : selectedStatus === "Critical"
          ? item.status === "Critical" || item.status === "Out of Stock"
          : selectedStatus === "Out of Stock"
          ? item.status === "Out of Stock" || item.status === "Critical"
          : item.status === selectedStatus;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [inventoryList, search, selectedCategory, selectedStatus]);

  // Aggregates
  const totalStockUnits = inventoryList.reduce((sum, i) => sum + i.availableStock, 0);
  const totalStockVal = inventoryList.reduce((sum, i) => sum + i.stockValue, 0);
  const lowCount = inventoryList.filter((i) => i.status === "Low" || i.status === "Critical").length;

  const handleExport = () => {
    const headers = [
      "Material Name",
      "Category",
      "Available Stock",
      "Unit",
      "Status",
      "Company",
      "Rate (₹)",
      "Stock Value (₹)",
    ];
    const rows = filteredInventory.map((i) => [
      i.name,
      i.category,
      i.availableStock,
      i.unit,
      i.status,
      i.company,
      i.rate,
      i.stockValue,
    ]);
    exportToExcel({ filename: "Inventory_Stock_Report", headers, rows });
  };

  const drawerTabs = [
    { id: "overview", label: "Overview", icon: "📋" },
    {
      id: "purchases",
      label: "Purchases",
      icon: "▣",
      count: selectedProduct?.recentPurchases?.length || 0,
    },
    {
      id: "issues",
      label: "Issues to Site",
      icon: "↗",
      count: selectedProduct?.recentIssues?.length || 0,
    },
    {
      id: "consumptions",
      label: "Site Usage",
      icon: "◔",
      count: selectedProduct?.recentConsumptions?.length || 0,
    },
  ];

  return (
    <Shell>
      {/* 1. Desktop Header Area (Hidden on <= 768px) */}
      <div className="inventoryDesktopHeader">
        <Title
          title="Inventory Master"
          desc="Live calculated physical stock derived from purchases, dispatches, and site movements."
          action={
            <>
              <button type="button" className="btn btn-secondary" onClick={handleExport}>
                ⤓ Export Stock
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenAdjustModal(null)}
              >
                + Add Quantity
              </button>
            </>
          }
        />
      </div>

      {/* 1b. Mobile Compact Header (Shown on <= 768px) */}
      <div className="inventoryMobileHeader">
        <div className="invMobHeaderTitleArea">
          <h1 className="invMobTitle">Inventory</h1>
          <span className="invMobCount">{inventoryList.length} materials</span>
        </div>
        <div className="invMobHeaderActions">
          <button
            type="button"
            className="invMobExportBtn"
            onClick={handleExport}
            title="Export Stock to Excel"
            aria-label="Export Stock"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>
          <button
            type="button"
            className="invMobAddBtn"
            onClick={() => handleOpenAdjustModal(null)}
          >
            + Add Quantity
          </button>
        </div>
      </div>

      {/* 2a. Desktop Inventory Metric Bar (Hidden on <= 768px) */}
      <div className="inventorySummaryRow inventoryDesktopSummary">
        <div className="invStatBox">
          <span className="invStatLabel">Total Catalog Items</span>
          <strong className="invStatVal">{inventoryList.length} Materials</strong>
        </div>
        <div className="invStatBox">
          <span className="invStatLabel">Physical Available Units</span>
          <strong className="invStatVal">{totalStockUnits.toLocaleString()}</strong>
        </div>
        <div className="invStatBox">
          <span className="invStatLabel">Inventory Value</span>
          <strong className="invStatVal">₹ {totalStockVal.toLocaleString()}</strong>
        </div>
        <div className={`invStatBox ${lowCount > 0 ? "danger" : ""}`}>
          <span className="invStatLabel">Low Stock Alert</span>
          <strong className="invStatVal">{lowCount} Items</strong>
        </div>
      </div>

      {/* 2b. Mobile Compact Summary Bar (Shown on <= 768px) */}
      <div className="inventoryMobileSummary">
        <div className="invMobSummaryItem">
          <strong className="invMobSummaryVal">{inventoryList.length}</strong>
          <span className="invMobSummaryLabel">Materials</span>
        </div>
        <div className="invMobSummaryDivider" />
        <div className="invMobSummaryItem">
          <strong className="invMobSummaryVal">{totalStockUnits.toLocaleString()}</strong>
          <span className="invMobSummaryLabel">Units</span>
        </div>
        <div className="invMobSummaryDivider" />
        <div className="invMobSummaryItem">
          <strong className="invMobSummaryVal">₹{totalStockVal.toLocaleString()}</strong>
          <span className="invMobSummaryLabel">Value</span>
        </div>
        <div className="invMobSummaryDivider" />
        <div className={`invMobSummaryItem ${lowCount > 0 ? "warning" : ""}`}>
          <strong className="invMobSummaryVal">{lowCount}</strong>
          <span className="invMobSummaryLabel">Low Stock</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar - Clean Catalogue Toolbar */}
      <section className="card tableCard invCatalogueSection">
        <div className="invCatalogueToolbar">
          {/* Row 1: Search Input & Results Count */}
          <div className="invSearchRow">
            <div className="invSearchBox">
              <span className="searchIcon">🔍</span>
              <input
                type="text"
                placeholder="Search materials..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="clearBtn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="tableCountHint">
              Showing <strong>{filteredInventory.length}</strong> of <strong>{inventoryList.length}</strong> items
            </div>
          </div>

          {/* Row 2: Category Filter Chips (Horizontally Scrollable) */}
          <div className="invFilterStrip">
            <span className="invFilterStripLabel">Category</span>
            <div className="invChipsScroll" role="tablist" aria-label="Filter by Category">
              {CATEGORIES.map((cat) => {
                const isSelected =
                  selectedCategory === cat ||
                  (cat === "All" && (selectedCategory === "All Categories" || selectedCategory === "All"));
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`invFilterChip ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Stock Status Filter Chips (Horizontally Scrollable) */}
          <div className="invFilterStrip statusStrip">
            <span className="invFilterStripLabel">Status</span>
            <div className="invChipsScroll" role="tablist" aria-label="Filter by Stock Status">
              {STATUS_FILTERS.map((st) => {
                const isSelected =
                  selectedStatus === st ||
                  (st === "All" && (selectedStatus === "All Statuses" || selectedStatus === "All"));
                let dotColor = "";
                let statusClass = "all";
                if (st === "Good") {
                  dotColor = "#10b981";
                  statusClass = "good";
                } else if (st === "Low") {
                  dotColor = "#f59e0b";
                  statusClass = "low";
                } else if (st === "Critical" || st === "Out of Stock") {
                  dotColor = "#ef4444";
                  statusClass = "critical";
                }

                return (
                  <button
                    key={st}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`invFilterChip statusChip ${statusClass} ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedStatus(st)}
                  >
                    {dotColor && (
                      <span
                        className="chipStatusDot"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    <span>{st}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 1. Mobile-First Data Cards (Zero Horizontal Scroll on <= 768px) */}
        <div className="mobileCardList">
          {filteredInventory.length === 0 ? (
            <div className="mobEmptyState">
              <div className="mobEmptyIcon">📦</div>
              <h3 className="mobEmptyTitle">No materials found</h3>
              <p className="mobEmptyDesc">Try changing your search or filters.</p>
              {(search || selectedCategory !== "All" || selectedStatus !== "All") && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: "10px" }}
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                    setSelectedStatus("All");
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            filteredInventory.map((item) => {
              const hasCompanies = item.companies && item.companies.length > 0;
              const statusMeta = getStockStatusMeta(item.status);

              return (
                <div
                  key={item.code || item.name}
                  className="mobMaterialCard"
                  onClick={() => {
                    setSelectedProduct(item);
                    setDrawerTab("overview");
                  }}
                >
                  {/* Top: Name, ID, & Status */}
                  <div className="mobCardTop">
                    <div className="mobCardTitleBlock">
                      <h3 className="mobMaterialName">{item.name}</h3>
                      {item.code && (
                        <span className="mobMaterialCode">{item.code}</span>
                      )}
                    </div>
                    <span className={`mobStockBadge ${statusMeta.badgeClass}`}>
                      <span className={`mobStatusDot ${statusMeta.dotClass}`} />
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Available Stock & Category */}
                  <div className="mobCardMetrics">
                    <div className="mobMetricBlock stockBlock">
                      <span className="mobMetricLabel">Available Stock</span>
                      <div className="mobStockValueWrap">
                        <strong className="mobStockNumber">
                          {Number(item.availableStock).toLocaleString("en-IN")}
                        </strong>
                        <span className="mobStockUnit">{item.unit || "Pcs"}</span>
                      </div>
                    </div>
                    <div className="mobMetricBlock categoryBlock">
                      <span className="mobMetricLabel">Category</span>
                      <span className="mobCategoryPill" title={item.category}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {/* Company & Rate Info - ONLY IF COMPANY DATA EXISTS (Completely hidden if empty) */}
                  {hasCompanies && (
                    <div className="mobCardCompanyRow">
                      <div className="mobCompanyInfo">
                        <span className="mobMetricLabel">Company / Supplier</span>
                        <span className="mobCompanyNames" title={item.companies.map((c) => c.name).join(", ")}>
                          🏢 {item.companies.map((c) => c.name).join(", ")}
                        </span>
                      </div>
                      {item.rate !== null && item.rate !== undefined && (
                        <div className="mobCompanyRate">
                          <span className="mobMetricLabel">Rate</span>
                          <span className="mobRateVal">
                            ₹{Number(item.rate).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Touch-Friendly Action Buttons */}
                  <div className="mobCardActions">
                    <button
                      type="button"
                      className="mobBtnPrimary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAdjustModal(item);
                      }}
                    >
                      + Manage Stock
                    </button>
                    <button
                      type="button"
                      className="mobBtnSecondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(item);
                        setDrawerTab("overview");
                      }}
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Data Table (Visible on > 768px) */}
        <div className="tableScroll">
          <table className="inventoryTable">
            <thead>
              <tr>
                <th className="colMaterial">Material Description</th>
                <th className="colCategory">Category</th>
                <th className="colCompany">Company</th>
                <th className="colRate">Company Rate (₹)</th>
                <th className="colStock">Available Stock</th>
                <th className="colStatus">Status</th>
                <th className="colAction">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTable">
                    <p>No materials match your filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const hasCompanies = item.companies && item.companies.length > 0;
                  return (
                    <tr
                      key={item.name}
                      onClick={() => {
                        setSelectedProduct(item);
                        setDrawerTab("overview");
                      }}
                    >
                      {/* Material Description */}
                      <td className="colMaterial">
                        <div className="materialNameBox">
                          <strong className="materialPrimaryName">{item.name}</strong>
                          {item.code && <span className="materialCodeBadge">{item.code}</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="colCategory">
                        <span className="categoryBadgePill">{item.category}</span>
                      </td>

                      {/* Company Column */}
                      <td className="colCompany">
                        {!hasCompanies ? (
                          <span className="emptyCellDash">—</span>
                        ) : item.companies.length === 1 ? (
                          <div className="singleCellComp">
                            <span className="compNameText">{item.companies[0].name}</span>
                          </div>
                        ) : (
                          <div className="tableMultiList">
                            {item.companies.map((c, cIdx) => (
                              <div key={cIdx} className="tableMultiRow">
                                <span className="compBullet">🏢</span>
                                <span className="compNameText" title={c.name}>{c.name}</span>
                              </div>
                            ))}
                            <div className="tableMultiRow totalPlaceholder">
                              <span style={{ visibility: "hidden" }}>—</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Company Rate (₹) Column */}
                      <td className="colRate textRight">
                        {!hasCompanies ? (
                          <span className="emptyCellDash">—</span>
                        ) : item.companies.length === 1 ? (
                          <div className="singleCellRate">
                            ₹ {Number(item.companies[0].rate).toLocaleString("en-IN")}
                          </div>
                        ) : (
                          <div className="tableMultiList alignRight">
                            {item.companies.map((c, cIdx) => (
                              <div key={cIdx} className="tableMultiRow alignRight">
                                <span className="rateVal">₹ {Number(c.rate).toLocaleString("en-IN")}</span>
                              </div>
                            ))}
                            <div className="tableMultiRow totalPlaceholder">
                              <span style={{ visibility: "hidden" }}>—</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Available Stock Column */}
                      <td className="colStock textRight">
                        {!hasCompanies ? (
                          <span className="emptyCellDash">0 {item.unit}</span>
                        ) : item.companies.length === 1 ? (
                          <div className="singleCellStock">
                            <strong className="stockVal">{Number(item.companies[0].stock).toLocaleString("en-IN")}</strong>{" "}
                            <span className="unitLabel">{item.unit}</span>
                          </div>
                        ) : (
                          <div className="tableMultiList alignRight">
                            {item.companies.map((c, cIdx) => (
                              <div key={cIdx} className="tableMultiRow alignRight">
                                <span className="stockVal">{Number(c.stock).toLocaleString("en-IN")}</span>{" "}
                                <span className="unitLabel">{item.unit}</span>
                              </div>
                            ))}
                            <div className="tableMultiRow totalRow alignRight">
                              <span className="totalLabel">Total:</span>{" "}
                              <strong className="totalVal">{Number(item.availableStock).toLocaleString("en-IN")} {item.unit}</strong>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="colStatus textCenter">
                        <Badge>{item.status}</Badge>
                      </td>

                      {/* Action Column */}
                      <td className="colAction textCenter">
                        <div className="actionBtnGroup">
                          <button
                            type="button"
                            className="actionBtn edit"
                            title="Manage company rate and quantity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAdjustModal(item);
                            }}
                          >
                            + Manage Stock
                          </button>
                          <button
                            type="button"
                            className="actionBtn view"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(item);
                              setDrawerTab("overview");
                            }}
                          >
                            Inspect →
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

      {/* 3. Product Detail Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || "Product History"}
        subtitle={`Category: ${selectedProduct?.category} · Supplied by: ${selectedProduct?.company}`}
        badge={<Badge>{selectedProduct?.status}</Badge>}
        tabs={drawerTabs}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        footerActions={
          <button
            type="button"
            className="secondary"
            onClick={() => setSelectedProduct(null)}
          >
            Close
          </button>
        }
      >
        {selectedProduct && (
          <div>
            {/* Tab 1: Overview */}
            {drawerTab === "overview" && (
              <div>
                <div className="drawerMetricGrid">
                  <div className="drawerMetricCard">
                    <span className="drawerMetricLabel">Available Stock</span>
                    <strong className="drawerMetricVal">
                      {selectedProduct.availableStock} {selectedProduct.unit}
                    </strong>
                  </div>
                  <div className="drawerMetricCard">
                    <span className="drawerMetricLabel">Supplying Company</span>
                    <strong className="drawerMetricVal" style={{ fontSize: "14px" }}>
                      {!selectedProduct.companies || selectedProduct.companies.length === 0
                        ? "—"
                        : selectedProduct.companies.length > 1
                        ? `${selectedProduct.companies.length} Companies`
                        : selectedProduct.companies[0].name}
                    </strong>
                  </div>
                  <div className="drawerMetricCard">
                    <span className="drawerMetricLabel">Company Rate</span>
                    <strong className="drawerMetricVal">
                      {!selectedProduct.companies || selectedProduct.companies.length === 0
                        ? "—"
                        : selectedProduct.companies.length > 1
                        ? `${selectedProduct.companies.length} Rates`
                        : `₹ ${Number(selectedProduct.companies[0].rate).toLocaleString("en-IN")}`}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: "14px" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    onClick={() => handleOpenAdjustModal(selectedProduct)}
                  >
                    <span>➕</span> Manage Company, Rate & Quantity
                  </button>
                </div>

                {/* Company Breakdown Table */}
                <div className="companyBreakdownCard">
                  <div className="companyBreakdownHead">
                    <span className="companyBreakdownTitle">🏢 Company-wise Rates & Available Stock</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      onClick={() => handleOpenAdjustModal(selectedProduct)}
                    >
                      + Add Company
                    </button>
                  </div>
                  <div className="companyTableWrap">
                    {!selectedProduct.companies || selectedProduct.companies.length === 0 ? (
                      <div style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                        No companies or stock recorded for this product yet.
                      </div>
                    ) : (
                      <table className="companyBreakdownTable">
                        <thead>
                          <tr>
                            <th>Company / Supplier</th>
                            <th style={{ textAlign: "right" }}>Rate (₹)</th>
                            <th style={{ textAlign: "right" }}>Available Stock</th>
                            <th style={{ textAlign: "right" }}>Valuation</th>
                            <th style={{ textAlign: "center" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProduct.companies.map((c, cIdx) => (
                            <tr key={cIdx}>
                              <td>
                                <strong>🏢 {c.name}</strong>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <span className="companyRateTag">₹ {Number(c.rate).toLocaleString("en-IN")}</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <b className="companyStockHighlight">{Number(c.stock).toLocaleString("en-IN")} {selectedProduct.unit}</b>
                              </td>
                              <td style={{ textAlign: "right", fontFamily: "var(--font-mono, monospace)" }}>
                                ₹ {((Number(c.stock) || 0) * (Number(c.rate) || 0)).toLocaleString("en-IN")}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  className="actionBtn edit"
                                  style={{ padding: "3px 8px", fontSize: "11px" }}
                                  onClick={() => handleOpenAdjustModal(selectedProduct, c.name)}
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="companyTableTotalRow">
                            <td><strong>Consolidated Total</strong></td>
                            <td style={{ textAlign: "right" }}>—</td>
                            <td style={{ textAlign: "right" }}><strong>{Number(selectedProduct.availableStock).toLocaleString("en-IN")} {selectedProduct.unit}</strong></td>
                            <td style={{ textAlign: "right" }}><strong>₹ {Number(selectedProduct.stockValue || 0).toLocaleString("en-IN")}</strong></td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <h4 className="drawerSectionTitle">Material Master Data</h4>
                <div className="drawerKvList">
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Category:</span>
                    <span className="drawerKvVal">{selectedProduct.category}</span>
                  </div>
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Supplied by Company:</span>
                    <span className="drawerKvVal">{selectedProduct.company}</span>
                  </div>
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Total Valuation:</span>
                    <span className="drawerKvVal">
                      ₹ {(selectedProduct.stockValue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <h4 className="drawerSectionTitle" style={{ marginTop: "20px" }}>
                  Material Flow Summary
                </h4>
                <div className="drawerKvList">
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Total Purchased (Inward):</span>
                    <span className="drawerKvVal" style={{ color: "var(--brand-600)" }}>
                      +{selectedProduct.totalPurchased} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Total Issued (To Sites):</span>
                    <span className="drawerKvVal" style={{ color: "var(--orange-text)" }}>
                      -{selectedProduct.totalIssued} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Recorded Consumed at Site:</span>
                    <span className="drawerKvVal" style={{ color: "var(--green-text)" }}>
                      {selectedProduct.totalConsumed} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="drawerKvRow">
                    <span className="drawerKvLabel">Net Physical Available:</span>
                    <span className="drawerKvVal" style={{ fontWeight: 800 }}>
                      {selectedProduct.availableStock} {selectedProduct.unit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Purchases */}
            {drawerTab === "purchases" && (
              <div className="drawerTimeline">
                {selectedProduct.recentPurchases.length === 0 ? (
                  <p className="emptyTable">No inward purchases logged for this item yet.</p>
                ) : (
                  selectedProduct.recentPurchases.map((p, idx) => (
                    <div key={idx} className="timelineRow">
                      <div className="timelineDot in" />
                      <div className="timelineContent">
                        <div className="timelineHeader">
                          <b>PI / PO #{p.poNumber}</b>
                          <span className="timelineDate">{p.date}</span>
                        </div>
                        <p className="timelineSub">Supplier: {p.supplier}</p>
                        <div className="timelineQty">
                          Qty: +{p.quantity} {selectedProduct.unit} @ ₹{p.rate}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Issues */}
            {drawerTab === "issues" && (
              <div className="drawerTimeline">
                {selectedProduct.recentIssues.length === 0 ? (
                  <p className="emptyTable">No dispatches to site logged for this item yet.</p>
                ) : (
                  selectedProduct.recentIssues.map((iss, idx) => (
                    <div key={idx} className="timelineRow">
                      <div className="timelineDot out" />
                      <div className="timelineContent">
                        <div className="timelineHeader">
                          <b>Voucher #{iss.voucherNo}</b>
                          <span className="timelineDate">{iss.date}</span>
                        </div>
                        <p className="timelineSub">Issued to: {iss.department}</p>
                        <div className="timelineQty out">
                          Dispatched: -{iss.quantity} {selectedProduct.unit}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 4: Consumptions */}
            {drawerTab === "consumptions" && (
              <div className="drawerTimeline">
                {selectedProduct.recentConsumptions.length === 0 ? (
                  <p className="emptyTable">No site consumption recorded for this item yet.</p>
                ) : (
                  selectedProduct.recentConsumptions.map((c, idx) => (
                    <div key={idx} className="timelineRow">
                      <div className="timelineDot used" />
                      <div className="timelineContent">
                        <div className="timelineHeader">
                          <b>Consumption #{c.consumptionNo}</b>
                          <span className="timelineDate">{c.date}</span>
                        </div>
                        <p className="timelineSub">Site: {c.department} · By: {c.usedBy || "Site Engineer"}</p>
                        <div className="timelineQty used">
                          Utilized: {c.quantity} {selectedProduct.unit}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Stock Adjustment Modal */}
      <StockAdjustModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustingCompany("");
        }}
        products={inventoryList}
        initialProduct={adjustingProduct}
        initialCompany={adjustingCompany}
        onStockUpdated={() => refreshInventory()}
      />
    </Shell>
  );
}
