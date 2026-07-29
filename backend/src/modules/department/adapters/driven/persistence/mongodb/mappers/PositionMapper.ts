import PositionDocument from "@modules/department/adapters/driven/persistence/mongodb/documents/PositionDocument";
import Position from "@modules/department/core/domain/entities/Position";
import Description from "@modules/department/core/domain/value-objects/Description";
import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/department/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";

const PositionMapper = {
    toDocument(position: Position): PositionDocument {
        return {
            _id:          position.id,
            code:         position.code.value,
            title:        position.title.value,
            departmentId: position.departmentId,
            level:        position.level.value,
            description:  position.description.value,
            status:       position.status.value,
            createdAt:    position.createdAt,
        };
    },

    toDomain(document: PositionDocument): Position {
        return Position.rehydrate({
            id:           document._id,
            code:         PositionCode.create(document.code),
            title:        PositionTitle.create(document.title),
            departmentId: document.departmentId,
            level:        PositionLevel.create(document.level),
            description:  Description.create(document.description),
            status:       PositionStatus.create(document.status),
            createdAt:    document.createdAt,
        });
    },
};

export default PositionMapper;
