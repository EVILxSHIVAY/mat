"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import GlobalSearchModal from "@/components/ui/GlobalSearchModal";
import "./shell.css";

// Admin Navigation Menu (Clean & Simple)
const adminNavigationSections = [
  {
    title: "OPERATIONS",
    items: [
      { href: "/", label: "Dashboard", icon: "⌂" },
      { href: "/inventory", label: "Inventory", icon: "📦" },
      { href: "/material-requests", label: "Vendor Requests", icon: "📋" },
      { href: "/material-consumption", label: "Site Consumption", icon: "◔" },
    ],
  },
  {
    title: "DIRECTORIES",
    items: [
      { href: "/suppliers", label: "Suppliers", icon: "🏢" },
      { href: "/vendors", label: "Vendors & Sites", icon: "👷" },
      { href: "/party-ledger", label: "Party Ledger", icon: "⚖" },
      { href: "/products", label: "Products Catalog", icon: "▦" },
      { href: "/upload", label: "Upload Vault", icon: "⇧" },
      { href: "/reports", label: "Reports & Sync", icon: "▤" },
    ],
  },
];

// Supplier Dedicated Navigation Menu (Clean & Simple)
const supplierNavigationSections = [
  {
    title: "SUPPLIER PORTAL",
    items: [
      { href: "/supplier", label: "Dashboard", icon: "🏢" },
      { href: "/supplier/orders", label: "Purchase Orders", icon: "📋" },
      { href: "/supplier/materials", label: "Supplied Materials", icon: "📦" },
      { href: "/supplier/profile", label: "Supplier Profile", icon: "⚙" },
    ],
  },
];

// Vendor / Contractor Dedicated Navigation Menu
const vendorNavigationSections = [
  {
    title: "VENDOR PORTAL",
    items: [
      { href: "/vendor", label: "Dashboard", icon: "👷" },
      { href: "/vendor/requests", label: "Material Requests", icon: "📋" },
      { href: "/vendor/issued", label: "Issued to Me", icon: "📦" },
      { href: "/vendor/consumption", label: "Site Consumption", icon: "◔" },
      { href: "/vendor/profile", label: "Profile & Sites", icon: "⚙" },
    ],
  },
];

