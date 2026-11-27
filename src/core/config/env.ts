/**
 * Startup & runtime environment validation.
 * Fails loudly when critical secrets are missing instead of using unsafe fallbacks.
 */

const REQUIRED_SERVER_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getJwtSecret(): string {
  const secret = getRequiredEnv('JWT_SECRET');
  if (
    process.env.NODE_ENV === 'production' &&
    (secret.length < 32 || secret.includes('fallback-key'))
  ) {
    throw new Error(
      'JWT_SECRET must be a strong secret (at least 32 characters) in production.'
    );
  }
  return secret;
}

export function validateServerEnv(): void {
  const missing = REQUIRED_SERVER_VARS.filter(
    (key) => !process.env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  // Enforce production strength checks
  getJwtSecret();
}
