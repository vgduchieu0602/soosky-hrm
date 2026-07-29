import { createDepartmentHttpRouter, DepartmentHttpUseCases } from "@modules/department";
import ArchiveDepartmentUseCase from "@modules/department/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/department/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/department/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/department/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/department/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/department/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/department/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/department/core/app/use-cases/department/UpdateDepartmentUseCase";
import ArchivePositionUseCase from "@modules/department/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/department/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/department/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/department/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/department/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/department/core/app/use-cases/position/UpdatePositionUseCase";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo, { PositionListFilter } from "@modules/department/core/app/ports/PositionRepo";
import Department from "@modules/department/core/domain/entities/Department";
import Position from "@modules/department/core/domain/entities/Position";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryDepartmentRepo implements DepartmentRepo {
    private readonly _store = new Map<string, Department>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(d => d.code.value === code); }
    async listAll() { return [...this._store.values()]; }
    async listChildren(parentId: string) { return [...this._store.values()].filter(d => d.parentDepartmentId === parentId); }
    async countChildren(parentId: string) { return (await this.listChildren(parentId)).length; }
    async save(d: Department) { this._store.set(d.id, d); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryPositionRepo implements PositionRepo {
    private readonly _store = new Map<string, Position>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(p => p.code.value === code); }
    async list(filter: PositionListFilter) {
        return [...this._store.values()].filter(p =>
            (filter.departmentId == undefined || p.departmentId === filter.departmentId) &&
            (filter.status == undefined || p.status.value === filter.status));
    }
    async countByDepartment(deptId: string) { return (await this.list({ departmentId: deptId })).length; }
    async save(p: Position) { this._store.set(p.id, p); }
    async deleteById(id: string) { this._store.delete(id); }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
};

function buildUseCases(): DepartmentHttpUseCases {
    const departmentRepo = new InMemoryDepartmentRepo();
    const positionRepo   = new InMemoryPositionRepo();
    return {
        createDepartment:     new CreateDepartmentUseCase(allowAllPermissions, departmentRepo),
        updateDepartment:     new UpdateDepartmentUseCase(allowAllPermissions, departmentRepo),
        getDepartment:        new GetDepartmentUseCase(departmentRepo),
        listDepartments:      new ListDepartmentsUseCase(departmentRepo),
        reparentDepartment:   new ReparentDepartmentUseCase(allowAllPermissions, departmentRepo),
        assignDepartmentHead: new AssignDepartmentHeadUseCase(allowAllPermissions, departmentRepo),
        archiveDepartment:    new ArchiveDepartmentUseCase(allowAllPermissions, departmentRepo),
        deleteDepartment:     new DeleteDepartmentUseCase(allowAllPermissions, departmentRepo, positionRepo),
        createPosition:       new CreatePositionUseCase(allowAllPermissions, positionRepo, departmentRepo),
        updatePosition:       new UpdatePositionUseCase(allowAllPermissions, positionRepo, departmentRepo),
        getPosition:          new GetPositionUseCase(positionRepo),
        listPositions:        new ListPositionsUseCase(positionRepo),
        archivePosition:      new ArchivePositionUseCase(allowAllPermissions, positionRepo),
        deletePosition:       new DeletePositionUseCase(allowAllPermissions, positionRepo),
    };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): Express {
    const app = express();
    app.use("/department", createDepartmentHttpRouter(buildUseCases(), fakeVerifier));
    return app;
}

describe("Department HTTP", () => {
    let app: Express;
    beforeEach(() => { app = buildApp(); });

    const auth = { Authorization: "Bearer user-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/department/departments").expect(401);
    });

    it("tạo -> lấy -> liệt kê cây", async () => {
        const created = await request(app).post("/department/departments")
            .set(auth).send({ code: "ENG", name: "Engineering" }).expect(201);
        const id = created.body.departmentId;

        await request(app).get(`/department/departments/${id}`).set(auth)
            .expect(200).expect(res => expect(res.body.code).toBe("ENG"));

        const child = await request(app).post("/department/departments")
            .set(auth).send({ code: "BE", name: "Backend", parentDepartmentId: id }).expect(201);

        await request(app).get("/department/departments?tree=true").set(auth)
            .expect(200).expect(res => {
                expect(res.body.departments).toHaveLength(1);
                expect(res.body.departments[0].children[0].id).toBe(child.body.departmentId);
            });
    });

    it("409 khi mã trùng", async () => {
        await request(app).post("/department/departments").set(auth).send({ code: "ENG", name: "E" }).expect(201);
        await request(app).post("/department/departments").set(auth).send({ code: "ENG", name: "E2" })
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_CODE_CONFLICT"));
    });

    it("chặn reparent gây chu trình (409)", async () => {
        const a = (await request(app).post("/department/departments").set(auth).send({ code: "A", name: "A" })).body.departmentId;
        const b = (await request(app).post("/department/departments").set(auth).send({ code: "B", name: "B", parentDepartmentId: a })).body.departmentId;
        await request(app).patch(`/department/departments/${a}/parent`).set(auth).send({ parentDepartmentId: b })
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_CYCLE"));
    });

    it("position: tạo cần phòng ban tồn tại; xoá department còn vị trí bị chặn", async () => {
        const dept = (await request(app).post("/department/departments").set(auth).send({ code: "D", name: "D" })).body.departmentId;
        await request(app).post("/department/positions").set(auth)
            .send({ code: "DEV", title: "Dev", departmentId: dept, level: 3 }).expect(201);
        await request(app).delete(`/department/departments/${dept}`).set(auth)
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_HAS_CHILDREN"));
    });
});
