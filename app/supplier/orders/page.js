"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "../supplier.css";

export default function SupplierOrdersPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [selectedPo, setSelectedPo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState("");

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      try {
        const clientPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
        const res = await fetch("/api/supplier/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchases: clientPurchases }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setPurchases(json.data.purchases || []);
          }
        }
      } catch (err) {
        console.error("Failed to load supplier purchases:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [user]);

  useEffect(() => {
    if (selectedPo) {
      lockScroll();
    }
    return () => {
      if (selectedPo) unlockScroll();
    };
  }, [selectedPo]);

  // Helper to persist updates to both local state and central storage
  const updatePurchaseInStore = (poNum, updateFields) => {
    const allPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
    const updatedAll = allPurchases.map((p) => {
      const match =
        (p.piNumber && p.piNumber === poNum) ||
        (p.number && p.number === poNum) ||
        (Array.isArray(p) && p[0] === poNum);
      if (match) {
        if (Array.isArray(p)) {
          const copy = [...p];
          if (updateFields.status) copy[6] = updateFields.status;
          if (updateFields.deliveryStatus) copy[7] = updateFields.deliveryStatus;
          return copy;
        } else {
          return {
            ...p,
            ...updateFields,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return p;
    });

    setStorageData(STORAGE_KEYS.PURCHASES, updatedAll);

    // Update local purchases
    setPurchases((prev) =>
      prev.map((p) => {
        const match =
          (p.piNumber && p.piNumber === poNum) ||
          (p.number && p.number === poNum) ||
          (Array.isArray(p) && p[0] === poNum);
        if (match) {
          if (Array.isArray(p)) {
            const copy = [...p];
            if (updateFields.status) copy[6] = updateFields.status;
            if (updateFields.deliveryStatus) copy[7] = updateFields.deliveryStatus;
            return copy;
          }
          return { ...p, ...updateFields, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );

    // Update drawer view if open
    setSelectedPo((prev) => {
      if (!prev) return null;
      const prevNum = prev.piNumber || prev.number || (Array.isArray(prev) ? prev[0] : "");
      if (prevNum === poNum) {
        if (Array.isArray(prev)) {
          const copy = [...prev];
          if (updateFields.status) copy[6] = updateFields.status;
          if (updateFields.deliveryStatus) copy[7] = updateFields.deliveryStatus;
          return copy;
        }
        return { ...prev, ...updateFields, updatedAt: new Date().toISOString() };
      }
      return prev;
    });
  };

  // Supplier Action: Approve Order placed by Admin
  const handleApproveOrder = (po) => {
    const poNum = po.piNumber || po.number || (Array.isArray(po) ? po[0] : "");
    if (!poNum) return;

    updatePurchaseInStore(poNum, {
      orderStatus: "Approved by Supplier",
      status: "Approved by Supplier",
      deliveryStatus: "Approved & Preparing",
      approvedAt: new Date().toISOString(),
      approvedBy: user?.name || user?.supplierName || "Supplier",
    });

    setActionFeedback(`✓ Order [${poNum}] has been approved! You can now prepare items and dispatch to our site.`);
  };

  // Supplier Action: Advance Site Delivery Fulfillment
  const handleUpdateDeliveryStatus = (po, newDeliveryStatus) => {
    const poNum = po.piNumber || po.number || (Array.isArray(po) ? po[0] : "");
    if (!poNum) return;

    const extraFields = {};
    if (newDeliveryStatus === "In Transit") {
      extraFields.dispatchedAt = new Date().toISOString();
    } else if (newDeliveryStatus === "Delivered to Site") {
      extraFields.deliveredAt = new Date().toISOString();
    }

    updatePurchaseInStore(poNum, {
      deliveryStatus: newDeliveryStatus,
      ...extraFields,
    });

    setActionFeedback(`🚚 Order [${poNum}] delivery status updated to: "${newDeliveryStatus}".`);
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const no = p.piNumber || p.number || (Array.isArray(p) ? p[0] : "");
      const quote = p.quotationNumber || (Array.isArray(p) ? p[3] : "");
      const loc = p.destinationSite || p.location || "Central Warehouse";
      const approval = p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "") || "Pending";
      const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "") || "Pending";

      const isApproved =
        approval.toLowerCase().includes("approved") ||
        approval.toLowerCase() === "paid" ||
        approval.toLowerCase() === "completed";

      const matchesSearch =
        !search ||
        String(no).toLowerCase().includes(search.toLowerCase()) ||
        String(quote).toLowerCase().includes(search.toLowerCase()) ||
        String(loc).toLowerCase().includes(search.toLowerCase());

      const matchesApproval =
        approvalFilter === "All" ||
        (approvalFilter === "Approved" && isApproved) ||
        (approvalFilter === "Pending" && !isApproved);

      const matchesDelivery =
        deliveryFilter === "All" || String(deliv).toLowerCase() === deliveryFilter.toLowerCase();

      return matchesSearch && matchesApproval && matchesDelivery;
    });
  }, [purchases, search, approvalFilter, deliveryFilter]);

  const pendingRequestsCount = useMemo(() => {
    return purchases.filter((p) => {
      const stat = p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "") || "Pending";
      return (
        !String(stat).toLowerCase().includes("approved") &&
        String(stat).toLowerCase() !== "paid" &&
        String(stat).toLowerCase() !== "completed"
      );
    }).length;
  }, [purchases]);

  return (
    <Shell>
      {/* Title & Operational Info */}
      <div className="sectionHeaderRow" style={{ marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "20px" }}>📦</span>
            <h1 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
              Product Requests & Site Deliveries
            </h1>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Product requests placed by PDV Operations Admin. Review requested products, approve the request, and update delivery progression towards our site.
          </p>
        </div>
      </div>

      {/* Pending Request Alert Callout */}
      {pendingRequestsCount > 0 ? (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "14px 18px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "13px",
            color: "#92400e",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>📥</span>
            <div>
              <strong>Action Required:</strong> You have <b>{pendingRequestsCount}</b> new product request{pendingRequestsCount > 1 ? "s" : ""} received from PDV Admin. Please review and click <b>✓ Approve</b> to confirm and begin delivery.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setApprovalFilter("Pending")}
            style={{ fontSize: "12px", padding: "5px 12px", whiteSpace: "nowrap" }}
          >
            Show Pending Requests ({pendingRequestsCount})
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          <span style={{ fontSize: "18px" }}>✓</span>
          <div>
            <strong>Operational Workflow:</strong> When Admin requests products, they are received here. Approve the request, then update the delivery status (Preparing → In Transit → Delivered to Site).
          </div>
        </div>
      )}

      {actionFeedback && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{actionFeedback}</span>
          <button
            type="button"
            onClick={() => setActionFeedback("")}
            style={{ background: "transparent", border: "none", color: "#065f46", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flex: "1 1 300px", maxWidth: "450px" }}>
          <input
            type="text"
            className="textInput"
            placeholder="Search by PO #, Quotation #, Site Location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              Supplier Approval:
            </span>
            <select
              className="textInput"
              style={{ width: "auto", padding: "0 12px", height: "38px" }}
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
            >
              <option value="All">All Approvals</option>
              <option value="Pending">Pending Your Approval</option>
              <option value="Approved">Approved by You</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              Site Delivery:
            </span>
            <select
              className="textInput"
              style={{ width: "auto", padding: "0 12px", height: "38px" }}
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            >
              <option value="All">All Deliveries</option>
              <option value="Pending">Pending Dispatch</option>
              <option value="Approved & Preparing">Approved & Preparing</option>
              <option value="In Transit">In Transit</option>
              <option value="Delivered to Site">Delivered to Site</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="supplierTableWrapper">
        {filteredPurchases.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📦</div>
            <b style={{ color: "var(--text-primary)", fontSize: "15px" }}>
              No Purchase Orders Found
            </b>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              {search || approvalFilter !== "All" || deliveryFilter !== "All"
                ? "Try clearing filters to view all orders."
                : "No purchase orders have been placed by PDV Admin to your supplier account yet."}
            </p>
          </div>
        ) : (
          <table className="supplierTable">
            <thead>
              <tr>
                <th>PO / PI Number</th>
                <th>Order Date</th>
                <th>Destination Site</th>
                <th>Materials Ordered</th>
                <th>Order Value</th>
                <th>Supplier Approval</th>
                <th>Delivery to Site</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p, idx) => {
                const no = p.piNumber || p.number || (Array.isArray(p) ? p[0] : `PO-${idx + 1}`);
                const dt = p.piDate || (Array.isArray(p) ? p[1] : "—");
                const loc = p.destinationSite || p.location || "Central Warehouse";
                const itemsCount = p.itemsCount || (p.lineItems ? p.lineItems.length : 1);
                const amt = p.totalAmount || (Array.isArray(p) ? p[5] : "—");
                const stat = p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "Pending");
                const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

                const isApproved =
                  String(stat).toLowerCase().includes("approved") ||
                  String(stat).toLowerCase() === "paid" ||
                  String(stat).toLowerCase() === "completed";

                return (
                  <tr key={no || idx}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <b style={{ color: "var(--brand-600)" }}>{no}</b>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          Admin PO
                        </span>
                      </div>
                    </td>
                    <td>{dt}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                        📍 {loc}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: "600" }}>{itemsCount} {itemsCount === 1 ? "item" : "items"}</span>
                    </td>
                    <td>
                      <b>{amt}</b>
                    </td>
                    <td>
                      {isApproved ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: "700",
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          ✓ Approved
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: "700",
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                          }}
                        >
                          ⏳ Pending Approval
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge>{deliv}</Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        {!isApproved && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                            onClick={() => handleApproveOrder(p)}
                          >
                            ✓ Approve
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => setSelectedPo(p)}
                        >
                          Details & Delivery
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PO Detail & Delivery Fulfillment Drawer */}
      {selectedPo && (() => {
        const poNum = selectedPo.piNumber || selectedPo.number || (Array.isArray(selectedPo) ? selectedPo[0] : "Order");
        const poDate = selectedPo.piDate || (Array.isArray(selectedPo) ? selectedPo[1] : "—");
        const poQuote = selectedPo.quotationNumber || (Array.isArray(selectedPo) ? selectedPo[3] : "—");
        const poAmt = selectedPo.totalAmount || (Array.isArray(selectedPo) ? selectedPo[5] : "—");
        const poLoc = selectedPo.destinationSite || selectedPo.location || "Central Warehouse";
        const poStat = selectedPo.orderStatus || selectedPo.status || (Array.isArray(selectedPo) ? selectedPo[6] : "Pending");
        const poDeliv = selectedPo.deliveryStatus || (Array.isArray(selectedPo) ? selectedPo[7] : "Pending") || "Pending";

        const isApproved =
          String(poStat).toLowerCase().includes("approved") ||
          String(poStat).toLowerCase() === "paid" ||
          String(poStat).toLowerCase() === "completed";

        return (
          <>
            <div
              className="mobileBackdrop"
              style={{ zIndex: 999 }}
              onClick={() => setSelectedPo(null)}
            />
            <div className="orderDetailDrawer">
              <div className="drawerHeader">
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "var(--brand-600)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Admin Purchase Order
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)", margin: "2px 0 0" }}>
                    {poNum}
                  </h3>
                </div>
                <button
                  type="button"
                  className="drawerCloseBtn"
                  onClick={() => setSelectedPo(null)}
                >
                  ✕
                </button>
              </div>

              <div className="drawerBody">
                {/* Status Summary Banner */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "12px",
                    background: "#f8fafc",
                    padding: "14px",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Order Date</small>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{poDate}</div>
                  </div>
                  <div>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Destination Site</small>
                    <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--brand-700)" }}>
                      📍 {poLoc}
                    </div>
                  </div>
                  <div>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Total Value</small>
                    <div style={{ fontWeight: "800", fontSize: "14px", color: "#059669" }}>{poAmt}</div>
                  </div>
                  <div>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Supplier Approval</small>
                    <div style={{ marginTop: "3px" }}>
                      {isApproved ? (
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#047857" }}>
                          ✓ Approved
                        </span>
                      ) : (
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#b45309" }}>
                          ⏳ Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Site Delivery</small>
                    <div style={{ marginTop: "3px" }}>
                      <Badge>{poDeliv}</Badge>
                    </div>
                  </div>
                </div>

                {/* APPROVAL CARD (If not yet approved) */}
                {!isApproved ? (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fcd34d",
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "20px" }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#92400e" }}>
                          Action Required: Approve Incoming Product Request
                        </h4>
                        <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "#78350f", lineHeight: "1.4" }}>
                          PDV Operations Admin has requested these products for delivery to <strong>📍 {poLoc}</strong>. Please review the requested items below and click &quot;Approve Product Request&quot; to confirm acceptance and begin preparation.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: "8px 18px", fontWeight: "700" }}
                          onClick={() => handleApproveOrder(selectedPo)}
                        >
                          ✓ Approve Product Request
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* SITE DELIVERY PROGRESSION CARD (If approved) */
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        color: "#166534",
                        display: "block",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Site Delivery & Logistics Progression
                    </span>
                    <p style={{ fontSize: "12.5px", color: "#166534", margin: "4px 0 14px" }}>
                      Delivering to: <strong>📍 {poLoc}</strong>. Update delivery status for further fulfillment:
                    </p>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{
                          background: poDeliv === "Approved & Preparing" ? "#dbeafe" : "#ffffff",
                          borderColor: poDeliv === "Approved & Preparing" ? "#2563eb" : "#cbd5e1",
                          color: poDeliv === "Approved & Preparing" ? "#1d4ed8" : "inherit",
                          fontWeight: 700,
                        }}
                        onClick={() => handleUpdateDeliveryStatus(selectedPo, "Approved & Preparing")}
                      >
                        📦 1. Preparing Materials
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{
                          background: poDeliv === "In Transit" || poDeliv === "Shipped" ? "#ede9fe" : "#ffffff",
                          borderColor: poDeliv === "In Transit" || poDeliv === "Shipped" ? "#7c3aed" : "#cbd5e1",
                          color: poDeliv === "In Transit" || poDeliv === "Shipped" ? "#6d28d9" : "inherit",
                          fontWeight: 700,
                        }}
                        onClick={() => handleUpdateDeliveryStatus(selectedPo, "In Transit")}
                      >
                        🚚 2. Dispatched / In Transit
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{
                          background: poDeliv === "Delivered to Site" || poDeliv === "Delivered" ? "#dcfce7" : "#ffffff",
                          borderColor: poDeliv === "Delivered to Site" || poDeliv === "Delivered" ? "#16a34a" : "#cbd5e1",
                          color: poDeliv === "Delivered to Site" || poDeliv === "Delivered" ? "#15803d" : "inherit",
                          fontWeight: 700,
                        }}
                        onClick={() => handleUpdateDeliveryStatus(selectedPo, "Delivered to Site")}
                      >
                        ✅ 3. Delivered to Site
                      </button>
                    </div>

                    {poDeliv === "Delivered to Site" && (
                      <div style={{ marginTop: "12px", fontSize: "12px", color: "#166534", fontWeight: "600" }}>
                        🎉 Delivery confirmed! Admin operations will receive and inspect materials at {poLoc}.
                      </div>
                    )}
                  </div>
                )}

                {/* Ordered Materials Line Items */}
                <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "10px", color: "var(--text-primary)" }}>
                  Ordered Materials & Quantities
                </h4>

                {selectedPo.lineItems && selectedPo.lineItems.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedPo.lineItems.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          fontSize: "12.5px",
                          background: "#ffffff",
                        }}
                      >
                        <div>
                          <b style={{ color: "var(--text-primary)" }}>{item.materialName || item.name}</b>
                          <div style={{ color: "var(--text-muted)", fontSize: "11.5px", marginTop: "2px" }}>
                            Quantity: <b>{item.quantity || item.qty}</b> {item.unit || "Pcs"} @ ₹{item.rate || 0}
                          </div>
                        </div>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--brand-700)" }}>
                          ₹{Number((item.quantity || item.qty || 0) * (item.rate || 0)).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                    Standard batch delivery with {selectedPo.itemsCount || (Array.isArray(selectedPo) ? selectedPo[4] : 1)} items.
                  </p>
                )}

                {selectedPo.remarks && (
                  <div style={{ marginTop: "18px", padding: "10px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>Admin Remarks / Instructions</small>
                    <p style={{ fontSize: "12.5px", marginTop: "2px", margin: 0 }}>{selectedPo.remarks}</p>
                  </div>
                )}

                {poQuote && poQuote !== "—" && (
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                    Quotation Reference: <strong>{poQuote}</strong>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </Shell>
  );
}
