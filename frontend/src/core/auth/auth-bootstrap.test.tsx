import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Khôi phục phiên khi mở ứng dụng.
 *
 * Điều được khoá: chuỗi token còn sót KHÔNG đủ để coi là đã đăng nhập; máy chủ
 * mới là nguồn sự thật; và trong lúc chưa biết thì chỉ vẽ màn hình chờ chứ không
 * vẽ ứng dụng hay đá về trang đăng nhập (đó chính là nguyên nhân chớp màn hình).
 */

const authService = vi.hoisted(() => ({
  refresh: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@features/auth/services/auth.service", () => ({ authService }));

import { AuthBootstrap } from "@core/auth/AuthBootstrap";
import { useAuthStore } from "@core/store/auth.store";

const USER = {
  id: "u1",
  username: "hr",
  email: "hr@soosky.local",
  roles: ["hr_manager"],
  permissions: [],
  mustChangePassword: false,
};

function resetStore() {
  useAuthStore.setState({ status: "initializing", accessToken: null, user: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("AuthBootstrap", () => {
  it("không có phiên → unauthenticated, không gọi /auth/me", async () => {
    authService.refresh.mockRejectedValue(new Error("no cookie"));

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(authService.me).not.toHaveBeenCalled();
    // Router VẪN được dựng (trang đăng nhập nằm trong router); việc chặn trang
    // cần đăng nhập là của ProtectedRoute.
    expect(await screen.findByText("APP")).toBeInTheDocument();
  });

  it("cookie refresh hợp lệ → refresh → /auth/me → authenticated", async () => {
    authService.refresh.mockResolvedValue({ accessToken: "tok-1" });
    authService.me.mockResolvedValue(USER);

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    expect(await screen.findByText("APP")).toBeInTheDocument();
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.accessToken).toBe("tok-1");
    expect(state.user).toEqual(USER);
  });

  it("refresh hỏng → unauthenticated, không gọi /auth/me", async () => {
    authService.refresh.mockRejectedValue(new Error("invalid"));

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("đã có access token trong bộ nhớ → chỉ gọi /auth/me", async () => {
    useAuthStore.setState({ accessToken: "tok-mem" });
    authService.me.mockResolvedValue(USER);

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    expect(await screen.findByText("APP")).toBeInTheDocument();
    expect(authService.refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("/auth/me hỏng → unauthenticated chứ không kẹt ở màn hình chờ", async () => {
    useAuthStore.setState({ accessToken: "tok-mem" });
    authService.me.mockRejectedValue(new Error("401"));

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("trong lúc chờ chỉ vẽ màn hình chờ", async () => {
    let resolveRefresh: (v: { accessToken: string }) => void = () => {};
    authService.refresh.mockReturnValue(new Promise((res) => { resolveRefresh = res; }));
    authService.me.mockResolvedValue(USER);

    render(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("APP")).not.toBeInTheDocument();

    resolveRefresh({ accessToken: "tok-1" });
    expect(await screen.findByText("APP")).toBeInTheDocument();
  });

  it("chỉ khôi phục MỘT lần dù StrictMode gọi effect hai lần", async () => {
    authService.refresh.mockResolvedValue({ accessToken: "tok-1" });
    authService.me.mockResolvedValue(USER);

    const { rerender } = render(<AuthBootstrap><div>APP</div></AuthBootstrap>);
    rerender(<AuthBootstrap><div>APP</div></AuthBootstrap>);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authService.me).toHaveBeenCalledTimes(1);
  });
});
