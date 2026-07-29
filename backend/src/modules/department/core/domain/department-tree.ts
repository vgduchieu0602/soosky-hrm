/**
 * Quy tắc domain thuần cho cây phòng ban — không Express, không driver DB.
 * Lắp danh sách phẳng thành rừng và phát hiện chu trình khi reparent.
 */

/** Bản ghi phòng ban phẳng đọc từ repository (id đã ở dạng string). */
export interface DepartmentRow {
    id:                 string;
    name:               string;
    code:               string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    description?:       string;
    status:             string;
}

export interface DeptNode extends DepartmentRow {
    children: DeptNode[];
}

/**
 * Trả về danh sách phẳng các node phòng ban, hoặc rừng lồng nhau khi `asTree`.
 * Node có cha không tồn tại trong tập dữ liệu được coi là gốc.
 */
export function assembleDepartments(rows: DepartmentRow[], asTree: boolean): DeptNode[] {
    const flat: DeptNode[] = rows.map(row => ({ ...row, children: [] }));

    if (asTree === false) return flat;

    const byId  = new Map(flat.map(node => [node.id, node]));
    const roots: DeptNode[] = [];
    for (const node of flat) {
        const parentId = node.parentDepartmentId;
        if (parentId != undefined && byId.has(parentId)) {
            byId.get(parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

/** Thu thập id của một phòng ban cùng toàn bộ con cháu (dùng cho kiểm tra chu trình). */
export function collectSubtreeIds(
    rows: { id: string; parentDepartmentId: string | null }[],
    rootId: string,
): Set<string> {
    const childrenByParent = new Map<string, string[]>();
    for (const row of rows) {
        if (row.parentDepartmentId == undefined) continue;
        const list = childrenByParent.get(row.parentDepartmentId) ?? [];
        list.push(row.id);
        childrenByParent.set(row.parentDepartmentId, list);
    }

    const result = new Set<string>();
    const stack   = [rootId];
    while (stack.length > 0) {
        const current = stack.pop()!;
        if (result.has(current)) continue;
        result.add(current);
        for (const child of childrenByParent.get(current) ?? []) stack.push(child);
    }
    return result;
}
