"""
test_day_closing_and_cashbook.py
================================
Comprehensive Python Test Suite for:
1. DrCreate & MS Access Day Closing Receipt Engine (UserForm12)
2. DrCreate & MS Access CASHBOOK _FORM Engine (Double-Entry Cash Ledger)
"""

import sys
import json
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def format_rs(val):
    return f"Rs. {val:,.2f}"

# ==============================================================================
# 1. Day Closing Receipt Engine Simulation (UserForm12)
# ==============================================================================
class DayClosingEngine:
    @staticmethod
    def compute_day_closing(date_str, sales, b2b_sales, purchases, cashbook_entries, expenses, visits):
        target_date = date_str.split("T")[0]

        # 1. Sales (POS + B2B)
        all_sales = sales + b2b_sales
        day_sales = [s for s in all_sales if (s.get("sale_date") or s.get("created_at", "")).split("T")[0] == target_date]

        total_sale = 0.0
        cash_sale = 0.0
        credit_sale = 0.0

        for s in day_sales:
            tot = float(s.get("total_amount") or 0)
            is_credit = s.get("payment_mode") == "Credit" or float(s.get("balance_due") or 0) > 0
            paid = float(s.get("paid_amount") or 0) if is_credit else tot
            total_sale += tot
            cash_sale += paid
            if is_credit:
                credit_sale += max(0.0, tot - paid)

        # 2. Purchases (GRN Inward)
        day_purchases = [p for p in purchases if (p.get("purchase_date") or p.get("created_at", "")).split("T")[0] == target_date]
        total_purchase = 0.0
        cash_purchase = 0.0
        credit_purchase = 0.0

        for p in day_purchases:
            tot = float(p.get("total_amount") or 0)
            is_credit = p.get("payment_mode") == "Credit" or float(p.get("balance_due") or 0) > 0
            paid = float(p.get("paid_amount") or 0) if is_credit else tot
            total_purchase += tot
            cash_purchase += paid
            if is_credit:
                credit_purchase += max(0.0, tot - paid)

        # 3. CashBook Payments Paid (Outflows)
        day_cash_paid = [c for c in cashbook_entries if (c.get("date") or "").split("T")[0] == target_date and (c.get("term") or c.get("type")) == "Paid"]
        day_expenses = [e for e in expenses if (e.get("expense_date") or e.get("date", "")).split("T")[0] == target_date]

        payments_paid_items = [
            {"account_name": c.get("account_name", "Expense"), "amount": float(c.get("amount", 0)), "naration": c.get("naration", "")}
            for c in day_cash_paid
        ] + [
            {"account_name": e.get("category", "Shop Expense"), "amount": float(e.get("amount", 0)), "naration": e.get("description", "")}
            for e in day_expenses
        ]
        total_payment_paid = sum(it["amount"] for it in payments_paid_items)

        # 4. CashBook Payments Received (Inflows) + OPD Consultations
        day_cash_receive = [c for c in cashbook_entries if (c.get("date") or "").split("T")[0] == target_date and (c.get("term") or c.get("type")) == "Receive"]
        day_visits = [v for v in visits if (v.get("visit_date") or "").split("T")[0] == target_date and v.get("status") in ["done", "completed", "waiting", "in_consultation"]]
        total_opd_fees = sum(float(v.get("fee_amount") or 0) for v in day_visits)

        payments_receive_items = [
            {"account_name": c.get("account_name", "Party Cash"), "amount": float(c.get("amount", 0)), "naration": c.get("naration", "")}
            for c in day_cash_receive
        ]
        if total_opd_fees > 0:
            payments_receive_items.insert(0, {
                "account_name": "OPD Doctor Consultation Fees",
                "amount": total_opd_fees,
                "naration": f"{len(day_visits)} Patients OPD Visits"
            })
        total_payment_receive = sum(it["amount"] for it in payments_receive_items)

        # 5. Closing Cash (Net Drawer Balance in Hand)
        closing_cash = cash_sale + total_payment_receive - cash_purchase - total_payment_paid

        # 6. WhatsApp Report String
        wa_text = (
            f"*📋 DAY CLOSING RECEIPT — {target_date}*\n"
            f"*🏥 Dr. Muhammad Kashif Khan Clinic & Store*\n\n"
            f"*💰 SALE:* Total: Rs. {total_sale:,.2f} | Cash: Rs. {cash_sale:,.2f} | Credit: Rs. {credit_sale:,.2f}\n"
            f"*📦 PURCHASE:* Total: Rs. {total_purchase:,.2f} | Cash: Rs. {cash_purchase:,.2f} | Credit: Rs. {credit_purchase:,.2f}\n"
            f"*🔻 PAYMENT PAID (Outflow):* Rs. {total_payment_paid:,.2f}\n"
            f"*🔺 PAYMENT RECEIVE (Inflow):* Rs. {total_payment_receive:,.2f}\n"
            f"*💵 CLOSING CASH IN HAND: Rs. {closing_cash:,.2f}*"
        )

        return {
            "date": target_date,
            "sales": {"total": total_sale, "cash": cash_sale, "credit": credit_sale},
            "purchases": {"total": total_purchase, "cash": cash_purchase, "credit": credit_purchase},
            "payments_paid": {"total": total_payment_paid, "items": payments_paid_items},
            "payments_received": {"total": total_payment_receive, "items": payments_receive_items},
            "closing_cash": closing_cash,
            "whatsapp_text": wa_text
        }


