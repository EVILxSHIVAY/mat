"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { fields } from "@/data/fields";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";
import History from "./History";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { calculateLiveInventory } from "@/lib/dataService";
import "@/components/ui/ui.css";
import "./material-issue.css";

// Category Classifier Helper
function categorizeMaterial(name) {
  const n = name.toLowerCase();
  if (
    n.includes("pipe") ||
    n.includes("nipple") ||
    n.includes("coupler") ||
    n.includes("tee") ||
    n.includes("elbow") ||
    n.includes("reducer") ||
    n.includes("socket") ||
    n.includes("bushing") ||
    n.includes("union") ||
    n.includes("end cap") ||
    n.includes("end cape") ||
    n.includes("dead plug") ||
    n.includes("anaconda") ||
    n.includes("transition") ||
    n.includes("mdpe")
  ) {
    return "Pipes & Fittings";
  }
  if (
    n.includes("valve") ||
    n.includes("gauge") ||
    n.includes("guage") ||
    n.includes("meter") ||
    n.includes("regulator")
  ) {
    return "Valves & Meters";
  }
  if (
    n.includes("drill") ||
    n.includes("hammer") ||
    n.includes("cutter") ||
    n.includes("wrench") ||
    n.includes("cutter") ||
    n.includes("machine") ||
    n.includes("excuzer") ||
    n.includes("scrapper") ||
    n.includes("vice") ||
    n.includes("handel") ||
    n.includes("collet") ||
    n.includes("gutka") ||
    n.includes("board") ||
    n.includes("marker") ||
    n.includes("allenkeys") ||
    n.includes("pump") ||
    n.includes("bit")
  ) {
    return "Tools & Equipment";
  }
  if (
    n.includes("safety") ||
    n.includes("jacket") ||
    n.includes("helmet") ||
    n.includes("boot") ||
    n.includes("shooes") ||
    n.includes("shoes") ||
    n.includes("first aid") ||
    n.includes("extinguisher") ||
    n.includes("caution") ||
    n.includes("cone")
  ) {
    return "Safety & PPE";
  }
  if (
    n.includes("clamp") ||
    n.includes("screw") ||
    n.includes("gitti") ||
    n.includes("topi") ||
    n.includes("tape")
  ) {
    return "Fasteners & Hardware";
  }
  return "General Materials";
}

// Unit Classifier Helper (Restricted strictly to Meter for pipe and Pcs for everything else)
function inferUnit(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("pipe")) return "Meter";
  return "Pcs";
}

const CATEGORIES = [
  "All",
  "Pipes & Fittings",
  "Valves & Meters",
  "Tools & Equipment",
  "Safety & PPE",
  "Fasteners & Hardware",
];

const RECENT_STORAGE_KEY = "pdv_recent_issued_materials";

