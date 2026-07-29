import SystemSettingDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/SystemSettingDocument";
import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";

const SystemSettingMapper = {
    toDocument(setting: SystemSetting): SystemSettingDocument {
        return {
            _id:       setting.id,
            entries:   setting.entries,
            createdAt: setting.createdAt,
            updatedAt: setting.updatedAt,
        };
    },

    toDomain(document: SystemSettingDocument): SystemSetting {
        return SystemSetting.rehydrate({
            id:        document._id,
            entries:   document.entries,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        });
    },
};

export default SystemSettingMapper;
