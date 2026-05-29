---
name: init-base
description: >
  Setup project architecture and enviroment for existing backend. Create folder structure (feature-based), install dependencies, configures enviroment.
  Use when user say 'init backend', 'init frontend', 'setup structure','scaffold project' or 'setup enviroment'.
argument-hint: "[backend]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Setup Project Architecture & Enviroment

** Scope:** Structure + Dependencies + Configs only. No fearture code.

This skill sets up:

- Folder structure (feature-base architecture)
- Dependencies installion
- Config files (.env, tsconfig, linting, etc.)
- Core/Shared modules (empty or minimal setup)
- Not feature code

## Pre-flight Checks

1. **Argument provided?** Must be exactly `backend`. If missing ask the user
2. **Target directory exists?**

- Backend: `backend/`

3. **Project already initialized?** Check for `package.json`

- If not, abort with: "Project not initialized. Run pnpm init -y inside <dir> first."

4. **Already scaffolded?** If src/features/ already contains feature folders, ask user to confirm overwriting — never overwrite silently.

5. **Reference docs available?** Verify these exist at the project root (parent of backend/):

CLAUDE.md, DATABASE.md, API_SPEC.md
BE-ARCHITECTURE.md, BE-PROJECT-RULES.md (for backend)
If missing, warn the user but proceed.

## 1. If argument = `backend`

### B1. Install dependencies

```bash
cd backend
pnpm add express mongoose zod jsonwebtoken bcryptjs cookie-parser cors helmet pino pino-http pino-pretty dotenv ms
pnpm add -D typescript tsx ts-node @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cookie-parser @types/cors @types/ms
pnpm add -D jest ts-jest @types/jest supertest @types/supertest mongodb-memory-server
pnpm add -D eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### B2. Create folder structure

```bash
mkdir -p src/config
mkdir -p src/core/{database,logger,events}
mkdir -p src/shared/{middlewares,errors,utils,types,models}
mkdir -p src/features/{iam,organization,employee,attendance,payroll,performance}/{controllers,services,repositories,dto,strategies,types,tests}
mkdir -p scripts tests
```

> **Note:** Mongoose models live in `src/shared/models/` (one file per collection), NOT inside each feature.
> This follows BE-PROJECT-RULES.md §1. Features only own their controllers/services/repositories/dto/routes;
> the schema/model layer is shared so any feature can import via `@shared/models/[entity].model`.

### B3. Write `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@core/*": ["src/core/*"],
      "@config/*": ["src/config/*"]
    }
  },
  "include": ["src", "scripts", "tests"]
}
```

### B4.Update `package.json`

Merge the following into the existing `package.json`:

```json
{
  "type": "commonjs",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "seed": "tsx scripts/seed.ts",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```

### B5. Write `.env.example` + `.env` + `.gitignore`

`.env.example`:

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/soosky_hrm?replicaSet=rs

JWT_ACCESS_SECRET=replace-with-64-byte-random-hex
JWT_REFRESH_SECRET=replace-with-64-byte-random-hex
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=14d

BCRYPT_ROUNDS=10
```

Copy `.env.example` → `.env` (do **not** overwrite if exists).

`.gitignore` (append):

```
node_modules
dist
.env
.env.local
coverage
*.log
.DS_Store
```

### B6. Write core scaffolding (compile-ready, no business logic)

`src/config/env.ts`:

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().url(),
});

export const env = schema.parse(process.env);
```

`src/core/logger/logger.ts`:

```ts
import pino from "pino";
import { env } from "@config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        }
      : undefined,
});
```

`src/core/database/mongoose.ts`:

```ts
import mongoose from "mongoose";
import { env } from "@config/env";
import { logger } from "@core/logger/logger";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  logger.info("MongoDB connected");
}

export async function disconnectDB() {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}
```

`src/config/jwt.config.ts`:

```ts
import type { SignOptions } from "jsonwebtoken";
import { env } from "@config/env";

export const JWT_ISSUER = "soosky-hrm";
export const JWT_AUDIENCE = "soosky-hrm-client";

export const accessTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
};

export const refreshTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
};

export const jwtSecrets = {
  access: env.JWT_ACCESS_SECRET,
  refresh: env.JWT_REFRESH_SECRET,
};
```

`src/shared/errors/http-error.ts`:

```ts
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "SYS_001",
  ) {
    super(message);
  }
}
```

`src/shared/middlewares/error-handler.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "@shared/errors/http-error";
import { logger } from "@core/logger/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: { code: "SYS_001", message: "Internal server error" },
  });
}
```

`src/app.ts`:

```ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "@core/logger/logger";
import { errorHandler } from "@shared/middlewares/error-handler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ credentials: true, origin: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // TODO: mount feature routers as they are implemented
  // app.use('/api/v1', iamRouter);

  app.use(errorHandler);
  return app;
}
```

`src/main.ts`:

```ts
import { createApp } from "./app";
import { connectDB, disconnectDB } from "@core/database/mongoose";
import { env } from "@config/env";
import { logger } from "@core/logger/logger";

async function bootstrap() {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () =>
    logger.info(`API listening on :${env.PORT}`),
  );

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal");
  process.exit(1);
});
```

### B7. Write `.eslintrc.cjs` and `.prettierrc`

`.eslintrc.cjs`:

```js
module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  ignorePatterns: ["dist", "node_modules"],
};
```

`.prettierrc`:

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

`jest.config.ts`:

```ts
import type { Config } from "jest";
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@features/(.*)$": "<rootDir>/src/features/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
  },
  testMatch: ["**/*.spec.ts"],
};
export default config;
```