# ==============================================================================
# 2. CASHBOOK _FORM Engine Simulation (Double-Entry Ledger)
# ==============================================================================
class CashBookEngine:
    def __init__(self):
        self.entries = []
        self.main_ac = []
        self.parties = {}
        self.suppliers = {}

    def get_next_voucher_no(self):
        if not self.entries:
            return "C-5160"
        max_num = 5159
        for e in self.entries:
            v = e.get("voucher_no", "")
            if v.startswith("C-"):
                try:
                    num = int(v.split("-")[1])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        return f"C-{max_num + 1}"

    def add_entry(self, date_str, term, account_name, naration, amount):
        v_no = self.get_next_voucher_no()
        entry = {
            "id": f"cb_{len(self.entries) + 1}",
            "voucher_no": v_no,
            "date": date_str,
            "term": term, # "Receive" | "Paid"
            "type": term,
            "account_name": account_name,
            "naration": naration,
            "amount": float(amount)
        }
        self.entries.insert(0, entry)

        # Double-entry posting to MainAc
        if term == "Receive":
            self.main_ac.append({"voucher_no": v_no, "account_name": "Cash In Hand", "debit": float(amount), "credit": 0})
            self.main_ac.append({"voucher_no": v_no, "account_name": account_name, "debit": 0, "credit": float(amount)})
            if account_name in self.parties:
                self.parties[account_name] = max(0.0, self.parties[account_name] - float(amount))
        else: # "Paid"
            self.main_ac.append({"voucher_no": v_no, "account_name": account_name, "debit": float(amount), "credit": 0})
            self.main_ac.append({"voucher_no": v_no, "account_name": "Cash In Hand", "debit": 0, "credit": float(amount)})
            if account_name in self.suppliers:
                self.suppliers[account_name] = max(0.0, self.suppliers[account_name] - float(amount))

        return entry

    def get_daily_summary(self, date_str):
        day_entries = [e for e in self.entries if e["date"] == date_str]
        receive_entries = [e for e in day_entries if e["term"] == "Receive"]
        paid_entries = [e for e in day_entries if e["term"] == "Paid"]

        total_debit = sum(e["amount"] for e in receive_entries)
        total_credit = sum(e["amount"] for e in paid_entries)
        balance = total_debit - total_credit

        return {
            "date": date_str,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "balance": balance,
            "receive_entries": receive_entries,
            "paid_entries": paid_entries
        }

    def delete_entry(self, voucher_no):
        self.entries = [e for e in self.entries if e["voucher_no"] != voucher_no]
        self.main_ac = [m for m in self.main_ac if m["voucher_no"] != voucher_no]


