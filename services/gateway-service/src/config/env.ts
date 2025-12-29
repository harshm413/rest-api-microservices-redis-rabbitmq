import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { createEnv, z } from '@chatapp/common';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  USER_SERVICE_URL: z.string().url(),
  AUTH_SERVICE_URL: z.string().url(),
  CHAT_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  INTERNAL_API_TOKEN: z.string().min(16),
});

type EnvType = z.infer<typeof envSchema>;

export const env: EnvType = createEnv(envSchema, {
  serviceName: 'gateway-service',
});

export type Env = typeof env;
