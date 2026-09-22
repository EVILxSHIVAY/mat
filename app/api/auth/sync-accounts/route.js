import { NextResponse } from "next/server";
import { syncDynamicAccounts } from "@/lib/auth/users";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { vendors = [], suppliers = [] } = body;

    syncDynamicAccounts({ vendors, suppliers });

    return NextResponse.json({
      success: true,
      message: "Dynamic accounts synchronized.",
      vendorCount: vendors.length,
      supplierCount: suppliers.length,
    });
  } catch (err) {
    console.error("[SyncAccounts API Error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to sync accounts." },
      { status: 500 }
    );
  }
}
