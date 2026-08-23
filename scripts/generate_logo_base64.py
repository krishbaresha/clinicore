import base64

with open("e:/Soft/DrCreate/ClinicFlow/frontend/public/clinic-logo.png", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

with open("e:/Soft/DrCreate/ClinicFlow/frontend/src/utils/clinicLogoBase64.js", "w", encoding="utf-8") as out:
    out.write(f'export const CLINIC_LOGO_BASE64 = "data:image/png;base64,{b64}";\n')

print("SUCCESS: clinicLogoBase64.js written!")
