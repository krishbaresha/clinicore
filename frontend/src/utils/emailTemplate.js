/**
 * emailTemplate.js
 * 🎨 Signature Dark Teal & Emerald CliniCore HTML Email Template Generator
 * Responsive, compatible with all modern email clients & webmail
 */

export function generateCliniCoreEmailTemplate({
  clinicName = "H/Dr.Asif Ashraf Khan Clinic",
  targetEmail = "admin@clinicore.pk",
  dateStr = new Date().toISOString().split("T")[0],
  timestampStr = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }),
  totalInflows = 0,
  totalStockValuation = 0,
  staffCount = 0,
  patientsCount = 0,
  backupFilename = "CliniCore_Encrypted_Backup.cfbak",
  backupSizeBytes = 0,
  downloadUrl = "https://api.clinicore.me/api/v1/system/download-backup?file=CliniCore_Encrypted_Backup.cfbak",
  frequencyLabel = "Manual On-Demand Backup",
  isTestPing = false,
}) {
  const sizeKb = (backupSizeBytes / 1024).toFixed(1) + " KB";

  if (isTestPing) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CliniCore Resend API Connectivity Test</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 30px -8px rgba(15, 118, 110, 0.12);">
          <tr>
            <td style="background: linear-gradient(135deg, #042f2e 0%, #0f766e 100%); padding: 36px 32px; text-align: left;">
              <span style="display: inline-block; background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                ✅ Resend Connection Verified
              </span>
              <h1 style="margin: 6px 0 2px 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
                CliniCore <span style="color: #34d399; font-weight: 300;">Hybrid OS</span>
              </h1>
              <p style="margin: 0; color: #ccfbf1; font-size: 13px; font-weight: 500;">
                Live Background Dispatch Gateway Test
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Hello Super Admin,<br>
                This confirms that your <strong>Resend API Gateway</strong> on <strong style="color: #0f766e;">api.clinicore.me</strong> is active and communicating directly with Resend cloud servers.
              </p>
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 18px; margin-bottom: 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size: 12px; color: #065f46; line-height: 1.6;">
                      <strong>Facility:</strong> ${clinicName}<br>
                      <strong>Target Inbox:</strong> ${targetEmail}<br>
                      <strong>Dispatched At:</strong> ${timestampStr}<br>
                      <strong>Gateway Status:</strong> <span style="color: #047857; font-weight: bold;">HTTP 200 Live</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                Automated daily closing statements and encrypted <code>.cfbak</code> database attachments will be delivered on schedule to this address.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                CliniCore Hybrid OS &bull; K.B Software Hyderabad &bull; Confidential Verification Transmission
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CliniCore Encrypted Database Vault &amp; Audit Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 30px -8px rgba(15, 118, 110, 0.12);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #042f2e 0%, #0f766e 100%); padding: 36px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      🔒 Encrypted System Backup
                    </span>
                    <h1 style="margin: 6px 0 2px 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">
                      CliniCore <span style="color: #34d399; font-weight: 300;">Hybrid OS</span>
                    </h1>
                    <p style="margin: 0; color: #ccfbf1; font-size: 13px; font-weight: 500;">
                      Automated Intelligence &amp; Master Database Vault Transmission
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Clinic & Exact Timestamp Sub-Header -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 12px; color: #475569;">
                    <strong style="color: #0f172a; font-size: 13px;">${clinicName}</strong><br>
                    <span style="color: #047857; font-weight: 700;">📅 Backup Timestamp: ${timestampStr}</span>
                  </td>
                  <td align="right" style="font-size: 11px; font-weight: 700; color: #0f766e;">
                    <span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 8px;">
                      ${frequencyLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Hello Super Admin,<br>
                Your encrypted database vault snapshot taken on <strong>${timestampStr}</strong> has been compiled and is ready for download. Below is your facility summary:
              </p>

              <!-- Financial & Operational 2x2 Metric Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">💰 Total Inflows</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px; font-family: monospace;">
                      Rs. ${Number(totalInflows).toLocaleString("en-US")}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">OPD Fees + POS &amp; B2B Sales</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">📦 Stock Valuation</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px; font-family: monospace;">
                      Rs. ${Number(totalStockValuation).toLocaleString("en-US")}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Central Godown &amp; Pharmacy</div>
                  </td>
                </tr>
                <tr><td height="12" colspan="3"></td></tr>
                <tr>
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">👥 Active Staff</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                      ${staffCount} Staff Members
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Doctors, Cashiers, Operators</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">📇 Registered Patients</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                      ${patientsCount} Patients
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">EMR &amp; Historical Profiles</div>
                  </td>
                </tr>
              </table>

              <!-- Encrypted Attachment & Direct Download CTA Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%); border: 1.5px solid #6ee7b7; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align: top;">
                          <div style="width: 40px; height: 40px; background-color: #0f766e; border-radius: 12px; text-align: center; line-height: 40px; color: #ffffff; font-size: 20px;">
                            🔒
                          </div>
                        </td>
                        <td style="padding-left: 12px; vertical-align: top;">
                          <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.8px;">
                            Encrypted Database Vault Attached
                          </div>
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 3px; font-family: monospace;">
                            ${backupFilename}
                          </div>
                          <div style="font-size: 12px; color: #047857; margin-top: 3px;">
                            Size: <strong>${sizeKb}</strong> &bull; Cipher: <strong>AES-XOR 0x5a</strong> &bull; Status: <strong>Verified Intact</strong>
                          </div>
                          <div style="font-size: 11.5px; color: #065f46; margin-top: 4px;">
                            Snapshot Time: <strong>${timestampStr}</strong>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- 1-CLICK DIRECT DOWNLOAD BUTTON -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 18px;">
                      <tr>
                        <td align="center">
                          <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" style="display: block; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; font-size: 14px; font-weight: 800; text-align: center; text-decoration: none; padding: 15px 24px; border-radius: 12px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);">
                            📥 Download .cfbak Backup File Directly (1-Click)
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top: 12px; padding: 8px 12px; background: rgba(16, 185, 129, 0.12); border-radius: 8px; border: 1px dashed #10b981; font-size: 11px; color: #065f46; line-height: 1.5; text-align: center;">
                      💡 You can also download the attached <strong>${backupFilename}</strong> file directly from your email attachments section below.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Restoration Guide Step-by-Step -->
              <div style="background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 18px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  📋 How to Restore from this Backup:
                </div>
                <ol style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.7; color: #334155;">
                  <li>Download the attached <strong>.cfbak</strong> file to your local computer.</li>
                  <li>Log in to your CliniCore Super Admin Panel at <a href="https://clinicore.me/developer-admin" style="color: #0f766e; font-weight: bold; text-decoration: none;">clinicore.me/developer-admin</a>.</li>
                  <li>Navigate to <strong>Backup, Restore &amp; Data Modes</strong> and select <strong>Restore .cfbak File</strong>.</li>
                  <li>All 26 relational collections, stock ledgers, patient records, and sales history will be restored in seconds.</li>
                </ol>
              </div>

              <!-- CTA Button to Command Center -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <a href="https://clinicore.me/developer-admin" style="display: inline-block; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: #ffffff; font-size: 13px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);">
                      Open CliniCore Command Center &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Signature -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #334155;">
                CliniCore Hybrid OS &bull; Engineered by K.B Software Hyderabad
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Confidential Automated Transmission. This message is intended solely for authorized clinic ownership.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
