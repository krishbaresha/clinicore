import { z } from "zod";

/**
 * Standardized Zod Schemas for CliniCore / ClinicFlow
 * Anti-Guess & Type-Safe Payload Validation Engine
 */

// ── Patient Schema ──
export const patientInputSchema = z.object({
  full_name: z
    .string({ required_error: "Full name is required." })
    .trim()
    .min(2, "Full name must be at least 2 characters."),
  relation_name: z.string().trim().optional().default(""),
  relation_type: z
    .enum(["father", "husband", "wife", "mother", "brother", "sister", "son", "daughter"])
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
  dob: z.string().optional().nullable(),
});

// ── Visit / OPD Queue Schema ──
export const visitInputSchema = z.object({
  patient_id: z.string({ required_error: "Patient ID is required." }).min(1),
  doctor_id: z.string().optional().default("user_001"),
  visit_type: z.enum(["first_visit", "follow_up", "emergency", "routine"]).default("first_visit"),
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
});

// ── Inventory Item Schema ──
export const inventoryItemSchema = z.object({
  medicine_name: z
    .string({ required_error: "Medicine name is required." })
    .trim()
    .min(1, "Medicine name is required."),
  company_name: z.string().trim().optional().default("General"),
  item_code: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default("General"),
  unit_price: z
    .union([z.number(), z.string()])
    .transform((val) => Math.max(0, Number(val) || 0)),
  unit_sale_price: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  stock_qty: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 0)),
  min_stock_alert: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => Math.max(0, Number(val) || 10)),
  unit_label: z.string().trim().optional().default("tablet"),
  strips_per_box: z.number().optional().default(10),
  units_per_strip: z.number().optional().default(10),
  has_multi_unit: z.boolean().optional().default(false),
});

// ── Pharmacy / Store Expense Schema ──
export const pharmacyExpenseSchema = z.object({
  amount: z
    .union([z.number(), z.string()], { required_error: "Expense amount is required." })
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val) && val > 0, "Valid amount greater than 0 is required."),
  description: z.string().trim().optional().default("General Store Expense"),
  category: z.string().trim().optional().default("Utilities"),
  paid_to: z.string().trim().optional().default(""),
});

// ── POS Sale Record Schema ──
export const recordSaleSchema = z.union([
  z.object({
    inventory_id: z.string({ required_error: "Inventory ID is required." }).min(1),
    quantity_sold: z
      .union([z.number(), z.string()])
      .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
    linked_visit_id: z.string().nullable().optional(),
    selected_unit_type: z.enum(["unit", "strip", "box"]).optional().default("unit"),
  }),
  z.object({
    items: z.array(z.any()).min(1, "At least one item is required in cart."),
    total_amount: z.union([z.number(), z.string()]).transform((val) => Number(val) || 0),
    payment_mode: z.string().optional().default("Cash"),
    paid_amount: z.union([z.number(), z.string()]).optional(),
    discount_amount: z.union([z.number(), z.string()]).optional(),
  }),
]);

// ── CashBook Entry Schema ──
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
  category: z.string().trim().optional().default("General"),
  description: z.string().trim().optional().default(""),
  payment_mode: z.string().optional().default("Cash"),
  voucher_no: z.string().optional(),
  date: z.string().optional(),
});

// ── Safe Parsing Helper ──
export function validateSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Validation failed";
    return {
      success: false,
      data: null,
      error: {
        code: "VALIDATION",
        message: firstError,
        details: result.error.format(),
      },
    };
  }
  return {
    success: true,
    data: result.data,
    error: null,
  };
}
