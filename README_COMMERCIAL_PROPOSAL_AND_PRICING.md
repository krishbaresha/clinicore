# ClinicFlow Commercial Proposal & Pricing Guide

**Market:** Pakistan, private clinics with optional in-clinic pharmacy. **Currency:** PKR. **This is a pricing guide, not a promise of regulated medical/pharmacy/FBR compliance.** Confirm legal, tax, hosting and WhatsApp costs before signing a client.

## 1. Positioning

ClinicFlow should be sold as a workflow-first clinic system:

- reception registration, multi-doctor token queues and patient history;
- handwritten prescription/report photo record;
- OPD fees, receipts and daily closing;
- optional pharmacy POS, inventory, supplier purchases and warehouse;
- local onboarding and support in Urdu/Roman Urdu.

Do **not** sell it as a hospital EMR, FBR/DRAP-compliant pharmacy platform, offline system, encrypted-health-record platform, or AI diagnosis tool until those claims are independently delivered and verified.

## 2. Recommended offer after production launch

| Plan | Suitable for | One-time setup* | Monthly, hosting included | Includes |
|---|---:|---:|---:|---|
| Clinic Starter | 1 doctor, 1 reception desk | 20,000 | 4,500 | patients, tokens, photos, OPD fees, basic reports, backup, support |
| Clinic Pro | up to 3 doctors, 3 staff | 35,000 | 7,500 | Starter + multi-doctor queue, procedures, advanced reports, WhatsApp-ready workflow |
| Clinic + Pharmacy | clinic plus one pharmacy counter | 55,000 | 12,500 | Pro + POS, purchases, supplier ledger, returns, inventory, EOD |
| Custom / Warehouse | multi-counter, warehouse, bespoke workflows | 100,000+ discovery deposit | 18,000+ | negotiated scope, SLA, migration, custom reports |

`*Setup` covers onboarding, initial configuration, basic logo/print template, staff training, and a defined migration. It does not include major custom development.

Offer annual payment at **10 months for the price of 12**. Use a 14-day pilot on demo/staging data; do not give a real-data free trial until backups/security are complete.

## 3. Hosting included vs client-owned hosting

### Managed hosting included (recommended subscription)

- You host/manage the app, database, backups, SSL, monitoring and updates.
- Charge the monthly prices above.
- Include reasonable limits in contract: one clinic, stated staff/doctor count, normal storage, business-hours support.
- Add photo storage overage, SMS/WhatsApp, custom development and on-site visits separately.

### Client-owned hosting

- Client pays hosting/domain directly and grants controlled access.
- Charge setup plus **PKR 2,500–5,000/month** for maintenance, updates, backup verification, and support.
- Never promise availability or recovery where you do not control backups/server access.
- Minimum recommendation: Clinic Starter **20,000 setup + 3,000/month**, Clinic + Pharmacy **55,000 setup + 5,000/month**.

## 4. Perpetual/on-premise sale — only with strict limits

One-time sale sounds attractive but creates unlimited support risk. Offer it only after a production version exists.

| Package | One-time licence + installation | Optional annual maintenance | Important exclusions |
|---|---:|---:|---|
| Clinic Starter | 150,000 | 30,000/year | hosting, domain, SMS/WhatsApp, major features, on-site support |
| Clinic + Pharmacy | 300,000 | 60,000/year | same exclusions; warehouse/custom reports quoted separately |
| Custom clinic deployment | 450,000+ | 15–20% of licence/year | priced after a paid discovery phase |

For permanent sale, contractually define: licence is for one clinic/branch, number of users, included version, install environment, backup responsibility, support response time, data ownership/export, and paid change-request process. The source code is **not** transferred unless separately priced at 3–5x the licence amount plus legal review.

## 5. Add-on price card

| Add-on | Suggested charge |
|---|---:|
| Legacy DrCreate/Access import and reconciliation | 25,000–75,000 one-time, after data audit |
| Extra branch | 3,000–6,000/month managed, depending on users/storage |
| Extra doctor | 750–1,500/month |
| Extra pharmacy counter | 1,500–3,000/month |
| WhatsApp/SMS | provider cost + 15–25% management fee; never absorb usage silently |
| Bespoke report/print format | 8,000–25,000 each after written scope |
| New module/custom workflow | paid discovery 15,000–40,000, then fixed quote |
| On-site training/install | travel + 10,000–25,000/day |
| Priority after-hours support | 2,500–7,500/month |

## 6. Why these ranges are sensible

Current Pakistani public offers span low-cost OPD tools around PKR 999–3,000/month, general clinic systems around PKR 4,000–10,800/month, and more premium clinic offerings near PKR 25,000/month; pharmacy systems advertise roughly PKR 2,499–6,999/month depending on counters and features. ClinicFlow should start in the practical middle, then charge for the pharmacy/warehouse complexity and human support. Market references: [MedicsPK](https://medicspk.com/clinic-and-hospital-management-system-pricing), [Docmora](https://docmora.com/pricing/), [Pak Health](https://pakhealth.pk/), [Mint POS](https://www.mintpos.pk/pos-for/pharmacy), and [NovaMedSuite](https://pk.novamedsuite.com/).

## 7. Proposal structure for each doctor

1. **Problem:** manual/legacy records, slow queue visibility, missing history, unclear cash/stock.
2. **Solution:** list only the modules demonstrated and included in their plan.
3. **Implementation:** discovery → configuration → migration → training → parallel pilot → go-live.
4. **Commercials:** setup, monthly/annual fee, add-ons, payment schedule and taxes.
5. **Responsibilities:** client provides logo, doctor/staff list, approved workflow, printer, domain/hosting decision, data export and timely acceptance testing.
6. **Service level:** response windows, support channels, maintenance window, backup responsibility.
7. **Limits:** no medical advice, no guaranteed internet/printer/WhatsApp delivery, no unapproved accounting/FBR/DRAP claim.
8. **Change control:** every new request is written, estimated, approved and billed before development.

## 8. Payment and risk controls

- Custom build: 50% advance, 30% at working staging acceptance, 20% at go-live. No work starts without advance.
- Subscription: setup fee before onboarding; monthly/annual fee in advance; suspend read/write access after a defined non-payment grace period but retain export access for a contract-defined period.
- Define what counts as a bug (does not meet agreed acceptance criteria) versus a change request (new/changed requirement).
- Get written approval for data import totals, printer design, staff roles and each financial workflow before go-live.
- Keep a change log and acceptance signature/email for every custom feature.

## 9. Scenario playbook

| Situation | Commercial/operational answer |
|---|---|
| Doctor wants “same as old software” | Run a paid workflow/data audit; create a signed feature map before quoting. |
| Doctor asks for a small new button | Document impact; quote if it changes data, print, money, stock, permissions, or reports. |
| Client wants own server | Use client-hosted option; client owns infra risk, you charge maintenance. |
| Internet fails | Until offline sync is built, use a paper contingency token/register and back-enter later; do not pretend cloud app is offline-capable. |
| Data migration has errors | Keep legacy read-only, fix mapping in staging, reconcile and obtain signed approval before cutover. |
| Printer not working | Treat printer driver/network as client environment; provide tested browser print templates, paid on-site support if needed. |
| Client stops paying | Follow written notice/grace/export policy; do not delete data impulsively. |
| Security incident | Preserve logs, contain access, notify owner, restore/reconcile, document corrective action. |

## 10. Sales rule

Sell the result—faster reception, retrievable patient history, reliable daily cash/stock—not a long feature list. Start with one clinic pilot, measure token time, search time, stock variance and cash-closing variance, then use that evidence in future proposals.
