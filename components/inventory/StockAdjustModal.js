"use client";

import { useState, useEffect, useMemo } from "react";
import { updateProductStock } from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

export default function StockAdjustModal({
  isOpen,
  onClose,
  products = [],
  initialProduct = null,
  onStockUpdated,
}) {
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [unit, setUnit] = useState("Pcs");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Initialize when modal opens or initialProduct changes
  useEffect(() => {
    if (isOpen) {
      lockScroll();
      const prod = initialProduct || (products.length > 0 ? products[0] : null);
      if (prod) {
        setSelectedProductCode(prod.code || prod.name);
        setPriceInput(prod.rate !== undefined ? String(prod.rate) : "0");
        setUnit(prod.unit === "Meter" ? "Meter" : (prod.name?.toLowerCase().includes("pipe") ? "Meter" : "Pcs"));
      }
      setQuantityToAdd("");
      setReason("");
      setFeedback(null);
    } else {
      unlockScroll();
    }
    return () => {
      if (isOpen) unlockScroll();
    };
  }, [isOpen, initialProduct, products]);

  // Find active product object
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

  // When switching products, update default price and unit
  const handleProductSelect = (code) => {
    setSelectedProductCode(code);
    const prod = products.find((p) => p.code === code || p.name === code);
    if (prod) {
      setPriceInput(prod.rate !== undefined ? String(prod.rate) : "0");
      setUnit(prod.unit === "Meter" ? "Meter" : (prod.name?.toLowerCase().includes("pipe") ? "Meter" : "Pcs"));
    }
    setQuantityToAdd("");
    setFeedback(null);
  };

  // Quick chip increment for quantity to add
  const handleQuickAdd = (amount) => {
    const current = Number(quantityToAdd) || 0;
    setQuantityToAdd(String(current + amount));
  };

  // Live preview calculation
  const currentStock = activeProduct?.availableStock ?? 0;
  const numAdded = Number(quantityToAdd) || 0;
  const resultingStock = Math.max(0, currentStock + numAdded);
  const newRate = Number(priceInput) >= 0 ? Number(priceInput) : (activeProduct?.rate ?? 0);

  // Save handler
  const handleSave = (e) => {
    e.preventDefault();
    if (!activeProduct) {
      alert("Please select a product first.");
      return;
    }

    if (numAdded < 0) {
      alert("Quantity to add cannot be negative.");
      return;
    }

    if (isNaN(newRate) || newRate < 0) {
      alert("Please enter a valid price (₹ 0 or greater).");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = updateProductStock(activeProduct.name, {
        mode: "add",
        quantity: numAdded,
        rate: newRate,
        unit: unit === "Meter" ? "Meter" : "Pcs",
        reason: reason.trim() || (numAdded > 0 ? `Added ${numAdded} ${unit}` : `Updated to ₹${newRate}/${unit}`),
        updatedBy: "Admin",
      });

      if (updated) {
        setFeedback({
          type: "success",
          message: `✓ Successfully updated "${activeProduct.name}"! Stock: ${resultingStock} ${unit}, Price: ₹${newRate}/${unit}`,
        });
        if (onStockUpdated) {
          onStockUpdated(updated);
        }
        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 500);
      } else {
        throw new Error("Failed to record update");
      }
    } catch (err) {
      console.error("Error updating stock and price:", err);
      setFeedback({
        type: "error",
        message: "Failed to update product. Please try again.",
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="modalContent stockModalContent"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px", width: "95%" }}
      >
        {/* Modal Header */}
        <div className="modalHeader">
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
              📦 Add Quantity & Edit Price
            </h3>
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
              Add stock quantity and update standard unit price for this product.
            </p>
          </div>
          <button type="button" className="modalCloseBtn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modalBody" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Feedback Alert */}
            {feedback && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background:
                    feedback.type === "success"
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                  color: feedback.type === "success" ? "#059669" : "#dc2626",
                  border: `1px solid ${
                    feedback.type === "success"
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(239, 68, 68, 0.3)"
                  }`,
                }}
              >
                {feedback.message}
              </div>
            )}

            {/* Product Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                Select Material / Product *
              </label>
              <select
                value={selectedProductCode}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="invSelect"
                style={{ width: "100%", padding: "10px 12px", fontSize: "13.5px" }}
                disabled={Boolean(initialProduct && initialProduct.code === selectedProductCode)}
              >
                {products.map((p) => (
                  <option key={p.code || p.name} value={p.code || p.name}>
                    {p.name} ({p.availableStock} {p.unit} · ₹{p.rate})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Product Highlight Card */}
            {activeProduct && (
              <div
                style={{
                  background: "var(--bg-subtle, #f8fafc)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Current Available Stock
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-600)", marginTop: "2px" }}>
                    {activeProduct.availableStock} {activeProduct.unit || "Pcs"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Current Standard Price
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                    ₹ {activeProduct.rate ?? 0}
                  </div>
                </div>
              </div>
            )}

            {/* 1. Add Quantity Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                Add Quantity (+)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Enter quantity to add (e.g. 50)..."
                  value={quantityToAdd}
                  onChange={(e) => setQuantityToAdd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "#059669",
                    borderRadius: "8px",
                    border: "2px solid #10b981",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  +{unit}
                </span>
              </div>

              {/* Quick Add Chips */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center", marginRight: "2px" }}>
                  Quick add:
                </span>
                {[5, 10, 25, 50, 100, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAdd(amt)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-card, #fff)",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Live resulting stock hint */}
              {numAdded > 0 && (
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#059669", marginTop: "2px" }}>
                  New Stock will become: <b>{currentStock} + {numAdded} = {resultingStock} {unit}</b>
                </div>
              )}
            </div>

            {/* 2. Unit and Price Section (Unit restricted strictly to Pcs or Meter) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Unit of Measure *
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="invSelect"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    fontSize: "14.5px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    border: "2px solid var(--border-default)",
                    background: "var(--surface-card, #fff)",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Meter">Meter</option>
                </select>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Only Pcs or Meter allowed
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Edit Price / Rate (₹) *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="Enter standard rate..."
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      paddingRight: "55px",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      borderRadius: "8px",
                      border: "2px solid var(--brand-500, #3b82f6)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    / {unit}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Standard rate per {unit}
                </span>
              </div>
            </div>

            {/* 3. Reason / Notes (Optional) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Stock replenishment, price revision, supplier updated rate..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-default)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modalFooter" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