export default function MaterialIssueForm() {
  const router = useRouter();

  // All 93 raw material column names from fields.issue
  const rawMaterialNames = useMemo(() => {
    const rawIssueFields = fields.issue || [];
    // Header cutoff is 5 for Material Issue
    return rawIssueFields.slice(5);
  }, []);

  // Catalog dataset with metadata
  const materialCatalog = useMemo(() => {
    return rawMaterialNames.map((name, index) => ({
      id: `mat-${index + 1}`,
      name: name,
      category: categorizeMaterial(name),
      unit: inferUnit(name),
    }));
  }, [rawMaterialNames]);

  // Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const [voucherDetails, setVoucherDetails] = useState({
    challanNo: `MI-${Date.now().toString().slice(-4)}`,
    slNo: `V-${Date.now().toString().slice(-3)}`,
    date: todayStr,
    issuedTo: "",
    issueType: "Issue",
  });

  // Selected Materials List: [{ id, name, category, unit, qty }]
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Browse All Materials Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalCategory, setModalCategory] = useState("All");

  // Autocomplete suggestions for Issue To
  const [knownParties, setKnownParties] = useState([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

  // Recent materials for quick add
  const [recentMaterials, setRecentMaterials] = useState([]);

  // UI status / notification
  const [notification, setNotification] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [liveInventory, setLiveInventory] = useState([]);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const qtyInputRefs = useRef({});

  // Helper to query available inventory stock
  const getStockForItem = (materialName) => {
    if (!materialName || !liveInventory.length) return 0;
    const key = materialName.toLowerCase().trim();
    const found = liveInventory.find(
      (inv) => inv.name && inv.name.toLowerCase().trim() === key
    );
    return found ? Number(found.availableStock) || 0 : 0;
  };

  useEffect(() => {
    try {
      setLiveInventory(calculateLiveInventory());
    } catch (e) {
      console.warn("Failed to load inventory:", e);
    }
  }, [refreshHistoryTrigger]);

  // 1. Initial Data Loading (Known Vendors, Recent Items, Query Pre-fill)
  useEffect(() => {
    try {
      // Load known vendors/contractors to whom materials are issued
      const rawVendors = localStorage.getItem("pdv_app_vendors");
      const partySet = new Set();
      if (rawVendors) {
        const parsed = JSON.parse(rawVendors);
        if (Array.isArray(parsed)) {
          parsed.forEach((v) => {
            if (v.name) partySet.add(v.name);
          });
        }
      }
      setKnownParties(Array.from(partySet));

      // Load recent materials
      const rawRecents = localStorage.getItem(RECENT_STORAGE_KEY);
      if (rawRecents) {
        const parsed = JSON.parse(rawRecents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentMaterials(parsed.slice(0, 5));
        }
      } else {
        // Default top commonly issued materials
        setRecentMaterials([
          "Steel Tube Nipple 2.5\"x12\" (GI Sleeve)",
          "NG Kit",
          "Drill Bit 0.6 MM",
          "Hose Clamp",
          "Coupler 20mm"
        ]);
      }

      // Check if arriving from a Vendor Material Request
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const vendorParam = urlParams.get("vendor");
        const matParam = urlParams.get("material");
        const qtyParam = urlParams.get("qty");
        const unitParam = urlParams.get("unit");
        const reqId = urlParams.get("reqId");

        if (vendorParam) {
          setVoucherDetails((prev) => ({
            ...prev,
            issuedTo: vendorParam,
            reqId: reqId || "",
          }));
        }

        if (matParam) {
          setSelectedMaterials((prev) => {
            if (prev.some((m) => m.name.toLowerCase() === matParam.toLowerCase())) {
              return prev;
            }
            return [
              {
                id: `req-mat-${Date.now()}`,
                name: matParam,
                category: categorizeMaterial(matParam),
                unit: unitParam || inferUnit(matParam),
                qty: Number(qtyParam) || 1,
              },
              ...prev,
            ];
          });
        }
      }
    } catch (e) {
      console.warn("Storage read error:", e);
    }
  }, []);

  // 2. Global Keyboard Shortcut for Search (Ctrl+K or /) and Click-Outside Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsCatalogModalOpen(false);
        setShowPartySuggestions(false);
      }
    };

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
      if (!e.target.closest(".fieldGroup")) {
        setShowPartySuggestions(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isCatalogModalOpen) {
      lockScroll();
    }
    return () => {
      if (isCatalogModalOpen) unlockScroll();
    };
  }, [isCatalogModalOpen]);

  // 3. Filtered Catalog for Quick Search Dropdown
  const searchResults = useMemo(() => {
    let list = materialCatalog;
    if (selectedCategory !== "All") {
      list = list.filter((m) => m.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 15); // Limit dropdown display for instant responsiveness
  }, [materialCatalog, selectedCategory, searchQuery]);

  // Handle Search Input Keyboard Navigation
  const handleSearchKeyDown = (e) => {
    if (!isSearchOpen || searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[highlightedIndex]) {
        handleAddMaterial(searchResults[highlightedIndex]);
      }
    }
  };

  // Add Material to Selected List
  const handleAddMaterial = (material) => {
    const existingIndex = selectedMaterials.findIndex((m) => m.name === material.name);

    if (existingIndex >= 0) {
      // If already present, increment quantity by 1
      const updated = [...selectedMaterials];
      const currentQty = Number(updated[existingIndex].qty) || 0;
      updated[existingIndex].qty = currentQty + 1;
      setSelectedMaterials(updated);
      focusQtyInput(material.name);
    } else {
      // Add new row with default qty 1
      const newEntry = {
        id: material.id || `mat-${Date.now()}`,
        name: material.name,
        category: material.category,
        unit: material.unit,
        qty: 1,
      };
      setSelectedMaterials((prev) => [newEntry, ...prev]);

      // Focus the new quantity input
      setTimeout(() => focusQtyInput(material.name), 50);
    }

    // Save to recents
    updateRecentMaterials(material.name);

    // Reset search
    setSearchQuery("");
    setIsSearchOpen(false);
    setHighlightedIndex(0);
  };

  // Focus Qty input helper
  const focusQtyInput = (materialName) => {
    if (qtyInputRefs.current[materialName]) {
      qtyInputRefs.current[materialName].focus();
      qtyInputRefs.current[materialName].select();
    }
  };

  // Update Recent Materials
  const updateRecentMaterials = (name) => {
    setRecentMaterials((prev) => {
      const filtered = prev.filter((item) => item !== name);
      const next = [name, ...filtered].slice(0, 6);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch (e) { }
      return next;
    });
  };

  // Update Quantity of Selected Material
  const handleQtyChange = (name, newQty) => {
    setSelectedMaterials((prev) =>
      prev.map((item) => {
        if (item.name === name) {
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  // Stepper increment/decrement
  const handleStepQty = (name, delta) => {
    setSelectedMaterials((prev) =>
      prev.map((item) => {
        if (item.name === name) {
          const current = Number(item.qty) || 0;
          const updated = Math.max(1, current + delta);
          return { ...item, qty: updated };
        }
        return item;
      })
    );
  };

  // Remove Selected Material
  const handleRemoveMaterial = (name) => {
    setSelectedMaterials((prev) => prev.filter((item) => item.name !== name));
  };

  // Clear all selected materials
  const handleClearAll = () => {
    if (selectedMaterials.length === 0) return;
    if (window.confirm("Are you sure you want to clear all selected materials?")) {
      setSelectedMaterials([]);
    }
  };

  // Total Quantity Calculation
  const totalSelectedCount = selectedMaterials.length;
  const totalUnitsCount = useMemo(() => {
    return selectedMaterials.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
  }, [selectedMaterials]);

  // Handle Save Record
  const handleSaveRecord = (e) => {
    if (e) e.preventDefault();

    // Validation
    if (selectedMaterials.length === 0) {
      setNotification({
        type: "error",
        text: "Please search and add at least one material before saving.",
      });
      setTimeout(() => setNotification({ type: "", text: "" }), 4000);
      return;
    }

    const invalidItems = selectedMaterials.filter(
      (m) => !m.qty || isNaN(Number(m.qty)) || Number(m.qty) <= 0
    );

    if (invalidItems.length > 0) {
      setNotification({
        type: "error",
        text: `Please enter a valid quantity (> 0) for: ${invalidItems[0].name}`,
      });
      focusQtyInput(invalidItems[0].name);
      setTimeout(() => setNotification({ type: "", text: "" }), 4000);
      return;
    }

    setIsSubmitting(true);

    try {
      const recordNumber =
        voucherDetails.challanNo ||
        voucherDetails.slNo ||
        `MI-${Date.now().toString().slice(-4)}`;

      const newRecord = {
        number: recordNumber,
        date: voucherDetails.date || todayStr,
        department: voucherDetails.issuedTo || "Main Site",
        itemsCount: totalSelectedCount,
        status: voucherDetails.issueType || "Issued",
        // Extended material details for full fidelity
        materials: selectedMaterials.map((m) => ({
          name: m.name,
          quantity: Number(m.qty),
          unit: m.unit,
          category: m.category,
        })),
        items: selectedMaterials.map((m) => ({
          name: m.name,
          qty: Number(m.qty),
          quantity: Number(m.qty),
          unit: m.unit,
          category: m.category,
        })),
        createdAt: new Date().toISOString(),
      };

      // Save to localStorage under existing key `pdv_app_issue`
      const storageKey = "pdv_app_issue";
      const existingRaw = localStorage.getItem(storageKey);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [newRecord, ...existingList];
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      // If linked to a Vendor Material Request, update issued progress and status
      if (voucherDetails.reqId) {
        try {
          const reqRaw = localStorage.getItem("pdv_app_material_needed");
          if (reqRaw) {
            const reqList = JSON.parse(reqRaw);
            const updatedReqs = reqList.map((r) => {
              if (r.id === voucherDetails.reqId) {
                const requestedTotal = Number(r.quantityNeeded) || Number(r.quantity) || 1;
                const priorIssued = Number(r.issuedQty) || 0;
                // find matching material qty in selectedMaterials
                const matchedMat = selectedMaterials.find(
                  (m) => m.name.toLowerCase().trim() === (r.materialName || "").toLowerCase().trim()
                );
                const qtyIssuedThisTime = matchedMat ? Number(matchedMat.qty) || 0 : totalUnitsCount;
                const newTotalIssued = priorIssued + qtyIssuedThisTime;
                const remaining = Math.max(0, requestedTotal - newTotalIssued);
                const isFullyIssued = newTotalIssued >= requestedTotal;

                return {
                  ...r,
                  status: isFullyIssued ? "Issued" : "Partially Issued",
                  issuedQty: newTotalIssued,
                  remainingNeeded: remaining,
                  challanNo: recordNumber,
                  issueChallanNo: recordNumber,
                  issuedAt: new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                };
              }
              return r;
            });
            localStorage.setItem("pdv_app_material_needed", JSON.stringify(updatedReqs));
          }
        } catch (e) {
          console.warn("Could not link request to issue:", e);
        }
      }

      // Success notification
      setNotification({
        type: "success",
        text: `✓ Issue Voucher ${recordNumber} saved successfully with ${totalSelectedCount} materials (${totalUnitsCount} units)!`,
      });

      // Reset form state
      setSelectedMaterials([]);
      setVoucherDetails({
        challanNo: `MI-${Date.now().toString().slice(-4)}`,
        slNo: `V-${Date.now().toString().slice(-3)}`,
        date: todayStr,
        issuedTo: "",
        issueType: "Issue",
      });

      // Trigger History reload
      setRefreshHistoryTrigger((prev) => prev + 1);

      setTimeout(() => {
        setNotification({ type: "", text: "" });
      }, 4500);
    } catch (err) {
      console.error("Save error:", err);
      setNotification({
        type: "error",
        text: "Failed to save record. Please check browser storage settings.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal Catalog Filter
  const modalCatalogFiltered = useMemo(() => {
    let list = materialCatalog;
    if (modalCategory !== "All") {
      list = list.filter((m) => m.category === modalCategory);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [materialCatalog, modalCategory, modalSearch]);

  return (
    <Shell>
      <div className="issuePageWrapper">
        {/* Alert Notification Banner */}
        {notification.text && (
          <div className={`alertBanner ${notification.type}`}>
            <span>{notification.text}</span>
            <button
              type="button"
              onClick={() => setNotification({ type: "", text: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Header Metrics & Quick Action Bar */}
        <div className="issueHeaderBar">
          <div className="issueHeaderLeft">
            <h1>
              <span>↗</span> New Material Issue Voucher
            </h1>
            <p>Select destination, search items to issue, and save the voucher.</p>
          </div>

          <div className="issueHeaderMetrics">
            <span className={`metricPill ${totalSelectedCount > 0 ? "active" : ""}`}>
              <span className="dot" />
              {totalSelectedCount} {totalSelectedCount === 1 ? "Item" : "Items"} Selected ({totalUnitsCount} Units)
            </span>

            <button
              type="button"
              className="catalogBtn"
              onClick={() => setIsCatalogModalOpen(true)}
              title={`Open full catalog of all ${materialCatalog.length} materials`}
            >
              <span>▦</span> Catalog ({materialCatalog.length})
            </button>

            <button
              type="button"
              className="catalogBtn"
              onClick={() => {
                const el = document.getElementById("issue-history-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              title="Scroll down to view recent issue history records"
            >
              <span>📜</span> Issue History
            </button>
          </div>
        </div>

        {/* 2. Issue Information Section */}
        <section className="voucherCard">
          <div className="cardSectionHeader">
            <h2>
              <span>📋</span> Voucher & Destination Information
            </h2>
            <span className="stepBadge active">Step 1 of 2</span>
          </div>

          <div className="voucherGrid">
            {/* Challan No */}
            <div className="fieldGroup">
              <label>
                Challan No <span className="req">*</span>
              </label>
              <input
                type="text"
                value={voucherDetails.challanNo}
                onChange={(e) =>
                  setVoucherDetails((p) => ({ ...p, challanNo: e.target.value }))
                }
                required
              />
            </div>

            {/* Sl / Voucher No */}
            <div className="fieldGroup">
              <label>V / Sl. No</label>
              <input
                type="text"
                value={voucherDetails.slNo}
                onChange={(e) =>
                  setVoucherDetails((p) => ({ ...p, slNo: e.target.value }))
                }
              />
            </div>

            {/* Date */}
            <div className="fieldGroup">
              <label>
                Issue Date <span className="req">*</span>
              </label>
              <input
                type="date"
                value={voucherDetails.date}
                onChange={(e) =>
                  setVoucherDetails((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
            </div>

            {/* Issue / Return Type */}
            <div className="fieldGroup">
              <label>Transaction Type</label>
              <select
                value={voucherDetails.issueType}
                onChange={(e) =>
                  setVoucherDetails((p) => ({ ...p, issueType: e.target.value }))
                }
              >
                <option value="Issue">Issue (Outward)</option>
                <option value="Return">Return (Inward)</option>
              </select>
            </div>

            {/* Material Issued To / Site / Party with smart autocomplete (spans full width) */}
            <div className="fieldGroup span4">
              <label>
                Issued To / Site / Party Destination <span className="req">*</span>
              </label>
              <input
                type="text"
                placeholder="Select site destination, vendor or party..."
                value={voucherDetails.issuedTo}
                onFocus={() => setShowPartySuggestions(true)}
                onChange={(e) => {
                  setVoucherDetails((p) => ({ ...p, issuedTo: e.target.value }));
                  setShowPartySuggestions(true);
                }}
                required
              />
              {showPartySuggestions && knownParties.length > 0 && (
                <ul className="suggestionsList">
                  {knownParties
                    .filter((p) =>
                      p.toLowerCase().includes(voucherDetails.issuedTo.toLowerCase())
                    )
                    .map((party) => (
                      <li
                        key={party}
                        className="suggestionItem"
                        onClick={() => {
                          setVoucherDetails((p) => ({ ...p, issuedTo: party }));
                          setShowPartySuggestions(false);
                        }}
                      >
                        <span>{party}</span>
                        <span style={{ fontSize: "10px", color: "#94a3b8" }}>Select</span>
                      </li>
                    ))}
                </ul>
              )}

              {/* Quick Destination Presets */}
              <div className="quickDestinationsWrap">
                <span className="quickDestLabel">Quick Select:</span>
                {["Central Warehouse", "Main Site Hub", "Vrindavan Site Phase 1", "Site Sector 4", "Direct Site Delivery"].map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    className="quickDestTag"
                    onClick={() => setVoucherDetails((p) => ({ ...p, issuedTo: dest }))}
                  >
                    + {dest}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Search & Add Interface (Core Redesign) */}
        <section className="searchAddSection" ref={dropdownRef}>
          <div className="cardSectionHeader">
            <h2>
              <span className="sectionIconCircle">🔍</span> Add Materials to Issue Voucher
            </h2>
            <span className="stepBadge active">Step 2 of 2</span>
          </div>

          <div className="searchBarWrapper">
            <span className="searchIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="materialSearchInput"
              placeholder={`Search ${materialCatalog.length} materials (e.g. pipe, valve, drill, clamp...)`}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="searchClearBtn"
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : (
              <div className="searchKeyHint">
                <span>Ctrl</span> + <span>K</span>
              </div>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="categoryPills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`catPill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setIsSearchOpen(true);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Recent Items Chips */}
          {recentMaterials.length > 0 && (
            <div className="recentChipsWrapper">
              <span className="recentLabel">Quick Add:</span>
              {recentMaterials.map((matName) => (
                <button
                  key={matName}
                  type="button"
                  className="recentChip"
                  onClick={() => {
                    const found = materialCatalog.find((m) => m.name === matName);
                    if (found) handleAddMaterial(found);
                  }}
                  title="Click to add to voucher"
                >
                  <span>+</span> {matName}
                </button>
              ))}
            </div>
          )}

          {/* Interactive Search Results Dropdown */}
          {isSearchOpen && (
            <div className="searchDropdown">
              <div className="searchDropdownHeader">
                Matching Catalog Materials ({searchResults.length} of {materialCatalog.length})
              </div>

              {searchResults.length === 0 ? (
                <div className="noResultsFound">
                  <p>No materials matching "{searchQuery}"</p>
                  <small style={{ color: "#94a3b8" }}>Try adjusting your search or category filter.</small>
                </div>
              ) : (
                searchResults.map((item, idx) => {
                  const isSelected = selectedMaterials.some((m) => m.name === item.name);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={item.id}
                      className={`searchResultRow ${isHighlighted ? "highlighted" : ""}`}
                      onClick={() => handleAddMaterial(item)}
                    >
                      <div className="searchResultLeft">
                        <div className="searchResultTitle">{item.name}</div>
                        <div className="searchResultMeta">
                          <span className="categoryTag">{item.category}</span>
                          <span>Unit: <strong>{item.unit}</strong></span>
                        </div>
                      </div>

                      <div className="searchResultAction">
                        {isSelected ? (
                          <span className="alreadyAddedBadge">✓ Added (+1)</span>
                        ) : (
                          <button type="button" className="quickAddBtn">
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* 4. Selected Materials Table */}
        <section className="selectedMaterialsCard">
          <div className="selectedHeader">
            <div className="selectedHeaderTitle">
              <span>📦</span> Selected Materials for Issue
              <span className="selectedCountBadge">{totalSelectedCount}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="browseCatalogBtn"
                onClick={() => setIsCatalogModalOpen(true)}
                title="Open full catalog modal"
              >
                <span>▦</span> Catalog
              </button>
              {totalSelectedCount > 0 && (
                <button
                  type="button"
                  className="clearAllBtn"
                  onClick={handleClearAll}
                >
                  ✕ Clear All Items
                </button>
              )}
            </div>
          </div>

          {selectedMaterials.length === 0 ? (
            <div className="emptySelectedState">
              <div className="emptyIconCircle">📥</div>
              <h3>No materials added to this voucher yet</h3>
              <p>
                Use the search box above to quickly find and add items, or click below to browse the complete catalog of 93 materials.
              </p>
              <button
                type="button"
                className="emptyActionBtn"
                onClick={() => setIsCatalogModalOpen(true)}
              >
                <span>▦</span> Open Full Material Catalog
              </button>
            </div>
          ) : (
            <div className="materialsTableContainer">
              <table className="materialsTable">
                <thead>
                  <tr>
                    <th className="itemIndexCol">#</th>
                    <th className="itemDescCol">Material Description & Specification</th>
                    <th>Category</th>
                    <th className="qtyCol">Issue Quantity</th>
                    <th className="unitCol">Unit</th>
                    <th className="actionCol">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMaterials.map((item, index) => {
                    const stockAvail = getStockForItem(item.name);
                    const qtyNum = Number(item.qty) || 0;
                    const shortage = Math.max(0, qtyNum - stockAvail);

                    return (
                      <tr key={item.name}>
                        <td className="itemIndexCol">{index + 1}</td>
                        <td className="itemDescCol">
                          <div className="itemNameText">{item.name}</div>
                          <div className="itemMetaRow" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: stockAvail > 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                              Warehouse Stock: {stockAvail} {item.unit}
                            </span>
                            {shortage > 0 && (
                              <span style={{
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                fontWeight: 700
                              }}>
                                ⚠️ Shortage: {shortage} {item.unit}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="categoryTag">{item.category}</span>
                        </td>
                        <td className="qtyCol">
                          <div className="qtyControlGroup">
                            <button
                              type="button"
                              className="qtyStepperBtn"
                              onClick={() => handleStepQty(item.name, -1)}
                              title="Decrease quantity"
                            >
                              −
                            </button>
                            <input
                              ref={(el) => (qtyInputRefs.current[item.name] = el)}
                              type="number"
                              className="qtyInput"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleQtyChange(item.name, e.target.value)}
                            />
                            <button
                              type="button"
                              className="qtyStepperBtn"
                              onClick={() => handleStepQty(item.name, 1)}
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          {shortage > 0 && stockAvail > 0 && (
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.name, stockAvail)}
                              style={{
                                marginTop: "4px",
                                fontSize: "10px",
                                padding: "2px 6px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "block",
                                width: "100%",
                                textAlign: "center"
                              }}
                              title="Set quantity to maximum available stock in warehouse"
                            >
                              ⚡ Issue Available ({stockAvail})
                            </button>
                          )}
                        </td>
                      <td className="unitCol">
                        <select
                          value={item.unit === "Meter" ? "Meter" : "Pcs"}
                          onChange={(e) => {
                            const newUnit = e.target.value;
                            setSelectedMaterials((prev) =>
                              prev.map((m) =>
                                m.name === item.name ? { ...m, unit: newUnit } : m
                              )
                            );
                          }}
                          style={{
                            padding: "3px 6px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-default)",
                            background: "var(--surface-card, #fff)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <option value="Pcs">Pcs</option>
                          <option value="Meter">Meter</option>
                        </select>
                      </td>
                      <td className="actionCol">
                        <button
                          type="button"
                          className="removeRowBtn"
                          onClick={() => handleRemoveMaterial(item.name)}
                          title="Remove item from issue"
                        >
                          ✕
                        </button>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Footer Summary */}
              <div className="tableSummaryBar">
                <span>
                  Total Line Items: <strong>{totalSelectedCount}</strong>
                </span>
                <span>
                  Aggregate Units to Issue: <strong>{totalUnitsCount}</strong>
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 5. Sticky Action Footer */}
        <div className="actionFooterSticky">
          <div className="footerSummaryText">
            Ready to issue <strong>{totalSelectedCount} materials</strong> ({totalUnitsCount} total units) to{" "}
            <strong>{voucherDetails.issuedTo || "specified site"}</strong>.
          </div>

          <div className="footerActionsGroup">
            <button
              type="button"
              className="secondary"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="saveRecordBtn"
              onClick={handleSaveRecord}
              disabled={isSubmitting || totalSelectedCount === 0}
            >
              <span>✓</span> {isSubmitting ? "Saving Voucher..." : "Save Record"}
            </button>
          </div>
        </div>

        {/* 6. Activity History Table */}
        <div id="issue-history-section" style={{ marginTop: "16px" }}>
          <History
            kind="issue"
            title="Material Issue History"
            refreshTrigger={refreshHistoryTrigger}
          />
        </div>
      </div>

      {/* 7. "Browse All Materials" Catalog Modal */}
      {isCatalogModalOpen && (
        <div
          className="catalogModalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCatalogModalOpen(false);
          }}
        >
          <div className="catalogModalContent">
            <div className="catalogModalHead">
              <div>
                <h2>Complete Material Catalog ({materialCatalog.length} Items)</h2>
                <p>Browse, search, and adjust issue quantities for any material directly.</p>
              </div>
              <button
                type="button"
                className="closeModalBtn"
                onClick={() => setIsCatalogModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="catalogModalToolbar">
              <input
                type="text"
                className="catalogSearchField"
                placeholder="Search catalog by name or category..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
              />

              <div className="categoryPills">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`catPill ${modalCategory === cat ? "active" : ""}`}
                    onClick={() => setModalCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogModalTableWrapper">
              <table className="materialsTable">
                <thead>
                  <tr>
                    <th className="itemIndexCol">#</th>
                    <th className="itemDescCol">Material Name</th>
                    <th>Category</th>
                    <th className="unitCol">Unit</th>
                    <th style={{ width: "140px", textAlign: "right" }}>Issue Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {modalCatalogFiltered.map((mat, idx) => {
                    const currentSelected = selectedMaterials.find((m) => m.name === mat.name);
                    const qtyVal = currentSelected ? currentSelected.qty : "";

                    return (
                      <tr key={mat.id}>
                        <td className="itemIndexCol">{idx + 1}</td>
                        <td className="itemDescCol">
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{mat.name}</span>
                        </td>
                        <td>
                          <span className="categoryTag">{mat.category}</span>
                        </td>
                        <td className="unitCol">{mat.unit}</td>
                        <td style={{ textAlign: "right" }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={qtyVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || Number(val) <= 0) {
                                handleRemoveMaterial(mat.name);
                              } else {
                                if (currentSelected) {
                                  handleQtyChange(mat.name, val);
                                } else {
                                  setSelectedMaterials((prev) => [
                                    {
                                      id: mat.id,
                                      name: mat.name,
                                      category: mat.category,
                                      unit: mat.unit,
                                      qty: val,
                                    },
                                    ...prev,
                                  ]);
                                }
                              }
                            }}
                            style={{
                              width: "80px",
                              height: "34px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              textAlign: "center",
                              fontWeight: 700,
                              background: currentSelected ? "#eef2ff" : "white",
                              color: currentSelected ? "#4338ca" : "#1e293b",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="catalogModalFoot">
              <span style={{ fontSize: "13px", color: "#475467" }}>
                Currently <strong>{totalSelectedCount} items</strong> selected in issue voucher.
              </span>
              <button
                type="button"
                className="primary"
                onClick={() => setIsCatalogModalOpen(false)}
              >
                Done ({totalSelectedCount} Selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
