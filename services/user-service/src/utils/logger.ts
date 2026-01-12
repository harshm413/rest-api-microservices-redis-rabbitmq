import { createLogger } from '@rest-api/common';
import type { Logger } from '@rest-api/common';

export const logger: Logger = createLogger({ name: 'user-service' });
