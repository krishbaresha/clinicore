import { z } from "zod";

/**
 * Standardized Canonical Zod Schemas for CliniCore / ClinicFlow
 * 25 Domain Entities & Anti-Guess Type-Safe Payload Validation Engine
 */

// ── 1. Clinic Schema ──
export const clinicSchema = z.object({
  id: z.string().optional().default("clinic_001"),
  name: z.string().min(1, "Clinic name is required."),
  logo_url: z.string().optional().default(""),
  address: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  default_consultation_fee: z.number().nonnegative().optional().default(500),
  clinic_status: z.enum(["open", "closed", "break"]).optional().default("open"),
  clinic_status_note: z.string().optional().default(""),
  public_notice: z.string().optional().default(""),
  notification_email: z.string().optional().default(""),
  report_frequency: z.string().optional().default("daily_9pm"),
  whatsapp_gateway_no: z.string().optional().default(""),
  created_at: z.string().optional(),
});

// ── 2. User & Role Schema ──
export const roleEnum = z.enum([
  "owner",
  "doctor",
  "receptionist",
  "pharmacist",
  "cashier",
  "warehouse_incharge",
  "warehouse_manager",
  "b2b_salesman",
  "accountant",
  "manager",
  "admin",
]);

export const userInputSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7, "Phone must be at least 7 digits."),
  role: roleEnum.default("receptionist"),
  specialization: z.string().optional().default("General Physician"),
  is_owner: z.boolean().optional().default(false),
  can_view_financials: z.boolean().optional().default(false),
  assigned_warehouse_id: z.string().nullable().optional().default(null),
  consultation_fee: z.number().nonnegative().optional().default(500),
  room_number: z.string().optional().default(""),
  status: z.enum(["active", "inactive", "deactivated"]).optional().default("active"),
  password: z.string().optional(),
});

export const userSchema = userInputSchema.extend({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  created_at: z.string().optional(),
  deactivated_at: z.string().nullable().optional(),
});

// ── 3. Permission Schema ──
export const permissionCapabilityEnum = z.enum([
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "financial_view",
  "export",
  "stock_adjust",
  "ledger_adjust",
  "admin",
]);

export const permissionSchema = z.object({
  role: roleEnum,
  entity: z.string(),
  capabilities: z.array(permissionCapabilityEnum),
});

// ── 4. Patient Schema ──
export const patientInputSchema = z.object({
  full_name: z
    .string({ required_error: "Full name is required." })
    .trim()
    .min(2, "Full name must be at least 2 characters."),
  relation_name: z.string().trim().optional().default(""),
  relation_type: z
    .string()
    .optional()
    .default("father"),
  phone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).trim())
    .refine((val) => val.length >= 7, "Phone number must be at least 7 digits."),
  age: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : Math.max(0, Math.min(130, Math.floor(num)));
    }),
  gender: z.enum(["male", "female", "other"]).nullable().optional().default("male"),
  cnic: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default("Hyderabad"),
  dob: z.string().optional().nullable(),
  notes: z.string().trim().optional().default(""),
});

