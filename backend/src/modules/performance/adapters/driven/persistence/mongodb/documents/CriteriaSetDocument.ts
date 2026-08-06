/** Dạng document lưu trữ của aggregate `CriteriaSet` (kèm toàn bộ phiên bản). */
export interface CriterionSubDocument {
    id:     string;
    code:   string;
    name:   string;
    kind:   string;
    weight: number;
}

export interface CriteriaVersionSubDocument {
    version:     number;
    criteria:    CriterionSubDocument[];
    publishedAt: Date;
    publishedBy: string;
}

export default interface CriteriaSetDocument {
    _id:         string;
    name:        string;
    description: string | null;
    versions:    CriteriaVersionSubDocument[];
    createdBy:   string;
    createdAt:   Date;
}
