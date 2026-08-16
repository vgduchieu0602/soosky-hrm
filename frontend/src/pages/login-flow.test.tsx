import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Đăng nhập và đổi mật khẩu bắt buộc.
 *
 * Điều được khoá: mọi vai trò đều vào `/dashboard`; tài khoản bị bắt đổi mật khẩu
 * đi thẳng tới trang đổi mật khẩu; và sau khi đổi xong client dùng ACCESS TOKEN
 * MỚI — nếu vẫn giữ token cũ thì mọi API trả 403 IAM_013 và người dùng bị đá
 * ngược lại đúng trang vừa rời.
 */

const authService = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock("@features/auth/services/auth.service", () => ({ authService }));

import LoginPage from "@pages/LoginPage";
import ChangePasswordPage from "@pages/ChangePasswordPage";
import { useAuthStore } from "@core/store/auth.store";
import type { AuthUser } from "@features/auth/types/auth.types";

function user(roles: string[], mustChangePassword = false): AuthUser {
  return { id: "u1", username: "u", email: "u@x.co", roles, permissions: [], mustChangePassword };
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/auth/login"]}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/auth/change-password" element={<div>CHANGE PASSWORD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLogin() {
  await userEvent.type(screen.getByLabelText("Email hoặc tên đăng nhập"), "hr");
  await userEvent.type(screen.getByLabelText("Mật khẩu"), "Hr@12345");
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ status: "unauthenticated", accessToken: null, user: null });
});

describe("đăng nhập", () => {
  it.each([["admin"], ["hr_manager"], ["employee"]])(
    "%s đăng nhập thành công → vào /dashboard, trạng thái authenticated",
    async (role) => {
      authService.login.mockResolvedValue({ accessToken: "tok", user: user([role]) });

      renderLogin();
      await submitLogin();

      expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
      const state = useAuthStore.getState();
      expect(state.status).toBe("authenticated");
      expect(state.accessToken).toBe("tok");
      expect(state.user?.roles).toEqual([role]);
    },
  );

  it("mustChangePassword → đi thẳng trang đổi mật khẩu, không vào dashboard", async () => {
    authService.login.mockResolvedValue({ accessToken: "tok", user: user(["employee"], true) });

    renderLogin();
    await submitLogin();

    expect(await screen.findByText("CHANGE PASSWORD")).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD")).not.toBeInTheDocument();
  });

  it("sai mật khẩu → hiện thông báo từ máy chủ, không đổi trạng thái", async () => {
    authService.login.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "Invalid credentials" } } },
    });

    renderLogin();
    await submitLogin();

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(screen.queryByText("DASHBOARD")).not.toBeInTheDocument();
  });
});

describe("đổi mật khẩu bắt buộc", () => {
  function renderChangePassword() {
    return render(
      <MemoryRouter initialEntries={["/auth/change-password"]}>
        <Routes>
          <Route path="/auth/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          <Route path="/auth/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("đổi xong → dùng access token MỚI và vào dashboard", async () => {
    useAuthStore.setState({
      status: "authenticated",
      accessToken: "stale-token",
      user: user(["employee"], true),
    });
    authService.changePassword.mockResolvedValue({ ok: true, accessToken: "fresh-token" });

    renderChangePassword();

    await userEvent.type(screen.getByLabelText("Mật khẩu hiện tại"), "Old@12345");
    await userEvent.type(screen.getByLabelText("Mật khẩu mới"), "New@12345");
    await userEvent.type(screen.getByLabelText("Xác nhận mật khẩu mới"), "New@12345");
    await userEvent.click(screen.getByRole("button", { name: /đổi mật khẩu & tiếp tục/i }));

    expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("fresh-token");
    expect(state.user?.mustChangePassword).toBe(false);
  });

  it("chưa đăng nhập → về trang đăng nhập", () => {
    useAuthStore.setState({ status: "unauthenticated", accessToken: null, user: null });

    renderChangePassword();

    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });
});
