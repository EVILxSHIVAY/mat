"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";
import "@/components/ui/ui.css";
import "../vendor.css";

export default function VendorProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  const vendorCode = user?.vendorCode || "VND-001";
  const vendorName = user?.vendorName || user?.name || "Vendor";

  useEffect(() => {
    const registeredVendors = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("pdv_app_vendors") || "[]")
      : [];

    const found = registeredVendors.find(
      (v) =>
        (v.code && v.code.toLowerCase() === vendorCode.toLowerCase()) ||
        (v.name && v.name.toLowerCase() === vendorName.toLowerCase())
    );

    if (found) {
      setProfile(found);
    } else {
      setProfile({
        code: vendorCode,
        name: vendorName,
        mobile: user?.mobile || "9876501234",
        email: user?.email || "vendor@pdv.com",
        trade: user?.trade || "Site Supervisor",
        status: "Active",
        sites: [
          { name: "Jaipur Project Site", location: "Jaipur, Rajasthan", status: "Active" },
          { name: "Ajmer City Gas Site", location: "Ajmer, Rajasthan", status: "Active" },
        ],
      });
    }
  }, [user, vendorCode, vendorName]);

  return (
    <Shell>
      <Title
        title="Vendor Profile & Assigned Sites"
        desc="Registered vendor details, contact information, role specialization, and operational site allocations."
      />

      {profile && (
        <div style={{ maxWidth: "880px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Main Profile Card */}
          <div className="sectionCard">
            <div className="sectionCardHeader">
              <div>
                <h3 className="sectionCardTitle" style={{ fontSize: "18px" }}>
                  {profile.name}
                </h3>
                <span style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                  Vendor Code: <b>{profile.code}</b> · Role: <b>{profile.trade || profile.role || "Site Supervisor"}</b>
                </span>
              </div>
              <Badge variant="success">{profile.status || "Active"}</Badge>
            </div>

            <div className="drawerInfoGrid" style={{ rowGap: "16px" }}>
              <div className="drawerInfoItem">
                <span>Vendor Person Name</span>
                <strong>{profile.name}</strong>
              </div>
              <div className="drawerInfoItem">
                <span>Vendor Code</span>
                <strong style={{ color: "#059669" }}>{profile.code}</strong>
              </div>
              <div className="drawerInfoItem">
                <span>Role / Scope</span>
                <strong>{profile.trade || profile.role || "Site Supervisor"}</strong>
              </div>
              <div className="drawerInfoItem">
                <span>Mobile Phone</span>
                <strong>{profile.mobile}</strong>
              </div>
              <div className="drawerInfoItem">
                <span>Email Address</span>
                <strong>{profile.email}</strong>
              </div>
              <div className="drawerInfoItem">
                <span>Status</span>
                <strong>{profile.status || "Active"}</strong>
              </div>
            </div>
          </div>

          {/* Project Sites Card */}
          <div className="sectionCard">
            <div className="sectionCardHeader">
              <h3 className="sectionCardTitle">
                <span>📍</span> Assigned Project Sites ({profile.sites?.length || 0})
              </h3>
            </div>

            <div className="drawerSitesList">
              {Array.isArray(profile.sites) && profile.sites.length > 0 ? (
                profile.sites.map((site, idx) => {
                  const sName = typeof site === "string" ? site : site.name;
                  const sLoc = typeof site === "string" ? "Active Sector" : site.location;
                  return (
                    <div key={idx} className="drawerSiteItem" style={{ padding: "12px 16px" }}>
                      <div className="drawerSiteIcon" style={{ fontSize: "20px" }}>🏗</div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>{sName}</strong>
                        <span style={{ display: "block", fontSize: "12px", color: "var(--muted)" }}>
                          {sLoc}
                        </span>
                      </div>
                      <Badge variant="success">Active Site</Badge>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>No sites registered.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
