import { z } from '@rest-api/common';

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
});
