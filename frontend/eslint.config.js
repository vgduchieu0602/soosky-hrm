import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Quy ước dự án: tiền tố `_` = cố tình không dùng (tham số giữ chỗ cho
      // chữ ký API, biến destructure để loại field). Không phải lỗi.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
  {
    // File cấu hình build chạy trên Node, không phải trong trình duyệt.
    files: ['*.config.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Plugin Tailwind vẫn phát hành CommonJS -> phải require().
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // shadcn/ui: mỗi file component kèm `xxxVariants` (cva) và kiểu props.
    // Tách ra file riêng chỉ để chiều react-refresh là chia nhỏ vô ích.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
])