# ==============================================================================
# TEST SUITE
# ==============================================================================
def run_tests():
    print("=" * 75)
    print("🚀 TESTING DAY CLOSING RECEIPT & CASHBOOK _FORM ENGINES")
    print("=" * 75)

    # --------------------------------------------------------------------------
    # TEST 1: Day Closing Receipt Formula Verification
    # --------------------------------------------------------------------------
    print("\n[Test 1] Testing Day Closing Receipt Calculations (UserForm12)...")
    sales_data = [
        {"id": "s1", "sale_date": "2026-08-22", "total_amount": 5000, "paid_amount": 5000, "payment_mode": "Cash"},
        {"id": "s2", "sale_date": "2026-08-22", "total_amount": 3000, "paid_amount": 1000, "payment_mode": "Credit", "balance_due": 2000},
    ]
    b2b_data = [
        {"id": "b1", "sale_date": "2026-08-22", "total_amount": 12000, "paid_amount": 8000, "payment_mode": "Credit", "balance_due": 4000},
    ]
    purchases_data = [
        {"id": "p1", "purchase_date": "2026-08-22", "total_amount": 6000, "paid_amount": 4000, "payment_mode": "Credit", "balance_due": 2000},
    ]
    cashbook_data = [
        {"voucher_no": "C-5160", "date": "2026-08-22", "term": "Receive", "account_name": "Waheed Medical", "amount": 2500},
        {"voucher_no": "C-5161", "date": "2026-08-22", "term": "Paid", "account_name": "Staff Tea & Lunch", "amount": 600},
    ]
    expenses_data = [
        {"id": "e1", "expense_date": "2026-08-22", "category": "Shop Cleaning", "amount": 300},
    ]
    visits_data = [
        {"id": "v1", "visit_date": "2026-08-22T09:00:00Z", "fee_amount": 300, "status": "completed"},
        {"id": "v2", "visit_date": "2026-08-22T10:00:00Z", "fee_amount": 500, "status": "completed"},
    ]

    closing = DayClosingEngine.compute_day_closing(
        "2026-08-22", sales_data, b2b_data, purchases_data, cashbook_data, expenses_data, visits_data
    )

    # Verifications:
    # 1. Total Sale = 5000 + 3000 + 12000 = 20,000 | Cash Sale = 5000 + 1000 + 8000 = 14,000 | Credit Sale = 2000 + 4000 = 6,000
    assert closing["sales"]["total"] == 20000.0, f"Sale Total Mismatch: {closing['sales']['total']}"
    assert closing["sales"]["cash"] == 14000.0, f"Sale Cash Mismatch: {closing['sales']['cash']}"
    assert closing["sales"]["credit"] == 6000.0, f"Sale Credit Mismatch: {closing['sales']['credit']}"

    # 2. Purchase: Total = 6000 | Cash Purchase = 4000 | Credit = 2000
    assert closing["purchases"]["total"] == 6000.0
    assert closing["purchases"]["cash"] == 4000.0
    assert closing["purchases"]["credit"] == 2000.0

    # 3. Payments Paid: 600 (Cashbook) + 300 (Expense) = 900
    assert closing["payments_paid"]["total"] == 900.0

    # 4. Payments Receive: 2500 (Waheed) + 800 (OPD Fees) = 3300
    assert closing["payments_received"]["total"] == 3300.0

    # 5. Closing Cash: Cash Sale (14,000) + Payment Receive (3,300) - Cash Purchase (4,000) - Payment Paid (900)
    # 14,000 + 3,300 - 4,000 - 900 = 12,400 Rs.
    expected_closing_cash = 14000 + 3300 - 4000 - 900 # 12,400
    assert closing["closing_cash"] == expected_closing_cash, f"Closing Cash Mismatch: {closing['closing_cash']} != {expected_closing_cash}"

    print(f"  ✅ Sale Breakdown: Total={format_rs(closing['sales']['total'])}, Cash={format_rs(closing['sales']['cash'])}, Credit={format_rs(closing['sales']['credit'])}")
    print(f"  ✅ Purchase Breakdown: Total={format_rs(closing['purchases']['total'])}, Cash={format_rs(closing['purchases']['cash'])}, Credit={format_rs(closing['purchases']['credit'])}")
    print(f"  ✅ Payments Paid (Outflow): {format_rs(closing['payments_paid']['total'])}")
    print(f"  ✅ Payments Received (Inflow): {format_rs(closing['payments_received']['total'])}")
    print(f"  ✅ Net Closing Cash in Hand: {format_rs(closing['closing_cash'])}")
    print(f"  ✅ WhatsApp Text Format Generated:\n{closing['whatsapp_text']}")

    # --------------------------------------------------------------------------
    # TEST 2: CASHBOOK _FORM Engine (Double-Entry Ledger)
    # --------------------------------------------------------------------------
    print("\n[Test 2] Testing CASHBOOK _FORM Engine (Voucher Sequencing & Double-Entry)...")
    cb = CashBookEngine()
    cb.parties["Muslim Medical Store"] = 10000.0
    cb.suppliers["BM Pvt LTD"] = 25000.0

    # 1. Initial Voucher #
    v1_no = cb.get_next_voucher_no()
    assert v1_no == "C-5160", f"Initial voucher error: {v1_no}"

    # 2. Add Cash Receipt (Receive Rs. 3,000 from Muslim Medical)
    e1 = cb.add_entry("2026-08-22", "Receive", "Muslim Medical Store", "Udhaar Recovery", 3000)
    assert e1["voucher_no"] == "C-5160"
    assert cb.parties["Muslim Medical Store"] == 7000.0, "Party balance not reduced"

    # 3. Add Cash Payment (Paid Rs. 5,000 to BM Pvt LTD)
    v2_no = cb.get_next_voucher_no()
    assert v2_no == "C-5161", f"Next voucher error: {v2_no}"
    e2 = cb.add_entry("2026-08-22", "Paid", "BM Pvt LTD", "Supplier Payment", 5000)
    assert cb.suppliers["BM Pvt LTD"] == 20000.0, "Supplier balance not reduced"

    # 4. Add Expense Payment (Paid Rs. 400 for Tea)
    e3 = cb.add_entry("2026-08-22", "Paid", "Staff Refreshment", "Chai Kharcha", 400)

    # 5. Check Daily Summary
    summary = cb.get_daily_summary("2026-08-22")
    # Total Debit (Inflow) = 3000
    # Total Credit (Outflow) = 5000 + 400 = 5400
    # Balance = 3000 - 5400 = -2400
    assert summary["total_debit"] == 3000.0
    assert summary["total_credit"] == 5400.0
    assert summary["balance"] == -2400.0
    assert len(summary["receive_entries"]) == 1
    assert len(summary["paid_entries"]) == 2

    print(f"  ✅ Voucher Sequencing: C-5160 ➔ C-5161 ➔ C-5162")
    print(f"  ✅ Party Ledger Auto-Reduction: Muslim Medical balance updated from Rs. 10,000 ➔ Rs. {cb.parties['Muslim Medical Store']:,.2f}")
    print(f"  ✅ Supplier Ledger Auto-Reduction: BM Pvt LTD balance updated from Rs. 25,000 ➔ Rs. {cb.suppliers['BM Pvt LTD']:,.2f}")
    print(f"  ✅ CashBook Daily Summary: Debit={format_rs(summary['total_debit'])}, Credit={format_rs(summary['total_credit'])}, Balance={format_rs(summary['balance'])}")

    # 6. Delete Voucher Test
    cb.delete_entry("C-5162")
    summary_after_del = cb.get_daily_summary("2026-08-22")
    assert summary_after_del["total_credit"] == 5000.0
    assert summary_after_del["balance"] == -2000.0
    print(f"  ✅ Voucher Deletion & Reconciliation: Total Credit updated to {format_rs(summary_after_del['total_credit'])}, Balance={format_rs(summary_after_del['balance'])}")

    print("\n" + "=" * 75)
    print("🎉 ALL DAY CLOSING & CASHBOOK TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
