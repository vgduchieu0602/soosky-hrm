import type { DepartmentNode } from "@features/organization/types/organization.types";

const COLOR_BY_CODE: Record<string, string> = {
  SK: "slate",
  CEO: "blue",
  CGO: "indigo",
  PO: "violet",
  APP: "cyan",
  DSG: "rose",
  QA: "emerald",
  BE: "blue",
  HR: "violet",
  UA: "amber",
};

const CHIP_CYCLE = ["blue", "cyan", "violet", "emerald", "amber", "rose", "indigo"];

/** Stable chip color for a department code (mapped, else hashed to the palette). */
export function chipFor(code: string): string {
  if (COLOR_BY_CODE[code]) return COLOR_BY_CODE[code];
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash * 31 + code.charCodeAt(i)) % 9973;
  return CHIP_CYCLE[hash % CHIP_CYCLE.length];
}

/** Headcount of a node plus all descendants. */
export function subtreeHeadcount(node: DepartmentNode): number {
  return (node.headcount || 0) + node.children.reduce((s, c) => s + subtreeHeadcount(c), 0);
}

/** Flatten a department tree into a list (depth-first). */
export function flatten(tree: DepartmentNode[]): DepartmentNode[] {
  const out: DepartmentNode[] = [];
  const walk = (n: DepartmentNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

/** Find a node by id anywhere in the tree. */
export function findById(tree: DepartmentNode[], id: string): DepartmentNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const inChild = findById(node.children, id);
    if (inChild) return inChild;
  }
  return null;
}

/** Max nesting depth of the tree (1 = flat roots). */
export function treeDepth(tree: DepartmentNode[]): number {
  let max = 0;
  const walk = (nodes: DepartmentNode[], depth: number) => {
    if (nodes.length === 0) return;
    max = Math.max(max, depth);
    nodes.forEach((n) => walk(n.children, depth + 1));
  };
  walk(tree, 1);
  return max;
}

/** Up-to-two-letter initials from a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}
