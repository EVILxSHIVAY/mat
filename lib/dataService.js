"use client";

import { fields } from "@/data/fields";
import { DEFAULT_SUPPLIERS } from "@/data/defaultSuppliers";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";
import { triggerAutoSyncToGoogleSheets } from "@/google_sheets_sync/syncClient";

export { DEFAULT_SUPPLIERS, DEFAULT_VENDORS };

// Local Storage Keys
export const STORAGE_KEYS = {
  SUPPLIERS: "pdv_app_suppliers",
  VENDORS: "pdv_app_vendors",
  PRODUCTS: "pdv_app_products",
  PURCHASES: "pdv_app_purchases",
  ISSUES: "pdv_app_issue",
  CONSUMPTIONS: "pdv_app_consumption",
  BILLS: "pdv_app_bills",
  NEEDED: "pdv_app_material_needed",
  PAYMENTS: "pdv_app_party_payments",
  RETURNS: "pdv_app_returns",
  STOCK_ADJUSTMENTS: "pdv_app_stock_adjustments",
};

// Operational Data Purge Marker Key
const CLEANUP_KEY = "pdv_clean_inventory_v2026_clean_stock";

/**
 * Purge all operational and transactional data across the admin panel
 * (Suppliers, Vendors, Purchases, Issues, Consumptions, Bills, Needed, Payments, Returns, Sheets Registry)
 * Strictly PRESERVES Products Master (STORAGE_KEYS.PRODUCTS) and Inventory.
 */
export function purgeAllOperationalData(syncGoogleSheets = false) {
  if (typeof window === "undefined") return;
  try {
    const emptyKeys = [
      STORAGE_KEYS.SUPPLIERS,
      STORAGE_KEYS.VENDORS,
      STORAGE_KEYS.PURCHASES,
      STORAGE_KEYS.ISSUES,
      STORAGE_KEYS.CONSUMPTIONS,
      STORAGE_KEYS.BILLS,
      STORAGE_KEYS.NEEDED,
      STORAGE_KEYS.PAYMENTS,
      STORAGE_KEYS.RETURNS,
    ];

    emptyKeys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify([]));
    });

    // Reset stock adjustments to empty object so no stock/company appears until added
    localStorage.setItem(STORAGE_KEYS.STOCK_ADJUSTMENTS, JSON.stringify({}));

    // Remove secondary caches and registries
    localStorage.removeItem("pdv_supplier_sheets_registry");
    localStorage.removeItem("pdv_recent_issued_materials");
    localStorage.removeItem("materialflow_real_issue");
    localStorage.removeItem("materialflow_real_consumption");
    localStorage.removeItem("materialflow_real_bills");

    // Mark cleanup done
    localStorage.setItem(CLEANUP_KEY, "true");

    if (syncGoogleSheets) {
      triggerAutoSyncToGoogleSheets();
    }
  } catch (err) {
    console.error("[DataService] Error during operational data purge:", err);
  }
}

/**
 * Auto-cleaner: ensures any existing dummy data in user's browser localStorage
 * is purged once on initial load, leaving inventory and products master intact.
 */
export function ensureOperationalDataCleaned() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(CLEANUP_KEY) !== "true") {
      purgeAllOperationalData(false);
    }
  } catch (err) {
    console.warn("[DataService] Cleanup verification warning:", err);
  }
}

// Safe LocalStorage Reader
export function getStorageData(key, fallback = []) {
  if (typeof window === "undefined") return fallback;
  ensureOperationalDataCleaned();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    console.warn(`[DataService] Error reading ${key}:`, err);
    return fallback;
  }
}

// Safe LocalStorage Writer
export function setStorageData(key, data, autoSync = true) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (autoSync) {
      triggerAutoSyncToGoogleSheets();
    }
  } catch (err) {
    console.error(`[DataService] Error saving ${key}:`, err);
  }
}

/**
 * Infer category and unit for materials from master catalog
 */
