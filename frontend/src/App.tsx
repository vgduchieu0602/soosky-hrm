import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "@core/router";
import { AuthBootstrap } from "@core/auth/AuthBootstrap";

export default function App() {
  return (
    <>
      {/* Router chỉ được dựng sau khi biết chắc người dùng đã đăng nhập hay
          chưa — nếu không, màn hình đầu tiên sẽ chớp qua lại giữa đăng nhập và
          workspace. */}
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
