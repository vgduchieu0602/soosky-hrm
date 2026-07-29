import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";

export default interface SystemSettingRepo {
    get(): Promise<SystemSetting | undefined>;
    save(systemSetting: SystemSetting): Promise<void>;
}