export function categorizeMaterial(name = "") {
  const n = String(name).toLowerCase();
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

/**
 * Check if material is an actual pipe (measured in Meter)
 * Excludes tools (wrench, vice, cutter, scraper), fittings (nipple, fitting, plug, coupler), accessories (tape, clamp)
 */
export function isPipe(name = "") {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return false;

  // Items that may contain the word "pipe" but are tools, fittings, hardware, or PPE
  const nonPipeKeywords = [
    "wrench",
    "vice",
    "vise",
    "scrapper",
    "scraper",
    "tape",
    "nipple",
    "cutter",
    "clamp",
    "stand",
    "fitting",
    "die",
    "collet",
    "bushing",
    "thread",
    "seal",
    "plug",
    "adapter",
    "joint",
    "machine",
    "bender",
    "reamer",
    "hook",
    "bracket",
    "gauge",
    "guage",
    "valve",
    "hammer",
    "drill",
    "bit",
    "boot",
    "shoe",
    "helmet",
    "jacket",
    "pump",
    "extinguisher",
    "sleeve",
  ];

  if (nonPipeKeywords.some((kw) => n.includes(kw))) {
    return false;
  }

  return n.includes("pipe");
}

export function inferUnit(name = "") {
  return isPipe(name) ? "Meter" : "Pcs";
}

/**
 * Standard Master Materials Catalog (93 items from Excel Row 1)
 */
export function getMasterMaterialCatalog() {
  const rawList = fields.products || fields.issue?.slice(5) || [];
  return rawList.map((name, idx) => ({
    code: `MAT-${String(idx + 1).padStart(3, "0")}`,
    name,
    category: categorizeMaterial(name),
    unit: inferUnit(name),
    reorderLevel: 20,
    defaultCompany: "",
    defaultRate: 0,
  }));
}

/**
 * Calculate dynamic live inventory stock across all products
 */
export function calculateLiveInventory() {
  const customProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
  const issues = getStorageData(STORAGE_KEYS.ISSUES, []);
  const consumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
  const returns = getStorageData(STORAGE_KEYS.RETURNS, []);
  const masterList = getMasterMaterialCatalog();

  const inventoryMap = new Map();

  // 1. Seed with Master catalog (clean default state: 0 stock, no company until added)
  masterList.forEach((item) => {
    inventoryMap.set(item.name.toLowerCase().trim(), {
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      company: "",
      companies: [],
      rate: 0,
      openingStock: 0,
      totalPurchased: 0,
      totalIssued: 0,
      totalConsumed: 0,
      totalReturned: 0,
      recentPurchases: [],
      recentIssues: [],
      recentConsumptions: [],
    });
  });

  // 2. Add or update with Custom Products added in Product Master
  customProducts.forEach((p, idx) => {
    const name = Array.isArray(p) ? p[1] || p[0] : p.name || p.materialDescription;
    if (!name) return;
    const key = name.toLowerCase().trim();
    const compName = (Array.isArray(p) ? p[5] || p[11] : p.company || p.supplier) || "PDV Central Warehouse";
    const prodRate = Number(Array.isArray(p) ? p[6] : p.rate) || 120;
    const prodUnit = inferUnit(name);

    const existing = inventoryMap.get(key) || {
      code: Array.isArray(p) ? p[0] : p.code || `PRD-${String(idx + 1).padStart(3, "0")}`,
      name,
      category: (Array.isArray(p) ? p[3] : p.category) || categorizeMaterial(name),
      unit: prodUnit,
      reorderLevel: Number(Array.isArray(p) ? p[10] : p.reorderLevel) || 20,
      company: compName,
      companies: [{ name: compName, rate: prodRate, stock: 0, unit: prodUnit }],
      rate: prodRate,
      openingStock: 0,
      totalPurchased: 0,
      totalIssued: 0,
      totalConsumed: 0,
      totalReturned: 0,
      recentPurchases: [],
      recentIssues: [],
      recentConsumptions: [],
    };

    if (Array.isArray(p)) {
      if (p[0]) existing.code = p[0];
      if (p[3]) existing.category = p[3];
      existing.unit = prodUnit;
      if (p[6]) existing.rate = Number(p[6]) || existing.rate;
      if (p[10]) existing.reorderLevel = Number(p[10]) || existing.reorderLevel;
      if (p[5] || p[11]) existing.company = p[5] || p[11];
    } else {
      Object.assign(existing, p);
    }
    inventoryMap.set(key, existing);
  });

  // 3. Process Purchases (Inward) - Group by supplying company
  purchases.forEach((po) => {
    const poSupplier = po.supplier || po.purchaseFrom || (Array.isArray(po) ? po[2] : "") || "PDV Supplier";
    if (po.lineItems && Array.isArray(po.lineItems)) {
      po.lineItems.forEach((item) => {
        const key = (item.materialName || item.name || "").toLowerCase().trim();
        const rec = inventoryMap.get(key);
        const qty = Number(item.quantity || item.qty) || 0;
        const itemRate = Number(item.rate) || (rec ? rec.rate : 0);
        if (rec) {
          rec.totalPurchased += qty;
          rec.recentPurchases.push({
            poNumber: po.piNumber || po.number || po[0],
            date: po.piDate || po.date || po[1],
            supplier: poSupplier,
            quantity: qty,
            rate: itemRate,
          });

          // Maintain company-wise stock from purchases
          if (poSupplier) {
            const existingComp = rec.companies.find(
              (c) => c.name.toLowerCase().trim() === poSupplier.toLowerCase().trim()
            );
            if (existingComp) {
              existingComp.stock += qty;
              if (itemRate > 0) existingComp.rate = itemRate;
            } else {
              rec.companies.push({
                name: poSupplier,
                rate: itemRate,
                stock: qty,
                unit: rec.unit,
              });
            }
          }
        }
      });
    }
  });

  // 4. Process Material Issues (Outward to Site)
  issues.forEach((iss) => {
    const issueItems = iss.items || iss.materials;
    if (issueItems && Array.isArray(issueItems)) {
      issueItems.forEach((item) => {
        const key = (item.name || item.materialName || "").toLowerCase().trim();
        const rec = inventoryMap.get(key);
        const qty = Number(item.qty || item.quantity) || 0;
        if (rec) {
          rec.totalIssued += qty;
          rec.recentIssues.push({
            voucherNo: iss.number || iss.challanNo,
            date: iss.date,
            department: iss.department || iss.issuedTo,
            quantity: qty,
          });
        }
      });
    }
  });

  // 5. Process Consumptions (Tracked at site)
  consumptions.forEach((c) => {
    if (c.items && Array.isArray(c.items)) {
      c.items.forEach((item) => {
        const key = (item.name || item.materialName || "").toLowerCase().trim();
        const rec = inventoryMap.get(key);
        const qty = Number(item.qty || item.quantityUsed || item.qtyUsed) || 0;
        if (rec) {
          rec.totalConsumed += qty;
          rec.recentConsumptions.push({
            consumptionNo: c.number,
            date: c.date,
            department: c.department || c.site,
            quantity: qty,
            usedBy: item.usedBy || c.usedBy,
          });
        }
      });
    } else if (c.materialName) {
      const key = c.materialName.toLowerCase().trim();
      const rec = inventoryMap.get(key);
      const qty = Number(c.quantityUsed) || 0;
      if (rec) {
        rec.totalConsumed += qty;
        rec.recentConsumptions.push({
          consumptionNo: c.number,
          date: c.date,
          department: c.department,
          quantity: qty,
          usedBy: c.usedBy,
        });
      }
    }
  });

  // 6. Process Returns (Inward from site)
  returns.forEach((ret) => {
    const key = (ret.materialName || "").toLowerCase().trim();
    const rec = inventoryMap.get(key);
    const qty = Number(ret.quantity) || 0;
    if (rec) {
      rec.totalReturned += qty;
    }
  });

  // 7. Calculate Available Stock, Status & Company Breakdown for each item
  const stockAdjustments = getStockAdjustments();

  return Array.from(inventoryMap.values()).map((item) => {
    const key = item.name.toLowerCase().trim();
    const codeKey = (item.code || "").toLowerCase().trim();
    const adj = stockAdjustments[key] || (codeKey ? stockAdjustments[codeKey] : null);

    let hasManualOverride = false;
    let companies = [];

    if (adj && Array.isArray(adj.companies)) {
      companies = adj.companies
        .map((c) => ({
          name: (c.name || "").trim(),
          rate: Number(c.rate) >= 0 ? Number(c.rate) : 0,
          stock: Math.max(0, Number(c.stock) || 0),
          unit: c.unit || item.unit,
        }))
        .filter((c) => c.name !== "");
      hasManualOverride = true;
    } else if (item.companies && item.companies.length > 0) {
      companies = item.companies
        .map((c) => ({
          name: (c.name || "").trim(),
          rate: Number(c.rate) >= 0 ? Number(c.rate) : 0,
          stock: Math.max(0, Number(c.stock) || 0),
          unit: c.unit || item.unit,
        }))
        .filter((c) => c.name !== "");
    }

    // Available stock is strictly the sum of entered company stocks
    const available = companies.reduce((sum, c) => sum + (Number(c.stock) || 0), 0);

    let status = "Out of Stock";
    if (available > (item.reorderLevel || 20)) {
      status = "Good";
    } else if (available > 0) {
      status = "Low";
    }

    const effectiveUnit = inferUnit(item.name);

    // Calculate total valuation based on each company's specific rate and quantity
    const totalCompanyValue = companies.reduce(
      (sum, c) => sum + ((Number(c.stock) || 0) * (Number(c.rate) || 0)),
      0
    );

    const primaryCompany = companies[0]?.name || "";
    const companySummary = companies.map((c) => c.name).join(", ");

    return {
      ...item,
      company: companySummary,
      primaryCompany,
      companies: companies.map((c) => ({ ...c, unit: effectiveUnit })),
      unit: effectiveUnit,
      rate: companies.length > 0 ? companies[0].rate : null,
      availableStock: available,
      computedStock: available,
      hasManualOverride,
      lastStockAdjustment: adj || null,
      stockValue: totalCompanyValue,
      status,
    };
  });
}

/**
 * Get all stock adjustments and manual stock counts
 */
export function getStockAdjustments() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STOCK_ADJUSTMENTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("[DataService] Error reading stock adjustments:", err);
    return {};
  }
}

