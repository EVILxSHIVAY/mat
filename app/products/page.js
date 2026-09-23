"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  calculateLiveInventory,
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  inferUnit,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";

const CATEGORIES = [
  "All Categories",
  "Pipes & Fittings",
  "Valves & Meters",
  "Tools & Equipment",
  "Safety & PPE",
  "Fasteners & Hardware",
  "General Materials",
];

function getSupplierName(p) {
  if (p.companies && Array.isArray(p.companies) && p.companies.length > 0) {
    const names = p.companies.map((c) => c.name).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  return p.company || p.supplier || "—";
}

export default function ProductsPage() {
  const [productsList, setProductsList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  // Add Product Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "Pipes & Fittings",
    supplier: "",
  });

  const loadData = () => {
    setProductsList(calculateLiveInventory());
    const sups = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
    setSuppliers(sups);
  };

  useEffect(() => {
    loadData();
    window.addEventListener("pdv_stock_updated", loadData);
    window.addEventListener("pdv_suppliers_updated", loadData);
    return () => {
      window.removeEventListener("pdv_stock_updated", loadData);
      window.removeEventListener("pdv_suppliers_updated", loadData);
    };
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      code: `PRD-${String(productsList.length + 1).padStart(3, "0")}`,
      name: "",
      category: "Pipes & Fittings",
      supplier: "",
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (isModalOpen) {
      lockScroll();
    }
    return () => {
      if (isModalOpen) unlockScroll();
    };
  }, [isModalOpen]);

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Material Name is required.");
      return;
    }

    const validatedUnit = inferUnit(formData.name);

    const row = [
      formData.code,
      formData.name.trim(),
      "",
      formData.category,
      validatedUnit,
      formData.supplier.trim(),
      100,
      "18%",
      "",
      "",
      20,
      "Central Warehouse",
      "",
      "Active",
    ];

    const currentCustom = getStorageData(STORAGE_KEYS.PRODUCTS, []);
    setStorageData(STORAGE_KEYS.PRODUCTS, [row, ...currentCustom]);
    loadData();
    setIsModalOpen(false);
  };

  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const sup = getSupplierName(p).toLowerCase();
      const s = search.toLowerCase().trim();

      const matchesSearch = !s || name.includes(s) || cat.includes(s) || sup.includes(s);
      const matchesCat =
        categoryFilter === "All Categories" || p.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [productsList, search, categoryFilter]);

  const handleExport = () => {
    const headers = ["Material Name", "Category", "Supplier Name"];
    const rows = filteredProducts.map((p) => [
      p.name,
      p.category,
      getSupplierName(p),
    ]);
    exportToExcel({ filename: "Product_Catalog", headers, rows });
  };

  return (
    <Shell>
      <Title
        title="Products Catalog"
        desc="Master catalog displaying Material Name, Category, and Supplier Name."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, whiteSpace: "nowrap" }}
              onClick={handleExport}
            >
              ⤓ Export Catalog
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, whiteSpace: "nowrap" }}
              onClick={handleOpenAdd}
            >
              + Add Product
            </button>
          </div>
        }
      />

      {/* Table & Mobile Card Section */}
      <section className="card tableCard">
        <div className="tableControls">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%", flexWrap: "wrap" }}>
            <div className="invSearchBox" style={{ flex: "1 1 260px", minWidth: 0 }}>
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search material, category, or supplier..."
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

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="invSelect"
              style={{ minWidth: "160px", height: "42px" }}
              aria-label="Filter by category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="tableCountHint">
            Showing <strong>{filteredProducts.length}</strong> of <strong>{productsList.length}</strong> items
          </span>
        </div>

        {/* 1. Mobile-First Data Cards (Showing Material Name, Category, Supplier Name only) */}
        <div className="mobileCardList">
          {filteredProducts.length === 0 ? (
            <div className="emptyTable">
              <p>No products match your search or filter.</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "8px" }}
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All Categories");
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const supplierName = getSupplierName(p);
              return (
                <div
                  key={p.code || p.name}
                  className="mobileDataCard"
                  style={{ cursor: "default", padding: "14px 16px", gap: "8px" }}
                >
                  <div className="mobileCardHeader" style={{ alignItems: "center", marginBottom: "2px" }}>
                    <h3 className="mobileCardTitle" style={{ fontSize: "14.5px", margin: 0, fontWeight: 700 }}>
                      {p.name}
                    </h3>
                    <span className="categoryBadgePill" style={{ fontSize: "11px", flexShrink: 0 }}>
                      {p.category}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>
                      Supplier:
                    </span>
                    <strong
                      style={{
                        color: supplierName !== "—" ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      {supplierName !== "—" && "🏢 "}
                      {supplierName}
                    </strong>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Data Table (Showing Material Name, Category, Supplier Name only) */}
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: "45%", padding: "12px 18px" }}>Material Name</th>
                <th style={{ width: "25%", padding: "12px 18px" }}>Category</th>
                <th style={{ width: "30%", padding: "12px 18px" }}>Supplier Name</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="emptyTable">
                    <p>No products match your search or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const supplierName = getSupplierName(p);
                  return (
                    <tr key={p.code || p.name}>
                      <td style={{ padding: "14px 18px" }}>
                        <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                          {p.name}
                        </strong>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span className="categoryBadgePill">{p.category}</span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            fontWeight: 500,
                            color: supplierName !== "—" ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {supplierName !== "—" && "🏢 "}
                          {supplierName}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="modalHeader">
              <h3>Add Product to Catalog</h3>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div
                className="modalBody"
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Material Name *
                  <input
                    type="text"
                    required
                    placeholder="e.g. Steel Pipe 2 inch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Category *
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="invSelect"
                    style={{ width: "100%" }}
                  >
                    {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Supplier Name
                  <input
                    type="text"
                    placeholder="e.g. Jindal Steel Ltd"
                    list="suppliers-list"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map((s, idx) => (
                      <option key={idx} value={s.name || s.supplierName || s[0]} />
                    ))}
                  </datalist>
                </label>
              </div>

              <div className="modalFooter" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