export const patientSchema = patientInputSchema.extend({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  mr_number: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ── 5. Visit / OPD Queue Schema ──
export const visitInputSchema = z.object({
  patient_id: z.string({ required_error: "Patient ID is required." }).min(1),
  doctor_id: z.string().optional().default("user_001"),
  visit_type: z.enum(["new", "first_visit", "follow_up", "emergency", "routine"]).default("first_visit"),
  fee_amount: z
    .union([z.number(), z.string()])
    .transform((val) => Math.max(0, Number(val) || 0)),
  discount_amount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  payment_method: z.enum(["cash", "online", "card", "free"]).default("cash"),
  referred_by: z.string().trim().optional().default(""),
  services: z.array(z.any()).optional().default([]),
  symptoms: z.string().optional().default(""),
  diagnosis: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  vitals_bp: z.string().optional().default(""),
  vitals_pulse: z.string().optional().default(""),
  vitals_temp: z.string().optional().default(""),
  vitals_spo2: z.string().optional().default(""),
  vitals_weight: z.string().optional().default(""),
});

export const visitSchema = visitInputSchema.extend({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  token_number: z.number().int().positive(),
  status: z.enum([
    "waiting",
    "in_consultation",
    "completed",
    "completed_reports_pending",
    "skipped",
    "skipped_reissued",
  ]).default("waiting"),
  visit_date: z.string(),
  net_fee: z.number().nonnegative(),
  fee_status: z.enum(["paid", "unpaid"]).default("paid"),
  prescription_image_url: z.string().nullable().optional(),
  report_image_urls: z.array(z.string()).optional().default([]),
  treatment_json: z.any().optional(),
  called_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

// ── 6. Prescription Item Schema ──
export const prescriptionItemSchema = z.object({
  medicine_name: z.string().min(1, "Medicine name is required."),
  potency: z.string().optional().default(""),
  dosage: z.string().optional().default("10 drops"),
  frequency: z.string().optional().default("TDS (3 times daily)"),
  duration: z.string().optional().default("7 days"),
  instructions: z.string().optional().default("Before meals in little water"),
});

// ── 7. Inventory Item & Multi-Warehouse Stock Schema ──
export const inventoryItemSchema = z.object({
  medicine_name: z
    .string({ required_error: "Medicine name is required." })
    .trim()
    .min(1, "Medicine name is required."),
  company_name: z.string().trim().optional().default("BM Pvt LTD"),
  item_code: z.string().trim().optional().default(""),
  generic_name: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default("Homeopathic Drops"),
  unit_price: z
    .union([z.number(), z.string()])
    .transform((val) => Math.max(0, Number(val) || 0)),
  unit_sale_price: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  cost_price_per_box: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  box_sale_price: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  strip_sale_price: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  stock_qty: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  store_stock: z.number().nonnegative().optional().default(0),
  warehouse_stock: z.number().nonnegative().optional().default(0),
  total_base_stock: z.number().nonnegative().optional().default(0),
  location_stocks: z.record(z.string(), z.number()).optional().default({}),
  low_stock_threshold: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 6)),
  unit_label: z.string().trim().optional().default("Bottle"),
  box_label: z.string().trim().optional().default("Pack"),
  strip_label: z.string().trim().optional().default("Bottle"),
  strips_per_box: z.number().positive().optional().default(1),
  units_per_strip: z.number().positive().optional().default(1),
  has_multi_unit: z.boolean().optional().default(false),
  barcode: z.string().trim().optional().default(""),
  expiry_date: z.string().optional().default("2028-12-31"),
  status: z.enum(["active", "inactive", "discontinued"]).optional().default("active"),
});

export const inventorySchema = inventoryItemSchema.extend({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ── 8. Medicine Batch Schema ──
export const medicineBatchStatusEnum = z.enum([
  "active",
  "near_expiry",
  "expired",
  "quarantined",
  "depleted",
]);

export const medicineBatchSchema = z.object({
  id: z.string().optional(),
  clinic_id: z.string().optional().default("clinic_001"),
  inventory_id: z.string().min(1, "Inventory ID is required."),
  medicine_name: z.string().optional().default(""),
  company_name: z.string().optional().default(""),
  item_code: z.string().optional().default(""),
  batch_no: z.string().min(1, "Batch number is required."),
  manufacturing_date: z.string().optional(),
  expiry_date: z.string().min(1, "Expiry date is required."),
  cost_price: z.number().nonnegative().default(0),
  sale_price: z.number().nonnegative().default(0),
  initial_quantity: z.number().nonnegative().optional().default(0),
  quantity_base_units: z.number().int().nonnegative().default(0),
  location_quantities: z.record(z.string(), z.number().nonnegative()).optional().default({}),
  supplier_id: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  purchase_invoice_no: z.string().nullable().optional(),
  status: medicineBatchStatusEnum.optional().default("active"),
  is_quarantined: z.boolean().optional().default(false),
  quarantine_reason: z.string().nullable().optional().default(null),
  quarantined_at: z.string().nullable().optional().default(null),
  quarantined_by: z.string().nullable().optional().default(null),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ── 9. Warehouse / Godown Schema ──
export const warehouseSchema = z.object({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  code: z.string().min(1, "Warehouse code is required."),
  name: z.string().min(1, "Warehouse name is required."),
  nickname: z.string().optional().default(""),
  location: z.string().optional().default(""),
  incharge_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  is_default: z.boolean().optional().default(false),
  is_store_counter: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  created_at: z.string().optional(),
});

// ── 10. Immutable Stock Movement Schema ──
export const stockMovementTypeEnum = z.enum([
  "opening",
  "purchase",
  "transfer_in",
  "transfer_out",
  "sale",
  "return",
  "adjustment",
  "damage",
  "expiry",
]);

export const stockMovementSchema = z.object({
  movement_id: z.string(),
  sequence_no: z.number().int().positive(),
  timestamp: z.string(),
  prev_hash: z.string(),
  hash: z.string(),
  inventory_id: z.string(),
  medicine_name: z.string(),
  company_name: z.string().optional().default(""),
  item_code: z.string().optional().default(""),
  movement_type: stockMovementTypeEnum,
  direction: z.enum(["IN", "OUT"]),
  source_location_id: z.string(),
  destination_location_id: z.string(),
  selected_unit_type: z.enum(["unit", "strip", "box"]).default("unit"),
  qty_selected_unit: z.number().positive(),
  qty_base_units: z.number().positive(),
  rate_per_base_unit: z.number().nonnegative().default(0),
  gross_amount: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  net_amount: z.number().nonnegative().default(0),
  source_voucher_type: z.string().default("MANUAL"),
  source_voucher_no: z.string().default(""),
  source_voucher_id: z.string().default(""),
  actor_id: z.string().optional().default("system"),
  actor_name: z.string().optional().default("System"),
  notes: z.string().optional().default(""),
});

// ── 11. Stock Transfer Schema ──
export const stockTransferItemSchema = z.object({
  inventory_id: z.string().min(1),
  medicine_name: z.string(),
  qty: z.number().positive(),
  unit_type: z.enum(["unit", "strip", "box"]).default("unit"),
  base_units: z.number().positive(),
});

export const stockTransferSchema = z.object({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  transfer_no: z.string(),
  from_warehouse_id: z.string(),
  to_warehouse_id: z.string(),
  items: z.array(stockTransferItemSchema).min(1, "At least one item is required."),
  status: z.enum(["pending", "in_transit", "completed", "received", "dispatched", "cancelled"]).default("pending"),
  transfer_date: z.string(),
  notes: z.string().optional().default(""),
  transferred_by: z.string().optional().default(""),
  received_by: z.string().nullable().optional(),
});

// ── 12. Supplier Schema ──
export const supplierSchema = z.object({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  supplier_code: z.string().min(1, "Supplier code is required."),
  name: z.string().min(2, "Company name is required."),
  company_name: z.string().optional().default(""),
  contact_person: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  city: z.string().optional().default("Hyderabad"),
  address: z.string().optional().default(""),
  current_balance: z.number().optional().default(0),
  balance_due: z.number().optional().default(0),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  created_at: z.string().optional(),
});

// ── 13. Purchase GRN Schema ──
export const purchaseItemSchema = z.object({
  inventory_id: z.string(),
  medicine_name: z.string(),
  company_name: z.string().optional().default(""),
  batch_no: z.string().optional().default(""),
  expiry_date: z.string().optional().default(""),
  box_qty: z.number().nonnegative().default(0),
  strip_qty: z.number().nonnegative().default(0),
  unit_qty: z.number().nonnegative().default(0),
  qty_base_units: z.number().positive(),
  cost_price_per_box: z.number().nonnegative(),
  line_total: z.number().nonnegative(),
});

export const purchaseInputSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required."),
  supplier_name: z.string().optional().default(""),
  destination_id: z.string().optional().default("wh_001"),
  destination_type: z.enum(["store", "warehouse"]).default("warehouse"),
  bill_no: z.string().optional().default(""),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required."),
  subtotal: z.number().nonnegative(),
  discount_amount: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative().default(0),
  balance_due: z.number().nonnegative().default(0),
  payment_mode: z.enum(["Cash", "Credit", "Cheque", "Bank Transfer"]).default("Cash"),
  purchase_date: z.string().optional(),
  notes: z.string().optional().default(""),
});

// ── 14. POS & B2B Sale Schemas ──
export const posSaleItemSchema = z.object({
  inventory_id: z.string().min(1),
  medicine_name: z.string(),
  selected_unit_type: z.enum(["unit", "strip", "box"]).default("unit"),
  quantity: z.number().positive(),
  base_units_deducted: z.number().positive(),
  unit_price: z.number().nonnegative(),
  disc_pct: z.number().min(0).max(100).optional().default(0),
  disc_flat: z.number().nonnegative().optional().default(0),
  line_total: z.number().nonnegative(),
});

export const b2bSaleItemSchema = z.object({
  inventory_id: z.string().min(1),
  medicine_name: z.string(),
  batch_no: z.string().optional().default(""),
  expiry_date: z.string().optional().default(""),
  qty_boxes: z.number().positive(),
  base_units_deducted: z.number().positive(),
  box_sale_price: z.number().nonnegative(),
  item_discount_pct: z.number().min(0).max(100).default(0),
  line_total: z.number().nonnegative(),
});

export const recordSaleSchema = z.union([
  z.object({
    inventory_id: z.string({ required_error: "Inventory ID is required." }).min(1),
    quantity_sold: z
      .union([z.number(), z.string()])
      .transform((val) => Math.max(1, parseInt(String(val), 10) || 1)),
    linked_visit_id: z.string().nullable().optional(),
    selected_unit_type: z.enum(["unit", "strip", "box"]).optional().default("unit"),
  }),
  z.object({
    items: z.array(z.any()).min(1, "At least one item is required in cart."),
    total_amount: z.union([z.number(), z.string()]).transform((val) => Number(val) || 0),
    payment_mode: z.string().optional().default("Cash"),
    paid_amount: z.union([z.number(), z.string()]).optional(),
    discount_amount: z.union([z.number(), z.string()]).optional(),
    patient_id: z.string().nullable().optional(),
    linked_visit_id: z.string().nullable().optional(),
  }),
]);

export const b2bSaleInputSchema = z.object({
  party_id: z.string().min(1, "Customer party is required."),
  salesman_id: z.string().optional().default(""),
  warehouse_id: z.string().optional().default("wh_001"),
  items: z.array(b2bSaleItemSchema).min(1, "At least one item is required."),
  subtotal: z.number().nonnegative(),
  trade_discount_pct: z.number().min(0).max(100).default(0),
  trade_discount_rs: z.number().nonnegative().default(0),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative().default(0),
  balance_due: z.number().nonnegative().default(0),
  payment_mode: z.enum(["Party Udhaar (Credit)", "Full Cash In Hand", "Cheque / Bank Transfer"]).default("Full Cash In Hand"),
  cheque_no: z.string().optional().default(""),
  bank_name: z.string().optional().default(""),
  cheque_clearance_date: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

// ── 15. Wholesale Party Schema ──
export const partySchema = z.object({
  id: z.string(),
  clinic_id: z.string().optional().default("clinic_001"),
  party_code: z.string().min(1, "Party code is required."),
  party_name: z.string().min(2, "Party name is required."),
  city: z.string().optional().default("Hyderabad"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  salesman_id: z.string().optional().default(""),
  credit_limit: z.number().nonnegative().optional().default(100000),
  current_balance: z.number().optional().default(0),
  balance_due: z.number().optional().default(0),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  created_at: z.string().optional(),
});

// ── 16. Patient & Supplier Ledger Schemas ──
export const patientLedgerTransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  type: z.enum(["debit", "credit"]),
  collected_by: z.string().optional().default("Cashier"),
});

export const patientLedgerSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  patient_name: z.string(),
  total_credit: z.number().nonnegative().default(0),
  total_paid: z.number().nonnegative().default(0),
  balance_due: z.number().default(0),
  transactions: z.array(patientLedgerTransactionSchema).default([]),
});

export const supplierLedgerSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  supplier_name: z.string(),
  supplier_code: z.string().optional().default(""),
  invoice_no: z.string().optional().default(""),
  type: z.string(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  running_balance: z.number().default(0),
  notes: z.string().optional().default(""),
  created_at: z.string().optional(),
});

// ── 17. Pharmacy & Clinic Expense Schema ──
export const pharmacyExpenseSchema = z.object({
  amount: z
    .union([z.number(), z.string()], { required_error: "Expense amount is required." })
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val > 0, "Valid amount greater than 0 is required."),
  description: z.string().trim().optional().default("General Store Expense"),
  category: z.string().trim().optional().default("Utilities"),
  paid_to: z.string().trim().optional().default(""),
  payment_mode: z.string().optional().default("Cash"),
  warehouse_id: z.string().optional().default("wh_str"),
  date: z.string().optional(),
});

// ── 18. CashBook / Payment Entry Schema ──
export const cashBookEntrySchema = z.object({
  type: z.union([
    z.enum(["Receipt", "Payment", "Transfer", "Receive", "Paid"]),
    z.string().transform((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()),
  ]),
  amount: z
    .union([z.number(), z.string()], { required_error: "Amount is required." })
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val > 0, "Amount must be greater than 0."),
  party_id: z.string().trim().optional().default(""),
  party_name: z.string().trim().optional().default(""),
  account_name: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default("General"),
  description: z.string().trim().optional().default(""),
  naration: z.string().trim().optional().default(""),
  payment_mode: z.string().optional().default("Cash"),
  voucher_no: z.string().optional(),
  date: z.string().optional(),
});

// ── 19. Universal Financial Transaction & Day Closing Schemas ──
export const universalTransactionTypeEnum = z.enum([
  "SALE",
  "PURCHASE",
  "PAYMENT_IN",
  "PAYMENT_OUT",
  "EXPENSE",
  "OPD_FEE",
  "REFUND",
  "ADJUSTMENT",
  "REVERSAL",
]);

export const universalTransactionSchema = z.object({
  id: z.string(),
  entry_no: z.string(),
  date: z.string(),
  transaction_type: universalTransactionTypeEnum,
  account_debit: z.string().default("Cash In Hand"),
  account_credit: z.string().default("General Revenue"),
  amount: z.number().positive(),
  source_module: z.enum(["pos", "b2b", "opd", "purchases", "expenses", "cashbook", "shift", "reversal"]),
  source_reference_id: z.string().default(""),
  voucher_no: z.string().default(""),
  party_id: z.string().nullable().optional(),
  party_name: z.string().optional().default(""),
  actor_id: z.string().default("system"),
  actor_name: z.string().default("System"),
  status: z.enum(["posted", "reversed", "reversal_entry"]).default("posted"),
  reversal_of_id: z.string().nullable().optional(),
  narration: z.string().default(""),
  hash: z.string().optional(),
});

export const shiftClosingSchema = z.object({
  id: z.string(),
  shift_date: z.string().optional(),
  date: z.string().optional(),
  warehouse_id: z.string().optional().default("wh_str"),
  cashier_id: z.string().optional().default(""),
  cashier_name: z.string().optional().default("Cashier"),
  closed_by: z.string().optional().default("Cashier"),
  opening_cash: z.number().nonnegative().default(0),
  system_cash_sales: z.number().nonnegative().default(0),
  pharmacy_sales: z.number().nonnegative().default(0),
  wholesale_sales: z.number().nonnegative().default(0),
  opd_fee_collection: z.number().nonnegative().default(0),
  opd_fees: z.number().nonnegative().default(0),
  total_inflow: z.number().nonnegative().default(0),
  cash_expenses: z.number().nonnegative().default(0),
  expenses: z.number().nonnegative().default(0),
  supplier_payments: z.number().nonnegative().default(0),
  returns_refunds: z.number().nonnegative().default(0),
  total_outflow: z.number().nonnegative().default(0),
  expected_cash: z.number().default(0),
  actual_cash_counted: z.number().nonnegative().default(0),
  physical_cash: z.number().nonnegative().default(0),
  variance: z.number().default(0),
  cash_variance: z.number().default(0),
  denominations: z.record(z.any()).optional().default({}),
  notes: z.string().optional().default(""),
  closed_at: z.string().optional(),
  is_locked: z.boolean().optional().default(true),
});

// ── 20. Audit Event Schema ──
export const auditEventSchema = z.object({
  id: z.string(),
  actor_id: z.string().default("system"),
  actor_name: z.string().default("System"),
  role: z.string().default("system"),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().default(""),
  timestamp: z.string(),
  before: z.any().nullable().optional(),
  after: z.any().nullable().optional(),
  reason: z.string().default(""),
  device_id: z.string().optional().default(""),
  session_token: z.string().optional().default(""),
  prev_hash: z.string().default("GENESIS_CLINICFLOW_2026"),
  hash: z.string(),
});

// ── 21. Sync Mutation & Outbox Schema ──
export const syncMutationStatusEnum = z.enum([
  "pending",
  "sending",
  "confirmed",
  "failed",
  "conflict",
  "dead_letter",
]);

export const syncMutationSchema = z.object({
  mutation_id: z.string().optional(),
  id: z.string().optional(), // Backwards compatibility
  entity: z.string().default("general"),
  entity_id: z.string().default(""),
  operation: z.enum(["INSERT", "UPDATE", "DELETE", "EXECUTE"]).default("UPDATE"),
  action_type: z.string().optional(), // Backwards compatibility
  payload: z.any(),
  status: syncMutationStatusEnum.default("pending"),
  created_at: z.string().optional(),
  device_id: z.string().default("dev_node_01"),
  user_id: z.string().default("system"),
  retry_count: z.number().int().nonnegative().default(0),
  last_error: z.string().nullable().optional().default(null),
  server_version: z.number().int().nullable().optional().default(null),
});

// ── 22. Document Upload Schema ──
export const documentUploadSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  visit_id: z.string().nullable().optional(),
  name: z.string().min(1, "File title is required."),
  file_type: z.enum(["report", "xray", "prescription", "document", "lab_report"]).default("report"),
  data_url: z.string().min(1, "Data URL / File content is required."),
  created_at: z.string().optional(),
});

