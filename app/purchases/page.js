"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import DetailDrawer from "@/components/ui/DetailDrawer";
import { exportToExcel } from "@/lib/exportToExcel";
import { getStorageData, setStorageData, STORAGE_KEYS } from "@/lib/dataService";
import { useAuth } from "@/lib/auth/AuthContext";
import "@/components/ui/ui.css";

export default function PurchasesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role !== "SUPPLIER";

  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [selectedPo, setSelectedPo] = useState(null);

  useEffect(() => {
    setPurchases(getStorageData(STORAGE_KEYS.PURCHASES, []));
  }, []);

  const savePurchases = (newList) => {
    setPurchases(newList);
    setStorageData(STORAGE_KEYS.PURCHASES, newList);
  };

  const handleDeliveryStatusChange = (po, newStatus) => {
    if (!isAdmin) return;
    const pNum = po.piNumber || (Array.isArray(po) ? po[0] : "");
    const updated = purchases.map((p) => {
      const curNum = p.piNumber || (Array.isArray(p) ? p[0] : "");
      if (p === po || (curNum && curNum === pNum)) {
        if (Array.isArray(p)) {
          const copy = [...p];
          copy[7] = newStatus;
          return copy;
        }
        return { ...p, deliveryStatus: newStatus };
      }
      return p;
    });
    savePurchases(updated);

    if (selectedPo) {
      if (Array.isArray(selectedPo)) {
        const copy = [...selectedPo];
        copy[7] = newStatus;
        setSelectedPo(copy);
      } else {
        setSelectedPo((prev) => (prev ? { ...prev, deliveryStatus: newStatus } : null));
      }
    }
  };

  const handleApproveOrder = (po) => {
    const updated = purchases.map((p) => {
      const pNum = p.piNumber || (Array.isArray(p) ? p[0] : "");
      const targetNum = po.piNumber || (Array.isArray(po) ? po[0] : "");
      if (p === po || pNum === targetNum) {
        if (Array.isArray(p)) {
          const copy = [...p];
          copy[6] = "Approved by Supplier";
          return copy;
        }
        return {
          ...p,
          status: "Approved by Supplier",
          orderStatus: "Approved by Supplier",
          approvedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    savePurchases(updated);
    if (Array.isArray(po)) {
      const copy = [...po];
      copy[6] = "Approved by Supplier";
      setSelectedPo(copy);
    } else {
      setSelectedPo({
        ...po,
        status: "Approved by Supplier",
        orderStatus: "Approved by Supplier",
        approvedAt: new Date().toISOString(),
      });
    }
  };

  const handleDelete = (index) => {
    if (confirm("Delete this purchase record?")) {
      savePurchases(purchases.filter((_, i) => i !== index));
      setSelectedPo(null);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const no = p.piNumber || (Array.isArray(p) ? p[0] : "");
    const sup = p.supplier || (Array.isArray(p) ? p[2] : "");
    const loc = p.destinationSite || p.location || "";
    const stat = p.status || (Array.isArray(p) ? p[6] : "");
    const orderStat = p.orderStatus || stat;
    const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

    const matchesSearch =
      !search ||
      String(no).toLowerCase().includes(search.toLowerCase()) ||
      String(sup).toLowerCase().includes(search.toLowerCase()) ||
      String(loc).toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "All" || String(stat).toLowerCase() === statusFilter.toLowerCase();

    const isSupApproved =
      String(orderStat).toLowerCase().includes("approved") ||
      String(stat).toLowerCase() === "paid" ||
      String(stat).toLowerCase() === "completed";

    const matchesApproval =
      approvalFilter === "All" ||
      (approvalFilter === "Approved" && isSupApproved) ||
      (approvalFilter === "Pending" && !isSupApproved);

    const matchesDelivery = deliveryFilter === "All" || String(deliv).toLowerCase() === deliveryFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesApproval && matchesDelivery;
  });

  const handleExport = () => {
    const headers = [
      "PI Number",
      "Date",
      "Supplier",
      "Destination Site",
      "Quote #",
      "Items Count",
      "Total Amount",
      "Supplier Approval",
      "Delivery Status",
    ];
    const rows = filteredPurchases.map((p) => {
      if (Array.isArray(p)) {
        return [
          p[0],
          p[1],
          p[2],
          "Central Warehouse",
          p[3],
          p[4],
          p[5],
          p[6],
          p[7] || "Pending",
        ];
      }
      return [
        p.piNumber,
        p.piDate,
        p.supplier,
        p.destinationSite || p.location || "Central Warehouse",
        p.quotationNumber,
        p.itemsCount,
        p.totalAmount,
        p.orderStatus || p.status,
        p.deliveryStatus || "Pending",
      ];
    });
    exportToExcel({ filename: "Purchases_PI_Report", headers, rows });
  };

  return (
    <Shell>
      <Title
        title="Purchases / PI Master"
        desc="Orders placed to registered suppliers, supplier approvals, and site delivery tracking."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="secondary" onClick={handleExport}>
              ⤓ Export to Excel
            </button>
            <Link href="/purchases/new" className="primary">
              + New Purchase Order
            </Link>
          </div>
        }
      />

      {/* Purchases Table Card */}
      <section className="card tableCard">
        <div className="tableControls">
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
            <div className="invSearchBox" style={{ maxWidth: "260px" }}>
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search PI#, supplier, site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="invSelect"
            >
              <option value="All">All Approvals</option>
              <option value="Approved">Approved by Supplier</option>
              <option value="Pending">Pending Supplier Approval</option>
            </select>

            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="invSelect"
            >
              <option value="All">All Deliveries</option>
              <option value="Pending">Delivery: Pending</option>
              <option value="Approved & Preparing">Delivery: Preparing</option>
              <option value="In Transit">Delivery: In Transit</option>
              <option value="Delivered to Site">Delivery: Delivered to Site</option>
            </select>
          </div>

          <span className="tableCountHint">
            Showing <strong>{filteredPurchases.length}</strong> of <strong>{purchases.length}</strong> purchases
          </span>
        </div>

        {/* Mobile-first compact cards (hidden on desktop) */}
        <div className="mobileCardList">
          {filteredPurchases.length === 0 ? (
            <div className="emptyTable">
              <p>No purchase records found.</p>
              <Link
                href="/purchases/new"
                className="primary"
                style={{ display: "inline-block", marginTop: "8px" }}
              >
                + Create Purchase Order
              </Link>
            </div>
          ) : (
            filteredPurchases.map((p, idx) => {
              const no = p.piNumber || (Array.isArray(p) ? p[0] : `PO-${idx + 1}`);
              const date = p.piDate || (Array.isArray(p) ? p[1] : "—");
              const sup = p.supplier || (Array.isArray(p) ? p[2] : "Direct Supplier");
              const loc = p.destinationSite || p.location || "Central Warehouse";
              const count = p.itemsCount || (Array.isArray(p) ? p[4] : (p.lineItems ? p.lineItems.length : 1));
              const amt = p.totalAmount || (Array.isArray(p) ? p[5] : "—");
              const stat = p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "Pending");
              const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

              const isSupApproved =
                String(stat).toLowerCase().includes("approved") ||
                String(stat).toLowerCase() === "paid" ||
                String(stat).toLowerCase() === "completed";

              return (
                <div
                  key={idx}
                  className="mobileDataCard"
                  onClick={() => setSelectedPo(p)}
                >
                  <div className="mobileCardHeader">
                    <div className="mobileCardTitleArea">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <code className="codeBadge">{no}</code>
                      </div>
                      <h3 className="mobileCardTitle">{sup}</h3>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                      {isSupApproved ? (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#047857", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px" }}>
                          ✓ Approved
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#b45309", background: "#fffbeb", padding: "2px 6px", borderRadius: "4px" }}>
                          ⏳ Pending Approval
                        </span>
                      )}
                      <Badge>{deliv}</Badge>
                    </div>
                  </div>

                  <div className="mobileCardBody">
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Destination Site</span>
                      <strong className="mobileMetricVal">📍 {loc}</strong>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Total Value</span>
                      <strong className="mobileMetricVal highlight">{amt}</strong>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Purchase Date</span>
                      <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{date}</span>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Materials</span>
                      <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}><b>{count}</b> items</span>
                    </div>
                  </div>

                  <div className="mobileCardFooter">
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Delivery: <strong>{deliv}</strong>
                    </span>
                    <button
                      type="button"
                      className="mobilePrimaryAction"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPo(p);
                      }}
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>PI / PO #</th>
                <th>Purchase Date</th>
                <th>Supplier</th>
                <th>Destination Site</th>
                <th>Line Items</th>
                <th>Total Value (₹)</th>
                <th>Supplier Approval</th>
                <th>Site Delivery</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="emptyTable">
                    <p>No purchase records found.</p>
                    <Link
                      href="/purchases/new"
                      className="primary"
                      style={{ display: "inline-block", marginTop: "8px" }}
                    >
                      + Create Purchase Order
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p, idx) => {
                  const no = p.piNumber || (Array.isArray(p) ? p[0] : `PO-${idx + 1}`);
                  const date = p.piDate || (Array.isArray(p) ? p[1] : "—");
                  const sup = p.supplier || (Array.isArray(p) ? p[2] : "Direct Vendor");
                  const loc = p.destinationSite || p.location || "Central Warehouse";
                  const count = p.itemsCount || (Array.isArray(p) ? p[4] : (p.lineItems ? p.lineItems.length : 1));
                  const amt = p.totalAmount || (Array.isArray(p) ? p[5] : "—");
                  const stat = p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "Pending");
                  const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

                  const isSupApproved =
                    String(stat).toLowerCase().includes("approved") ||
                    String(stat).toLowerCase() === "paid" ||
                    String(stat).toLowerCase() === "completed";

                  return (
                    <tr key={idx} onClick={() => setSelectedPo(p)}>
                      <td>
                        <strong>{no}</strong>
                      </td>
                      <td>{date}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "600" }}>{sup}</span>
                          {p.supplierCode && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.supplierCode}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: "600" }}>📍 {loc}</span>
                      </td>
                      <td>
                        <b>{count}</b> materials
                      </td>
                      <td>
                        <strong style={{ color: "var(--brand-700)" }}>{amt}</strong>
                      </td>
                      <td>
                        {isSupApproved ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: "700", color: "#047857", background: "#ecfdf5", padding: "3px 8px", borderRadius: "5px", border: "1px solid #a7f3d0" }}>
                            ✓ Approved
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: "700", color: "#b45309", background: "#fffbeb", padding: "3px 8px", borderRadius: "5px", border: "1px solid #fde68a" }}>
                            ⏳ Pending Approval
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge>{deliv}</Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="actionBtn view"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPo(p);
                          }}
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Purchase Detail Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedPo)}
        onClose={() => setSelectedPo(null)}
        title={selectedPo?.piNumber || (Array.isArray(selectedPo) ? selectedPo[0] : "Purchase Details")}
        subtitle={`Supplier: ${selectedPo?.supplier || (Array.isArray(selectedPo) ? selectedPo[2] : "—")}`}
        badge={<Badge>{selectedPo?.status || (Array.isArray(selectedPo) ? selectedPo[6] : "Approved")}</Badge>}
        footerActions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(selectedPo?.status === "Pending" || (Array.isArray(selectedPo) && selectedPo[6] === "Pending")) && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleApproveOrder(selectedPo)}
              >
                ✓ Approve Order
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                const idx = purchases.indexOf(selectedPo);
                if (idx >= 0) handleDelete(idx);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="secondary btn-sm"
              onClick={() => setSelectedPo(null)}
            >
              Close
            </button>
          </div>
        }
      >
        {selectedPo && (() => {
          const currentDelivStatus =
            selectedPo.deliveryStatus ||
            (Array.isArray(selectedPo) ? selectedPo[7] : "Pending") ||
            "Pending";

          const stat = selectedPo.orderStatus || selectedPo.status || (Array.isArray(selectedPo) ? selectedPo[6] : "Pending");
          const isSupApproved =
            String(stat).toLowerCase().includes("approved") ||
            String(stat).toLowerCase() === "paid" ||
            String(stat).toLowerCase() === "completed";

          const destSite = selectedPo.destinationSite || selectedPo.location || "Central Warehouse";
          const supName = selectedPo.supplier || (Array.isArray(selectedPo) ? selectedPo[2] : "Supplier");

          return (
            <div>
              {/* Supplier Approval Banner */}
              <div
                style={{
                  background: isSupApproved ? "#f0fdf4" : "#fffbeb",
                  border: isSupApproved ? "1px solid #bbf7d0" : "1px solid #fde68a",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{isSupApproved ? "✓" : "⏳"}</span>
                  <div>
                    <b style={{ color: isSupApproved ? "#166534" : "#92400e", fontSize: "13px" }}>
                      {isSupApproved ? "Order Approved by Supplier" : "Pending Supplier Approval"}
                    </b>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: isSupApproved ? "#15803d" : "#78350f" }}>
                      {isSupApproved
                        ? `${supName} confirmed acceptance of this order for site delivery to ${destSite}.`
                        : `Order placed to ${supName}. Waiting for supplier to accept and prepare materials.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fulfillment & Delivery Stepper Control */}
              <div
                style={{
                  background: "var(--surface-alt, #f8fafc)",
                  border: "1px solid var(--border-default, #e2e8f0)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Site Delivery Stage · 📍 {destSite}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                        Current Status:
                      </strong>
                      <Badge>{currentDelivStatus}</Badge>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                        Set Status:
                      </label>
                      <select
                        className="invSelect"
                        style={{ padding: "4px 10px", height: "34px", fontSize: "13px", fontWeight: "600" }}
                        value={currentDelivStatus}
                        onChange={(e) => handleDeliveryStatusChange(selectedPo, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved & Preparing">Approved & Preparing</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Delivered to Site">Delivered to Site</option>
                      </select>
                    </div>
                  ) : null}
                </div>

                {/* Stepper Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {[
                    { id: "Pending", label: "Pending", icon: "⏳" },
                    { id: "Approved & Preparing", label: "Preparing", icon: "📦" },
                    { id: "In Transit", label: "In Transit", icon: "🚚" },
                    { id: "Delivered to Site", label: "Delivered", icon: "✓" },
                  ].map((stage, sIdx) => {
                    const stages = ["Pending", "Approved & Preparing", "In Transit", "Delivered to Site"];
                    const curIdx = stages.indexOf(currentDelivStatus);
                    const isPassedOrCurrent = curIdx >= sIdx;
                    const isCurrent = curIdx === sIdx;

                    return (
                      <button
                        key={stage.id}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => isAdmin && handleDeliveryStatusChange(selectedPo, stage.id)}
                        title={isAdmin ? `Set delivery status to ${stage.label}` : "Admin access required"}
                        style={{
                          flex: 1,
                          padding: "8px 6px",
                          borderRadius: "6px",
                          border: isCurrent
                            ? stage.id === "Delivered to Site"
                              ? "2px solid #059669"
                              : stage.id === "In Transit"
                              ? "2px solid #7c3aed"
                              : "2px solid #2563eb"
                            : isPassedOrCurrent
                            ? "1px solid #cbd5e1"
                            : "1px dashed #cbd5e1",
                          background: isCurrent
                            ? stage.id === "Delivered to Site"
                              ? "#ecfdf5"
                              : stage.id === "In Transit"
                              ? "#f5f3ff"
                              : "#eff6ff"
                            : isPassedOrCurrent
                            ? "#f1f5f9"
                            : "transparent",
                          color: isCurrent
                            ? stage.id === "Delivered to Site"
                              ? "#065f46"
                              : stage.id === "In Transit"
                              ? "#5b21b6"
                              : "#1e40af"
                            : isPassedOrCurrent
                            ? "#334155"
                            : "var(--text-muted)",
                          fontWeight: isCurrent ? "700" : "500",
                          fontSize: "11.5px",
                          cursor: isAdmin ? "pointer" : "default",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>{stage.icon}</span>
                        <span>{stage.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="drawerMetricGrid">
                <div className="drawerMetricCard">
                  <span className="drawerMetricLabel">Total Billed</span>
                  <strong className="drawerMetricVal">
                    {selectedPo.totalAmount || (Array.isArray(selectedPo) ? selectedPo[5] : "—")}
                  </strong>
                </div>
                <div className="drawerMetricCard">
                  <span className="drawerMetricLabel">Purchase Date</span>
                  <strong className="drawerMetricVal" style={{ fontSize: "14px" }}>
                    {selectedPo.piDate || (Array.isArray(selectedPo) ? selectedPo[1] : "—")}
                  </strong>
                </div>
                <div className="drawerMetricCard">
                  <span className="drawerMetricLabel">Destination Site</span>
                  <strong className="drawerMetricVal" style={{ fontSize: "13px" }}>
                    📍 {destSite}
                  </strong>
                </div>
              </div>

              {selectedPo.lineItems && selectedPo.lineItems.length > 0 && (
                <div>
                  <h4 className="drawerSectionTitle">Purchased Line Items ({selectedPo.lineItems.length})</h4>
                  <div className="tableScroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPo.lineItems.map((item, i) => (
                          <tr key={i}>
                            <td><strong>{item.materialName || item.name}</strong></td>
                            <td>{item.quantity || item.qty} {item.unit || "Pcs"}</td>
                            <td>₹ {item.rate}</td>
                            <td>₹ {Number((item.quantity || item.qty || 0) * (item.rate || 0)).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <h4 className="drawerSectionTitle" style={{ marginTop: "20px" }}>
                Order & Fulfillment Details
              </h4>
              <div className="drawerKvList">
                <div className="drawerKvRow">
                  <span className="drawerKvLabel">Destination Site:</span>
                  <span className="drawerKvVal">📍 {destSite}</span>
                </div>
                <div className="drawerKvRow">
                  <span className="drawerKvLabel">Supplier Approval:</span>
                  <span className="drawerKvVal">
                    {isSupApproved ? (
                      <span style={{ color: "#047857", fontWeight: "700" }}>✓ Approved by Supplier</span>
                    ) : (
                      <span style={{ color: "#b45309", fontWeight: "700" }}>⏳ Pending Supplier Approval</span>
                    )}
                  </span>
                </div>
                <div className="drawerKvRow">
                  <span className="drawerKvLabel">Delivery to Site:</span>
                  <span className="drawerKvVal"><Badge>{currentDelivStatus}</Badge></span>
                </div>
                <div className="drawerKvRow">
                  <span className="drawerKvLabel">Placed By:</span>
                  <span className="drawerKvVal">PDV Operations Admin</span>
                </div>
                <div className="drawerKvRow">
                  <span className="drawerKvLabel">Remarks:</span>
                  <span className="drawerKvVal">{selectedPo.remarks || "No remarks"}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </DetailDrawer>
    </Shell>
  );
}
