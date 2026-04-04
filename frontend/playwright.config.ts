import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 *
 * 环境变量:
 * - BASE_URL: 基础 URL (默认: http://localhost:3000)
 * - BACKEND_URL: 后端 API URL (默认: http://localhost:8000)
 *
 * 运行测试:
 * - npx playwright test           # 运行所有测试
 * - npx playwright test --ui      # 使用 UI 模式运行
 * - npx playwright test --debug    # 调试模式
 * - npx playwright show-report    # 查看报告
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 禁用并行以避免数据库冲突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // 单工作进程以避免并发问题
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 用于本地开发的 webServer (可选)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