/**
 * Save, edit, or add company stock details for a product.
 * Supports only: Quantity, Company Name, Rate (and unit).
 * Supports editing/changing company name, rate, and quantity later.
 */
export function saveProductCompanyStock(productNameOrCode, {
  companyName,
  rate,
  quantity,
  unit,
  mode = "set", // 'set' sets exact quantity, 'add' adds to existing quantity
  oldCompanyName = null, // provided when editing/renaming an existing company entry
}) {
  if (typeof window === "undefined" || !productNameOrCode) return null;
  try {
    const currentAdjustments = getStockAdjustments();
    const inventory = calculateLiveInventory();
    const key = String(productNameOrCode).toLowerCase().trim();

    const currentItem = inventory.find(
      (p) =>
        p.name.toLowerCase().trim() === key ||
        p.code.toLowerCase().trim() === key
    );

    const storageKey = currentItem ? currentItem.name.toLowerCase().trim() : key;
    const existingAdj = currentAdjustments[storageKey] || {};

    let companies = [];
    if (Array.isArray(existingAdj.companies)) {
      companies = existingAdj.companies.map((c) => ({ ...c }));
    } else if (currentItem && Array.isArray(currentItem.companies)) {
      companies = currentItem.companies.map((c) => ({ ...c }));
    }

    const targetName = String(companyName || "").trim();
    if (!targetName) return null;

    const numQty = Math.max(0, Number(quantity) || 0);
    const numRate = Math.max(0, Number(rate) || 0);
    const itemUnit = inferUnit(currentItem?.name || key);

    if (oldCompanyName) {
      // Editing existing company
      const oldIdx = companies.findIndex(
        (c) => c.name.toLowerCase().trim() === String(oldCompanyName).toLowerCase().trim()
      );
      if (oldIdx >= 0) {
        const prevStock = companies[oldIdx].stock || 0;
        companies[oldIdx] = {
          name: targetName,
          rate: numRate,
          stock: mode === "add" ? Math.max(0, prevStock + numQty) : numQty,
          unit: itemUnit,
        };
      } else {
        companies.push({ name: targetName, rate: numRate, stock: numQty, unit: itemUnit });
      }
    } else {
      // Adding new or updating matched company
      const existingIdx = companies.findIndex(
        (c) => c.name.toLowerCase().trim() === targetName.toLowerCase().trim()
      );
      if (existingIdx >= 0) {
        const prevStock = companies[existingIdx].stock || 0;
        companies[existingIdx].name = targetName;
        companies[existingIdx].rate = numRate;
        companies[existingIdx].stock = mode === "add" ? Math.max(0, prevStock + numQty) : numQty;
        companies[existingIdx].unit = itemUnit;
      } else {
        companies.push({
          name: targetName,
          rate: numRate,
          stock: numQty,
          unit: itemUnit,
        });
      }
    }

    const totalStock = companies.reduce((sum, c) => sum + (Number(c.stock) || 0), 0);

    const newAdjustmentRecord = {
      productName: currentItem?.name || productNameOrCode,
      productCode: currentItem?.code || "",
      manualStock: totalStock,
      companies,
      updatedAt: new Date().toISOString(),
    };

    currentAdjustments[storageKey] = newAdjustmentRecord;
    localStorage.setItem(STORAGE_KEYS.STOCK_ADJUSTMENTS, JSON.stringify(currentAdjustments));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pdv_stock_updated", { detail: newAdjustmentRecord }));
    }

    return newAdjustmentRecord;
  } catch (err) {
    console.error("[DataService] Error saving company stock:", err);
    return null;
  }
}

