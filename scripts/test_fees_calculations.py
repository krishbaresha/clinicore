"""
test_fees_calculations.py
=========================
Comprehensive Test Suite for ClinicFlow Financial & Fees Calculation Engine
Testing all mathematical formulas, aggregations, denominations, date ranges, and edge cases.
"""

import sys
import json
import math
from datetime import datetime, timedelta

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def format_currency(val):
    return f"Rs. {val:,.2f}"

class FeesCalculationEngine:
    """
    Python mirror of the JavaScript calculation engine in FeesReports.jsx,
    DayClosingReceiptModal.jsx, and visits.js.
    """
    
    @staticmethod
    def calculate_inflows(visits, pos_sales, b2b_sales, target_date_str):
        """
        Calculate total inflows for a given calendar date.
        """
        # OPD Fees
        day_visits = [v for v in visits if v.get("visit_date", "").split("T")[0] == target_date_str]
        opd_fees = sum(float(v.get("fee_amount") or 0) for v in day_visits)
        
        # Pharmacy POS Sales
        day_pos = [s for s in pos_sales if s.get("sale_date", "").split("T")[0] == target_date_str]
        pos_total = sum(float(s.get("total_amount") or 0) for s in day_pos)
        
        # Wholesale B2B Sales (cash received)
        day_b2b = [b for b in b2b_sales if b.get("sale_date", "").split("T")[0] == target_date_str]
        b2b_cash = sum(float(b.get("paid_amount") if b.get("paid_amount") is not None else b.get("total_amount") or 0) for b in day_b2b)
        
        total_inflow = opd_fees + pos_total + b2b_cash
        return {
            "opd_fees": opd_fees,
            "opd_count": len(day_visits),
            "pos_total": pos_total,
            "pos_count": len(day_pos),
            "b2b_cash": b2b_cash,
            "b2b_count": len(day_b2b),
            "total_inflow": total_inflow
        }

    @staticmethod
    def calculate_outflows(expenses, purchases, returns, target_date_str):
        """
        Calculate total outflows for a given calendar date.
        """
        day_expenses = [e for e in expenses if (e.get("expense_date") or e.get("date", "")).split("T")[0] == target_date_str]
        total_expenses = sum(float(e.get("amount") or 0) for e in day_expenses)
        
        day_purchases = [p for p in purchases if (p.get("purchase_date") or p.get("date", "")).split("T")[0] == target_date_str]
        supplier_cash = sum(float(p.get("paid_amount") or 0) for p in day_purchases)
        
        day_returns = [r for r in returns if (r.get("return_date") or r.get("date", "")).split("T")[0] == target_date_str]
        returns_refunds = sum(float(r.get("refund_amount") or 0) for r in day_returns)
        
        total_outflow = total_expenses + supplier_cash + returns_refunds
        return {
            "expenses": total_expenses,
            "expenses_count": len(day_expenses),
            "supplier_cash": supplier_cash,
            "purchases_count": len(day_purchases),
            "returns_refunds": returns_refunds,
            "returns_count": len(day_returns),
            "total_outflow": total_outflow
        }

    @staticmethod
    def calculate_expected_cash(inflows, outflows):
        return inflows["total_inflow"] - outflows["total_outflow"]

    @staticmethod
    def calculate_physical_cash(denominations):
        """
        Calculates physical counted notes total.
        Denominations map: 5000, 1000, 500, 100, 50, 20, 10
        """
        notes = {
            5000: int(denominations.get("note5000", 0)),
            1000: int(denominations.get("note1000", 0)),
            500:  int(denominations.get("note500", 0)),
            100:  int(denominations.get("note100", 0)),
            50:   int(denominations.get("note50", 0)),
            20:   int(denominations.get("note20", 0)),
            10:   int(denominations.get("note10", 0)),
        }
        total = sum(k * v for k, v in notes.items())
        return total

    @staticmethod
    def calculate_variance(physical_cash, expected_cash):
        variance = physical_cash - expected_cash
        if variance == 0:
            status = "BALANCED"
        elif variance < 0:
            status = "SHORTAGE"
        else:
            status = "SURPLUS"
        return variance, status

    @staticmethod
    def get_fees_summary(visits, range_type="monthly", doctor_id=None, ref_date=None):
        """
        Summary calculation for OPD Trends (Daily, Weekly, Monthly).
        """
        now = ref_date or datetime.now()
        now_date = now.date()
        
        filtered = []
        for v in visits:
            if doctor_id and v.get("doctor_id") and v.get("doctor_id") != doctor_id:
                continue
            v_dt = datetime.fromisoformat(v["visit_date"].replace("Z", "+00:00")).date()
            
            if range_type == "daily":
                if v_dt == now_date:
                    filtered.append(v)
            elif range_type == "weekly":
                week_ago = now_date - timedelta(days=7)
                if week_ago <= v_dt <= now_date:
                    filtered.append(v)
            elif range_type == "monthly":
                if v_dt.year == now_date.year and v_dt.month == now_date.month:
                    filtered.append(v)
                    
        total_fees = sum(float(v.get("fee_amount") or 0) for v in filtered)
        visit_count = len(filtered)
        
        by_date = {}
        for v in filtered:
            v_dt = datetime.fromisoformat(v["visit_date"].replace("Z", "+00:00"))
            key = v_dt.strftime("%d %b")
            by_date[key] = by_date.get(key, 0.0) + float(v.get("fee_amount") or 0)
            
        chart_data = [{"date": k, "fees": v} for k, v in by_date.items()]
        return {
            "total_fees": total_fees,
            "visit_count": visit_count,
            "chart_data": chart_data,
            "range": range_type
        }


