import crypto from 'crypto';
import type { AuthTokenPayload } from '../types/api.types.ts';

export class AuthMiddleware {
  private static readonly SECRET = process.env.JWT_SECRET || 'cf_default_jwt_secret_production_guard';

  /**
   * Verifies Bearer JWT Token from request Authorization header
   */
  public static verifyToken(
    authHeader?: string
  ): { valid: boolean; payload?: AuthTokenPayload; error?: string } {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or malformed Authorization header' };
    }

    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT structure' };
    }

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature safely
    const computedSignature = crypto
      .createHmac('sha256', this.SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const buf1 = Buffer.from(signature);
    const buf2 = Buffer.from(computedSignature);

    if (buf1.length !== buf2.length || !crypto.timingSafeEqual(buf1, buf2)) {
      return { valid: false, error: 'Invalid JWT signature' };
    }

    try {
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
      const payload: AuthTokenPayload = JSON.parse(payloadJson);

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'JWT session token expired' };
      }

      return { valid: true, payload };
    } catch {
      return { valid: false, error: 'Failed to parse JWT payload' };
    }
  }

  /**
   * Helper to generate signed JWT token for testing / auth endpoint
   */
  public static generateToken(userId: string, clinicId: string, role: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        user_id: userId,
        clinic_id: clinicId,
        role: role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 Days
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }
}
