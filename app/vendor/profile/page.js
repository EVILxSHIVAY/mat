"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
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

  const initials = (profile?.name || vendorName)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "VN";

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
            <div className="profileCardHeader">
              <div className="profileHeaderLeft">
                <div className="profileAvatar">{initials}</div>
                <div className="profileHeaderText">
                  <h2 className="profileNameTitle">{profile.name}</h2>
                  <div className="profileSubMeta">
                    <span>
                      Vendor Code: <b style={{ color: "#059669" }}>{profile.code}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Role: <b>{profile.trade || profile.role || "Site Supervisor"}</b>
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant="success">{profile.status || "Active"}</Badge>
            </div>

            <div className="profileInfoGrid">
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Vendor Person Name</span>
                <strong className="profileInfoVal">{profile.name}</strong>
              </div>
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Vendor Code</span>
                <strong className="profileInfoVal code">{profile.code}</strong>
              </div>
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Role / Scope</span>
                <strong className="profileInfoVal">{profile.trade || profile.role || "Site Supervisor"}</strong>
              </div>
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Mobile Phone</span>
                <strong className="profileInfoVal">{profile.mobile}</strong>
              </div>
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Email Address</span>
                <strong className="profileInfoVal">{profile.email}</strong>
              </div>
              <div className="profileInfoItem">
                <span className="profileInfoLabel">Account Status</span>
                <strong className="profileInfoVal status">{profile.status || "Active"}</strong>
              </div>
            </div>
          </div>

          {/* Project Sites Card */}
          <div className="sectionCard">
            <div className="sectionCardHeader" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: "14px" }}>
              <h3 className="sectionCardTitle">
                <span>📍</span> Assigned Project Sites ({profile.sites?.length || 0})
              </h3>
            </div>

            <div className="profileSitesList">
              {Array.isArray(profile.sites) && profile.sites.length > 0 ? (
                profile.sites.map((site, idx) => {
                  const sName = typeof site === "string" ? site : site.name;
                  const sLoc = typeof site === "string" ? "Active Sector" : site.location;
                  return (
                    <div key={idx} className="profileSiteCard">
                      <div className="profileSiteLeft">
                        <div className="profileSiteIcon">🏗</div>
                        <div className="profileSiteInfo">
                          <strong className="profileSiteName">{sName}</strong>
                          <span className="profileSiteLoc">📍 {sLoc}</span>
                        </div>
                      </div>
                      <Badge variant="success">Active Site</Badge>
                    </div>
                  );
                })
              ) : (
                <div className="emptyStateCard" style={{ padding: "28px 16px" }}>
                  <p style={{ margin: 0, color: "var(--muted)" }}>No sites assigned to this vendor.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
