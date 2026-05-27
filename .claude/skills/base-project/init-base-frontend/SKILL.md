---
name: init-base-frontend
description: >
  Setup project architecture and environment for new or existing frontend. Create folder structure (feature-based), install dependencies, configure environment.
  Use when user says:
  - init frontend
  - setup frontend
  - tạo project react
  - khởi tạo frontend
  - setup vite
argument-hint: "[frontend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Setup Project Architecture & Enviroment

** Scope:** Structure + Dependencies + Configs only. No feature code
This skill sets up:

- Folder structure (feature-based architecture)
- Dependencies installation
- Config files (.env, tsconfig, vite.config, linting, etc.)
- Core/Shared modules (empty or minimal setup)
- Not feature code

## Pre-flight Checks

1. **Argument provided?** Must be exactly `frontend`. If missing, ask the user.
2. **Target directory exists?**

- Frontend: `frontend/`

3. **Project already initialized?** Check for `package.json`

- If not, abort with: "Project not initialized. Run pnpm init -y inside <dir> first."

4. **Already scaffolded?** If src/features/ already contains feature folders, ask user to confirm overwriting — never overwrite silently.

5. **Reference docs available?** Verify these exist at the project root (parent of frontend/):

CLAUDE.md, DATABASE.md, API_SPEC.md
FE-ARCHITECTURE.md, FE-PROJECT-RULES.md (for frontend)
If missing, warn the user but proceed.

## 1. If argument = `frontend`

### B1. Init project (if not exists)

```bash
pnpm create vite@latest frontend -- --template react-ts
cd frontend
```

### B2. Install dependencies

```bash
cd frontend

# Core runtime
pnpm add react-router-dom zustand axios react-hook-form zod @hookform/resolvers

# Styling + shacn/ui prerequisites
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge
pnpm add @radix-ui/react-slot lucide-react
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### B3. Create folder structure

```bash
mkdir -p src/assets
mkdir -p src/components/ui
mkdir -p src/core/{http,router,store}
mkdir -p src/shared/{hooks,utils,types,constants}
mkdir -p src/layouts
mkdir -p src/pages
mkdir -p src/features/{auth,dashboard,employee,attendance,payroll}/{components,hooks,store,types,services}
```

**Note:** src/components/ui/ is managed by shadcn/ui CLI — components are auto-generated here. Do NOT manually create files in this folder.
Custom composite components (built on top of shadcn primitives) go in src/components/ directly.
Feature-specific components stay inside src/features/<feature>/components/.
Global state (auth token, user session) lives in src/core/store/. Feature-scoped state lives in src/features/<feature>/store/.

### B4: Write tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "noEmit": true,
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@core/*": ["src/core/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@pages/*": ["src/pages/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### B5: Write vite.config.ts

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@pages": path.resolve(__dirname, "./src/pages"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

### B6: Update package.json scripts

Merge into existing package.json:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  }
}
```

### B7: Write .env.example + .env + .gitignore

.env.example
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=MyApp
Copy .env.example → .env (do not overwrite if exists).
.gitignore (append if not present):
node_modules
dist
.env
.env.local
.DS_Store
\*.log

### B8: Write core scaffolding (compile-ready, no business logic)

`src/core/http/axios.ts`:

```ts
import axios from "axios";
import { useAuthStore } from "@core/store/auth.store";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
```

`src/core/store/auth.store.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "auth-storage" },
  ),
);
```

`src/core/router/index.tsx`:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import DashboardPage from "@pages/DashboardPage";
import NotFoundPage from "@pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [{ path: "login", element: <LoginPage /> }],
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
```

`src/core/router/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/auth/login" replace />;
}
```

`src/App.tsx`:

```tsx
import { RouterProvider } from "react-router-dom";
import { router } from "@core/router";

export default function App() {
  return <RouterProvider router={router} />;
}
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/index.css` (Tailwind directives):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`tailwind.config.ts` (shadcn/ui compatible):

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

### B9. Write shadcn/ui setup files

`src/shared/utils/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`components.json` (for reference — generated by `npx shadcn@latest init`):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/shared/utils/cn",
    "ui": "@/components/ui",
    "lib": "@/shared/utils",
    "hooks": "@/shared/hooks"
  }
}
```

Run `npx shadcn@latest init` after `tsconfig.json` and `vite.config.ts` are written.
This injects CSS variables into `src/index.css` automatically.
Add components on-demand: `npx shadcn@latest add button input form card dialog table`

### B10: Write placeholder layouts & pages

`src/layouts/MainLayout.tsx`:

```tsx
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* TODO: add Sidebar / Topbar */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

`src/layouts/AuthLayout.tsx`:

```tsx
import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Outlet />
    </div>
  );
}
```

`src/pages/DashboardPage.tsx`:

```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
```

`src/pages/LoginPage.tsx`:

```tsx
export default function LoginPage() {
  return <h1 className="text-2xl font-bold">Login</h1>;
}
```

`src/pages/NotFoundPage.tsx`:

```tsx
export default function NotFoundPage() {
  return <h1 className="text-2xl font-bold">404 — Not Found</h1>;
}
```

### B11. Write .eslintrc.cjs and .prettierrc

`.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  ignorePatterns: ["dist", "node_modules"],
};
```

`.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## Naming Conventions

Type | Convention | Example
Component | PascalCase | UserCard.tsx
Hook | camelCase prefix `use` | useCurrentUser.ts
Store | camelCase suffix `.store` | auth.store.ts
Service | camelCase suffix `.service` | auth.service.ts
Type/Interface | PascalCase | UserProfile.ts
Utility | camelCase | formatDate.ts
Feature folder | kebab-case | src/features/employee/
