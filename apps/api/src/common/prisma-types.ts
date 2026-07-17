// Utility to safely cast Record<string, unknown> to Prisma's InputJsonValue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toJson = (v: Record<string, unknown> | unknown): any => v;
