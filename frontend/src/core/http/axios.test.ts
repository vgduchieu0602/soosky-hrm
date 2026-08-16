import { beforeEach, describe, expect, it } from "vitest";
import MockAdapter from "axios-mock-adapter";

/**
 * Vòng đời refresh của tầng HTTP.
 *
 * Điều được khoá: nhiều 401 đồng thời chỉ tạo MỘT lời gọi `/auth/refresh`; mỗi
 * request chỉ thử lại đúng một lần; `/auth/refresh` và `/auth/login` không bao
 * giờ tự kích hoạt refresh (đệ quy); và refresh hỏng thì chỉ đánh dấu mất phiên
 * chứ không ép tải lại trang.
 */

import api from "@core/http/axios";
import { useAuthStore } from "@core/store/auth.store";

const mock = new MockAdapter(api);
// `/auth/refresh` được gọi bằng axios gốc (không qua interceptor của `api`),
// nên phải giả lập riêng trên instance mặc định.
const globalMock = new MockAdapter((await import("axios")).default);

beforeEach(() => {
  mock.reset();
  globalMock.reset();
  useAuthStore.setState({ status: "authenticated", accessToken: "old-token", user: null });
});

describe("axios interceptor", () => {
  it("401 → refresh → thử lại request một lần với token mới", async () => {
    let calls = 0;
    mock.onGet("/employees").reply(() => {
      calls += 1;
      return calls === 1 ? [401, { error: { message: "hết hạn" } }] : [200, { data: [] }];
    });
    globalMock.onPost("/auth/refresh").reply(200, { data: { accessToken: "new-token" } });

    const res = await api.get("/employees");

    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(useAuthStore.getState().accessToken).toBe("new-token");
  });

  it("nhiều 401 cùng lúc chỉ tạo MỘT lời gọi refresh", async () => {
    const seen = new Set<string>();
    mock.onGet(/\/r\d/).reply((config) => {
      const url = config.url ?? "";
      if (seen.has(url)) return [200, { data: url }];
      seen.add(url);
      return [401, {}];
    });

    let refreshCalls = 0;
    globalMock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, { data: { accessToken: "new-token" } }];
    });

    await Promise.all([api.get("/r1"), api.get("/r2"), api.get("/r3")]);

    expect(refreshCalls).toBe(1);
  });

  it("refresh hỏng → đánh dấu mất phiên (không ép tải lại trang)", async () => {
    mock.onGet("/employees").reply(401, {});
    globalMock.onPost("/auth/refresh").reply(401, {});

    await expect(api.get("/employees")).rejects.toBeTruthy();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("/auth/refresh trả 401 KHÔNG tự gọi refresh (không đệ quy)", async () => {
    let refreshCalls = 0;
    mock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [401, {}];
    });

    await expect(api.post("/auth/refresh")).rejects.toBeTruthy();

    expect(refreshCalls).toBe(1);
  });

  it("/auth/login sai mật khẩu → giữ nguyên lỗi 401, không refresh", async () => {
    mock.onPost("/auth/login").reply(401, { error: { message: "Invalid credentials" } });
    let refreshCalls = 0;
    globalMock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, { data: { accessToken: "x" } }];
    });

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshCalls).toBe(0);
    // Đăng nhập sai không được xoá phiên đang có.
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("vẫn 401 sau khi đã refresh → dừng lại, không lặp vô hạn", async () => {
    let calls = 0;
    mock.onGet("/employees").reply(() => {
      calls += 1;
      return [401, {}];
    });
    globalMock.onPost("/auth/refresh").reply(200, { data: { accessToken: "new-token" } });

    await expect(api.get("/employees")).rejects.toBeTruthy();

    expect(calls).toBe(2); // lần đầu + đúng một lần thử lại
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("gắn access token hiện tại vào mỗi request", async () => {
    mock.onGet("/employees").reply((config) => [200, { auth: config.headers?.Authorization }]);

    const res = await api.get("/employees");

    expect(res.data.auth).toBe("Bearer old-token");
  });
});
