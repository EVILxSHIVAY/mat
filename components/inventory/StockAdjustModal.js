"use client";

import { useState, useEffect, useMemo } from "react";
import { saveProductCompanyStock, inferUnit } from "@/lib/dataService";
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

  // Initialize modal state
  useEffect(() => {
    if (isOpen) {
      lockScroll();
      const prod = initialProduct || (products.length > 0 ? products[0] : null);
      if (prod) {
        setSelectedProductCode(prod.code || prod.name);
        if (initialCompany && Array.isArray(prod.companies)) {
          const matched = prod.companies.find(
            (c) => c.name.toLowerCase() === initialCompany.toLowerCase()
          );
          if (matched) {
            setCompanyName(matched.name);
            setRate(matched.rate !== undefined && matched.rate !== null ? String(matched.rate) : "");
            setQuantity(matched.stock !== undefined && matched.stock !== null ? String(matched.stock) : "");
            setFeedback(null);
            return;
          }
        }
      }
      setCompanyName(initialCompany || "");
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeProduct) return;

    const trimmedName = companyName.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter a Company Name." });
      return;
    }

    const numRate = Number(rate);
    if (isNaN(numRate) || numRate < 0) {
      setFeedback({ type: "error", message: "Please enter a valid non-negative Rate (₹)." });
      return;
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 0) {
      setFeedback({ type: "error", message: "Please enter a valid Quantity." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const prodUnit = inferUnit(activeProduct.name);
      saveProductCompanyStock(activeProduct.code || activeProduct.name, {
        companyName: trimmedName,
        rate: numRate,
        quantity: numQty,
        unit: prodUnit,
        mode: "set",
      });

      setFeedback({
        type: "success",
        message: `Saved ${trimmedName} stock (${numQty} ${prodUnit} @ ₹${numRate}) successfully.`,
      });

      setCompanyName("");
      setRate("");
      setQuantity("");
      if (onStockUpdated) onStockUpdated();
    } catch (err) {
      setFeedback({ type: "error", message: "Failed to save company stock. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modalBackdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modalHeader">
          <div className="modalHeaderTitleArea">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>📦</span>
              <h2 className="modalTitle">Manage Stock</h2>
            </div>
            {activeProduct && (
              <p className="modalSubtitle">
                <strong>{activeProduct.name}</strong> ·{" "}
                <span style={{ color: "var(--text-muted)" }}>{activeProduct.code || "MAT"}</span> ·{" "}
                <span>Unit: {inferUnit(activeProduct.name)}</span>
              </p>
            )}
          </div>
          <button type="button" className="closeBtn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modalBody">
          {/* Material Selector if multiple products available and none fixed */}
          {!initialProduct && products.length > 1 && (
            <div className="formGroup" style={{ marginBottom: "16px" }}>
              <label className="formLabel">Select Material</label>
              <select
                className="formInput"
                value={selectedProductCode}
                onChange={(e) => {
                  setSelectedProductCode(e.target.value);
                  setCompanyName("");
                  setRate("");
                  setQuantity("");
                  setFeedback(null);
                }}
              >
                {products.map((p) => (
                  <option key={p.code || p.name} value={p.code || p.name}>
                    {p.name} ({p.code})
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

          {/* Input Form: Strictly Quantity, Company Name, and Rate */}
          <form onSubmit={handleSubmit} className="stockForm">
            <div className="formHeaderRow">
              <h3 className="formSectionTitle">+ Add Company Stock</h3>
            </div>

            <div className="formInputsGrid">
              {/* 1. Company Name */}
              <div className="formGroup">
                <label className="formLabel" htmlFor="companyNameInput">
                  Company Name <span className="req">*</span>
                </label>
                <input
                  id="companyNameInput"
                  type="text"
                  className="formInput"
                  placeholder="e.g. Jindal Steel & Power"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              {/* 2. Rate (₹) */}
              <div className="formGroup">
                <label className="formLabel" htmlFor="rateInput">
                  Rate per {inferUnit(activeProduct?.name)} (₹) <span className="req">*</span>
                </label>
                <div className="inputWithPrefix">
                  <span className="inputPrefix">₹</span>
                  <input
                    id="rateInput"
                    type="number"
                    min="0"
                    step="any"
                    className="formInput prefixInput"
                    placeholder="0.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 3. Quantity */}
              <div className="formGroup">
                <label className="formLabel" htmlFor="quantityInput">
                  Available Quantity ({inferUnit(activeProduct?.name)}) <span className="req">*</span>
                </label>
                <input
                  id="quantityInput"
                  type="number"
                  min="0"
                  step="any"
                  className="formInput"
                  placeholder={`Enter stock in ${inferUnit(activeProduct?.name)}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modalFooterActions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Done / Close
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
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