// ── 23. Clinic Service Schema ──
export const clinicServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required."),
  category: z.string().optional().default("General"),
  price: z.number().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional().default(""),
});

// ── 24. Enterprise Approvals & Governance Schemas ──
export const requestTypeEnum = z.enum([
  "large_discount",
  "stock_adjustment",
  "financial_adjustment",
  "purchase_reversal",
  "sale_reversal",
  "ledger_adjustment",
  "batch_quarantine",
]);

export const approvalStatusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const executionStatusEnum = z.enum([
  "unexecuted",
  "executing",
  "executed",
  "failed",
  "rolled_back",
]);

export const approvalRequestInputSchema = z.object({
  request_type: requestTypeEnum,
  entity: z.string().min(1, "Target entity is required"),
  entity_id: z.string().optional().default(""),
  requested_by_id: z.string().min(1, "Requestor ID is required"),
  requested_by_name: z.string().min(1, "Requestor name is required"),
  reason: z.string().min(3, "Justification reason is required"),
  payload: z.record(z.any()),
  urgency: z.enum(["normal", "urgent", "critical"]).default("normal"),
  metadata: z.record(z.any()).optional().default({}),
});

export const approvalSchema = approvalRequestInputSchema.extend({
  id: z.string(),
  status: approvalStatusEnum.default("pending"),
  requested_at: z.string(),
  reviewed_by_id: z.string().nullable().default(null),
  reviewed_by_name: z.string().nullable().default(null),
  reviewed_at: z.string().nullable().default(null),
  review_notes: z.string().nullable().default(null),
  execution_status: executionStatusEnum.default("unexecuted"),
  executed_at: z.string().nullable().default(null),
  execution_error: z.string().nullable().default(null),
  execution_result: z.record(z.any()).nullable().default(null),
  hash: z.string().optional(),
});

// ── Safe Parsing Helper ──
export function validateSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues || result.error?.errors || [];
    const firstError = issues[0]?.message || "Validation failed";
    return {
      success: false,
      data: null,
      error: {
        code: "VALIDATION",
        message: firstError,
        details: result.error?.format ? result.error.format() : null,
      },
    };
  }
  return {
    success: true,
    data: result.data,
    error: null,
  };
}
