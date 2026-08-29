import net from 'node:net';
import os from 'node:os';

export interface ClinicServerPairingConfig {
  host: string;
  port: number;
  serverName: string;
  apiVersion: string;
  protocol: 'http' | 'https';
}

export interface PairingHandshakeResult {
  paired: boolean;
  targetUrl: string;
  latencyMs: number;
  error?: string;
  serverDetails?: {
    clinicName: string;
    serverIp: string;
    serverPort: number;
    status: string;
  };
}

export class PhonePairingService {
  private defaultPort: number = 5000;

  /**
   * Discovers local LAN IPv4 network interfaces available on the system.
   */
  public getLocalIpAddresses(): string[] {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          addresses.push(alias.address);
        }
      }
    }

    return addresses;
  }

  /**
   * Constructs standard LAN target URL for local ClinicFlow server (192.168.x.x:5000)
   */
  public buildServerUrl(host: string = '192.168.1.100', port: number = 5000): string {
    const cleanHost = host.trim() || '192.168.1.100';
    const cleanPort = port > 0 && port < 65536 ? port : this.defaultPort;
    return `http://${cleanHost}:${cleanPort}`;
  }

  /**
   * Simulates or performs connection probe / pairing handshake to Clinic local server.
   */
  public async performPairingHandshake(
    host: string,
    port: number = 5000,
    timeoutMs: number = 3000
  ): Promise<PairingHandshakeResult> {
    const startTime = Date.now();
    const targetUrl = this.buildServerUrl(host, port);

    // Basic IP validation check
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(host) && host !== 'localhost' && host !== '127.0.0.1') {
      return {
        paired: false,
        targetUrl,
        latencyMs: 0,
        error: `Invalid IP address format: ${host}`
      };
    }

    try {
      const isReachable = await this.pingPort(host, port, timeoutMs);
      const latencyMs = Date.now() - startTime;

      if (!isReachable) {
        return {
          paired: false,
          targetUrl,
          latencyMs,
          error: `Connection timed out while probing ${host}:${port}`
        };
      }

      return {
        paired: true,
        targetUrl,
        latencyMs,
        serverDetails: {
          clinicName: 'Dr. Kashif Khan Clinic & Wholesale Medical Store',
          serverIp: host,
          serverPort: port,
          status: 'ONLINE_ACTIVE'
        }
      };
    } catch (err: any) {
      return {
        paired: false,
        targetUrl,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Pairing handshake failed'
      };
    }
  }

  /**
   * Helper function to probe socket connection to Clinic server host and port.
   */
  private pingPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      const onError = () => {
        socket.destroy();
        resolve(false);
      };

      socket.setTimeout(timeoutMs);
      socket.once('error', onError);
      socket.once('timeout', onError);

      socket.connect(port, host, () => {
        socket.end();
        resolve(true);
      });
    });
  }

  /**
   * Generates LAN QR Code payload string for mobile app pairing scan.
   */
  public generateQrPairingPayload(host: string, port: number = 5000, clinicId: string = 'CLINIC-HYD-01'): string {
    const payload = {
      type: 'CLINICFLOW_MOBILE_PAIRING',
      version: '1.0.0',
      clinicId,
      serverUrl: this.buildServerUrl(host, port),
      issuedAt: new Date().toISOString()
    };

    return JSON.stringify(payload);
  }
}