/**
 * Delete a company entry for a product
 */
export function deleteProductCompany(productNameOrCode, companyNameToDelete) {
  if (typeof window === "undefined" || !productNameOrCode || !companyNameToDelete) return null;
  try {
    const currentAdjustments = getStockAdjustments();
    const inventory = calculateLiveInventory();
    const key = String(productNameOrCode).toLowerCase().trim();

    const currentItem = inventory.find(
      (p) =>
        p.name.toLowerCase().trim() === key ||
        p.code.toLowerCase().trim() === key
    );

    const storageKey = currentItem ? currentItem.name.toLowerCase().trim() : key;
    const existingAdj = currentAdjustments[storageKey] || {};

    let companies = [];
    if (Array.isArray(existingAdj.companies)) {
      companies = existingAdj.companies.map((c) => ({ ...c }));
    } else if (currentItem && Array.isArray(currentItem.companies)) {
      companies = currentItem.companies.map((c) => ({ ...c }));
    }

    const filtered = companies.filter(
      (c) => c.name.toLowerCase().trim() !== String(companyNameToDelete).toLowerCase().trim()
    );

    const totalStock = filtered.reduce((sum, c) => sum + (Number(c.stock) || 0), 0);
    const newRecord = {
      productName: currentItem?.name || productNameOrCode,
      productCode: currentItem?.code || "",
      manualStock: totalStock,
      companies: filtered,
      updatedAt: new Date().toISOString(),
    };

    currentAdjustments[storageKey] = newRecord;
    localStorage.setItem(STORAGE_KEYS.STOCK_ADJUSTMENTS, JSON.stringify(currentAdjustments));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pdv_stock_updated", { detail: newRecord }));
    }

    return newRecord;
  } catch (err) {
    console.error("[DataService] Error deleting company from product:", err);
    return null;
  }
}

/**
 * Remove a specific company from a product's company breakdown (alias for deleteProductCompany)
 */
export function removeProductCompany(productNameOrCode, companyNameToRemove) {
  return deleteProductCompany(productNameOrCode, companyNameToRemove);
}

/**
 * Deduct stock from a specific company for a product when issuing material to vendors
 * @param {string} productNameOrCode
 * @param {string} companyName - target company name (if omitted, deducts from highest available)
 * @param {number} quantity - quantity to deduct
 */
export function deductProductCompanyStock(productNameOrCode, companyName, quantity) {
  if (typeof window === "undefined" || !productNameOrCode) return null;
  try {
    const currentAdjustments = getStockAdjustments();
    const inventory = calculateLiveInventory();
    const key = String(productNameOrCode).toLowerCase().trim();

    const currentItem = inventory.find(
      (p) =>
        p.name.toLowerCase().trim() === key ||
        p.code.toLowerCase().trim() === key
    );

    const storageKey = currentItem ? currentItem.name.toLowerCase().trim() : key;
    const existingAdj = currentAdjustments[storageKey] || {};

    let companies = [];
    if (Array.isArray(existingAdj.companies) && existingAdj.companies.length > 0) {
      companies = existingAdj.companies.map((c) => ({ ...c }));
    } else if (currentItem && Array.isArray(currentItem.companies) && currentItem.companies.length > 0) {
      companies = currentItem.companies.map((c) => ({ ...c }));
    }

    if (companies.length === 0) {
      return null;
    }

    const qtyToDeduct = Math.max(0, Number(quantity) || 0);
    const targetComp = (companyName || "").trim().toLowerCase();

    let targetIdx = -1;
    if (targetComp) {
      targetIdx = companies.findIndex((c) => c.name.toLowerCase().trim() === targetComp);
    }
    if (targetIdx === -1) {
      targetIdx = 0;
      let maxStock = -1;
      companies.forEach((c, idx) => {
        if (Number(c.stock) > maxStock) {
          maxStock = Number(c.stock);
          targetIdx = idx;
        }
      });
    }

    companies[targetIdx].stock = Math.max(0, (Number(companies[targetIdx].stock) || 0) - qtyToDeduct);
    const totalStock = companies.reduce((sum, c) => sum + (Number(c.stock) || 0), 0);

    const newAdjustmentRecord = {
      productName: currentItem?.name || productNameOrCode,
      productCode: currentItem?.code || "",
      manualStock: totalStock,
      companies,
      updatedAt: new Date().toISOString(),
    };

    currentAdjustments[storageKey] = newAdjustmentRecord;
    localStorage.setItem(STORAGE_KEYS.STOCK_ADJUSTMENTS, JSON.stringify(currentAdjustments));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pdv_stock_updated", { detail: newAdjustmentRecord }));
    }

    return newAdjustmentRecord;
  } catch (err) {
    console.error("[DataService] Error deducting company stock:", err);
    return null;
  }
}

