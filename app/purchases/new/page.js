"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import StepIndicator from "@/components/ui/StepIndicator";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  getMasterMaterialCatalog,
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import "@/components/ui/ui.css";
import "./new-purchase.css";

const PURCHASE_STEPS = [
  { title: "Purchase Details" },
  { title: "Materials & Items" },
  { title: "Payment Info" },
  { title: "Attach Document" },
  { title: "Review & Confirm" },
];

export default function NewPurchasePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [suppliersList, setSuppliersList] = useState([]);
  const [materialCatalog, setMaterialCatalog] = useState([]);

  // Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const [details, setDetails] = useState({
    supplier: "",
    piNumber: `PI-${Date.now().toString().slice(-4)}`,
    piDate: todayStr,
    location: "Central Warehouse",
    quotationNumber: `QT-${Date.now().toString().slice(-3)}`,
    remarks: "",
  });

  // Line items: [{ materialName, unit, quantity, rate, gstPercent, total }]
  const [lineItems, setLineItems] = useState([
    {
      materialName: 'Steel Tube Nipple 2.5"x12" (GI Sleeve)',
      unit: "Pcs",
      quantity: 100,
      rate: 120,
      gstPercent: 18,
      total: 14160,
    },
  ]);

  // Payment state
  const [payment, setPayment] = useState({
    paymentStatus: "Partial", // "Paid" | "Partial" | "Unpaid"
    amountPaid: 5000,
    paymentMode: "Bank Transfer (NEFT/RTGS)",
    paymentDate: todayStr,
  });

  // Document attachment
  const [docFile, setDocFile] = useState(null);
  const [docBase64, setDocBase64] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMaterialCatalog(getMasterMaterialCatalog());
    const storedSuppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
    const supList = [];
    storedSuppliers.forEach((s) => {
      const code = Array.isArray(s) ? s[0] : s?.code;
      const name = Array.isArray(s) ? s[1] : s?.name;
      if (name && !supList.some((item) => item.name === name)) {
        supList.push({ name, code: code || "" });
      }
    });
    setSuppliersList(supList);
    if (!details.supplier && supList.length > 0) {
      setDetails((prev) => ({ ...prev, supplier: supList[0].name, supplierCode: supList[0].code }));
    }

    // Prefill from URL query params (e.g. from Material Requests or shortcut)
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const reqMat = urlParams.get("material");
      const reqQty = Number(urlParams.get("qty")) || 50;
      const rawUnit = urlParams.get("unit");
      const reqUnit = (rawUnit === "Meter" || rawUnit === "Pcs")
        ? rawUnit
        : (reqMat?.toLowerCase().includes("pipe") ? "Meter" : "Pcs");
      const reqLoc = urlParams.get("location");
      if (reqLoc) {
        setDetails((prev) => ({ ...prev, location: reqLoc }));
      }
      if (reqMat) {
        setLineItems([
          {
            materialName: reqMat,
            unit: reqUnit,
            quantity: reqQty,
            rate: 150,
            gstPercent: 18,
            total: Math.round(reqQty * 150 * 1.18),
          },
        ]);
      }
    }
  }, []);

  // Material Line Item Helpers
  const handleAddLineItem = () => {
    const defaultMat = materialCatalog[0] || { name: "GI Pipe 1/2\"", unit: "Meter", defaultRate: 150 };
    const inferredUnit = defaultMat.unit === "Meter" || defaultMat.name.toLowerCase().includes("pipe") ? "Meter" : "Pcs";
    const newItem = {
      materialName: defaultMat.name,
      unit: inferredUnit,
      quantity: 10,
      rate: defaultMat.defaultRate || 100,
      gstPercent: 18,
      total: Math.round(10 * (defaultMat.defaultRate || 100) * 1.18),
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleUpdateLineItem = (index, field, value) => {
    const copy = [...lineItems];
    copy[index][field] = value;

    if (field === "materialName") {
      const found = materialCatalog.find((m) => m.name === value);
      if (found) {
        copy[index].unit = found.unit === "Meter" || found.name.toLowerCase().includes("pipe") ? "Meter" : "Pcs";
        copy[index].rate = found.defaultRate || copy[index].rate;
      } else {
        copy[index].unit = value.toLowerCase().includes("pipe") ? "Meter" : "Pcs";
      }
    }

    const qty = Number(copy[index].quantity) || 0;
    const rate = Number(copy[index].rate) || 0;
    const gst = Number(copy[index].gstPercent) || 0;
    const sub = qty * rate;
    copy[index].total = Math.round(sub + (sub * gst) / 100);

    setLineItems(copy);
  };

  const handleRemoveLineItem = (index) => {
    if (lineItems.length === 1) {
      alert("At least one material line item is required.");
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = lineItems.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
  const totalGst = lineItems.reduce((acc, item) => {
    const itemSub = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    return acc + (itemSub * (Number(item.gstPercent) || 0)) / 100;
  }, 0);
  const grandTotal = Math.round(subtotal + totalGst);

  // File Handler
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF documents are supported for invoices.");
      return;
    }
    setDocFile(file);
    const reader = new FileReader();
    reader.onload = () => setDocBase64(reader.result);
    reader.readAsDataURL(file);
  };

  // Final Confirmation & Submission
  const handleConfirmPurchase = () => {
    if (!details.supplier || !details.piNumber) {
      alert("Supplier and PI Number are required.");
      setCurrentStep(1);
      return;
    }
    if (lineItems.length === 0) {
      alert("Please add at least one material.");
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);

    // 1. Create Purchase Master Record placed by Admin
    const newPurchase = {
      piNumber: details.piNumber,
      piDate: details.piDate,
      supplier: details.supplier,
      supplierCode: details.supplierCode || "",
      quotationNumber: details.quotationNumber,
      itemsCount: lineItems.length,
      totalAmount: `₹ ${grandTotal.toLocaleString()}`,
      orderStatus: "Pending Supplier Approval",
      status: "Pending Supplier Approval",
      deliveryStatus: "Pending",
      location: details.location,
      destinationSite: details.location,
      remarks: details.remarks,
      lineItems: lineItems,
      placedBy: "Admin",
      createdAt: new Date().toISOString(),
      payment: {
        ...payment,
        totalBilled: grandTotal,
        balanceDue: Math.max(0, grandTotal - (Number(payment.amountPaid) || 0)),
      },
    };

    // Array format for backward compatibility with existing tables
    const legacyRow = [
      details.piNumber,
      details.piDate,
      details.supplier,
      details.quotationNumber,
      String(lineItems.length),
      `₹ ${grandTotal.toLocaleString()}`,
      newPurchase.status,
    ];

    // Store in purchases
    const currentPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
    setStorageData(STORAGE_KEYS.PURCHASES, [newPurchase, ...currentPurchases]);

    // 2. If Payment recorded, log into Party Payments ledger
    if (payment.amountPaid > 0) {
      const currentPayments = getStorageData(STORAGE_KEYS.PAYMENTS, []);
      const newPayRecord = {
        id: Date.now(),
        partyName: details.supplier,
        invoiceNo: details.piNumber,
        invoiceDate: details.piDate,
        totalAmount: grandTotal,
        amountPaid: Number(payment.amountPaid) || 0,
        balanceLeft: Math.max(0, grandTotal - (Number(payment.amountPaid) || 0)),
        paymentMode: payment.paymentMode,
        paymentDate: payment.paymentDate,
        status: Number(payment.amountPaid) >= grandTotal ? "Paid" : "Partial",
      };
      setStorageData(STORAGE_KEYS.PAYMENTS, [newPayRecord, ...currentPayments]);
    }

    // 3. If Document attached, save into Bills Vault
    if (docFile && docBase64) {
      const currentBills = getStorageData(STORAGE_KEYS.BILLS, []);
      const newBill = {
        id: Date.now(),
        billType: "Proforma Invoice",
        billNumber: details.piNumber,
        supplierName: details.supplier,
        billDate: details.piDate,
        amount: `₹ ${grandTotal.toLocaleString()}`,
        fileName: docFile.name,
        fileSize: `${(docFile.size / 1024).toFixed(1)} KB`,
        fileData: docBase64,
      };
      setStorageData(STORAGE_KEYS.BILLS, [newBill, ...currentBills]);
    }

    setMessage(`✓ Product request [${details.piNumber}] sent to ${details.supplier}! Supplier has received it in their portal and will approve/fulfill delivery to ${details.location}. Redirecting...`);
    setTimeout(() => {
      router.push("/purchases");
    }, 1200);
  };

  const materialOptions = materialCatalog.map((m) => ({
    value: m.name,
    label: m.name,
    sublabel: `${m.category} · Standard Rate: ₹${m.defaultRate || 100}`,
  }));

  return (
    <Shell>
      <Title
        title="Request Products from Supplier / Purchase Order"
        desc="Place product supply requests to registered suppliers. The supplier receives this request in their portal, approves it, and fulfills delivery to our project site."
      />

      {/* Stepper Header */}
      <StepIndicator
        steps={PURCHASE_STEPS}
        currentStep={currentStep}
        onStepClick={(s) => setCurrentStep(s)}
      />

      {message && (
        <div className="purchaseSuccessBanner animate-fade-in">{message}</div>
      )}

      {/* STEP 1: Purchase Details */}
      {currentStep === 1 && (
        <section className="card formCard animate-fade-in">
          <div className="sectionHead">
            <div>
              <h2>Step 1: Purchase Order & Supplier Assignment</h2>
              <p>Select the registered supplier, purchase order number, and delivery destination site.</p>
            </div>
          </div>

          {suppliersList.length === 0 ? (
            <div
              style={{
                padding: "18px 20px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#991b1b",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>
                  ⚠️ No Registered Suppliers in Directory
                </strong>
                <span style={{ fontSize: "13px" }}>
                  Orders can only be placed to suppliers registered in the Admin Suppliers Directory. Please add a supplier first.
                </span>
              </div>
              <a
                href="/suppliers"
                className="btn btn-primary"
                style={{ textDecoration: "none", fontSize: "13px", padding: "8px 14px", whiteSpace: "nowrap" }}
              >
                + Add Supplier in Directory ➔
              </a>
            </div>
          ) : (
            <div className="formGrid">
              <SearchableSelect
                label="Supplier (from Admin Directory) *"
                required
                options={suppliersList.map((s) => `${s.name}${s.code ? ` (${s.code})` : ""}`)}
                value={
                  details.supplier
                    ? `${details.supplier}${details.supplierCode ? ` (${details.supplierCode})` : ""}`
                    : ""
                }
                onChange={(val) => {
                  const match = suppliersList.find(
                    (s) => `${s.name}${s.code ? ` (${s.code})` : ""}` === val || s.name === val
                  );
                  setDetails({
                    ...details,
                    supplier: match ? match.name : val,
                    supplierCode: match ? match.code : "",
                  });
                }}
                placeholder="Choose registered supplier..."
              />

              <label>
                Purchase / PO Number *
                <input
                  type="text"
                  required
                  value={details.piNumber}
                  onChange={(e) => setDetails({ ...details, piNumber: e.target.value })}
                />
              </label>

              <label>
                Order Date *
                <input
                  type="date"
                  required
                  value={details.piDate}
                  onChange={(e) => setDetails({ ...details, piDate: e.target.value })}
                />
              </label>

              <label>
                Delivery Destination Site *
                <select
                  value={details.location}
                  onChange={(e) => setDetails({ ...details, location: e.target.value })}
                >
                  <option value="Central Warehouse">Central Warehouse (Main)</option>
                  <option value="Jaipur Project Site">Jaipur Project Site</option>
                  <option value="Ajmer City Gas Site">Ajmer City Gas Site</option>
                  <option value="Vrindavan Site A">Vrindavan Site A</option>
                  <option value="Delhi Store & Hub">Delhi Store & Hub</option>
                  <option value="Kosi Kalan Store">Kosi Kalan Store</option>
                </select>
              </label>

              <label>
                Quotation Reference Number
                <input
                  type="text"
                  value={details.quotationNumber}
                  onChange={(e) => setDetails({ ...details, quotationNumber: e.target.value })}
                />
              </label>

              <label>
                Remarks / Delivery Instructions
                <input
                  type="text"
                  placeholder="e.g. Deliver before Friday, unload at Gate 2"
                  value={details.remarks}
                  onChange={(e) => setDetails({ ...details, remarks: e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="stepFooter">
            <button
              type="button"
              className="primary"
              disabled={suppliersList.length === 0 || !details.supplier}
              onClick={() => {
                if (!details.supplier) {
                  alert("Please choose a supplier from the directory.");
                  return;
                }
                setCurrentStep(2);
              }}
            >
              Continue to Materials →
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Materials & Items */}
      {currentStep === 2 && (
        <section className="card formCard animate-fade-in">
          <div className="sectionHead">
            <div>
              <h2>Step 2: Line Items & Materials ({lineItems.length})</h2>
              <p>Add only the materials being purchased with quantity, unit rate, and GST.</p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={handleAddLineItem}
            >
              + Add Another Material
            </button>
          </div>

          {/* Mobile-first compact line items (hidden on desktop, visible <=768px) */}
          <div className="mobileCardList purchaseWizardMobileCards">
            {lineItems.map((item, idx) => {
              const baseAmount = Math.round((Number(item.quantity) || 0) * (Number(item.rate) || 0));
              const gstAmount = Math.round(baseAmount * ((Number(item.gstPercent) || 0) / 100));

              return (
                <div key={idx} className="purchaseItemCard">
                  <div className="purchaseItemCardHeader">
                    <div className="itemCardBadgeRow">
                      <span className="itemCardIndex">#{idx + 1}</span>
                      <span className="itemGstBadge">{item.gstPercent}% GST</span>
                      <span className="itemUnitBadge">{item.unit || "Pcs"}</span>
                    </div>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        className="itemCardDeleteBtn"
                        onClick={() => handleRemoveLineItem(idx)}
                        title="Remove line item"
                        aria-label="Remove item"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Material Description Selector */}
                  <div className="purchaseItemField">
                    <label className="purchaseItemLabel">Material Description</label>
                    <SearchableSelect
                      options={materialOptions}
                      value={item.materialName}
                      onChange={(val) => handleUpdateLineItem(idx, "materialName", val)}
                    />
                  </div>

                  {/* Primary 2-Column Numeric Inputs */}
                  <div className="purchaseItemInputsGrid">
                    <div className="purchaseItemField">
                      <label className="purchaseItemLabel">
                        Quantity ({item.unit || "Pcs"})
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="purchaseNumericInput"
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value)}
                      />
                    </div>

                    <div className="purchaseItemField">
                      <label className="purchaseItemLabel">Unit Rate (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="purchaseNumericInput"
                        value={item.rate}
                        onChange={(e) => handleUpdateLineItem(idx, "rate", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Tap-to-Expand Tax & Specification Details */}
                  <details className="purchaseItemExpandable">
                    <summary className="purchaseItemExpandSummary">
                      <span>⚙️ Tax & Unit Details</span>
                      <span className="expandChevron">▾</span>
                    </summary>
                    <div className="purchaseItemExpandContent">
                      <div className="expandFieldRow">
                        <label className="purchaseItemLabel">GST Rate</label>
                        <select
                          className="purchaseSelectInput"
                          value={item.gstPercent}
                          onChange={(e) => handleUpdateLineItem(idx, "gstPercent", e.target.value)}
                        >
                          <option value="18">18% (Standard)</option>
                          <option value="12">12%</option>
                          <option value="5">5%</option>
                          <option value="0">0% (Nil)</option>
                          <option value="28">28% (Luxury/High)</option>
                        </select>
                      </div>

                      <div className="expandFieldRow">
                        <label className="purchaseItemLabel">Unit of Measure</label>
                        <input
                          type="text"
                          className="purchaseNumericInput"
                          style={{ fontSize: "14px", fontWeight: "normal" }}
                          value={item.unit}
                          onChange={(e) => handleUpdateLineItem(idx, "unit", e.target.value)}
                        />
                      </div>

                      <div className="taxBreakdownStrip">
                        <div className="taxBreakdownCol">
                          <small>Base (Excl. Tax)</small>
                          <b>₹ {baseAmount.toLocaleString()}</b>
                        </div>
                        <div className="taxBreakdownCol">
                          <small>GST ({item.gstPercent}%)</small>
                          <b>+ ₹ {gstAmount.toLocaleString()}</b>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Prominent Subtotal Footer */}
                  <div className="purchaseItemCardFooter">
                    <span className="itemTotalLabel">Calculated Total:</span>
                    <strong className="itemTotalVal">
                      ₹ {(item.total || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tableScroll">
            <table className="lineItemsTable">
              <thead>
                <tr>
                  <th style={{ minWidth: "260px" }}>Material Description</th>
                  <th style={{ width: "90px" }}>Unit</th>
                  <th style={{ width: "110px" }}>Qty</th>
                  <th style={{ width: "120px" }}>Rate (₹)</th>
                  <th style={{ width: "100px" }}>GST %</th>
                  <th style={{ width: "130px" }}>Total (₹)</th>
                  <th style={{ width: "60px" }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <SearchableSelect
                        options={materialOptions}
                        value={item.materialName}
                        onChange={(val) => handleUpdateLineItem(idx, "materialName", val)}
                      />
                    </td>
                    <td>
                      <select
                        style={{ height: "38px", width: "100%", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-default)", background: "var(--surface-card, #fff)", fontWeight: 600 }}
                        value={item.unit === "Meter" ? "Meter" : "Pcs"}
                        onChange={(e) => handleUpdateLineItem(idx, "unit", e.target.value)}
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Meter">Meter</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        style={{ height: "38px" }}
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        style={{ height: "38px" }}
                        value={item.rate}
                        onChange={(e) => handleUpdateLineItem(idx, "rate", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        style={{ height: "38px" }}
                        value={item.gstPercent}
                        onChange={(e) => handleUpdateLineItem(idx, "gstPercent", e.target.value)}
                      >
                        <option value="18">18%</option>
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="0">0%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td>
                      <strong style={{ fontSize: "14px", color: "var(--brand-700)" }}>
                        ₹ {item.total?.toLocaleString() || "0"}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="actionBtn delete"
                        onClick={() => handleRemoveLineItem(idx)}
                        title="Remove line item"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="purchaseTotalsBox">
            <div className="totalsRow">
              <span>Subtotal:</span>
              <strong>₹ {subtotal.toLocaleString()}</strong>
            </div>
            <div className="totalsRow">
              <span>GST Total:</span>
              <strong>₹ {Math.round(totalGst).toLocaleString()}</strong>
            </div>
            <div className="totalsRow grand">
              <span>Grand Total Amount:</span>
              <strong>₹ {grandTotal.toLocaleString()}</strong>
            </div>
          </div>

          <div className="stepFooter">
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setCurrentStep(3)}
            >
              Continue to Payment →
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Payment */}
      {currentStep === 3 && (
        <section className="card formCard animate-fade-in">
          <div className="sectionHead">
            <div>
              <h2>Step 3: Payment & Settlement Status</h2>
              <p>Record initial payment or mark as pending for credit terms.</p>
            </div>
          </div>

          <div className="paymentStatusPicker">
            <label className={`statusOpt ${payment.paymentStatus === "Paid" ? "active" : ""}`}>
              <input
                type="radio"
                name="payStat"
                checked={payment.paymentStatus === "Paid"}
                onChange={() =>
                  setPayment({ ...payment, paymentStatus: "Paid", amountPaid: grandTotal })
                }
              />
              <div>
                <b>Fully Paid</b>
                <small>Full invoice amount settled</small>
              </div>
            </label>

            <label className={`statusOpt ${payment.paymentStatus === "Partial" ? "active" : ""}`}>
              <input
                type="radio"
                name="payStat"
                checked={payment.paymentStatus === "Partial"}
                onChange={() => setPayment({ ...payment, paymentStatus: "Partial" })}
              />
              <div>
                <b>Partially Paid</b>
                <small>Advance / partial payment made</small>
              </div>
            </label>

            <label className={`statusOpt ${payment.paymentStatus === "Unpaid" ? "active" : ""}`}>
              <input
                type="radio"
                name="payStat"
                checked={payment.paymentStatus === "Unpaid"}
                onChange={() =>
                  setPayment({ ...payment, paymentStatus: "Unpaid", amountPaid: 0 })
                }
              />
              <div>
                <b>Unpaid / Credit</b>
                <small>Payment due later on credit terms</small>
              </div>
            </label>
          </div>

          {payment.paymentStatus !== "Unpaid" && (
            <div className="formGrid" style={{ marginTop: "20px" }}>
              <label>
                Amount Paid Now (₹) *
                <input
                  type="number"
                  min="0"
                  max={grandTotal}
                  value={payment.amountPaid}
                  onChange={(e) => setPayment({ ...payment, amountPaid: e.target.value })}
                />
              </label>

              <label>
                Payment Date
                <input
                  type="date"
                  value={payment.paymentDate}
                  onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })}
                />
              </label>

              <label>
                Payment Mode
                <select
                  value={payment.paymentMode}
                  onChange={(e) => setPayment({ ...payment, paymentMode: e.target.value })}
                >
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI / Instant Pay">UPI / Instant Pay</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </label>
            </div>
          )}

          <div className="stepFooter">
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(2)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setCurrentStep(4)}
            >
              Continue to Documents →
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Documents */}
      {currentStep === 4 && (
        <section className="card formCard animate-fade-in">
          <div className="sectionHead">
            <div>
              <h2>Step 4: Attach Vendor Soft Copy</h2>
              <p>Upload PDF invoice, quotation or challan for permanent audit trail.</p>
            </div>
          </div>

          <div className="docUploadBox">
            <div className="uploadIcon">📄</div>
            <h3>Drag & Drop PDF Invoice Here</h3>
            <p>Or browse your computer to attach</p>
            <label className="btn btn-secondary" style={{ cursor: "pointer", marginTop: "10px" }}>
              Choose PDF File
              <input
                hidden
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFile}
              />
            </label>
            {docFile && (
              <div className="attachedFileBadge">
                <span>📎 {docFile.name}</span>
                <small>({(docFile.size / 1024).toFixed(1)} KB)</small>
                <button
                  type="button"
                  className="clearBtn"
                  onClick={() => {
                    setDocFile(null);
                    setDocBase64("");
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="stepFooter">
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(3)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setCurrentStep(5)}
            >
              Review & Finalize →
            </button>
          </div>
        </section>
      )}

      {/* STEP 5: Review & Confirm */}
      {currentStep === 5 && (
        <section className="card formCard animate-fade-in">
          <div className="sectionHead">
            <div>
              <h2>Step 5: Review Purchase Order Summary</h2>
              <p>Check all details before saving and incrementing warehouse inventory.</p>
            </div>
          </div>

          <div className="reviewSummaryGrid">
            <div className="reviewSummaryCard">
              <span className="summaryLabel">SUPPLIER</span>
              <strong className="summaryVal">{details.supplier}</strong>
              <small>Destination: {details.location}</small>
            </div>

            <div className="reviewSummaryCard">
              <span className="summaryLabel">PI NUMBER & DATE</span>
              <strong className="summaryVal">{details.piNumber}</strong>
              <small>{details.piDate}</small>
            </div>

            <div className="reviewSummaryCard">
              <span className="summaryLabel">LINE ITEMS</span>
              <strong className="summaryVal">{lineItems.length} Materials</strong>
              <small>Total Units: {lineItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}</small>
            </div>

            <div className="reviewSummaryCard">
              <span className="summaryLabel">SETTLEMENT</span>
              <strong className="summaryVal">₹ {grandTotal.toLocaleString()}</strong>
              <small>Status: {payment.paymentStatus}</small>
            </div>
          </div>

          <h3 style={{ fontSize: "14px", marginTop: "20px", marginBottom: "10px" }}>
            Included Materials
          </h3>
          {/* Mobile-first review item cards */}
          <div className="mobileCardList">
            {lineItems.map((item, idx) => (
              <div key={idx} className="mobileDataCard" style={{ padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <strong style={{ fontSize: "13.5px" }}>{item.materialName}</strong>
                  <strong style={{ fontSize: "13.5px", color: "var(--brand-700)" }}>
                    ₹ {item.total.toLocaleString()}
                  </strong>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                  <span>Qty: <b>{item.quantity} {item.unit}</b></span>
                  <span>Rate: ₹ {item.rate}</span>
                  <span>GST: {item.gstPercent}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tableScroll">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{item.materialName}</strong></td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>₹ {item.rate}</td>
                    <td>{item.gstPercent}%</td>
                    <td><strong>₹ {item.total.toLocaleString()}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="stepFooter" style={{ marginTop: "24px" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(4)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="primary"
              style={{ minWidth: "180px" }}
              disabled={isSubmitting}
              onClick={handleConfirmPurchase}
            >
              {isSubmitting ? "Sending Request..." : "🚀 Send Product Request to Supplier"}
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
