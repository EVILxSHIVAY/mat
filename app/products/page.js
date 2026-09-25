"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  calculateLiveInventory,
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  inferUnit,
  getProductSuppliersMap,
  addProductSupplier,
  updateProductSupplierRate,
  removeProductSupplier,
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

// Helper to normalize directory supplier shape
function parseSupplier(s) {
  if (Array.isArray(s)) {
    return {
      code: s[0] || "",
      name: s[1] || "",
      contact: s[2] || "",
      mobile: s[3] || "",
      email: s[4] || "",
      gst: s[5] || "",
      status: s[6] || "Active",
    };
  }
  return {
    code: s?.code || "",
    name: s?.name || "",
    contact: s?.contactPerson || s?.contact || "",
    mobile: s?.mobile || "",
    email: s?.email || "",
    gst: s?.gst || "",
    status: s?.status || "Active",
  };
}

export default function ProductsPage() {
  const [productsList, setProductsList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productSuppliersMap, setProductSuppliersMap] = useState({});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  // Add Product Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "Pipes & Fittings",
    supplier: "",
    rate: "",
  });

  // Add Supplier Modal state (Assign supplier to a specific material)
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");
  const [newSupplierRate, setNewSupplierRate] = useState("");
  const [addSupplierError, setAddSupplierError] = useState("");

  // Edit Supplier Rate Modal state
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false);
  const [targetSupplierForEdit, setTargetSupplierForEdit] = useState(null);
  const [editRateValue, setEditRateValue] = useState("");
  const [editSupplierError, setEditSupplierError] = useState("");

  const loadData = () => {
    setProductsList(calculateLiveInventory());
    const sups = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
    setSuppliers(sups);
    setProductSuppliersMap(getProductSuppliersMap());
  };

  useEffect(() => {
    loadData();
    window.addEventListener("pdv_stock_updated", loadData);
    window.addEventListener("pdv_suppliers_updated", loadData);
    window.addEventListener("pdv_product_suppliers_updated", loadData);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("pdv_stock_updated", loadData);
      window.removeEventListener("pdv_suppliers_updated", loadData);
      window.removeEventListener("pdv_product_suppliers_updated", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  // Lock scroll when any modal is open
  useEffect(() => {
    const anyModalOpen = isModalOpen || isAddSupplierModalOpen || isEditSupplierModalOpen;
    if (anyModalOpen) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => {
      unlockScroll();
    };
  }, [isModalOpen, isAddSupplierModalOpen, isEditSupplierModalOpen]);

  // Helper to get assigned suppliers for a specific product
  const getAssignedSuppliers = (p) => {
    if (!p) return [];
    const key = (p.name || "").toLowerCase().trim();
    const codeKey = (p.code || "").toLowerCase().trim();
    const fromMap = productSuppliersMap[key] || (codeKey ? productSuppliersMap[codeKey] : null);
    if (Array.isArray(fromMap) && fromMap.length > 0) return fromMap;
    if (Array.isArray(p.assignedSuppliers) && p.assignedSuppliers.length > 0) return p.assignedSuppliers;
    return [];
  };

  const getSupplierSummary = (p) => {
    const assigned = getAssignedSuppliers(p);
    if (assigned.length > 0) {
      return assigned.map((s) => s.supplierName).join(", ");
    }
    return "No supplier assigned";
  };

  // --- Handlers for Add Product ---
  const handleOpenAdd = () => {
    setFormData({
      code: `PRD-${String(productsList.length + 1).padStart(3, "0")}`,
      name: "",
      category: "Pipes & Fittings",
      supplier: "",
      rate: "",
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      alert("Material Name is required.");
      return;
    }

    const validatedUnit = inferUnit(trimmedName);
    const chosenSupplier = formData.supplier.trim();
    const numRate = Number(formData.rate) || 0;

    const row = [
      formData.code,
      trimmedName,
      "",
      formData.category,
      validatedUnit,
      chosenSupplier,
      numRate,
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

    if (chosenSupplier) {
      addProductSupplier(trimmedName, {
        supplierName: chosenSupplier,
        rate: numRate,
      });
    }

    loadData();
    setIsModalOpen(false);
  };

  // --- Handlers for Add Supplier to Product ---
  const handleOpenAddSupplier = (product) => {
    setTargetProduct(product);
    setSelectedSupplierName("");
    setNewSupplierRate("");
    setAddSupplierError("");
    setIsAddSupplierModalOpen(true);
  };

  const handleSaveAddSupplier = (e) => {
    e.preventDefault();
    if (!targetProduct) return;

    if (!selectedSupplierName.trim()) {
      setAddSupplierError("Please select a supplier from the Supplier Directory.");
      return;
    }

    const numRate = Number(newSupplierRate);
    if (isNaN(numRate) || numRate < 0) {
      setAddSupplierError("Please enter a valid non-negative rate.");
      return;
    }

    const res = addProductSupplier(targetProduct.name || targetProduct.code, {
      supplierName: selectedSupplierName.trim(),
      rate: numRate,
    });

    if (!res.success) {
      setAddSupplierError(res.error || "Failed to assign supplier.");
      return;
    }

    loadData();
    setIsAddSupplierModalOpen(false);
  };

  // --- Handlers for Edit Supplier Rate ---
  const handleOpenEditSupplier = (product, sup) => {
    setTargetProduct(product);
    setTargetSupplierForEdit(sup);
    setEditRateValue(sup.rate !== undefined && sup.rate !== null ? String(sup.rate) : "");
    setEditSupplierError("");
    setIsEditSupplierModalOpen(true);
  };

  const handleSaveEditSupplier = (e) => {
    e.preventDefault();
    if (!targetProduct || !targetSupplierForEdit) return;

    const numRate = Number(editRateValue);
    if (isNaN(numRate) || numRate < 0) {
      setEditSupplierError("Please enter a valid non-negative rate.");
      return;
    }

    const res = updateProductSupplierRate(
      targetProduct.name || targetProduct.code,
      targetSupplierForEdit.supplierName,
      numRate
    );

    if (!res.success) {
      setEditSupplierError(res.error || "Failed to update supplier rate.");
      return;
    }

    loadData();
    setIsEditSupplierModalOpen(false);
  };

  // --- Handlers for Remove Supplier from Product ---
  const handleRemoveSupplier = (product, sup) => {
    if (!product || !sup) return;
    const confirmMessage = `Remove "${sup.supplierName}" from "${product.name}"?\n\nThis removes the supplier assignment and material rate from this product. It will NOT delete "${sup.supplierName}" from the Supplier Directory.`;
    if (window.confirm(confirmMessage)) {
      removeProductSupplier(product.name || product.code, sup.supplierName);
      loadData();
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const supSummary = getSupplierSummary(p).toLowerCase();
      const s = search.toLowerCase().trim();

      const matchesSearch = !s || name.includes(s) || cat.includes(s) || supSummary.includes(s);
      const matchesCat =
        categoryFilter === "All Categories" || p.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [productsList, search, categoryFilter, productSuppliersMap]);

  const handleExport = () => {
    const headers = ["Material Name", "Category", "Supplier Name"];
    const rows = filteredProducts.map((p) => {
      const assigned = getAssignedSuppliers(p);
      const supText =
        assigned.length > 0
          ? assigned.map((s) => `${s.supplierName} (₹${s.rate})`).join("; ")
          : "No supplier assigned";
      return [p.name, p.category, supText];
    });
    exportToExcel({ filename: "Product_Catalog", headers, rows });
  };

  // Parse directory suppliers for assignment dropdown
  const directorySuppliers = useMemo(() => {
    return suppliers.map(parseSupplier).filter((s) => s.name && s.name.trim() !== "");
  }, [suppliers]);

  // Suppliers available to assign to targetProduct (preventing duplicates)
  const availableToAssign = useMemo(() => {
    if (!targetProduct) return directorySuppliers;
    const assigned = getAssignedSuppliers(targetProduct).map((s) =>
      s.supplierName.toLowerCase().trim()
    );
    return directorySuppliers.filter(
      (s) => !assigned.includes(s.name.toLowerCase().trim())
    );
  }, [targetProduct, directorySuppliers, productSuppliersMap]);

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

        {/* 1. Mobile-First Data Cards (Showing Material Name, Category, Supplier Name) */}
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
              const assigned = getAssignedSuppliers(p);
              return (
                <div
                  key={p.code || p.name}
                  className="mobileDataCard"
                  style={{ cursor: "default", padding: "14px 16px", gap: "10px" }}
                >
                  <div className="mobileCardHeader" style={{ alignItems: "center", marginBottom: "2px" }}>
                    <div>
                      <h3 className="mobileCardTitle" style={{ fontSize: "14.5px", margin: 0, fontWeight: 700 }}>
                        {p.name}
                      </h3>
                      {p.code && (
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{p.code}</span>
                      )}
                    </div>
                    <span className="categoryBadgePill" style={{ fontSize: "11px", flexShrink: 0 }}>
                      {p.category}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>
                        Supplier Name:
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "2px 8px", fontSize: "11px", height: "24px", borderRadius: "4px" }}
                        onClick={() => handleOpenAddSupplier(p)}
                      >
                        + Add Supplier
                      </button>
                    </div>

                    {assigned.length === 0 ? (
                      <span style={{ color: "var(--text-muted)", fontSize: "12.5px", fontStyle: "italic" }}>
                        No supplier assigned
                      </span>
                    ) : (
                      assigned.map((sup) => (
                        <div
                          key={sup.supplierName}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "var(--surface-subtle, #f8fafc)",
                            border: "1px solid var(--border-default, #e2e8f0)",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            fontSize: "12.5px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                            <span>🏢</span>
                            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sup.supplierName}
                            </span>
                            <span style={{ color: "var(--brand-700, #0369a1)", fontWeight: 700, fontSize: "12px", flexShrink: 0 }}>
                              ₹{Number(sup.rate).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                            <button
                              type="button"
                              style={{
                                background: "white",
                                border: "1px solid var(--border-default, #cbd5e1)",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                              onClick={() => handleOpenEditSupplier(p, sup)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={{
                                background: "white",
                                border: "1px solid #fecaca",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "11px",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                              onClick={() => handleRemoveSupplier(p, sup)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Data Table (Showing Material Name, Category, Supplier Name) */}
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: "42%", padding: "12px 18px" }}>Material Name</th>
                <th style={{ width: "23%", padding: "12px 18px" }}>Category</th>
                <th style={{ width: "35%", padding: "12px 18px" }}>Supplier Name</th>
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
                  const assigned = getAssignedSuppliers(p);
                  return (
                    <tr key={p.code || p.name}>
                      <td style={{ padding: "14px 18px" }}>
                        <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                          {p.name}
                        </strong>
                        {p.code && (
                          <span style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {p.code}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span className="categoryBadgePill">{p.category}</span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {assigned.length === 0 ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                              No supplier assigned
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: "4px 10px",
                                fontSize: "12px",
                                height: "28px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                              onClick={() => handleOpenAddSupplier(p)}
                            >
                              + Add Supplier
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {assigned.map((sup) => (
                              <div
                                key={sup.supplierName}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  background: "var(--surface-subtle, #f8fafc)",
                                  border: "1px solid var(--border-default, #e2e8f0)",
                                  borderRadius: "6px",
                                  padding: "6px 10px",
                                  gap: "8px",
                                  fontSize: "12.5px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: "12px" }}>🏢</span>
                                  <strong
                                    style={{
                                      color: "var(--text-primary)",
                                      fontWeight: 600,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={sup.supplierName}
                                  >
                                    {sup.supplierName}
                                  </strong>
                                  <span
                                    style={{
                                      color: "var(--brand-700, #0369a1)",
                                      fontWeight: 700,
                                      background: "#e0f2fe",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      fontSize: "11.5px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    ₹{Number(sup.rate).toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    title="Edit Rate"
                                    style={{
                                      background: "#ffffff",
                                      border: "1px solid var(--border-default, #cbd5e1)",
                                      borderRadius: "4px",
                                      padding: "2px 7px",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                      color: "var(--text-secondary)",
                                      fontWeight: 500,
                                    }}
                                    onClick={() => handleOpenEditSupplier(p, sup)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    title="Remove Supplier from this product"
                                    style={{
                                      background: "#ffffff",
                                      border: "1px solid #fecaca",
                                      borderRadius: "4px",
                                      padding: "2px 7px",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                      color: "#dc2626",
                                      fontWeight: 500,
                                    }}
                                    onClick={() => handleRemoveSupplier(p, sup)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            <div style={{ marginTop: "2px" }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: "3px 8px",
                                  fontSize: "11.5px",
                                  height: "26px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  borderRadius: "5px",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                                onClick={() => handleOpenAddSupplier(p)}
                              >
                                + Add Supplier
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal 1: Add Supplier to Product */}
      {isAddSupplierModalOpen && targetProduct && (
        <div className="modalBackdrop" onClick={() => setIsAddSupplierModalOpen(false)}>
          <div
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modalHeader">
              <div>
                <h3 style={{ margin: 0 }}>Add Supplier</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Assign supplier and set rate for: <strong>{targetProduct.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsAddSupplierModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveAddSupplier}>
              <div className="modalBody" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {addSupplierError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                    }}
                  >
                    ⚠️ {addSupplierError}
                  </div>
                )}

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Supplier <span style={{ color: "#dc2626" }}>*</span></span>
                    <Link
                      href="/suppliers"
                      target="_blank"
                      style={{ fontSize: "11.5px", color: "var(--brand-600)", textDecoration: "none", fontWeight: 500 }}
                    >
                      + Supplier Directory ↗
                    </Link>
                  </div>
                  <select
                    value={selectedSupplierName}
                    onChange={(e) => {
                      setSelectedSupplierName(e.target.value);
                      setAddSupplierError("");
                    }}
                    className="invSelect"
                    style={{ width: "100%", height: "42px" }}
                    required
                    disabled={availableToAssign.length === 0}
                  >
                    <option value="">
                      {directorySuppliers.length === 0
                        ? "-- No suppliers in Supplier Directory --"
                        : availableToAssign.length === 0
                        ? "-- All directory suppliers already assigned --"
                        : "-- Select Supplier --"}
                    </option>
                    {availableToAssign.map((s, idx) => (
                      <option key={s.code || idx} value={s.name}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {directorySuppliers.length === 0 && (
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--amber-text, #d97706)" }}>
                    ⚠️ Supplier Directory is empty. Click{" "}
                    <Link
                      href="/suppliers"
                      target="_blank"
                      style={{ fontWeight: 600, color: "var(--brand-600)", textDecoration: "underline" }}
                    >
                      Supplier Directory
                    </Link>{" "}
                    to register suppliers first.
                  </p>
                )}

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Rate (₹) <span style={{ color: "#dc2626" }}>*</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        fontSize: "14px",
                      }}
                    >
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Enter Rate (₹)"
                      style={{ paddingLeft: "28px", width: "100%" }}
                      value={newSupplierRate}
                      onChange={(e) => {
                        setNewSupplierRate(e.target.value);
                        setAddSupplierError("");
                      }}
                    />
                  </div>
                </label>
              </div>

              <div className="modalFooter" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsAddSupplierModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={availableToAssign.length === 0 || !selectedSupplierName}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Supplier Rate */}
      {isEditSupplierModalOpen && targetProduct && targetSupplierForEdit && (
        <div className="modalBackdrop" onClick={() => setIsEditSupplierModalOpen(false)}>
          <div
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modalHeader">
              <div>
                <h3 style={{ margin: 0 }}>Edit Supplier Rate</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Material: <strong>{targetProduct.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsEditSupplierModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveEditSupplier}>
              <div className="modalBody" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {editSupplierError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                    }}
                  >
                    ⚠️ {editSupplierError}
                  </div>
                )}

                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                    Supplier
                  </span>
                  <div
                    style={{
                      height: "42px",
                      background: "var(--surface-subtle, #f8fafc)",
                      border: "1px solid var(--border-default, #e2e8f0)",
                      borderRadius: "6px",
                      padding: "0 12px",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginTop: "4px",
                    }}
                  >
                    🏢 {targetSupplierForEdit.supplierName}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Rate for this Material (₹) <span style={{ color: "#dc2626" }}>*</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        fontSize: "14px",
                      }}
                    >
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Enter Rate (₹)"
                      style={{ paddingLeft: "28px", width: "100%" }}
                      value={editRateValue}
                      onChange={(e) => {
                        setEditRateValue(e.target.value);
                        setEditSupplierError("");
                      }}
                    />
                  </div>
                </label>
              </div>

              <div className="modalFooter" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsEditSupplierModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Product to Catalog */}
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
                  Initial Supplier (Optional)
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="invSelect"
                    style={{ width: "100%" }}
                  >
                    <option value="">-- No initial supplier (assign later) --</option>
                    {directorySuppliers.map((s, idx) => (
                      <option key={s.code || idx} value={s.name}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {formData.supplier && (
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Rate for this Supplier (₹)
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: "12px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        style={{ paddingLeft: "28px", width: "100%" }}
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      />
                    </div>
                  </label>
                )}
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
