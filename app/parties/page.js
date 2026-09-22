"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import {
  getStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import "@/components/ui/ui.css";
import "./parties.css";

export default function PartiesAndSitesPage() {
  const [issues, setIssues] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [needed, setNeeded] = useState([]);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setIssues(getStorageData(STORAGE_KEYS.ISSUES, []));
    setConsumptions(getStorageData(STORAGE_KEYS.CONSUMPTIONS, []));
    setNeeded(getStorageData(STORAGE_KEYS.NEEDED, []));
    setPayments(getStorageData(STORAGE_KEYS.PAYMENTS, []));
    setSuppliers(getStorageData(STORAGE_KEYS.SUPPLIERS, []));
    setVendors(getStorageData(STORAGE_KEYS.VENDORS, []));
  }, []);

  // Map parties and sites dynamically from registered vendors
  const partySiteMap = useMemo(() => {
    return (vendors || []).map((v) => ({
      partyName: v.name || "",
      contactPerson: v.contactPerson || "",
      phone: v.mobile || "",
      sites: Array.isArray(v.sites) ? v.sites : [],
    }));
  }, [vendors]);

  const filteredParties = partySiteMap.filter((p) => {
    return (
      !search ||
      p.partyName.toLowerCase().includes(search.toLowerCase()) ||
      p.sites.some((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <Shell>
      <Title
        title="Parties & Field Sites Architecture"
        desc="Hierarchical view of vendors, clients, and their active project sites and material positions."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <Link href="/vendors" className="btn btn-secondary">
              👤 Vendors Registry →
            </Link>
            <Link href="/party-ledger" className="primary">
              ⚖ Open Party Ledger
            </Link>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="tableControls" style={{ borderRadius: "var(--radius-lg)", marginBottom: "20px" }}>
        <div className="invSearchBox" style={{ maxWidth: "340px" }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search party name or site location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Parties & Sites Cards Grid */}
      <div className="partiesGrid">
        {filteredParties.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🏢</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "6px" }}>No Parties or Field Sites Found</h3>
            <p style={{ fontSize: "0.88rem", maxWidth: "420px", margin: "0 auto 16px" }}>
              There are currently no active vendors or project sites registered in the system.
            </p>
            <Link href="/vendors" className="btn btn-primary" style={{ display: "inline-flex" }}>
              👷 Manage Vendors Registry
            </Link>
          </div>
        ) : null}
        {filteredParties.map((party, idx) => {
          // Calculate material movements for this party
          const partyIssues = issues.filter(
            (i) => (i.department || "").toLowerCase().includes(party.partyName.toLowerCase())
          );
          const partyConsumptions = consumptions.filter(
            (c) => (c.department || "").toLowerCase().includes(party.partyName.toLowerCase())
          );
          const partyPayments = payments.filter(
            (p) => (p.partyName || "").toLowerCase().includes(party.partyName.toLowerCase())
          );

          const totalBilled = partyPayments.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
          const totalPaid = partyPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);
          const totalOutstanding = Math.max(0, totalBilled - totalPaid);

          return (
            <div key={idx} className="card partyCard">
              <div className="partyCardHeader">
                <div>
                  <h3 className="partyCardTitle">{party.partyName}</h3>
                  <span className="partyCardContact">
                    Contact: {party.contactPerson} · 📞 {party.phone}
                  </span>
                </div>
                <Link
                  href={`/party-ledger?party=${encodeURIComponent(party.partyName)}`}
                  className="btn btn-sm btn-secondary"
                >
                  View Ledger →
                </Link>
              </div>

              <div className="partyKpiRow">
                <div className="partyKpi">
                  <span>Dispatched Issues</span>
                  <strong>{partyIssues.length} Vouchers</strong>
                </div>
                <div className="partyKpi">
                  <span>Consumptions</span>
                  <strong>{partyConsumptions.length} Records</strong>
                </div>
                <div className="partyKpi">
                  <span>Outstanding Balance</span>
                  <strong style={{ color: totalOutstanding > 0 ? "var(--red)" : "inherit" }}>
                    ₹ {totalOutstanding.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="partySitesSection">
                <span className="sitesSectionTitle">Attached Project Sites ({party.sites.length})</span>
                <div className="sitePillsList">
                  {party.sites.map((site, sIdx) => (
                    <div key={sIdx} className="sitePill">
                      <div>
                        <b>{site.name}</b>
                        <small>{site.location}</small>
                      </div>
                      <Badge variant="success">{site.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
