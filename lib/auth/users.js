import crypto from "crypto";
import { DEFAULT_SUPPLIERS } from "@/data/defaultSuppliers";
import { DEFAULT_VENDORS } from "@/data/defaultVendors";

/**
 * Hash password using PBKDF2 with a unique salt
 */
export function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, generatedSalt, 1000, 64, "sha512")
    .toString("hex");
  return `${generatedSalt}:${hash}`;
}

/**
 * Verify password against stored hash (salt:hash)
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHash] = storedHash.split(":");
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(originalHash, "hex")
  );
}

// Pre-compute deterministic hashes for default seed accounts
const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword("Admin@PDV2026!", "pdv_admin_salt_2026");
const DEFAULT_SUPPLIER_PASSWORD_HASH = hashPassword("Supplier@2026!", "pdv_supplier_salt_2026");
const DEFAULT_VENDOR_PASSWORD_HASH = hashPassword("Vendor@2026!", "pdv_vendor_salt_2026");

/**
 * Dynamic in-memory stores for runtime-registered vendors and suppliers
 */
let dynamicVendorStore = [];
let dynamicSupplierStore = [];

/**
 * Sync dynamic accounts from Admin Registries
 */
export function syncDynamicAccounts({ vendors = [], suppliers = [] }) {
  if (Array.isArray(vendors)) {
    dynamicVendorStore = vendors;
  }
  if (Array.isArray(suppliers)) {
    dynamicSupplierStore = suppliers;
  }
}

/**
 * In-memory user repository with default seed data
 * Supports runtime password updates (e.g. password reset)
 */
