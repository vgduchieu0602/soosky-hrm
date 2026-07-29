import Position from "@modules/department/core/domain/entities/Position";

export interface PositionDTO {
    id:           string;
    code:         string;
    title:        string;
    departmentId: string;
    level:        number;
    description:  string;
    status:       string;
    createdAt:    string;
}

const PositionPresenter = {
    toDTO(position: Position): PositionDTO {
        return {
            id:           position.id,
            code:         position.code.value,
            title:        position.title.value,
            departmentId: position.departmentId,
            level:        position.level.value,
            description:  position.description.value,
            status:       position.status.value,
            createdAt:    position.createdAt.toISOString(),
        };
    },
};

export default PositionPresenter;