/**
 * Compatibility wrapper for updateProductStock
 */
export function updateProductStock(productNameOrCode, {
  companyName = "",
  mode = "set",
  quantity = 0,
  rate,
  unit,
  oldCompanyName = null,
}) {
  return saveProductCompanyStock(productNameOrCode, {
    companyName,
    rate,
    quantity,
    unit,
    mode,
    oldCompanyName,
  });
}

/**
 * Reset manual stock override for a product back to system calculated baseline
 */
export function resetProductStock(productNameOrCode) {
  if (typeof window === "undefined" || !productNameOrCode) return false;
  try {
    const currentAdjustments = getStockAdjustments();
    const inventory = calculateLiveInventory();
    const key = String(productNameOrCode).toLowerCase().trim();
    const currentItem = inventory.find(
      (p) =>
        p.name.toLowerCase().trim() === key ||
        p.code.toLowerCase().trim() === key
    );
    const storageKey = currentItem ? currentItem.name.toLowerCase().trim() : key;

    if (currentAdjustments[storageKey]) {
      delete currentAdjustments[storageKey];
      localStorage.setItem(STORAGE_KEYS.STOCK_ADJUSTMENTS, JSON.stringify(currentAdjustments));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pdv_stock_updated", { detail: { storageKey, reset: true } }));
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error("[DataService] Error resetting product stock:", err);
    return false;
  }
}

/**
 * Get aggregated dashboard statistics
 */
export function getDashboardMetrics() {
  const inventory = calculateLiveInventory();
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
  const issues = getStorageData(STORAGE_KEYS.ISSUES, []);
  const consumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
  const needed = getStorageData(STORAGE_KEYS.NEEDED, []);
  const payments = getStorageData(STORAGE_KEYS.PAYMENTS, []);

  const totalStockValue = inventory.reduce((sum, item) => sum + (item.stockValue || 0), 0);
  const lowStockItems = inventory.filter((item) => item.status === "Low" || item.status === "Critical");
  const pendingRequests = needed.filter(
    (n) => (n.status || "Requested").toLowerCase() !== "issued" && (n.status || "").toLowerCase() !== "completed"
  );

  const totalBilled = payments.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const totalReceived = payments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const totalOutstanding = Math.max(0, totalBilled - totalReceived);

  const totalPurchasedUnits = inventory.reduce((sum, i) => sum + i.totalPurchased, 0);
  const totalIssuedUnits = inventory.reduce((sum, i) => sum + i.totalIssued, 0);
  const totalConsumedUnits = inventory.reduce((sum, i) => sum + i.totalConsumed, 0);
  const remainingSiteUnits = Math.max(0, totalIssuedUnits - totalConsumedUnits);

  const activity = [];

  purchases.forEach((po) => {
    activity.push({
      type: "purchase",
      icon: "▣",
      title: `Purchase ${po.piNumber || po[0] || "PO"}`,
      subtitle: `${po.supplier || po[2] || "Supplier"} · ${po.itemsCount || (po.lineItems ? po.lineItems.length : 1)} items`,
      date: po.piDate || po[1] || "Recent",
      timestamp: new Date(po.piDate || Date.now()).getTime() || Date.now(),
      badge: "Inward",
      badgeType: "approved",
    });
  });

  issues.forEach((iss) => {
    activity.push({
      type: "issue",
      icon: "↗",
      title: `Material Issued ${iss.number || iss.challanNo}`,
      subtitle: `To ${iss.department || iss.issuedTo} · ${iss.itemsCount || (iss.items ? iss.items.length : 1)} items`,
      date: iss.date || "Recent",
      timestamp: new Date(iss.date || Date.now()).getTime() || Date.now(),
      badge: "Dispatched",
      badgeType: "issued",
    });
  });

  consumptions.forEach((c) => {
    activity.push({
      type: "consumption",
      icon: "◔",
      title: `Consumption Recorded ${c.number}`,
      subtitle: `At ${c.department || c.site} · ${c.itemsCount || 1} items`,
      date: c.date || "Recent",
      timestamp: new Date(c.date || Date.now()).getTime() || Date.now(),
      badge: "Consumed",
      badgeType: "completed",
    });
  });

  needed.forEach((req) => {
    activity.push({
      type: "request",
      icon: "📋",
      title: `Material Requisition ${req.materialName}`,
      subtitle: `${req.partyName} · ${req.quantityNeeded} ${req.unit || "Pcs"} (${req.priority || "Normal"})`,
      date: req.requiredByDate || "Pending",
      timestamp: Date.now() - 5000,
      badge: req.priority || "High",
      badgeType: req.priority === "Urgent" ? "danger" : "pending",
    });
  });

  activity.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return {
    totalStockValue,
    totalMaterialsCount: inventory.length,
    lowStockCount: lowStockItems.length,
    lowStockItems: lowStockItems.slice(0, 6),
    pendingRequestsCount: pendingRequests.length,
    pendingRequests: pendingRequests.slice(0, 5),
    totalBilled,
    totalReceived,
    totalOutstanding,
    totalPurchasesCount: purchases.length,
    pendingPurchasesCount: purchases.filter((p) => {
      const stat = (p.status || (Array.isArray(p) ? p[6] : "")).toLowerCase();
      return stat === "pending" || stat === "partial";
    }).length,
    movement: {
      purchased: totalPurchasedUnits,
      issued: totalIssuedUnits,
      consumed: totalConsumedUnits,
      remainingAtSite: remainingSiteUnits,
    },
    recentActivity: activity.slice(0, 8),
  };
}

/**
 * Universal Global Omnisearch across all entities
 */
export function searchAllEntities(query = "") {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  const inventory = calculateLiveInventory();
  const suppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
  const issues = getStorageData(STORAGE_KEYS.ISSUES, []);
  const consumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
  const bills = getStorageData(STORAGE_KEYS.BILLS, []);
  const needed = getStorageData(STORAGE_KEYS.NEEDED, []);

  // 1. Products / Inventory Match
  inventory.forEach((item) => {
    if (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    ) {
      results.push({
        id: `prod-${item.code}`,
        type: "Product / Stock",
        title: item.name,
        subtitle: `${item.availableStock} ${item.unit} available · ${item.category}`,
        badge: item.status,
        badgeType: item.status === "Good" ? "active" : item.status === "Low" ? "pending" : "danger",
        href: `/inventory?highlight=${encodeURIComponent(item.name)}`,
        data: item,
      });
    }
  });

  // 3. Suppliers Match
  suppliers.forEach((sup, idx) => {
    const code = Array.isArray(sup) ? sup[0] : sup.code || `SUP-${idx + 1}`;
    const name = Array.isArray(sup) ? sup[1] : sup.name || "";
    const contact = Array.isArray(sup) ? sup[2] : sup.contactPerson || "";
    if (
      (code && String(code).toLowerCase().includes(q)) ||
      (name && String(name).toLowerCase().includes(q)) ||
      (contact && String(contact).toLowerCase().includes(q))
    ) {
      results.push({
        id: `sup-${code}`,
        type: "Supplier Directory",
        title: name,
        subtitle: `Code: ${code} · Contact: ${contact || "—"}`,
        badge: Array.isArray(sup) ? sup[6] : sup.status || "Active",
        badgeType: "approved",
        href: `/suppliers`,
        data: sup,
      });
    }
  });

  // 4. Material Issues Match
  issues.forEach((iss) => {
    const no = iss.number || iss.challanNo;
    const dept = iss.department || iss.issuedTo;
    if (
      (no && String(no).toLowerCase().includes(q)) ||
      (dept && String(dept).toLowerCase().includes(q))
    ) {
      results.push({
        id: `iss-${no}`,
        type: "Material Issue Voucher",
        title: `Voucher ${no}`,
        subtitle: `Issued to: ${dept || "Site"} · Date: ${iss.date || "—"}`,
        badge: iss.status || "Issued",
        badgeType: "issued",
        href: `/material-requests`,
        data: iss,
      });
    }
  });

  // 5. Consumptions Match
  consumptions.forEach((c) => {
    const no = c.number;
    const dept = c.department || c.site;
    if (
      (no && String(no).toLowerCase().includes(q)) ||
      (dept && String(dept).toLowerCase().includes(q))
    ) {
      results.push({
        id: `con-${no}`,
        type: "Consumption Record",
        title: `Consumption ${no}`,
        subtitle: `Site: ${dept || "—"} · Date: ${c.date || "—"}`,
        badge: "Consumed",
        badgeType: "completed",
        href: `/material-consumption?search=${encodeURIComponent(no)}`,
        data: c,
      });
    }
  });

  // 6. Documents Match
  bills.forEach((b) => {
    const num = b.billNumber || "";
    const sup = b.supplierName || "";
    const file = b.fileName || "";
    if (
      num.toLowerCase().includes(q) ||
      sup.toLowerCase().includes(q) ||
      file.toLowerCase().includes(q)
    ) {
      results.push({
        id: `bill-${b.id || num}`,
        type: "Document / Invoice",
        title: `${b.billType}: ${num}`,
        subtitle: `${sup} · ${b.amount || "—"} · ${file}`,
        badge: b.billType,
        badgeType: "paid",
        href: `/upload?search=${encodeURIComponent(num)}`,
        data: b,
      });
    }
  });

  return results.slice(0, 15);
}


/**
 * Format number or numeric string to INR currency representation
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹ ${num.toLocaleString()}`;
}

/**
 * Get current date string in YYYY-MM-DD format
 */
export function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

/**
 * 📦 Clean Database Snapshot Generator for Google Sheets & Cloud Sync
 * Normalizes all 10 modules so that no nested objects or misaligned columns reach Google Sheets.
 */
export function getDatabaseSnapshot() {
  const inventory = calculateLiveInventory();
  const rawSuppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
  const rawProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
  const rawPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
  const rawIssues = getStorageData(STORAGE_KEYS.ISSUES, []);
  const rawConsumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
  const rawNeeded = getStorageData(STORAGE_KEYS.NEEDED, []);
  const rawPayments = getStorageData(STORAGE_KEYS.PAYMENTS, []);
  const rawReturns = getStorageData(STORAGE_KEYS.RETURNS, []);
  const rawBills = getStorageData(STORAGE_KEYS.BILLS, []);

  // 1. Live Inventory Summary
  const inventoryRows = inventory.map((i) => [
    i.code || "",
    i.name || "",
    i.category || "General",
    Number(i.availableStock || 0),
    i.unit || "Pcs",
    Number(i.reorderLevel || 20),
    Number(i.rate || 0),
    Number(i.stockValue || 0),
    Number(i.openingStock || 0),
    Number(i.totalPurchased || 0),
    Number(i.totalIssued || 0),
    Number(i.totalConsumed || 0),
    Number(i.totalReturned || 0),
    i.status || "Good",
    i.location || "Central Warehouse",
  ]);

  // 2. Suppliers
  const supplierRows = rawSuppliers.map((s, idx) => {
    if (Array.isArray(s)) {
      return [
        s[0] || `SUP-${String(idx + 1).padStart(3, "0")}`,
        s[1] || "",
        s[2] || "",
        s[3] || "",
        s[4] || "",
        s[5] || "",
        s[6] || "Active",
      ];
    }
    return [
      s.code || `SUP-${String(idx + 1).padStart(3, "0")}`,
      s.name || "",
      s.contactPerson || s.contact || "",
      s.mobile || "",
      s.email || "",
      s.gst || "",
      s.status || "Active",
    ];
  });

  // 3. Purchases
  const purchaseRows = rawPurchases.map((p, idx) => {
    if (Array.isArray(p)) {
      return [
        p[0] || `PO-${idx + 1}`,
        p[1] || "",
        p[2] || "",
        p[3] || "—",
        Number(p[4]) || 1,
        p[5] || "—",
        p[6] || "Approved",
        p[7] || "Pending",
        p[8] || "Central Warehouse",
        p[9] || "",
      ];
    }
    return [
      p.piNumber || p.number || `PO-${idx + 1}`,
      p.piDate || p.date || "",
      p.supplier || "",
      p.quotationNumber || "—",
      Number(p.itemsCount || (p.lineItems ? p.lineItems.length : 1)),
      p.totalAmount || "₹ 0",
      p.status || "Approved",
      p.deliveryStatus || "Pending",
      p.location || "Central Warehouse",
      p.remarks || "",
    ];
  });

  // 4. Material Issues
  const issueRows = rawIssues.map((iss, idx) => {
    if (Array.isArray(iss)) {
      return [
        iss[0] || `MIV-${idx + 1}`,
        iss[1] || "",
        iss[2] || "",
        iss[3] || "Central Warehouse",
        Number(iss[4]) || 1,
        iss[5] || "Issued",
        "",
      ];
    }
    const matSummary = iss.items && Array.isArray(iss.items)
      ? iss.items.map((m) => `${m.name} (${m.quantity} ${m.unit || "Pcs"})`).join(", ")
      : "";
    return [
      iss.number || iss.challanNo || `MIV-${idx + 1}`,
      iss.date || "",
      iss.department || iss.issuedTo || iss.party || "Site",
      iss.site || "Central Warehouse",
      Number(iss.itemsCount || (iss.items ? iss.items.length : 1)),
      iss.status || "Issued",
      matSummary,
    ];
  });

  // 5. Material Consumption
  const consumptionRows = rawConsumptions.map((c, idx) => {
    if (Array.isArray(c)) {
      return [
        c[0] || `CON-${idx + 1}`,
        c[1] || "",
        c[2] || "",
        c[3] || "",
        c[4] || "—",
        c[5] || "—",
        Number(c[6]) || 1,
        c[7] || "",
        c[8] || "Consumed",
        "",
      ];
    }
    const itemSummary = c.items && Array.isArray(c.items)
      ? c.items.map((m) => `${m.name} (${m.quantityUsed || m.qty || 0} ${m.unit || "Pcs"})`).join(", ")
      : (c.materialName ? `${c.materialName} (${c.quantityUsed || 0} Pcs)` : "");
    return [
      c.number || `CON-${idx + 1}`,
      c.date || "",
      c.department || c.site || "Site",
      c.site || "",
      c.issueVoucher || "—",
      c.usedBy || "—",
      Number(c.itemsCount || (c.items ? c.items.length : 1)),
      c.remarks || "",
      c.status || "Consumed",
      itemSummary,
    ];
  });

  // 6. Returns & Movements
  const returnRows = rawReturns.map((ret, idx) => {
    if (Array.isArray(ret)) {
      return [
        ret[0] || `RET-${idx + 1}`,
        ret[1] || "",
        ret[2] || "Return to Warehouse",
        ret[3] || "Site",
        ret[4] || "Central Warehouse",
        ret[5] || "",
        Number(ret[6]) || 0,
        ret[7] || "Pcs",
        ret[8] || "",
      ];
    }
    return [
      ret.returnNo || `RET-${idx + 1}`,
      ret.date || "",
      ret.movementType || "Return to Warehouse",
      ret.sourceSite || "Site",
      ret.destinationSite || "Central Warehouse",
      ret.materialName || "",
      Number(ret.quantity) || 0,
      ret.unit || "Pcs",
      ret.reason || "",
    ];
  });

  // 7. Material Requests (Needed)
  const neededRows = rawNeeded.map((n) => [
    n.partyName || n.party || "",
    n.materialName || n.material || "",
    Number(n.quantityNeeded || n.qty || 0),
    n.unit || "Pcs",
    n.requiredByDate || n.date || "",
    n.priority || "High",
    n.status || "Requested",
    n.remarks || "",
  ]);

  // 8. Party Payments & Ledger
  const paymentRows = rawPayments.map((p, idx) => [
    p.partyName || "",
    p.invoiceNo || `INV-${idx + 1}`,
    p.invoiceDate || "",
    Number(p.totalAmount || 0),
    Number(p.amountPaid || 0),
    Number(p.balanceLeft || 0),
    p.paymentMode || "Bank Transfer",
    p.paymentDate || "",
    p.status || "Pending",
  ]);

  // 9. Attached Bills & Documents
  const billRows = rawBills.map((b, idx) => [
    b.billType || "Invoice",
    b.billNumber || `BILL-${idx + 1}`,
    b.supplierName || "—",
    b.billDate || "",
    b.amount || "—",
    b.fileName || "",
    b.fileSize || "",
    b.status || "Verified",
  ]);

  // 10. Master Materials Catalog + Custom
  const masterCatalog = getMasterMaterialCatalog();
  const productRows = masterCatalog.map((m) => [
    m.code,
    m.name,
    m.category,
    m.unit,
    m.reorderLevel,
    m.defaultLocation,
    m.defaultRate,
    "Active",
  ]);
  rawProducts.forEach((p, idx) => {
    if (Array.isArray(p)) {
      productRows.push([
        p[0] || `PRD-${idx + 100}`,
        p[1] || "",
        p[3] || "General",
        inferUnit(p[1]),
        Number(p[10]) || 20,
        p[11] || "Central Warehouse",
        Number(p[6]) || 150,
        p[13] || "Active",
      ]);
    } else if (p.name) {
      productRows.push([
        p.code || `PRD-${idx + 100}`,
        p.name,
        p.category || "General",
        inferUnit(p.name),
        Number(p.reorderLevel) || 20,
        p.location || "Central Warehouse",
        Number(p.rate) || 150,
        p.status || "Active",
      ]);
    }
  });

  return {
    Inventory_Stock: {
      headers: [
        "Material Code",
        "Material Name",
        "Category",
        "Available Stock",
        "Unit",
        "Reorder Level",
        "Unit Rate (₹)",
        "Stock Valuation (₹)",
        "Opening Stock",
        "Total Inward (Purchases)",
        "Total Outward (Issues)",
        "Total Consumed (Site)",
        "Total Returned",
        "Stock Status",
        "Warehouse Location",
      ],
      rows: inventoryRows,
    },
    Purchases: {
      headers: [
        "PI / PO Number",
        "Invoice Date",
        "Supplier / Vendor",
        "Quotation Ref #",
        "Items Count",
        "Total Amount",
        "Status",
        "Delivery Status",
        "Delivery Location",
        "Remarks",
      ],
      rows: purchaseRows,
    },
    Material_Issues: {
      headers: [
        "Challan / Sl No",
        "Date",
        "Party / Department",
        "Site Location",
        "Items Count",
        "Status",
        "Materials Summary",
      ],
      rows: issueRows,
    },
    Material_Consumption: {
      headers: [
        "Consumption No",
        "Date",
        "Department / Contractor",
        "Site Location",
        "Issue Voucher Ref",
        "Supervised / Used By",
        "Items Count",
        "Remarks",
        "Status",
        "Consumed Materials",
      ],
      rows: consumptionRows,
    },
    Material_Returns: {
      headers: [
        "Return #",
        "Date",
        "Movement Type",
        "Source Site",
        "Destination Site",
        "Material Name",
        "Quantity",
        "Unit",
        "Reason / Remarks",
      ],
      rows: returnRows,
    },
    Material_Needed: {
      headers: [
        "Party / Site",
        "Material Required",
        "Quantity Needed",
        "Unit",
        "Required Date",
        "Priority",
        "Status",
        "Remarks",
      ],
      rows: neededRows,
    },
    Party_Payments: {
      headers: [
        "Party / Vendor",
        "Invoice #",
        "Invoice Date",
        "Total Billed (₹)",
        "Amount Paid (₹)",
        "Balance Due (₹)",
        "Payment Mode",
        "Payment Date",
        "Status",
      ],
      rows: paymentRows,
    },
    Suppliers: {
      headers: [
        "Supplier Code",
        "Supplier Name",
        "Contact Person",
        "Mobile Number",
        "Email",
        "GSTIN",
        "Status",
      ],
      rows: supplierRows,
    },
    Products_Master: {
      headers: [
        "Product Code",
        "Material Description",
        "Category",
        "Unit",
        "Reorder Level",
        "Default Location",
        "Standard Rate (₹)",
        "Status",
      ],
      rows: productRows,
    },
    Bills: {
      headers: [
        "Document Type",
        "Invoice / Bill #",
        "Supplier / Vendor",
        "Date",
        "Amount",
        "File Name",
        "File Size",
        "Status",
      ],
      rows: billRows,
    },
  };
}