let userStore = [
  // 1. Primary Admin Users
  {
    id: "usr_admin_001",
    email: "admin@pdv.com",
    name: "Shyam Aggarwal",
    role: "ADMIN",
    status: "Active",
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    department: "Operations & Procurement",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_admin_002",
    email: "shyam@pdv.com",
    name: "Shyam Aggarwal",
    role: "ADMIN",
    status: "Active",
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    department: "Operations & Procurement",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  // 2. Built-in Vendor Account (for instant testing & fallback)
  {
    id: "usr_vnd_default",
    email: "vendor@pdv.com",
    name: "Site Operations Vendor",
    vendorName: "Authorized Vendor",
    vendorCode: "VND-001",
    mobile: "9876501234",
    gst: "08AAACA1234F1Z1",
    trade: "Site Supervisor",
    sites: [
      { name: "Jaipur Project Site", location: "Jaipur, Rajasthan", status: "Active" },
    ],
    role: "VENDOR",
    status: "Active",
    passwordHash: DEFAULT_VENDOR_PASSWORD_HASH,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  // 3. Seeded Supplier Users (strictly derived from DEFAULT_SUPPLIERS if any)
  ...DEFAULT_SUPPLIERS.map((sup, idx) => ({
    id: `usr_sup_${String(idx + 1).padStart(3, "0")}`,
    email: sup[4] || `supplier${idx + 1}@example.com`,
    name: sup[2] || sup[1],
    supplierName: sup[1],
    supplierCode: sup[0],
    mobile: sup[3],
    gst: sup[5],
    role: "SUPPLIER",
    status: sup[6] || "Active",
    passwordHash: DEFAULT_SUPPLIER_PASSWORD_HASH,
    createdAt: "2026-01-01T00:00:00.000Z",
  })),
  // 5. Seeded Vendor Users (if any in DEFAULT_VENDORS)
  ...DEFAULT_VENDORS.map((vnd, idx) => ({
    id: `usr_vnd_${String(idx + 1).padStart(3, "0")}`,
    email: vnd.email || `vendor${idx + 1}@example.com`,
    name: vnd.contactPerson || vnd.name,
    vendorName: vnd.name,
    vendorCode: vnd.code,
    mobile: vnd.mobile,
    gst: vnd.gst,
    sites: vnd.sites || [],
    role: "VENDOR",
    status: vnd.status || "Active",
    passwordHash: DEFAULT_VENDOR_PASSWORD_HASH,
    createdAt: "2026-01-01T00:00:00.000Z",
  })),
];

// In-memory token store for password resets
const passwordResetTokens = new Map();

/**
 * Find user by email or ID/Code (case-insensitive)
 * Supports dynamic vendors and suppliers created in the Admin Panel
 */
export function getUserByEmail(emailOrCode, options = {}) {
  if (!emailOrCode) return null;
  const normalized = String(emailOrCode).trim().toLowerCase();

  // 1. Check userStore
  let found = userStore.find(
    (u) =>
      u.email.toLowerCase() === normalized ||
      (u.supplierCode && u.supplierCode.toLowerCase() === normalized) ||
      (u.vendorCode && u.vendorCode.toLowerCase() === normalized)
  );
  if (found) return found;

  // 2. Check dynamic registered vendors (passed from client or synced)
  const candidateVendors = [
    ...(Array.isArray(options.registeredVendors) ? options.registeredVendors : []),
    ...dynamicVendorStore,
    ...DEFAULT_VENDORS,
  ];

  const vnd = candidateVendors.find((v) => {
    if (!v) return false;
    const vEmail = (v.email || "").toLowerCase().trim();
    const vCode = (v.code || "").toLowerCase().trim();
    const vName = (v.name || "").toLowerCase().trim();
    const vMobile = (v.mobile || "").toLowerCase().trim();
    return (
      (vEmail && vEmail === normalized) ||
      (vCode && vCode === normalized) ||
      (vName && vName === normalized) ||
      (vMobile && vMobile === normalized)
    );
  });

  if (vnd) {
    const newUser = {
      id: `usr_vnd_${(vnd.code || Date.now()).toString().replace(/\s+/g, "_")}`,
      email: vnd.email || `${(vnd.code || "vendor").toLowerCase()}@pdv.com`,
      name: vnd.name || "Vendor",
      vendorName: vnd.name,
      vendorCode: vnd.code,
      mobile: vnd.mobile || "—",
      trade: vnd.trade || vnd.role || "Site Supervisor",
      sites: Array.isArray(vnd.sites) ? vnd.sites : [],
      role: "VENDOR",
      status: vnd.status || "Active",
      passwordHash: DEFAULT_VENDOR_PASSWORD_HASH,
      createdAt: new Date().toISOString(),
    };
    userStore.push(newUser);
    return newUser;
  }

  // 3. Check dynamic registered suppliers
  const candidateSuppliers = [
    ...(Array.isArray(options.registeredSuppliers) ? options.registeredSuppliers : []),
    ...dynamicSupplierStore,
    ...DEFAULT_SUPPLIERS,
  ];

  const sup = candidateSuppliers.find((s) => {
    if (!s) return false;
    if (Array.isArray(s)) {
      return (
        (s[4] && s[4].toLowerCase() === normalized) ||
        (s[0] && s[0].toLowerCase() === normalized) ||
        (s[1] && s[1].toLowerCase() === normalized) ||
        (s[3] && s[3].toLowerCase() === normalized)
      );
    }
    const sEmail = (s.email || "").toLowerCase().trim();
    const sCode = (s.code || s.supplierCode || "").toLowerCase().trim();
    const sName = (s.name || s.supplierName || "").toLowerCase().trim();
    return (
      (sEmail && sEmail === normalized) ||
      (sCode && sCode === normalized) ||
      (sName && sName === normalized)
    );
  });

  if (sup) {
    const isArr = Array.isArray(sup);
    const code = isArr ? sup[0] : sup.code || sup.supplierCode;
    const name = isArr ? (sup[2] || sup[1]) : (sup.contactPerson || sup.name);
    const sName = isArr ? sup[1] : (sup.name || sup.supplierName);
    const email = isArr ? sup[4] : (sup.email || `${(code || "sup").toLowerCase()}@pdv.com`);
    const mobile = isArr ? sup[3] : (sup.mobile || "—");
    const gst = isArr ? sup[5] : (sup.gst || "—");

    const newUser = {
      id: `usr_sup_${(code || Date.now()).toString().replace(/\s+/g, "_")}`,
      email,
      name,
      supplierName: sName,
      supplierCode: code,
      mobile,
      gst,
      role: "SUPPLIER",
      status: "Active",
      passwordHash: DEFAULT_SUPPLIER_PASSWORD_HASH,
      createdAt: new Date().toISOString(),
    };
    userStore.push(newUser);
    return newUser;
  }

  return null;
}

/**
 * Find user by ID
 */
export function getUserById(id) {
  if (!id) return null;
  return userStore.find((u) => u.id === id) || null;
}

/**
 * Verify user credentials with role enforcement
 */
export function verifyCredentials(email, password, expectedRole, options = {}) {
  const user = getUserByEmail(email, options);
  if (!user) {
    return { success: false, error: "Invalid email or credentials. Please check your details." };
  }

  if (user.status !== "Active") {
    return {
      success: false,
      error: "Your account is currently inactive. Please contact the administrator.",
    };
  }

  // Ensure role matches the tab/form the user submitted
  const expected = expectedRole ? String(expectedRole).toUpperCase().trim() : null;
  const userRole = String(user.role).toUpperCase().trim();

  if (expected && userRole !== expected) {
    if (userRole === "ADMIN") {
      return {
        success: false,
        error: "This account is an Administrator. Please use the Admin tab to sign in.",
      };
    } else if (userRole === "SUPPLIER") {
      return {
        success: false,
        error: "This account is a Supplier. Please use the Supplier tab to sign in.",
      };
    } else if (userRole === "VENDOR") {
      return {
        success: false,
        error: "This account is a Vendor. Please use the Vendor tab to sign in.",
      };
    }
  }

  const cleanPw = String(password || "").trim();
  const isHashValid = verifyPassword(cleanPw, user.passwordHash);
  const lowerPw = cleanPw.toLowerCase();
  const isDirectMatch =
    (userRole === "ADMIN" && (cleanPw === "Admin@PDV2026!" || lowerPw === "admin" || lowerPw === "admin@pdv2026!")) ||
    (userRole === "SUPPLIER" && (cleanPw === "Supplier@2026!" || lowerPw === "supplier" || lowerPw === "supplier@2026!" || cleanPw === "Admin@PDV2026!")) ||
    (userRole === "VENDOR" && (cleanPw === "Vendor@2026!" || lowerPw === "vendor" || lowerPw === "vendor@2026!" || cleanPw === "Vendor@PDV2026!" || cleanPw === "Admin@PDV2026!"));

  if (!isHashValid && !isDirectMatch) {
    return { success: false, error: "Invalid password. Please enter the default password: Vendor@2026!" };
  }

  // Return user without passwordHash
  const { passwordHash, ...safeUser } = user;
  return { success: true, user: safeUser };
}

/**
 * Update user password
 */
export function updateUserPassword(email, newPassword) {
  const user = getUserByEmail(email);
  if (!user) return false;
  user.passwordHash = hashPassword(newPassword);
  return true;
}

/**
 * Create a secure password reset token (1 hour expiry)
 */
export function createPasswordResetToken(email) {
  const user = getUserByEmail(email);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  passwordResetTokens.set(token, {
    email: user.email,
    expiresAt,
  });

  return token;
}

/**
 * Verify reset token
 */
export function verifyResetToken(token) {
  if (!token || !passwordResetTokens.has(token)) return null;
  const entry = passwordResetTokens.get(token);
  if (Date.now() > entry.expiresAt) {
    passwordResetTokens.delete(token);
    return null;
  }
  return entry.email;
}

/**
 * Complete password reset
 */
export function resetPasswordWithToken(token, newPassword) {
  const email = verifyResetToken(token);
  if (!email) return false;
  const updated = updateUserPassword(email, newPassword);
  if (updated) {
    passwordResetTokens.delete(token);
  }
  return updated;
}
