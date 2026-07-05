/**
 * Pure domain rules for performance criteria. No Express, no Mongoose.
 */

/**
 * Base key for a criterion: explicit key wins; otherwise slugify the label.
 * Criteria are equally weighted (ratio = simple average), so no weight is derived here.
 */
export function baseCriterionKey(label: string, key?: string): string {
  return (
    (key?.trim() ||
      label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')) || 'criterion'
  );
}