export default function Shell({ children }) {
  const currentPath = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, quickSwitchRole } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
    }
  }, [isLoading, isAuthenticated, currentPath]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === "SUPPLIER" && !currentPath.startsWith("/supplier")) {
        window.location.href = "/supplier";
      } else if (user?.role === "VENDOR" && !currentPath.startsWith("/vendor")) {
        window.location.href = "/vendor";
      }
    }
  }, [isLoading, isAuthenticated, user, currentPath]);

  const isSupplier = user?.role === "SUPPLIER";
  const isVendor = user?.role === "VENDOR";
  const activeNavigationSections = isSupplier
    ? supplierNavigationSections
    : isVendor
    ? vendorNavigationSections
    : adminNavigationSections;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompactSidebar, setIsCompactSidebar] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          color: "#f8fafc",
          fontFamily: "var(--font-outfit), sans-serif",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 16,
            boxShadow: "0 10px 25px rgba(59, 130, 246, 0.35)",
          }}
        >
          P
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#f1f5f9",
          }}
        >
          PDV Material Management
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
          Checking authentication & redirecting to login...
        </div>
      </div>
    );
  }

  // Find current active page title
  let pageTitle = isSupplier ? "Supplier Portal" : isVendor ? "Vendor Portal" : "Dashboard";
  for (const section of activeNavigationSections) {
    const found = section.items.find((item) => {
      if (item.href === "/" && !isSupplier && !isVendor) return currentPath === "/";
      if (item.href === "/supplier" && isSupplier) return currentPath === "/supplier";
      if (item.href === "/vendor" && isVendor) return currentPath === "/vendor";
      return currentPath.startsWith(item.href);
    });
    if (found) {
      pageTitle = found.label;
      break;
    }
  }

  const handleLogout = async () => {
    await logout();
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : isSupplier
    ? "VE"
    : isVendor
    ? "AC"
    : "SA";

  return (
    <div className={`app ${isCompactSidebar ? "compact" : ""}`}>
      {/* Dim backdrop overlay for mobile */}
      {isMobileMenuOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close navigation"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        {/* Brand Logo & Name */}
        <div className="brand">
          <span className="brandMark">{isSupplier ? "🏢" : isVendor ? "👤" : "P"}</span>
          <div className="brandTextWrapper">
            <span className="brandName">
              {isSupplier ? "PDV Supplier" : isVendor ? "PDV Vendor" : "PDV Solutions"}
            </span>
            <span className="brandSub">
              {isSupplier ? "Supplier Portal" : isVendor ? "Vendor Portal" : "Material Management"}
            </span>
          </div>
          <button
            type="button"
            className="close"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="sidebarNavScroll">
          {activeNavigationSections.map((section) => (
            <div key={section.title} className="navSection">
              <p className="navLabel">{section.title}</p>
              <nav>
                {section.items.map((item) => {
                  const isActive =
                    currentPath === item.href ||
                    (item.href !== "/" &&
                      item.href !== "/supplier" &&
                      item.href !== "/vendor" &&
                      currentPath.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={isActive ? "active" : ""}
                    >
                      <i>{item.icon}</i>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User profile footer at bottom of sidebar with Red Log Out */}
        <div className="sideFoot">
          <div className="avatar">{userInitials}</div>
          <div className="userInfoBlock">
            <b title={user?.name || (isSupplier ? "Supplier" : isVendor ? "Vendor" : "Administrator")}>
              {user?.name || (isSupplier ? "Supplier" : isVendor ? "Vendor" : "Administrator")}
            </b>
            <small>
              {isSupplier
                ? `Supplier ${user?.supplierCode ? `(${user.supplierCode})` : ""}`
                : isVendor
                ? `Vendor ${user?.vendorCode ? `(${user.vendorCode})` : ""}`
                : "Administrator (Procurement)"}
            </small>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="sideLogoutBtn"
            title="Log Out"
            aria-label="Log Out"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Workspace Page Area */}
      <main className="workspace">
        {/* Top Header */}
        <header>
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          {/* Desktop sidebar collapse button */}
          <button
            type="button"
            className="collapse"
            onClick={() => setIsCompactSidebar(!isCompactSidebar)}
            aria-label="Collapse sidebar"
          >
            ☰
          </button>

          {/* Breadcrumb Title */}
          <div className="crumb">
            {isSupplier ? "Supplier Portal" : isVendor ? "Vendor Portal" : "Material Management"} <span>/</span> {pageTitle}
          </div>

          {/* Omnisearch Quick Button */}
          {!isSupplier && !isVendor && (
            <button
              type="button"
              className="headerSearchBar"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Global search (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="searchPrompt">Search stock, vendors, PI#, vouchers...</span>
              <kbd className="searchKbd">Ctrl K</kbd>
            </button>
          )}

          {/* Header Right Side */}
          <div className="headRight">
            {!isSupplier && !isVendor && (
              <Link
                href="/reports"
                className="headerSyncBtn"
                title="Reports & Cloud Sync"
              >
                ⚡ Google Sync
              </Link>
            )}

            {/* User Dropdown / Profile */}
            <div className="userDropdownWrap">
              <button
                type="button"
                className="headAvatarBtn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User profile menu"
              >
                <div className="headAvatar">{userInitials}</div>
                <span className="headUserName">
                  {user?.name ? user.name.split(" ")[0] : isSupplier ? "Supplier" : isVendor ? "Vendor" : "Admin"}
                </span>
                <span className={`headRolePill ${isSupplier ? "supplier" : isVendor ? "vendor" : "admin"}`}>
                  {isSupplier ? "Supplier" : isVendor ? "Vendor" : "Admin"}
                </span>
                <span className="caret">▾</span>
              </button>

              {isUserMenuOpen && (
                <div className="userMenuPopup">
                  <div className="userMenuHeader">
                    <b>{user?.name || (isSupplier ? "Supplier" : isVendor ? "Vendor" : "Administrator")}</b>
                    <small>{user?.email || "admin@pdv.com"}</small>
                    <span className="userMenuRoleBadge">
                      {isSupplier
                        ? `🏢 Supplier Portal ${user?.supplierCode ? `(${user.supplierCode})` : ""}`
                        : isVendor
                        ? `👷 Vendor Portal ${user?.vendorCode ? `(${user.vendorCode})` : ""}`
                        : "🛡️ Administrator"}
                    </span>
                  </div>
                  <div className="userMenuDivider" />

                  {isSupplier ? (
                    <Link
                      href="/supplier/profile"
                      className="userMenuItem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>🏢</span> Supplier Profile & Details
                    </Link>
                  ) : isVendor ? (
                    <Link
                      href="/vendor/profile"
                      className="userMenuItem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>⚙</span> Vendor Profile & Sites
                    </Link>
                  ) : (
                    <Link
                      href="/reports"
                      className="userMenuItem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>📊</span> Reports & Cloud Hub
                    </Link>
                  )}

                  {/* Persona Quick Switcher: Only shown for non-admin to switch back to Admin */}
                  {user?.role !== "ADMIN" && (
                    <>
                      <div className="userMenuDivider" />
                      <div style={{ padding: "6px 12px 2px", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Switch Workspace
                      </div>
                      <button
                        type="button"
                        className="userMenuItem"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          quickSwitchRole("ADMIN");
                        }}
                      >
                        <span>🛡️</span> Switch to Admin Workspace
                      </button>
                    </>
                  )}

                  <div className="userMenuDivider" />
                  <button
                    type="button"
                    className="userMenuItem danger"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <span>🚪</span> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">{children}</div>
      </main>

      {/* Global Omnisearch Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
