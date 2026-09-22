"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { getStorageData, STORAGE_KEYS } from "@/lib/dataService";
import "./supplier.css";

export default function SupplierDashboardPage() {
  const { user } = useAuth();

  const [supplierData, setSupplierData] = useState({
    profile: null,
    purchases: [],
    bills: [],
    products: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load server-isolated data for this authenticated supplier
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const clientPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
        const clientBills = getStorageData(STORAGE_KEYS.BILLS, []);
        const clientProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);

        const res = await fetch("/api/supplier/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchases: clientPurchases,
            bills: clientBills,
            products: clientProducts,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setSupplierData({
              profile: json.supplier,
              purchases: json.data.purchases || [],
              bills: json.data.bills || [],
              products: json.data.products || [],
            });
          }
        }
      } catch (err) {
        console.error("[Supplier Portal] Error loading scoped data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const { purchases, bills, profile } = supplierData;

  // Calculate Metrics strictly for this supplier
  const totalOrders = purchases.length;
  const pendingApprovalCount = purchases.filter((p) => {
    const stat = (p.orderStatus || p.status || (Array.isArray(p) ? p[6] : "")).toLowerCase();
    return !stat.includes("approved") && stat !== "completed" && stat !== "paid";
  }).length;
  const deliveredToSiteCount = purchases.filter((p) => {
    const deliv = (p.deliveryStatus || (Array.isArray(p) ? p[7] : "")).toLowerCase();
    return deliv === "delivered to site" || deliv === "delivered";
  }).length;

  // Parse numerical total billed from this vendor
  const totalBilledValue = purchases.reduce((acc, p) => {
    const rawAmt = p.totalAmount || (Array.isArray(p) ? p[5] : "0");
    const num = Number(String(rawAmt).replace(/[^0-9.-]+/g, "")) || 0;
    return acc + num;
  }, 0);

  const companyName = profile?.companyName || user?.supplierName || "Supplier Workspace";
  const supplierCode = profile?.code || user?.supplierCode || "SUP-001";

  return (
    <Shell>
      {/* 1. Clean Top Header Card */}
      <div className="supplierBanner">
        <div className="supplierBannerLeft">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1>{companyName}</h1>
            <span className="supplierMetaBadge">
              Code: {supplierCode} · {profile?.status || "Active"}
            </span>
          </div>
          <p>Supplier Workspace · Review Admin Purchase Orders, Approve, and Deliver to Site.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/supplier/orders" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>📦</span> View Incoming Orders
          </Link>
        </div>
      </div>

      {/* 2. Clean Metrics Grid */}
      <div className="supplierMetricsGrid">
        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Orders Placed by Admin</span>
            <span className="supplierMetricIcon">📋</span>
          </div>
          <div className="supplierMetricValue">{totalOrders}</div>
          <span className="supplierMetricSubtext">Total assigned purchase orders</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Pending Your Approval</span>
            <span className="supplierMetricIcon">⏳</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#d97706" }}>
            {pendingApprovalCount}
          </div>
          <span className="supplierMetricSubtext">Awaiting supplier confirmation</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Delivered to Site</span>
            <span className="supplierMetricIcon">✓</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#059669" }}>
            {deliveredToSiteCount}
          </div>
          <span className="supplierMetricSubtext">Delivered to project site</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Total Value</span>
            <span className="supplierMetricIcon">₹</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#4f46e5" }}>
            ₹ {totalBilledValue.toLocaleString()}
          </div>
          <span className="supplierMetricSubtext">Total order amount</span>
        </div>
      </div>

      {/* 3. Recent Orders Table */}
      <div className="sectionHeaderRow" style={{ marginTop: "8px", marginBottom: "14px" }}>
        <h2 className="sectionTitle">Incoming Purchase Orders</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/supplier/orders" className="btn btn-sm btn-secondary" style={{ textDecoration: "none" }}>
            View All Orders ({totalOrders}) ➔
          </Link>
        </div>
      </div>

      <div className="supplierTableWrapper">
        {purchases.length === 0 ? (
          <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📦</div>
            <b style={{ color: "var(--text-primary)" }}>No Orders Assigned Yet</b>
            <p style={{ fontSize: "13px", marginTop: "2px" }}>
              Official purchase orders placed by PDV Operations Admin will appear here for your approval and site delivery.
            </p>
          </div>
        ) : (
          <table className="supplierTable">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Date</th>
                <th>Destination Site</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Approval</th>
                <th>Delivery to Site</th>
              </tr>
            </thead>
            <tbody>
              {purchases.slice(0, 5).map((p, idx) => {
                const no = p.piNumber || (Array.isArray(p) ? p[0] : `PO-${idx + 1}`);
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
                      <b style={{ color: "var(--brand-600)" }}>{no}</b>
                    </td>
                    <td>{dt}</td>
                    <td>
                      <span style={{ fontWeight: "600" }}>📍 {loc}</span>
                    </td>
                    <td>{itemsCount} {itemsCount === 1 ? "item" : "items"}</td>
                    <td>
                      <b>{amt}</b>
                    </td>
                    <td>
                      {isApproved ? (
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#047857" }}>
                          ✓ Approved
                        </span>
                      ) : (
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#b45309" }}>
                          ⏳ Pending Approval
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge>{deliv}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Minimal Support Line */}
      <div style={{ marginTop: "20px", textAlign: "center", fontSize: "12.5px", color: "#64748b" }}>
        Need support? Email Procurement at <code>procurement@pdv.com</code>
      </div>
    </Shell>
  );
}
