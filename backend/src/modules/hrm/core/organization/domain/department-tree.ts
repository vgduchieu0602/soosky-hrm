/**
 * Pure organization domain rules — no Express, no Mongoose.
 * Department tree assembly, head-name formatting and subtree/cycle detection.
 */

export interface DeptHead {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface DeptNode {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  managerId: string | null;
  head: DeptHead | null;
  description?: string;
  status: string;
  headcount: number;
  children: DeptNode[];
}

/** Flat department row as read from the repository (ids already stringified). */
export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  managerId: string | null;
  description?: string;
  status: string;
}

/** Raw employee-head row (name parts + avatar) used to build the head label. */
export interface HeadRow {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  avatarUrl?: string;
}

/** Compose the display name of a department head: "last middle first". */
export function headName(h: HeadRow): string {
  return [h.lastName, h.middleName, h.firstName].filter(Boolean).join(' ').trim();
}

export function buildHeadMap(heads: HeadRow[]): Map<string, DeptHead> {
  const map = new Map<string, DeptHead>();
  for (const h of heads) {
    map.set(h.id, { id: h.id, name: headName(h), avatarUrl: h.avatarUrl });
  }
  return map;
}

/**
 * Build the flat list of department nodes (with headcount + resolved head),
 * optionally nested into a forest when `asTree` is set.
 */
export function assembleDepartments(
  rows: DepartmentRow[],
  countMap: Map<string, number>,
  headMap: Map<string, DeptHead>,
  asTree: boolean,
): DeptNode[] {
  const flat: DeptNode[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    parentDepartmentId: d.parentDepartmentId,
    managerId: d.managerId,
    head: d.managerId ? (headMap.get(d.managerId) ?? null) : null,
    description: d.description,
    status: d.status,
    headcount: countMap.get(d.id) ?? 0,
    children: [],
  }));

  if (!asTree) return flat;

  const byId = new Map(flat.map((n) => [n.id, n]));
  const roots: DeptNode[] = [];
  for (const node of flat) {
    if (node.parentDepartmentId && byId.has(node.parentDepartmentId)) {
      byId.get(node.parentDepartmentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Collect the id + all descendant ids of a department (for cycle / archive checks). */
export function collectSubtreeIds(
  rows: { id: string; parentDepartmentId: string | null }[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const d of rows) {
    if (!d.parentDepartmentId) continue;
    const list = childrenByParent.get(d.parentDepartmentId) ?? [];
    list.push(d.id);
    childrenByParent.set(d.parentDepartmentId, list);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (result.has(cur)) continue;
    result.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) stack.push(child);
  }
  return result;
}
