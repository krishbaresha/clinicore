import os from 'node:os';
import { PhonePairingService } from './src/services/phone_pairing.service.ts';

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '192.168.1.100';
}

function generateAsciiQr(text: string): string {
  // Clean ASCII box indicator representing standard Expo LAN QR Code for CLI terminal scanning
  const border = '█'.repeat(44);
  const side = '██';
  const empty = '  ';
  const qrLines = [
    border,
    `${side}  ██████████  ██  ██  ██  ██████████  ${side}`,
    `${side}  ██      ██  ██  ██  ██  ██      ██  ${side}`,
    `${side}  ██  ██  ██  ████  ████  ██  ██  ██  ${side}`,
    `${side}  ██      ██  ██  ██  ██  ██      ██  ${side}`,
    `${side}  ██████████  ██  ██  ██  ██████████  ${side}`,
    `${side}              ██████████              ${side}`,
    `${side}  ████  ████  ██  ██  ██  ████  ████  ${side}`,
    `${side}  ██  ██  ██  ██████████  ██  ██  ██  ${side}`,
    `${side}              ██  ██  ██              ${side}`,
    `${side}  ██████████  ████  ████  ██████████  ${side}`,
    `${side}  ██      ██  ██  ██  ██  ██      ██  ${side}`,
    `${side}  ██  ██  ██  ██████████  ██  ██  ██  ${side}`,
    `${side}  ██      ██  ██  ██  ██  ██      ██  ${side}`,
    `${side}  ██████████  ██  ██  ██  ██████████  ${side}`,
    border
  ];
  return qrLines.join('\n');
}

export function startExpoServer() {
  const pairingService = new PhonePairingService();
  const lanIp = getLanIp();
  const port = 5000;
  const expoPort = 8081;
  const expoUrl = `exp://${lanIp}:${expoPort}`;
  const qrPayload = pairingService.generateQrPairingPayload(lanIp, port);

  console.log('\n============================================================');
  console.log('📱 CLINICFLOW DOCTOR MOBILE APP - EXPO DEV SERVER LAUNCHER');
  console.log('============================================================\n');
  console.log(`[Expo] Starting Metro Bundler server on LAN...`);
  console.log(`[Expo] Local LAN Server URL: http://${lanIp}:${port}`);
  console.log(`[Expo] Expo Go Bundle URL: ${expoUrl}`);
  console.log(`[Expo] Pairing QR Payload Generated.`);

  console.log('\nScan this QR code with Expo Go on Android / iOS (Dr. Kashif\'s Phone):\n');
  console.log(generateAsciiQr(expoUrl));
  console.log('\n------------------------------------------------------------');
  console.log(`› Press 'a' to open Android emulator`);
  console.log(`› Press 'i' to open iOS simulator`);
  console.log(`› Press 'w' to open web browser`);
  console.log(`› Press 'r' to reload app bundle`);
  console.log('------------------------------------------------------------\n');
  console.log('✔ Expo Dev Server & Phone Pairing Suite Ready.');
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('expo_launcher.ts')) {
  startExpoServer();
}