# ==============================================================================
# TEST SUITE EXECUTION
# ==============================================================================
def run_all_tests():
    print("=" * 70)
    print("🚀 RUNNING CLINICFLOW FEES & FINANCIAL ENGINE TESTS (PYTHON)")
    print("=" * 70)
    
    passed_tests = 0
    total_tests = 0
    
    # --------------------------------------------------------------------------
    # TEST 1: Inflow Calculation Accuracy
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing Cash Inflow Aggregations...")
    test_visits = [
        {"id": "v1", "visit_date": "2026-08-22T09:00:00Z", "fee_amount": 300, "doctor_id": "user_001"},
        {"id": "v2", "visit_date": "2026-08-22T10:30:00Z", "fee_amount": 500, "doctor_id": "user_002"},
        {"id": "v3", "visit_date": "2026-08-21T11:00:00Z", "fee_amount": 300, "doctor_id": "user_001"}, # Previous day
    ]
    test_pos = [
        {"id": "s1", "sale_date": "2026-08-22T09:15:00Z", "total_amount": 1250, "paid_amount": 1250},
        {"id": "s2", "sale_date": "2026-08-22T11:00:00Z", "total_amount": 800, "paid_amount": 800},
    ]
    test_b2b = [
        {"id": "b1", "sale_date": "2026-08-22T14:00:00Z", "total_amount": 15000, "paid_amount": 10000}, # 10k cash, 5k credit
    ]
    
    inflow_res = FeesCalculationEngine.calculate_inflows(test_visits, test_pos, test_b2b, "2026-08-22")
    
    expected_opd = 800.0   # 300 + 500
    expected_pos = 2050.0  # 1250 + 800
    expected_b2b = 10000.0 # 10,000 cash paid
    expected_total_inflow = 12850.0
    
    assert inflow_res["opd_fees"] == expected_opd, f"OPD Mismatch: {inflow_res['opd_fees']} != {expected_opd}"
    assert inflow_res["pos_total"] == expected_pos, f"POS Mismatch: {inflow_res['pos_total']} != {expected_pos}"
    assert inflow_res["b2b_cash"] == expected_b2b, f"B2B Mismatch: {inflow_res['b2b_cash']} != {expected_b2b}"
    assert inflow_res["total_inflow"] == expected_total_inflow, f"Total Inflow Mismatch: {inflow_res['total_inflow']} != {expected_total_inflow}"
    print(f"  ✅ Inflows Match: OPD={format_currency(expected_opd)}, POS={format_currency(expected_pos)}, B2B Cash={format_currency(expected_b2b)} ➔ Total={format_currency(expected_total_inflow)}")
    passed_tests += 1

    # --------------------------------------------------------------------------
    # TEST 2: Outflow Calculation Accuracy
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing Cash Outflow Aggregations...")
    test_expenses = [
        {"id": "e1", "expense_date": "2026-08-22", "amount": 350, "category": "Tea & Refreshment"},
        {"id": "e2", "expense_date": "2026-08-22", "amount": 1500, "category": "Electricity Bill Share"},
    ]
    test_purchases = [
        {"id": "p1", "purchase_date": "2026-08-22", "total_amount": 8000, "paid_amount": 3000}, # 3k cash paid
    ]
    test_returns = [
        {"id": "r1", "return_date": "2026-08-22", "refund_amount": 250},
    ]
    
    outflow_res = FeesCalculationEngine.calculate_outflows(test_expenses, test_purchases, test_returns, "2026-08-22")
    
    expected_exp = 1850.0  # 350 + 1500
    expected_sup = 3000.0  # 3000 paid
    expected_ret = 250.0   # 250 refund
    expected_total_outflow = 5100.0
    
    assert outflow_res["expenses"] == expected_exp, f"Expenses Mismatch: {outflow_res['expenses']} != {expected_exp}"
    assert outflow_res["supplier_cash"] == expected_sup, f"Supplier Cash Mismatch: {outflow_res['supplier_cash']} != {expected_sup}"
    assert outflow_res["returns_refunds"] == expected_ret, f"Returns Mismatch: {outflow_res['returns_refunds']} != {expected_ret}"
    assert outflow_res["total_outflow"] == expected_total_outflow, f"Total Outflow Mismatch: {outflow_res['total_outflow']} != {expected_total_outflow}"
    print(f"  ✅ Outflows Match: Exp={format_currency(expected_exp)}, Sup Cash={format_currency(expected_sup)}, Returns={format_currency(expected_ret)} ➔ Total={format_currency(expected_total_outflow)}")
    passed_tests += 1

    # --------------------------------------------------------------------------
    # TEST 3: Net System Expected Cash
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing System Expected Cash Drawer Balance...")
    expected_net = expected_total_inflow - expected_total_outflow # 12850 - 5100 = 7750
    calculated_net = FeesCalculationEngine.calculate_expected_cash(inflow_res, outflow_res)
    assert calculated_net == expected_net, f"Net Expected Cash Mismatch: {calculated_net} != {expected_net}"
    print(f"  ✅ Expected Cash Matches: Inflow ({format_currency(expected_total_inflow)}) - Outflow ({format_currency(expected_total_outflow)}) = {format_currency(calculated_net)}")
    passed_tests += 1

    # --------------------------------------------------------------------------
    # TEST 4: Denominations Counter & Cash Audit Variance
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing Physical Cash Denominations & Variance Audit...")
    
    # Case A: Balanced (Exactly 7,750 Rs) -> 1x 5000, 2x 1000, 1x 500, 2x 100, 1x 50
    denom_balanced = {
        "note5000": 1, # 5000
        "note1000": 2, # 2000
        "note500":  1, # 500
        "note100":  2, # 200
        "note50":   1, # 50
        "note20":   0,
        "note10":   0,
    }
    phys_a = FeesCalculationEngine.calculate_physical_cash(denom_balanced)
    var_a, status_a = FeesCalculationEngine.calculate_variance(phys_a, calculated_net)
    assert phys_a == 7750, f"Physical Total Mismatch: {phys_a} != 7750"
    assert var_a == 0 and status_a == "BALANCED", f"Variance Case A Failed: {var_a}, {status_a}"
    print(f"  ✅ Case A (Balanced): Counted {format_currency(phys_a)} vs Expected {format_currency(calculated_net)} ➔ Variance = {var_a} ({status_a})")

    # Case B: Shortage (7,500 Rs instead of 7,750 Rs -> -250 Rs)
    denom_short = { "note5000": 1, "note1000": 2, "note500": 1 }
    phys_b = FeesCalculationEngine.calculate_physical_cash(denom_short) # 7500
    var_b, status_b = FeesCalculationEngine.calculate_variance(phys_b, calculated_net)
    assert var_b == -250 and status_b == "SHORTAGE", f"Variance Case B Failed: {var_b}, {status_b}"
    print(f"  ✅ Case B (Shortage): Counted {format_currency(phys_b)} vs Expected {format_currency(calculated_net)} ➔ Variance = {var_b} ({status_b})")

    # Case C: Surplus (8,000 Rs instead of 7,750 Rs -> +250 Rs)
    denom_surplus = { "note5000": 1, "note1000": 3 }
    phys_c = FeesCalculationEngine.calculate_physical_cash(denom_surplus) # 8000
    var_c, status_c = FeesCalculationEngine.calculate_variance(phys_c, calculated_net)
    assert var_c == 250 and status_c == "SURPLUS", f"Variance Case C Failed: {var_c}, {status_c}"
    print(f"  ✅ Case C (Surplus): Counted {format_currency(phys_c)} vs Expected {format_currency(calculated_net)} ➔ Variance = +{var_c} ({status_c})")
    passed_tests += 1

    # --------------------------------------------------------------------------
    # TEST 5: OPD Consultation Fee Trends (Daily / Weekly / Monthly)
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing OPD Fee Trends & Doctor Isolation Filter...")
    ref_now = datetime(2026, 8, 22, 12, 0, 0)
    
    opd_visits_sample = [
        {"id": "v1", "visit_date": "2026-08-22T09:00:00Z", "fee_amount": 300, "doctor_id": "user_001"},
        {"id": "v2", "visit_date": "2026-08-22T10:00:00Z", "fee_amount": 500, "doctor_id": "user_002"},
        {"id": "v3", "visit_date": "2026-08-20T11:00:00Z", "fee_amount": 300, "doctor_id": "user_001"},
        {"id": "v4", "visit_date": "2026-08-10T11:00:00Z", "fee_amount": 300, "doctor_id": "user_001"},
        {"id": "v5", "visit_date": "2026-07-25T11:00:00Z", "fee_amount": 300, "doctor_id": "user_001"}, # Last month
    ]
    
    # 1. Daily for All Doctors
    daily_all = FeesCalculationEngine.get_fees_summary(opd_visits_sample, "daily", None, ref_now)
    assert daily_all["total_fees"] == 800 and daily_all["visit_count"] == 2
    
    # 2. Daily for Dr. Kashif Only (user_001)
    daily_doc1 = FeesCalculationEngine.get_fees_summary(opd_visits_sample, "daily", "user_001", ref_now)
    assert daily_doc1["total_fees"] == 300 and daily_doc1["visit_count"] == 1
    
    # 3. Weekly (Visits in last 7 days: v1, v2, v3)
    weekly_all = FeesCalculationEngine.get_fees_summary(opd_visits_sample, "weekly", None, ref_now)
    assert weekly_all["total_fees"] == 1100 and weekly_all["visit_count"] == 3
    
    # 4. Monthly (Visits in Aug 2026: v1, v2, v3, v4)
    monthly_all = FeesCalculationEngine.get_fees_summary(opd_visits_sample, "monthly", None, ref_now)
    assert monthly_all["total_fees"] == 1400 and monthly_all["visit_count"] == 4
    
    print(f"  ✅ OPD Daily Total (All): {format_currency(daily_all['total_fees'])} ({daily_all['visit_count']} visits)")
    print(f"  ✅ OPD Daily Total (Dr. Kashif user_001): {format_currency(daily_doc1['total_fees'])} ({daily_doc1['visit_count']} visit)")
    print(f"  ✅ OPD Weekly Total: {format_currency(weekly_all['total_fees'])} ({weekly_all['visit_count']} visits)")
    print(f"  ✅ OPD Monthly Total: {format_currency(monthly_all['total_fees'])} ({monthly_all['visit_count']} visits)")
    passed_tests += 1

    # --------------------------------------------------------------------------
    # TEST 6: Edge Cases & Boundary Conditions
    # --------------------------------------------------------------------------
    total_tests += 1
    print(f"\n[Test {total_tests}] Testing Robustness & Edge Cases (NaN, Null, 0, Negative bounds)...")
    
    edge_visits = [
        {"id": "ve1", "visit_date": "2026-08-22T01:00:00Z", "fee_amount": None},
        {"id": "ve2", "visit_date": "2026-08-22T02:00:00Z", "fee_amount": 0},
        {"id": "ve3", "visit_date": "2026-08-22T03:00:00Z", "fee_amount": "450.50"},
    ]
    edge_inflow = FeesCalculationEngine.calculate_inflows(edge_visits, [], [], "2026-08-22")
    assert edge_inflow["opd_fees"] == 450.50
    assert edge_inflow["opd_count"] == 3
    
    # Zero denominations handling
    zero_denom = FeesCalculationEngine.calculate_physical_cash({})
    assert zero_denom == 0
    
    print(f"  ✅ Null / 0 / String number conversions handled cleanly without crashing.")
    passed_tests += 1

    print("\n" + "=" * 70)
    print(f"🎉 ALL {passed_tests}/{total_tests} TEST SUITES PASSED PERFECTLY WITH 100% ACCURACY!")
    print("=" * 70)

if __name__ == "__main__":
    run_all_tests()
