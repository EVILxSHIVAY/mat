"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { saveProductCompanyStock, inferUnit, getProductSuppliers } from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

export default function StockAdjustModal({
  isOpen,
  onClose,
  products = [],
  initialProduct = null,
  initialCompany = "",
  onStockUpdated,
}) {
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [productSuppliersVersion, setProductSuppliersVersion] = useState(0);

  // Listen for product supplier changes
  useEffect(() => {
    const handleUpdate = () => {
      setProductSuppliersVersion((v) => v + 1);
    };
    window.addEventListener("pdv_product_suppliers_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("pdv_product_suppliers_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, []);

  // Find active product
  const activeProduct = useMemo(() => {
    if (!selectedProductCode) return initialProduct || products[0] || null;
    return (
      products.find(
        (p) =>
          p.code === selectedProductCode ||
          p.name === selectedProductCode ||
          p.name?.toLowerCase() === selectedProductCode.toLowerCase()
      ) ||
      initialProduct ||
      null
    );
  }, [selectedProductCode, products, initialProduct]);

  // Load ONLY assigned suppliers for THIS material from Products Catalog
  const assignedSuppliers = useMemo(() => {
    if (!activeProduct) return [];
    return getProductSuppliers(activeProduct.name || activeProduct.code);
  }, [activeProduct, productSuppliersVersion]);

  // Find if selected company already exists in inventory stock records for THIS material
  const existingCompanyRecord = useMemo(() => {
    if (!activeProduct || !companyName) return null;
    const searchTarget = companyName.trim().toLowerCase();
    if (!searchTarget) return null;

    if (Array.isArray(activeProduct.companies) && activeProduct.companies.length > 0) {
      const found = activeProduct.companies.find(
        (c) => c.name && c.name.toLowerCase().trim() === searchTarget
      );
      if (found) return found;
    }

    if (
      activeProduct.company &&
      activeProduct.company.toLowerCase().trim() === searchTarget &&
      activeProduct.company !== "—"
    ) {
      return {
        name: activeProduct.company,
        rate: activeProduct.rate || 0,
        stock: activeProduct.availableStock || 0,
      };
    }

    return null;
  }, [activeProduct, companyName]);

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      lockScroll();
      const prod = initialProduct || (products.length > 0 ? products[0] : null);
      if (prod) {
        setSelectedProductCode(prod.code || prod.name);
        const prodAssigned = getProductSuppliers(prod.name || prod.code);

        if (initialCompany) {
          const trimmed = initialCompany.toLowerCase().trim();
          const matchedAssigned = prodAssigned.find(
            (s) => s.supplierName && s.supplierName.toLowerCase().trim() === trimmed
          );

          setCompanyName(initialCompany);
          if (matchedAssigned && matchedAssigned.rate !== undefined && matchedAssigned.rate !== null) {
            setRate(String(matchedAssigned.rate));
          } else {
            setRate("");
          }
          setQuantity("");
          setFeedback(null);
          return;
        } else if (prodAssigned.length === 1) {
          // If exactly one supplier assigned, pre-select it
          setCompanyName(prodAssigned[0].supplierName);
          setRate(String(prodAssigned[0].rate || 0));
          setQuantity("");
          setFeedback(null);
          return;
        }
      }
      setCompanyName("");
      setRate("");
      setQuantity("");
      setFeedback(null);
    } else {
      unlockScroll();
    }
    return () => {
      if (isOpen) unlockScroll();
    };
  }, [isOpen, initialProduct, initialCompany, products]);

  // Handle supplier selection with Material-Specific Rate Auto-fill
  const handleSupplierChange = (selectedName) => {
    setCompanyName(selectedName);
    setFeedback(null);

    if (!selectedName) {
      setRate("");
      return;
    }

    const trimmed = selectedName.trim().toLowerCase();
    const matchedAssigned = assignedSuppliers.find(
      (s) => s.supplierName && s.supplierName.toLowerCase().trim() === trimmed
    );

    if (matchedAssigned) {
      // Auto-fill configured rate from Products Catalog!
      setRate(String(matchedAssigned.rate !== undefined && matchedAssigned.rate !== null ? matchedAssigned.rate : 0));
    } else {
      setRate("");
    }
  };

  // Handle material selection change
  const handleProductChange = (prodCode) => {
    setSelectedProductCode(prodCode);
    const prod = products.find(
      (p) => p.code === prodCode || p.name === prodCode || p.name?.toLowerCase() === prodCode.toLowerCase()
    );
    const prodAssigned = prod ? getProductSuppliers(prod.name || prod.code) : [];

    if (prodAssigned.length === 1) {
      setCompanyName(prodAssigned[0].supplierName);
      setRate(String(prodAssigned[0].rate || 0));
    } else {
      setCompanyName("");
      setRate("");
    }
    setQuantity("");
    setFeedback(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeProduct) return;

    const trimmedName = companyName.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please select an assigned Supplier from the dropdown." });
      return;
    }

    const matchedAssigned = assignedSuppliers.find(
      (s) => s.supplierName.toLowerCase().trim() === trimmedName.toLowerCase()
    );

    if (!matchedAssigned) {
      setFeedback({
        type: "error",
        message: `Supplier "${trimmedName}" is not assigned to this material in Products Catalog.`,
      });
      return;
    }

    const numRate = Number(matchedAssigned.rate !== undefined && matchedAssigned.rate !== null ? matchedAssigned.rate : rate || 0);
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid Quantity greater than 0." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const prodUnit = inferUnit(activeProduct.name);
      const existingStock = existingCompanyRecord ? Number(existingCompanyRecord.stock) || 0 : 0;
      const expectedNewStock = existingStock + numQty;

      saveProductCompanyStock(activeProduct.code || activeProduct.name, {
        companyName: trimmedName,
        rate: numRate,
        quantity: numQty,
        unit: prodUnit,
        mode: "add",
      });

      setFeedback({
        type: "success",
        message: existingCompanyRecord
          ? `Added ${numQty} ${prodUnit}. ${trimmedName} stock updated to ${expectedNewStock} ${prodUnit} @ ₹${numRate.toLocaleString("en-IN")}.`
          : `Added ${trimmedName} stock (${numQty} ${prodUnit} @ ₹${numRate.toLocaleString("en-IN")}) successfully.`,
      });

      setCompanyName("");
      setRate("");
      setQuantity("");
      if (onStockUpdated) onStockUpdated();
      setTimeout(() => {
        if (onClose) onClose();
      }, 700);
    } catch (err) {
      setFeedback({ type: "error", message: "Failed to save company stock. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const numQtyEntered = Number(quantity) || 0;
  const unitName = inferUnit(activeProduct?.name);

  return (
    <div className="modalBackdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modalHeader">
          <div className="modalHeaderTitleArea">
            <h2 className="modalTitle">Add Stock</h2>
            {activeProduct && (
              <p className="modalSubtitle">
                <strong>{activeProduct.name}</strong>
                {activeProduct.code && (
                  <span style={{ color: "var(--text-muted)" }}> · {activeProduct.code}</span>
                )}
                <span> · Unit: {unitName}</span>
              </p>
            )}
          </div>
          <button type="button" className="closeBtn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modalBody">
          {/* Material Selector if opened from main page without fixed product */}
          {!initialProduct && products.length > 1 && (
            <div className="formGroup" style={{ marginBottom: "16px" }}>
              <label className="formLabel">Material</label>
              <select
                className="formInput"
                value={selectedProductCode}
                onChange={(e) => handleProductChange(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.code || p.name} value={p.code || p.name}>
                    {p.name} {p.code ? `(${p.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Feedback message */}
          {feedback && (
            <div className={`feedbackBanner ${feedback.type}`}>
              {feedback.type === "success" ? "✓ " : "⚠️ "}
              {feedback.message}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="stockForm">
            <div className="formInputsGrid">
              {/* 1. Supplier Dropdown - ONLY suppliers assigned to THIS material in Products Catalog */}
              <div className="formGroup">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label className="formLabel" htmlFor="companyNameInput" style={{ margin: 0 }}>
                    Supplier <span className="req">*</span>
                  </label>
                  <Link
                    href="/products"
                    style={{ fontSize: "11.5px", color: "var(--brand-600)", textDecoration: "none", fontWeight: 500 }}
                  >
                    Manage in Products Catalog ↗
                  </Link>
                </div>

                <select
                  id="companyNameInput"
                  className="formInput"
                  value={companyName}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  disabled={assignedSuppliers.length === 0}
                  required
                >
                  <option value="">
                    {assignedSuppliers.length === 0
                      ? "-- No suppliers assigned in Products Catalog --"
                      : "-- Select Assigned Supplier --"}
                  </option>
                  {assignedSuppliers.map((sup) => (
                    <option key={sup.supplierName} value={sup.supplierName}>
                      {sup.supplierName} (₹{Number(sup.rate).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>

                {assignedSuppliers.length === 0 && (
                  <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "var(--amber-text, #d97706)" }}>
                    ⚠️ No suppliers are assigned to this material. Please assign a supplier and rate in{" "}
                    <Link
                      href="/products"
                      style={{ fontWeight: 600, color: "var(--brand-600)", textDecoration: "underline" }}
                    >
                      Products Catalog
                    </Link>{" "}
                    first.
                  </p>
                )}
              </div>

              {/* Current Stock info when supplier is selected */}
              {companyName && (
                <div
                  style={{
                    background: existingCompanyRecord ? "#f0fdf4" : "var(--surface-subtle, #f8fafc)",
                    border: `1px solid ${existingCompanyRecord ? "#bbf7d0" : "var(--border-default, #e2e8f0)"}`,
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--text-secondary, #475569)", fontWeight: 500 }}>
                    Current Stock for this Supplier:
                  </span>
                  <span style={{ fontWeight: 700, color: existingCompanyRecord ? "#166534" : "var(--text-primary)" }}>
                    {existingCompanyRecord
                      ? `${Number(existingCompanyRecord.stock).toLocaleString("en-IN")} ${unitName}`
                      : `0 ${unitName}`}
                  </span>
                </div>
              )}

              {/* 2. Quantity to Add */}
              <div className="formGroup">
                <label className="formLabel" htmlFor="quantityInput">
                  Quantity to Add ({unitName}) <span className="req">*</span>
                </label>
                <input
                  id="quantityInput"
                  type="number"
                  min="0.01"
                  step="any"
                  className="formInput"
                  placeholder="Enter quantity to add"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={assignedSuppliers.length === 0}
                  required
                />
              </div>

              {/* 3. Rate (₹) - Auto-associated from Material + Supplier assignment in Products Catalog */}
              <div className="formGroup">
                <label className="formLabel">
                  Rate per {unitName} (₹)
                  <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--text-muted)", marginLeft: "6px" }}>
                    (configured in Products Catalog)
                  </span>
                </label>
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
                    color: rate !== "" ? "var(--text-primary, #0f172a)" : "var(--text-muted, #94a3b8)",
                  }}
                >
                  {rate !== ""
                    ? `₹${Number(rate).toLocaleString("en-IN")}`
                    : "— Select an assigned supplier to view rate —"}
                </div>
              </div>

              {/* Preview of accumulated stock after adding */}
              {numQtyEntered > 0 && companyName && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1.5px solid #a7f3d0",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#065f46", fontWeight: 600 }}>After adding:</span>
                  <strong style={{ fontSize: "15px", color: "#047857" }}>
                    {(
                      (existingCompanyRecord ? Number(existingCompanyRecord.stock) || 0 : 0) +
                      numQtyEntered
                    ).toLocaleString("en-IN")}{" "}
                    {unitName}
                  </strong>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="modalFooterActions" style={{ justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", minHeight: "44px", fontSize: "14px", fontWeight: 600 }}
                disabled={isSubmitting || assignedSuppliers.length === 0 || !companyName}
              >
                {isSubmitting ? "Saving..." : "Save Stock"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
