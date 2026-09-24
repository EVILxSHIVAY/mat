"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { getDashboardMetrics, calculateLiveInventory } from "@/lib/dataService";
import "@/components/ui/ui.css";
import "./dashboard.css";

export default function Dashboard() {
  const [metrics, setMetrics] = useState(() => getDashboardMetrics());
  const [inventory, setInventory] = useState(() => calculateLiveInventory());

  const refreshData = () => {
    setMetrics(getDashboardMetrics());
    setInventory(calculateLiveInventory());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener("pdv_stock_updated", refreshData);
    window.addEventListener("pdv_requests_updated", refreshData);
    window.addEventListener("storage", refreshData);
    return () => {
      window.removeEventListener("pdv_stock_updated", refreshData);
      window.removeEventListener("pdv_requests_updated", refreshData);
      window.removeEventListener("storage", refreshData);
    };
  }, []);

  // Stock Aggregates
  const totalStockUnits = inventory.reduce(
    (sum, item) => sum + (Number(item.availableStock) || 0),
    0
  );
  const outOfStockCount = inventory.filter(
    (item) => (Number(item.availableStock) || 0) === 0
  ).length;

  const hasIssues =
    metrics.lowStockCount > 0 ||
    metrics.pendingRequestsCount > 0 ||
    metrics.totalOutstanding > 0;

  const totalIssuesCount =
    (metrics.lowStockCount > 0 ? 1 : 0) +
    (metrics.pendingRequestsCount > 0 ? 1 : 0) +
    (metrics.totalOutstanding > 0 ? 1 : 0);

  return (
    <Shell>
      <div className="mobileDashContainer">
        {/* 1. SIMPLE HEADER */}
        <header className="dashHeader">
          <div className="dashHeaderLeft">
            <h1 className="dashTitle">Operations Dashboard</h1>
            <p className="dashSubtitle">Real-time stock, requests & site movements</p>
          </div>
          {/* Quiet status chip on desktop */}
          {!hasIssues && (
            <div className="dashQuietStatus desktopOnly">
              <span className="dashQuietDot">✓</span>
              <span>All caught up · Zero critical alerts</span>
            </div>
          )}
        </header>

        {/* 2. NEEDS ATTENTION (Conditional Alert or Quiet Status) */}
        {!hasIssues ? (
          <div className="dashQuietStatus mobileOnly">
            <span className="dashQuietDot">✓</span>
            <span>All caught up · Zero critical alerts</span>
          </div>
        ) : (
          <section className="dashAttentionSection card" aria-label="Actionable items">
            <div className="dashAttentionHead">
              <div className="dashAttentionTitleRow">
                <span className="dashAttentionIcon">⚠️</span>
                <h2 className="dashAttentionHeading">Needs Attention</h2>
              </div>
              <span className="dashAttentionBadge">
                {totalIssuesCount} action{totalIssuesCount > 1 ? "s" : ""}
              </span>
            </div>

            <div className="dashAttentionList">
              {metrics.pendingRequestsCount > 0 && (
                <div className="dashAttentionRow">
                  <div className="dashAttentionRowLeft">
                    <span className="dashStatusDot amber" />
                    <div>
                      <strong className="dashAttentionRowTitle">
                        {metrics.pendingRequestsCount} Pending Requisition
                        {metrics.pendingRequestsCount > 1 ? "s" : ""}
                      </strong>
                      <span className="dashAttentionRowDesc">
                        Site requests awaiting review & dispatch
                      </span>
                    </div>
                  </div>
                  <Link href="/material-requests" className="dashAttentionActionBtn">
                    View →
                  </Link>
                </div>
              )}

              {metrics.lowStockCount > 0 && (
                <div className="dashAttentionRow">
                  <div className="dashAttentionRowLeft">
                    <span className="dashStatusDot red" />
                    <div>
                      <strong className="dashAttentionRowTitle">
                        {metrics.lowStockCount} Low Stock Item
                        {metrics.lowStockCount > 1 ? "s" : ""}
                      </strong>
                      <span className="dashAttentionRowDesc">
                        Materials below threshold, purchase needed
                      </span>
                    </div>
                  </div>
                  <Link href="/inventory?filter=low" className="dashAttentionActionBtn">
                    View →
                  </Link>
                </div>
              )}

              {metrics.totalOutstanding > 0 && (
                <div className="dashAttentionRow">
                  <div className="dashAttentionRowLeft">
                    <span className="dashStatusDot yellow" />
                    <div>
                      <strong className="dashAttentionRowTitle">
                        ₹ {metrics.totalOutstanding.toLocaleString()} Outstanding
                      </strong>
                      <span className="dashAttentionRowDesc">
                        Party ledger payment balance pending
                      </span>
                    </div>
                  </div>
                  <Link href="/party-ledger" className="dashAttentionActionBtn">
                    View →
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. QUICK ACTIONS (2-Column Mobile Grid) */}
        <section className="dashSection" aria-label="Quick operations">
          <div className="dashSectionHeader">
            <span className="dashSectionEyebrow">QUICK ACTIONS</span>
          </div>

          <div className="dashQuickGrid">
            <Link href="/material-requests" className="dashQuickBtn">
              <span className="dashQuickIcon">↗</span>
              <span className="dashQuickLabel">Issue Material</span>
            </Link>

            <Link href="/material-requests" className="dashQuickBtn">
              <span className="dashQuickIcon">📋</span>
              <span className="dashQuickLabel">Request Material</span>
            </Link>

            <Link href="/material-consumption" className="dashQuickBtn">
              <span className="dashQuickIcon">◔</span>
              <span className="dashQuickLabel">Record Usage</span>
            </Link>

            <Link href="/purchases/new" className="dashQuickBtn primary">
              <span className="dashQuickIcon">＋</span>
              <span className="dashQuickLabel">Add Purchase</span>
            </Link>
          </div>
        </section>

        {/* Responsive Content Split (Stock Summary & Recent Activity) */}
        <div className="dashMainGrid">
          {/* 4. COMPACT STOCK SUMMARY */}
          <section className="dashStockSection card" aria-label="Stock summary">
            <div className="dashStockHead">
              <div>
                <span className="dashSectionEyebrow">STOCK STATUS</span>
                <h2 className="dashCardTitle">Live Inventory</h2>
              </div>
              {metrics.totalStockValue > 0 && (
                <div className="dashStockValuation">
                  <span className="dashStockValuationLabel">Total Value</span>
                  <strong className="dashStockValuationVal">
                    ₹ {metrics.totalStockValue.toLocaleString()}
                  </strong>
                </div>
              )}
            </div>

            <div className="dashStockMetricsList">
              <div className="dashStockRow">
                <span className="dashStockRowLabel">Total Physical Stock</span>
                <span className="dashStockRowVal highlight">
                  {totalStockUnits.toLocaleString()}{" "}
                  <small className="dashStockRowHint">
                    ({metrics.totalMaterialsCount} materials)
                  </small>
                </span>
              </div>

              <div className="dashStockRow">
                <span className="dashStockRowLabel">Low Stock Items</span>
                <span
                  className={`dashStockRowVal ${
                    metrics.lowStockCount > 0 ? "warningText" : ""
                  }`}
                >
                  {metrics.lowStockCount}
                </span>
              </div>

              <div className="dashStockRow">
                <span className="dashStockRowLabel">Out of Stock</span>
                <span
                  className={`dashStockRowVal ${
                    outOfStockCount > 0 ? "dangerText" : ""
                  }`}
                >
                  {outOfStockCount}
                </span>
              </div>
            </div>

            <div className="dashStockFooter">
              <Link href="/inventory" className="dashStockLink">
                View Inventory Master →
              </Link>
            </div>
          </section>

          {/* 5. RECENT ACTIVITY (Latest 3-5 Compact Activities) */}
          <section className="dashActivitySection card" aria-label="Recent activity">
            <div className="dashActivityHead">
              <div>
                <span className="dashSectionEyebrow">ACTIVITY</span>
                <h2 className="dashCardTitle">Recent Operational Activity</h2>
              </div>
              <Link href="/reports" className="dashActivityLink">
                View all →
              </Link>
            </div>

            <div className="dashActivityList">
              {metrics.recentActivity.length === 0 ? (
                <div className="dashEmptyActivity">
                  <span className="dashEmptyIcon">📋</span>
                  <div>
                    <strong>No recent activity</strong>
                    <p>Create a purchase or issue material to see activity here.</p>
                  </div>
                </div>
              ) : (
                metrics.recentActivity.slice(0, 5).map((act, idx) => (
                  <div key={idx} className="dashActivityItem">
                    <div className="dashActivityLeft">
                      <span className="dashActivityIcon">{act.icon}</span>
                      <div className="dashActivityDetails">
                        <strong className="dashActivityTitle">{act.title}</strong>
                        <span className="dashActivitySubtitle">{act.subtitle}</span>
                      </div>
                    </div>
                    <div className="dashActivityRight">
                      <Badge variant={act.badgeType}>{act.badge}</Badge>
                      <span className="dashActivityDate">{act.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
