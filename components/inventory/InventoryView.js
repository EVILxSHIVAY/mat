"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { exportToExcel } from "@/lib/exportToExcel";
import { calculateLiveInventory, getMaterialSupplierRows } from "@/lib/dataService";
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

const STATUS_FILTERS = ["All", "Good", "Low", "Out of Stock"];

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

  // Listen for custom stock and product supplier update events
  useEffect(() => {
    const handleStockUpdated = () => {
      refreshInventory();
    };
    window.addEventListener("pdv_stock_updated", handleStockUpdated);
    window.addEventListener("pdv_product_suppliers_updated", handleStockUpdated);
    window.addEventListener("pdv_suppliers_updated", handleStockUpdated);
    return () => {
      window.removeEventListener("pdv_stock_updated", handleStockUpdated);
      window.removeEventListener("pdv_product_suppliers_updated", handleStockUpdated);
      window.removeEventListener("pdv_suppliers_updated", handleStockUpdated);
    };
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
          ? item.status === "Low" || item.status === "Critical"
          : selectedStatus === "Out of Stock"
          ? item.status === "Out of Stock"
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
      "Company / Supplier",
      "Rate (₹)",
      "Stock Value (₹)",
    ];
    const rows = filteredInventory.map((i) => {
      const sRows = getMaterialSupplierRows(i).filter((s) => s && s.name && !s.name.includes(","));
      const compStr = sRows.length > 0 ? sRows.map((s) => s.name).join(", ") : (i.company || "—");
      const rateStr = sRows.length > 0
        ? sRows.map((s) => (s.rate > 0 ? `₹${s.rate}` : "₹0")).join(", ")
        : (i.rate ? `₹${i.rate}` : "—");
      return [
        i.name,
        i.category,
        i.availableStock,
        i.unit,
        i.status,
        compStr,
        rateStr,
        i.stockValue,
      ];
    });
    exportToExcel({ filename: "Inventory_Stock_Report", headers, rows });
  };

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
                } else if (st === "Out of Stock") {
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
              const supplierRows = getMaterialSupplierRows(item).filter(
                (sup) => sup && sup.name && !sup.name.includes(",")
              );
              const statusMeta = getStockStatusMeta(item.status);
              const unit = item.unit || "Pcs";

              return (
                <div
                  key={item.code || item.name}
                  className="mobMaterialCard"
                  onClick={() => {
                    setSelectedProduct(item);
                  }}
                >
                  {/* 1. Header: Name + status badge, then material code */}
                  <div className="mobCardTop">
                    <div className="mobCardHeaderRow">
                      <h3 className="mobMaterialName">{item.name}</h3>
                      <span className={`mobStockBadge ${statusMeta.badgeClass}`}>
                        <span className={`mobStatusDot ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                      </span>
                    </div>
                    {item.code && (
                      <span className="mobMaterialCode">{item.code}</span>
                    )}
                  </div>

                  {/* 2. Stock summary block: Available Stock, Category */}
                  <div className="mobCardMetrics">
                    <div className="mobMetricBlock stockBlock">
                      <span className="mobMetricLabel">Available Stock</span>
                      <div className="mobStockValueWrap">
                        <strong className="mobStockNumber">
                          {Number(item.availableStock).toLocaleString("en-IN")}
                        </strong>
                        <span className="mobStockUnit">{unit}</span>
                      </div>
                    </div>
                    <div className="mobMetricBlock categoryBlock">
                      <span className="mobMetricLabel">Category</span>
                      <span className="mobCategoryPill" title={item.category}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {/* 3. "COMPANY / SUPPLIER" section */}
                  <div className="mobSupplierSection">
                    <span className="mobSupplierHeading">COMPANY / SUPPLIER</span>
                    {supplierRows.length === 0 ? (
                      <div className="mobNoSupplier">No supplier configured</div>
                    ) : (
                      <>
                        <div className="mobSupplierList">
                          {supplierRows.map((sup, sIdx) => (
                            <div key={sup.name || sIdx} className="mobSupplierRow">
                              <span className="mobSupplierName" title={sup.name}>
                                🏢 {sup.name}
                              </span>
                              <span className="mobSupplierDetails">
                                ₹{Number(sup.rate).toLocaleString("en-IN")} · {Number(sup.stock).toLocaleString("en-IN")} {unit}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mobSupplierTotalRow">
                          <span className="mobTotalLabel">Total:</span>
                          <strong className="mobTotalVal">
                            {Number(item.availableStock).toLocaleString("en-IN")} {unit}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 4. Full-width "+ Add Stock" and "View More" buttons, stacked vertically */}
                  <div className="mobCardActionsStacked">
                    <button
                      type="button"
                      className="mobBtnPrimaryFull"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAdjustModal(item);
                      }}
                    >
                      + Add Stock
                    </button>
                    <button
                      type="button"
                      className="mobBtnSecondaryFull"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(item);
                      }}
                    >
                      View More
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
                  const supplierRows = getMaterialSupplierRows(item).filter(
                    (sup) => sup && sup.name && !sup.name.includes(",")
                  );
                  const hasSuppliers = supplierRows.length > 0;
                  const unit = item.unit || "Pcs";

                  return (
                    <tr
                      key={item.name}
                      onClick={() => {
                        setSelectedProduct(item);
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
                        {!hasSuppliers ? (
                          <span className="emptyCellDash">—</span>
                        ) : supplierRows.length === 1 ? (
                          <div className="singleCellComp">
                            <span className="compNameText">{supplierRows[0].name}</span>
                          </div>
                        ) : (
                          <div className="tableMultiList">
                            {supplierRows.map((c, cIdx) => (
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
                        {!hasSuppliers ? (
                          <span className="emptyCellDash">—</span>
                        ) : supplierRows.length === 1 ? (
                          <div className="singleCellRate">
                            ₹ {Number(supplierRows[0].rate).toLocaleString("en-IN")}
                          </div>
                        ) : (
                          <div className="tableMultiList alignRight">
                            {supplierRows.map((c, cIdx) => (
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
                        {!hasSuppliers ? (
                          <span className="emptyCellDash">0 {unit}</span>
                        ) : supplierRows.length === 1 ? (
                          <div className="singleCellStock">
                            <strong className="stockVal">{Number(supplierRows[0].stock).toLocaleString("en-IN")}</strong>{" "}
                            <span className="unitLabel">{unit}</span>
                          </div>
                        ) : (
                          <div className="tableMultiList alignRight">
                            {supplierRows.map((c, cIdx) => (
                              <div key={cIdx} className="tableMultiRow alignRight">
                                <span className="stockVal">{Number(c.stock).toLocaleString("en-IN")}</span>{" "}
                                <span className="unitLabel">{unit}</span>
                              </div>
                            ))}
                            <div className="tableMultiRow totalRow alignRight">
                              <span className="totalLabel">Total:</span>{" "}
                              <strong className="totalVal">{Number(item.availableStock).toLocaleString("en-IN")} {unit}</strong>
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
                            title="Add or update company stock"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAdjustModal(item);
                            }}
                          >
                            + Add Stock
                          </button>
                          <button
                            type="button"
                            className="actionBtn view"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(item);
                            }}
                          >
                            View More →
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
        title="Material"
      >
        {selectedProduct && (() => {
          const companiesList = getMaterialSupplierRows(selectedProduct).filter(
            (c) => c && c.name && !c.name.includes(",")
          );

          const unitName = selectedProduct.unit || "Pcs";
          const statusInfo = getStockStatusMeta(selectedProduct.status || "In Stock");

          return (
            <div className="viewStockContainer">
              {/* Header: Material Name, ID, ● Good */}
              <div className="viewStockHeaderArea">
                <div className="viewStockHeaderTop">
                  <h3 className="viewStockMaterialName">{selectedProduct.name}</h3>
                  <span className={`statusBadge ${statusInfo.badgeClass}`}>
                    <span className="badgeDot" />
                    {statusInfo.label === "In Stock" ? "Good" : statusInfo.label}
                  </span>
                </div>
                {selectedProduct.code && (
                  <span className="viewStockMaterialCode">{selectedProduct.code}</span>
                )}
              </div>

              {/* MATERIAL DETAILS */}
              <div className="viewStockSection">
                <h4 className="viewStockSectionHeading">MATERIAL DETAILS</h4>
                <div className="viewStockDetailsCard">
                  <div className="viewStockDetailCol">
                    <span className="viewStockDetailLabel">Category</span>
                    <span className="viewStockDetailVal">{selectedProduct.category || "General"}</span>
                  </div>
                  <div className="viewStockDetailCol alignRight">
                    <span className="viewStockDetailLabel">Available Stock</span>
                    <div className="viewStockAvailableVal">
                      <strong className="viewStockQtyNum">
                        {Number(selectedProduct.availableStock).toLocaleString("en-IN")}
                      </strong>
                      <span className="viewStockQtyUnit">{unitName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* COMPANY / SUPPLIER DETAILS */}
              <div className="viewStockSection">
                <h4 className="viewStockSectionHeading">COMPANY / SUPPLIER DETAILS</h4>
                {companiesList.length === 0 ? (
                  <div className="viewStockEmpty">No company stock recorded for this material.</div>
                ) : (
                  <div className="viewStockTableCard">
                    <table className="viewStockTable">
                      <thead>
                        <tr>
                          <th className="thCompany">Company / Supplier</th>
                          <th className="thRate textRight">Rate</th>
                          <th className="thStock textRight">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companiesList.map((c, idx) => (
                          <tr key={idx}>
                            <td className="tdCompany">
                              <span className="viewStockTableCompName">{c.name}</span>
                            </td>
                            <td className="tdRate textRight">
                              <span className="viewStockTableRate">
                                {c.rate !== null && c.rate !== undefined && !isNaN(c.rate) && c.rate !== ""
                                  ? `₹${Number(c.rate).toLocaleString("en-IN")}`
                                  : "—"}
                              </span>
                            </td>
                            <td className="tdStock textRight">
                              <strong className="viewStockTableStock">
                                {Number(c.stock).toLocaleString("en-IN")} {unitName}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
