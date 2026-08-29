import crypto from 'crypto';

export class AuthService {
  private static readonly SALT_PREFIX = 'cf_salt_2026_master';

  /**
   * Hashes plain-text password using RFC 6234 Salted SHA-256 Digest
   */
  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const computedDigest = crypto
      .createHash('sha256')
      .update(this.SALT_PREFIX + '::' + salt + '::' + password)
      .digest('hex');
    return `cf_s256$${salt}$${computedDigest}`;
  }

  /**
   * Verifies plain-text password against stored hash digest
   */
  public static verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash.startsWith('cf_s256$')) {
      return false;
    }
    const parts = storedHash.split('$');
    if (parts.length !== 3) {
      return false;
    }
    const salt = parts[1];
    const targetDigest = parts[2];
    const computedDigest = crypto
      .createHash('sha256')
      .update(this.SALT_PREFIX + '::' + salt + '::' + password)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(targetDigest), Buffer.from(computedDigest));
  }

  /**
   * Generates Base64URL-encoded JWT token payload
   */
  public static generateSessionToken(userId: string, clinicId: string, role: string): string {
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
    const secret = process.env.JWT_SECRET || 'cf_default_jwt_secret_production_guard';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    return `${header}.${payload}.${signature}`;
  }
}
