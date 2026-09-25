"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  DEFAULT_SUPPLIERS,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";

// Normalize supplier row (array or object) to a consistent shape
function parseSupplier(s) {
  if (Array.isArray(s)) {
    return { code: s[0], name: s[1], contact: s[2], mobile: s[3], email: s[4], gst: s[5], status: s[6] || "Active" };
  }
  return {
    code: s.code || "", name: s.name || "", contact: s.contactPerson || s.contact || "",
    mobile: s.mobile || "", email: s.email || "", gst: s.gst || "", status: s.status || "Active",
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [editIndex, setEditIndex] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    contact: "",
    mobile: "",
    email: "",
    gst: "",
    status: "Active",
  });

  useEffect(() => {
    const saved = getStorageData(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS || []);
    setSuppliers(saved);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      lockScroll();
    }
    return () => {
      if (isModalOpen) unlockScroll();
    };
  }, [isModalOpen]);

  const saveList = (list) => {
    setSuppliers(list);
    setStorageData(STORAGE_KEYS.SUPPLIERS, list);

    // Notify any open components (like Inventory StockAdjustModal)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pdv_suppliers_updated", { detail: list }));
    }

    try {
      fetch("/api/auth/sync-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers: list }),
      }).catch(() => { });
    } catch (e) { }
  };

  const handleOpenAdd = () => {
    setModalMode("add");
    setEditIndex(null);
    setFormData({
      code: `SUP-${String(suppliers.length + 1).padStart(3, "0")}`,
      name: "",
      contact: "",
      mobile: "",
      email: "",
      gst: "",
      status: "Active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup, idx) => {
    setModalMode("edit");
    setEditIndex(idx);
    setFormData(parseSupplier(sup));
    setIsModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      alert("Supplier / Company Name is required.");
      return;
    }

    const row = [
      formData.code.trim() || `SUP-${String(suppliers.length + 1).padStart(3, "0")}`,
      trimmedName,
      formData.contact.trim(),
      formData.mobile.trim(),
      formData.email.trim(),
      formData.gst.trim(),
      formData.status || "Active",
    ];

    if (modalMode === "add") {
      saveList([row, ...suppliers]);
    } else if (editIndex !== null) {
      const copy = [...suppliers];
      copy[editIndex] = row;
      saveList(copy);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (index) => {
    const { name } = parseSupplier(suppliers[index]);
    if (confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      saveList(suppliers.filter((_, i) => i !== index));
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) => {
      const { name, code, contact, mobile, gst } = parseSupplier(s);
      return [name, code, contact, mobile, gst].some(
        (v) => String(v || "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, search]);

  const handleExport = () => {
    const headers = ["Supplier Code", "Supplier / Company Name", "Contact Person", "Mobile", "Email", "GSTIN", "Status"];
    const rows = filteredSuppliers.map((s) => {
      const p = parseSupplier(s);
      return [p.code, p.name, p.contact, p.mobile, p.email, p.gst, p.status];
    });
    exportToExcel({ filename: "Suppliers_Directory", headers, rows });
  };

  return (
    <Shell>
      <Title
        title="Suppliers Directory"
        desc="Manage approved suppliers and vendor companies for inventory material sourcing."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="secondary" onClick={handleExport}>
              ⤓ Export Directory
            </button>
            <button type="button" className="primary" onClick={handleOpenAdd}>
              + Add Supplier
            </button>
          </div>
        }
      />

      {/* Table Card */}
      <section className="card tableCard">
        <div className="tableControls">
          <div className="invSearchBox" style={{ maxWidth: "340px" }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search supplier name, code, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="clearBtn" onClick={() => setSearch("")}>
                ×
              </button>
            )}
          </div>

          <span className="tableCountHint">
            Showing <strong>{filteredSuppliers.length}</strong> of <strong>{suppliers.length}</strong> suppliers
          </span>
        </div>

        {/* Mobile-first compact cards (hidden on desktop) */}
        <div className="mobileCardList">
          {filteredSuppliers.length === 0 ? (
            <div className="emptyTable">
              <p>No suppliers match your search.</p>
              {suppliers.length === 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "10px" }}
                  onClick={handleOpenAdd}
                >
                  + Add First Supplier
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "8px" }}
                  onClick={() => setSearch("")}
                >
                  Reset Search
                </button>
              )}
            </div>
          ) : (
            filteredSuppliers.map((s, idx) => {
              const { code, name, contact, mobile, gst, status: stat } = parseSupplier(s);

              return (
                <div key={idx} className="mobileDataCard">
                  <div className="mobileCardHeader">
                    <div className="mobileCardTitleArea">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <code className="codeBadge">{code}</code>
                      </div>
                      <h3 className="mobileCardTitle">{name}</h3>
                    </div>
                    <Badge variant={stat === "Active" ? "active" : "pending"}>{stat}</Badge>
                  </div>

                  <div className="mobileCardBody">
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Contact Person</span>
                      <strong className="mobileMetricVal">{contact || "—"}</strong>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">Mobile</span>
                      <span className="mobileMetricVal" style={{ fontSize: "13.5px" }}>{mobile || "—"}</span>
                    </div>
                    <div className="mobileMetricItem">
                      <span className="mobileMetricLabel">GSTIN</span>
                      <span className="mobileMetricVal" style={{ fontSize: "12px", fontFamily: "monospace" }}>{gst || "—"}</span>
                    </div>
                  </div>

                  <div className="mobileCardFooter" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOpenEdit(s, idx)}
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(idx)}
                    >
                      ✕ Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Code</th>
                <th>Supplier / Company Name</th>
                <th>Contact Person</th>
                <th>Mobile Number</th>
                <th>Email</th>
                <th>GSTIN</th>
                <th style={{ width: "90px" }}>Status</th>
                <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emptyTable">
                    <p style={{ margin: "12px 0" }}>No suppliers found.</p>
                    {suppliers.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleOpenAdd}
                      >
                        + Add First Supplier
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s, idx) => {
                  const { code, name, contact, mobile, email, gst, status: stat } = parseSupplier(s);

                  return (
                    <tr key={idx}>
                      <td>
                        <code className="codeBadge">{code}</code>
                      </td>
                      <td>
                        <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>{name}</strong>
                      </td>
                      <td>{contact || "—"}</td>
                      <td>{mobile || "—"}</td>
                      <td>{email || "—"}</td>
                      <td>
                        <small style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{gst || "—"}</small>
                      </td>
                      <td>
                        <Badge variant={stat === "Active" ? "active" : "pending"}>{stat}</Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenEdit(s, idx)}
                          >
                            ✎ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modalHeader">
              <h3>{modalMode === "add" ? "Add New Supplier" : "Edit Supplier"}</h3>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="modalBody" style={{ display: "flex", flexDirection: "column", gap: "14px", minHeight: 0 }}>
                <div className="formGridResponsive">
                  <label>
                    Supplier Code *
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </label>
                  <label>
                    Supplier / Company Name *
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jindal Steel, Tata Steel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </label>
                </div>

                <div className="formGridResponsive">
                  <label>
                    Contact Person
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </label>
                  <label>
                    Mobile Phone
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </label>
                </div>

                <div className="formGridResponsive">
                  <label>
                    Email Address
                    <input
                      type="email"
                      placeholder="supplier@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </label>
                  <label>
                    GSTIN Number
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="15-character GSTIN"
                      value={formData.gst}
                      onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                    />
                  </label>
                </div>

                <label>
                  Status
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary">
                  {modalMode === "add" ? "+ Save Supplier" : "Update Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
