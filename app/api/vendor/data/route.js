import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";

/**
 * Server-Enforced Vendor Data Scoping API
 * Strictly returns only records belonging to the authenticated vendor/contractor.
 */
export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please sign in." },
      { status: 401 }
    );
  }

  const session = await verifySessionToken(token);
  if (!session || (session.role !== "VENDOR" && session.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Access denied. Vendor role required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { issues = [], requests = [], consumptions = [] } = body;

    const vendorName = session.vendorName || session.name || "";
    const vendorCode = session.vendorCode || "";

    // Locate Vendor Profile from Master
    const foundMaster = DEFAULT_VENDORS.find(
      (v) =>
        (vendorCode && v.code && v.code.toLowerCase() === vendorCode.toLowerCase()) ||
        (vendorName && v.name && v.name.toLowerCase() === vendorName.toLowerCase()) ||
        (session.email && v.email && v.email.toLowerCase() === session.email.toLowerCase())
    );

    const targetVnd = foundMaster || (session.role === "ADMIN" ? DEFAULT_VENDORS[0] : null);

    const profile = targetVnd
      ? {
          code: targetVnd.code,
          name: targetVnd.name,
          contactPerson: targetVnd.contactPerson,
          mobile: targetVnd.mobile,
          email: targetVnd.email,
          gst: targetVnd.gst,
          trade: targetVnd.trade,
          status: targetVnd.status || "Active",
          sites: targetVnd.sites || [],
        }
      : {
          code: vendorCode || "VND-001",
          name: vendorName || session.name,
          contactPerson: session.name,
          email: session.email,
          mobile: session.mobile || "—",
          gst: session.gst || "—",
          trade: session.trade || "Site Supervisor",
          status: "Active",
          sites: Array.isArray(session.sites) && session.sites.length > 0
            ? session.sites
            : [{ name: "Main Site", location: "Active Site", status: "Active" }],
        };

    // Strict Data Isolation: Only return records matching this vendor
    const isVendorMatch = (recordParty) => {
      if (!recordParty) return false;
      const cleanRecord = String(recordParty).toLowerCase().trim();
      const cleanTarget = String(profile.name).toLowerCase().trim();
      return (
        cleanRecord.includes(cleanTarget) ||
        cleanTarget.includes(cleanRecord) ||
        cleanRecord.includes(profile.code.toLowerCase())
      );
    };

    const isolatedIssues = issues.filter((iss) => {
      const dept = iss.department || iss.issuedTo || "";
      return isVendorMatch(dept);
    });

    const isolatedRequests = requests.filter((req) => {
      const party = req.partyName || req.vendor || "";
      return isVendorMatch(party);
    });

    const isolatedConsumptions = consumptions.filter((con) => {
      const party = con.department || con.partyName || "";
      return isVendorMatch(party);
    });

    return NextResponse.json({
      success: true,
      vendor: profile,
      data: {
        issues: isolatedIssues,
        requests: isolatedRequests,
        consumptions: isolatedConsumptions,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to load vendor workspace data." },
      { status: 500 }
    );
  }
}
