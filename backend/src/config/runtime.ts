import 'dotenv/config';

export function integerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} debe ser un entero positivo`);
  return value;
}

export function allowedOrigins(): string[] {
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('CORS_ORIGINS debe contener orígenes http(s) exactos, sin rutas ni barra final');
    }
  }
  if (!origins.length) throw new Error('Configura al menos un origen en CORS_ORIGINS');
  return origins;
}

export const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    callback(null, !origin || allowedOrigins().includes(origin));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
};

export function redisConnection() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL debe usar redis:// o rediss://');
    const db = Number(url.pathname.slice(1) || 0);
    if (!Number.isSafeInteger(db) || db < 0) throw new Error('Base Redis inválida');
    return { host: url.hostname, port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db, ...(url.protocol === 'rediss:' ? { tls: {} } : {}) };
  }
  return { host: process.env.REDIS_HOST || '127.0.0.1', port: integerEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined };
}
