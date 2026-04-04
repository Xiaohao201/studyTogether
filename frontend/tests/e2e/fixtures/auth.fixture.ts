/**
 * 测试夹具 - 提供预先认证的页面状态
 */
import { test as base, Page } from '@playwright/test';
import { LoginPage, RegisterPage } from '../pages';
import { generateTestUser, registerUserViaApi, loginUserViaApi } from '../helpers';

export interface AuthFixtures {
  authenticatedPage: Page;
  testUser: {
    username: string;
    email: string;
    password: string;
  };
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // 创建测试用户
    const testUser = generateTestUser();

    // 通过 API 注册
    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在，继续
    }

    // 导航到登录页面并登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 等待导航到地图页面 (登录后的默认页面)
    await page.waitForURL('/map', { timeout: 10000 });

    await use(page);
  },

  testUser: async ({}, use) => {
    const user = generateTestUser();
    await use(user);
  },
});

export { expect } from '@playwright/test';
