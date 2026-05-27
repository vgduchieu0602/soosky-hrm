import type { PaginationQuery, PaginationMeta } from '@shared/types/pagination.type';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePagination(query: PaginationQuery) {
  const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Parse `sort=-createdAt,name` → `{ createdAt: -1, name: 1 }`
 */
export function parseSort(sort?: string): Record<string, 1 | -1> | undefined {
  if (!sort) return undefined;
  const out: Record<string, 1 | -1> = {};
  for (const part of sort.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) out[trimmed.slice(1)] = -1;
    else out[trimmed] = 1;
  }
  return out;
}
