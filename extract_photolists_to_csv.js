const fs = require('fs');
const path = require('path');

// Master List Data Extracted from Photos in Software Docs/Lists

// 1. Dr. Reckeweg Germany
const reckewegList = [
    { code: "R-1 to R-75", name: "R No's Specialities (R-1 to R-75)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1250 },
    { code: "R-76", name: "R-76 (Asthma Drops Forte)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1360 },
    { code: "R-77", name: "R-77 (Anti-Smoking Drops)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1360 },
    { code: "R-78", name: "R-78 (Eye Drops)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1360 },
    { code: "R-81", name: "R-81 (Analgesic Drops)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1360 },
    { code: "R-41P", name: "R-41 Plain (Sexual Weakness)", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1700 },
    { code: "R-41F", name: "R-41 Forte", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1490 },
    { code: "R-130", name: "R-130", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 2385 },
    { code: "R-131", name: "R-131", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 2385 },
    { code: "R-182-192", name: "R-182 to R-192", company: "Dr. Reckeweg Germany", category: "Drops", packing: "50 ml", price: 2000 },
    { code: "R-193", name: "R-193", company: "Dr. Reckeweg Germany", category: "Drops", packing: "50 ml", price: 2350 },
    { code: "R-96", name: "R-96 (Nasal Spray)", company: "Dr. Reckeweg Germany", category: "Spray", packing: "15 ml", price: 1300 },
    { code: "R-95-100", name: "R-95 Alfalfa Tonic (100ml)", company: "Dr. Reckeweg Germany", category: "Syrup", packing: "100 ml", price: 1300 },
    { code: "R-95-500", name: "R-95 Alfalfa Tonic (500ml)", company: "Dr. Reckeweg Germany", category: "Syrup", packing: "500 ml", price: 5460 },
    { code: "AMB-1000", name: "Ambra 1000 Drops", company: "Dr. Reckeweg Germany", category: "Drops", packing: "22 ml", price: 1700 },
    { code: "DAM-GOLD", name: "Damia Gold Drops", company: "Dr. Reckeweg Germany", category: "Drops", packing: "50 ml", price: 2200 },
    { code: "VITA-C", name: "Vita-C 15 Syrup", company: "Dr. Reckeweg Germany", category: "Syrup", packing: "250 ml", price: 2620 },
    { code: "R-8", name: "R-8 Cough Syrup", company: "Dr. Reckeweg Germany", category: "Syrup", packing: "150 ml", price: 1470 },
    { code: "R-61", name: "R-61 Ointment", company: "Dr. Reckeweg Germany", category: "Cream / Ointment", packing: "85 gm", price: 2730 },
    { code: "VITA-C-AMP", name: "Vita-C 15 Forte Ampoules", company: "Dr. Reckeweg Germany", category: "Injections / Ampoules", packing: "12 Amp / 10ml", price: 4100 },
    { code: "R-17-AMP", name: "R-17 Forte Ampoules", company: "Dr. Reckeweg Germany", category: "Injections / Ampoules", packing: "12 Amp / 10ml", price: 4400 },
];

// 2. Lehning Laboratories France
const lehningList = [
    { code: "LEH-01", name: "AMPHOSCA (FEMALE)", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1990 },
    { code: "LEH-02", name: "AMPHOSCA (MALE)", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1990 },
    { code: "LEH-03", name: "ANGIPAX TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "40 TABS", price: 1340 },
    { code: "LEH-04", name: "BILLEROL TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "45 TABS", price: 1640 },
    { code: "LEH-05", name: "BIOCARDE DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1340 },
    { code: "LEH-06", name: "BIOMAG TABLETS (ORANGE)", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "90 TABS", price: 2040 },
    { code: "LEH-07", name: "CAROMINTHE DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "90 ML", price: 1690 },
    { code: "LEH-08", name: "DAMIAPAX DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1440 },
    { code: "LEH-09", name: "DIABENE DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1440 },
    { code: "LEH-10", name: "DIACURE CAPSULES", company: "Lehning Laboratories Pharma", category: "Capsules", packing: "60 CAPS", price: 2190 },
    { code: "LEH-L08", name: "L 8 DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L25", name: "L 25 DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L28", name: "L 28 DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L52", name: "L 52 DROPS (Flu & Cold)", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L72", name: "L 72 DROPS (Sleep / Anxiety)", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L107", name: "L 107 DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-L114", name: "L 114 DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1590 },
    { code: "LEH-11", name: "NERVOPAX TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "80 TABS", price: 1640 },
    { code: "LEH-12", name: "NICO-STOP TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1140 },
    { code: "LEH-13", name: "PASSIFLORA DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1290 },
    { code: "LEH-14", name: "PHAPAX DROPS (Headache / Migraine)", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1540 },
    { code: "LEH-15", name: "PHYTOBERRY DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1040 },
    { code: "LEH-16", name: "PHYTOTUX-H SYRUP", company: "Lehning Laboratories Pharma", category: "Syrup", packing: "90 ML", price: 1140 },
    { code: "LEH-17", name: "REXORUBIA GRANULES", company: "Lehning Laboratories Pharma", category: "Granules", packing: "350 GMS", price: 2490 },
    { code: "LEH-18", name: "SANTAHERBA DROPS (Asthma)", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1440 },
    { code: "LEH-19", name: "SINUSPAX TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1440 },
    { code: "LEH-20", name: "SOLUDOR DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "90 ML", price: 1690 },
    { code: "LEH-21", name: "TONIC VEGETAL SYRUP 90ML", company: "Lehning Laboratories Pharma", category: "Syrup", packing: "90 ML", price: 1040 },
    { code: "LEH-22", name: "TONIC VEGETAL SYRUP 250ML", company: "Lehning Laboratories Pharma", category: "Syrup", packing: "250 ML", price: 2040 },
    { code: "LEH-23", name: "TRIM DROPS", company: "Lehning Laboratories Pharma", category: "Drops", packing: "30 ML", price: 1240 },
    { code: "LEH-24", name: "TRIM TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1240 },
    { code: "LEH-25", name: "URARTHONE SYRUP", company: "Lehning Laboratories Pharma", category: "Syrup", packing: "250 ML", price: 2190 },
    { code: "LEH-26", name: "VINICARDE SYRUP", company: "Lehning Laboratories Pharma", category: "Syrup", packing: "250 ML", price: 2490 },
    { code: "LEH-27", name: "VOXPAX TABLETS", company: "Lehning Laboratories Pharma", category: "Tablets", packing: "60 TABS", price: 1540 },
];

// 3. HFP Private Ltd (Syrups, Drops, Tablets, Specialities)
const hfpList = [
    // 120ml Syrups
    { code: "HFP-S01", name: "ALFALFA SYRUP 120ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S02", name: "ALLERGIC-N SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },
    { code: "HFP-S03", name: "ALLERGIC-S SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },
    { code: "HFP-S04", name: "ASTHAMA H SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },
    { code: "HFP-S05", name: "BIONA TONIC SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S06", name: "BIO # 21 SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S07", name: "BONE PLUS SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S08", name: "COUGH CONTROL SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S09", name: "COUGH CONTROL (SF) SUGAR FREE", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S10", name: "COUGH CONTROL (HONEY)", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },
    { code: "HFP-S11", name: "DYROFEN SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S12", name: "FEVER KILL SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S13", name: "FERRUM COMPOSE SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S14", name: "GASTROGENA SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S15", name: "GASTROGENA + PODINA SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S16", name: "GLYCO MAX SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S17", name: "GINGO MAX SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },
    { code: "HFP-S18", name: "GROWTH UP BABY TONIC", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S19", name: "GYNO PLUS SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 230 },
    { code: "HFP-S20", name: "URONAL SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 250 },

    // 250ml Syrups
    { code: "HFP-S250-1", name: "ALFALFA SYRUP 250ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-2", name: "ALTRIS CARDIAL SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-3", name: "AVENA FORT TONIC", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-4", name: "CALCI + SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-5", name: "GASTROGENA + PODINA 250ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-6", name: "JAM-E-QALB SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-7", name: "NERVO + SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-8", name: "POWER INN SYRUP", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-9", name: "SHARBAT FAULAD", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 375 },
    { code: "HFP-S250-10", name: "URONAL SYRUP 250ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 395 },

    // Specialities & Tablets
    { code: "HFP-TAB1", name: "COLD CURE TABLETS (100 Tab)", company: "HFP Pvt Ltd", category: "Tablets", packing: "100 Tab", price: 375 },
    { code: "HFP-TAB2", name: "BED WEDDING TABLETS (100 Tab)", company: "HFP Pvt Ltd", category: "Tablets", packing: "100 Tab", price: 275 },
    { code: "HFP-TAB3", name: "GASTROGENA TABLETS (30 Tab)", company: "HFP Pvt Ltd", category: "Tablets", packing: "30 Tab", price: 175 },
    { code: "HFP-TAB4", name: "IOMAX TABLETS (20 Tab)", company: "HFP Pvt Ltd", category: "Tablets", packing: "20 Tab", price: 245 },
    { code: "HFP-TAB5", name: "CALCI + TABLETS (30 Tab)", company: "HFP Pvt Ltd", category: "Tablets", packing: "30 Tab", price: 450 },
    { code: "HFP-DRP1", name: "KIDNEY GOLD DROPS 20ML", company: "HFP Pvt Ltd", category: "Drops", packing: "20 ml", price: 575 },
    { code: "HFP-DRP2", name: "KOREAN GINSENG TONIC 120ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 1170 },
    { code: "HFP-DRP3", name: "KOREAN GINSENG TONIC 250ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "250 ml", price: 2170 },
    { code: "HFP-DRP4", name: "HEPA GYARD FORT 120ML", company: "HFP Pvt Ltd", category: "Syrup", packing: "120 ml", price: 695 },
    { code: "HFP-DRP5", name: "WEIGHT GAINER CAPSULES (60 Cap)", company: "HFP Pvt Ltd", category: "Capsules", packing: "60 Cap", price: 1175 },
    { code: "HFP-DRP6", name: "SEXO FORT CAPSULES (60 Cap)", company: "HFP Pvt Ltd", category: "Capsules", packing: "60 Cap", price: 1575 },
    { code: "HFP-DRP7", name: "HORSE POWER TILLA 20ML", company: "HFP Pvt Ltd", category: "Oil / Tilla", packing: "20 ml", price: 1275 },
];

// 4. GHR Homoeo Pharma Drops Series (GHR 1 to 42)
const ghrList = [
    { code: "GHR-01", name: "GHR 1 (Male Vitality / Premature Ejaculation)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-02", name: "GHR 2 (Diabetes / Sugar Complications)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-03", name: "GHR 3 (Obesity / Metabolism Booster)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-04", name: "GHR 4 (Kidney & Bladder Stones)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-05", name: "GHR 5 (Chronic Constipation / IBS-C)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-06", name: "GHR 6 (Uric Acid / Gout / Joint Pain)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-07", name: "GHR 7 (Thyroid Diseases / Hypo & Hyper)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-08", name: "GHR 8 (Child Stunting & Malnutrition)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-09", name: "GHR 9 (Sciatica / Nerve Pain)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-10", name: "GHR 10 (Kidney & Bladder Infection / Edema)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-11", name: "GHR 11 (Liver & Gallbladder Stones / Hepatitis)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-12", name: "GHR 12 (Eczema / Skin Itching & Allergy)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-13", name: "GHR 13 (Female Menstrual Complaints / PMS)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-14", name: "GHR 14 (Anemia / Blood Deficiency)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-15", name: "GHR 15 (General & Nervous Weakness)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-16", name: "GHR 16 (Diarrhea / IBS-D / Dysentery)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-17", name: "GHR 17 (Asthma / Bronchitis)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-18", name: "GHR 18 (Prostate Enlargement / BPH)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-19", name: "GHR 19 (Piles / Hemorrhoids / Varicose Veins)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-20", name: "GHR 20 (Tonsillitis / Throat Swelling)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-21", name: "GHR 21 (Heart Diseases / Palpitation)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-22", name: "GHR 22 (Anxiety / Stress / Insomnia)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-23", name: "GHR 23 (Memory Weakness / Brain Booster)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-24", name: "GHR 24 (Acne / Pimples)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-25", name: "GHR 25 (Warts / Corns / Skin Growths)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-26", name: "GHR 26 (GERD / Gastric Acidity)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-27", name: "GHR 27 (Sinusitis / Toothache Infection)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-28", name: "GHR 28 (Eye Weakness / Cataract)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-29", name: "GHR 29 (Hair Fall / Premature Greying)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-31", name: "GHR 31 (Neuralgia / Nerve Inflammation)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-32", name: "GHR 32 (Nasal Allergy / Sneezing)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-33", name: "GHR 33 (Bed Wetting / Incontinence)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-34", name: "GHR 34 (High Cholesterol / Lipid Control)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-35", name: "GHR 35 (Psoriasis / Dry Scaling)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-37", name: "GHR 37 (Chronic Cough / Bronchial Irritation)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-38", name: "GHR 38 (Flu / Cold / Nasal Congestion)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-39", name: "GHR 39 (Hypertension / High BP)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-40", name: "GHR 40 (Appetite & Weight Gain Booster)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-41", name: "GHR 41 (Migraine / Severe Headache)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
    { code: "GHR-42", name: "GHR 42 (Otitis Media / Ear Discharge & Tinnitus)", company: "GHR Homoeo Pharma", category: "Drops", packing: "30 ml", price: 350 },
];

// 5. Kent Specialities & No. Series
const kentList = [
    { code: "KC-A2.13", name: "Acne Cure Cream", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "30gm", price: 160 },
    { code: "KC-A3.13", name: "Acne Safe Ointment", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "20gm", price: 150 },
    { code: "KC-A1.20", name: "Acnetop Capsules", company: "Kent Homoeopathic Pharmacy", category: "Capsules", packing: "20's", price: 250 },
    { code: "KC-E2.09", name: "Eastlive Tonic Syrup", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 500 },
    { code: "KC-A1.01", name: "Action-1 Drops", company: "Kent Homoeopathic Pharmacy", category: "Drops", packing: "30ml", price: 230 },
    { code: "KC-A2.01", name: "Action-2 Spray", company: "Kent Homoeopathic Pharmacy", category: "Spray", packing: "35gm", price: 230 },
    { code: "KC-A2.27", name: "Action-3 Cream", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "35gm", price: 220 },
    { code: "KC-A4.03", name: "Add Plus Super Complex Spray", company: "Kent Homoeopathic Pharmacy", category: "Spray", packing: "120ml", price: 260 },
    { code: "KC-A1.20", name: "Add Plus Super Complex Capsule", company: "Kent Homoeopathic Pharmacy", category: "Capsules", packing: "20's", price: 250 },
    { code: "KC-A1.22", name: "Addstop Slimming 21-day Program", company: "Kent Homoeopathic Pharmacy", category: "Drops", packing: "90's", price: 790 },
    { code: "KC-A2.16", name: "Alfalfa Extra Drops", company: "Kent Homoeopathic Pharmacy", category: "Drops", packing: "60ml", price: 170 },
    { code: "KC-A1.07", name: "Alfalfa Forte Syrup 120ml", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 230 },
    { code: "KC-A1.05", name: "Alfalfa Forte Syrup 250ml", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "250ml", price: 440 },
    { code: "KC-A3.09", name: "Alfalfa Tonic Syrup", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 230 },
    { code: "KC-A1.09", name: "Alfalfa Cupules", company: "Kent Homoeopathic Pharmacy", category: "Capsules", packing: "30's", price: 335 },
    { code: "KC-A2.02", name: "Allergy Relief Nasal Spray", company: "Kent Homoeopathic Pharmacy", category: "Spray", packing: "15ml", price: 220 },
    { code: "KC-B1.07", name: "Baby Tonic Syrup", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "60ml", price: 170 },
    { code: "KC-B1.05", name: "Baby Tonic Syrup 120ml", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 250 },
    { code: "KC-B1.14", name: "Bed Wetting Tablets", company: "Kent Homoeopathic Pharmacy", category: "Tablets", packing: "30's", price: 240 },
    { code: "KC-B1.09", name: "Bonevil Tonic Syrup", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 230 },
    { code: "KC-B1.07", name: "Berberis Renal Drops", company: "Kent Homoeopathic Pharmacy", category: "Drops", packing: "30ml", price: 240 },
    { code: "KC-C1.07", name: "Calcium Liquid", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "250ml", price: 420 },
    { code: "KC-C1.14", name: "Calcium Max Liquid", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "1000ml", price: 1500 },
    { code: "KC-C9.30", name: "Calcium Tab (Orange Flavored)", company: "Kent Homoeopathic Pharmacy", category: "Tablets", packing: "75's", price: 185 },
    { code: "KC-C8.27", name: "Calcium Tablets", company: "Kent Homoeopathic Pharmacy", category: "Tablets", packing: "150's", price: 180 },
    { code: "KC-C19.43", name: "Calendula Cream (Tube)", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "35gm", price: 165 },
    { code: "KC-C22.02", name: "MFI (Computer Eye Drops)", company: "Kent Homoeopathic Pharmacy", category: "Eye / Ear Drops", packing: "40's", price: 260 },
    { code: "KC-C16.38", name: "Calendula Extra (Cream)", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "200gm", price: 425 },
    { code: "KC-C11.38", name: "Calcium Max Cream", company: "Kent Homoeopathic Pharmacy", category: "Cream / Ointment", packing: "15gm", price: 115 },
    { code: "KC-C20.02", name: "Cineraria Maritima Eye Drops", company: "Kent Homoeopathic Pharmacy", category: "Eye / Ear Drops", packing: "10ml", price: 200 },
    { code: "KC-C17.20", name: "Crataegus Heart Capsules", company: "Kent Homoeopathic Pharmacy", category: "Capsules", packing: "30's", price: 260 },
    { code: "KC-C34.03", name: "Crataegus Gold Drops", company: "Kent Homoeopathic Pharmacy", category: "Drops", packing: "30ml", price: 240 },
    { code: "KC-D2.09", name: "Damiana Tonic", company: "Kent Homoeopathic Pharmacy", category: "Syrup", packing: "120ml", price: 240 },
];

const allExtractedMedicines = [
    ...reckewegList,
    ...lehningList,
    ...hfpList,
    ...ghrList,
    ...kentList
];

// Helper to escape CSV values
function csvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

// 1. Export Consolidated Master CSV for Software Docs
let masterCsv = "Item Code,Medicine Name,Manufacturing Company,Category,Packing / Size,Retail Price (Rs),Trade Cost (Rs),Stock Quantity\n";
allExtractedMedicines.forEach(m => {
    masterCsv += `${csvCell(m.code)},${csvCell(m.name)},${csvCell(m.company)},${csvCell(m.category)},${csvCell(m.packing)},${m.price},0,0\n`;
});
fs.writeFileSync('Software_Docs_PriceLists_Master.csv', masterCsv, 'utf8');

// 2. Export Individual Company CSVs for easy reference
const companies = [
    { name: "Dr_Reckeweg_Germany", data: reckewegList },
    { name: "Lehning_Laboratories_France", data: lehningList },
    { name: "HFP_Private_Ltd", data: hfpList },
    { name: "GHR_Homoeo_Pharma", data: ghrList },
    { name: "Kent_Homoeopathic_Pharmacy", data: kentList }
];

companies.forEach(c => {
    let compCsv = "Item Code,Medicine Name,Category,Packing / Size,Retail Price (Rs)\n";
    c.data.forEach(m => {
        compCsv += `${csvCell(m.code)},${csvCell(m.name)},${csvCell(m.category)},${csvCell(m.packing)},${m.price}\n`;
    });
    fs.writeFileSync(`Software Docs/Lists/${c.name}_PriceList.csv`, compCsv, 'utf8');
});

console.log(`🎉 Successfully extracted and generated Excel CSVs from all photo lists!`);
console.log(`Total Extracted Products: ${allExtractedMedicines.length}`);
console.log(`- Reckeweg: ${reckewegList.length}`);
console.log(`- Lehning France: ${lehningList.length}`);
console.log(`- HFP Private Ltd: ${hfpList.length}`);
console.log(`- GHR Pharma: ${ghrList.length}`);
console.log(`- Kent Pharma: ${kentList.length}`);
