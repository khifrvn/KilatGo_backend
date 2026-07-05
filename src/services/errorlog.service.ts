import { prisma } from '../config/database';

interface LogInput {
  level?: string;
  statusCode?: number;
  message: string;
  path?: string;
  method?: string;
  stack?: string;
  userId?: string;
}

// Fire-and-forget: jangan sampai gagal logging menggagalkan request.
export function logError(input: LogInput): void {
  prisma.errorLog
    .create({
      data: {
        level: input.level || 'ERROR',
        statusCode: input.statusCode ?? null,
        message: (input.message || 'Unknown error').slice(0, 4000),
        path: input.path?.slice(0, 255),
        method: input.method?.slice(0, 10),
        stack: input.stack?.slice(0, 8000),
        userId: input.userId,
      },
    })
    .catch(() => {
      /* diamkan — hindari loop error saat logging */
    });
}

export async function listErrors(params: { level?: string; limit?: number } = {}) {
  return prisma.errorLog.findMany({
    where: params.level ? { level: params.level } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(params.limit || 200, 500),
  });
}

export async function clearErrors() {
  const { count } = await prisma.errorLog.deleteMany({});
  return { cleared: count };
}
