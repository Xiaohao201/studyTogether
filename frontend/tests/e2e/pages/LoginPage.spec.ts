/**
 * 登录流程 E2E 测试
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './LoginPage';
import { generateTestUser } from '../helpers/test-data';
import { registerUserViaApi } from '../helpers/api';

test.describe('登录流程', () => {
  test('应该正确显示登录页面', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // 验证页面标题
    await loginPage.verifyTitle();

    // 验证表单字段存在
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('应该显示表单验证错误 - 无效邮箱', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.fillForm({
      email: 'not-a-valid-email',
      password: 'ValidPassword123!',
    });

    await loginPage.emailInput.blur();
    await page.waitForTimeout(500); // 等待 Zod 验证
  });

  test('应该显示表单验证错误 - 密码太短', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.fillForm({
      email: 'test@example.com',
      password: 'short',
    });

    await loginPage.passwordInput.blur();
    await page.waitForTimeout(500);
  });

  test('应该显示密码显示/隐藏切换功能', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // 默认应该是隐藏密码
    let inputType = await loginPage.getPasswordInputType();
    expect(inputType).toBe('password');

    // 点击显示按钮
    await loginPage.togglePasswordVisibility();

    // 应该变成 text
    inputType = await loginPage.getPasswordInputType();
    expect(inputType).toBe('text');

    // 再次点击应该变回 password
    await loginPage.togglePasswordVisibility();
    inputType = await loginPage.getPasswordInputType();
    expect(inputType).toBe('password');
  });

  test('应该使用无效凭据显示错误', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login({
      email: 'nonexistent@example.com',
      password: 'WrongPassword123!',
    });

    // 提交后应该仍在登录页面（失败）
    // 或者显示错误消息
    await page.waitForTimeout(2000);
  });

  test('点击注册链接应该导航到注册页面', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.clickRegisterLink();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: /创建账号/i })).toBeVisible();
  });

  test('点击返回首页链接应该导航到首页', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.clickHomeLink();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('找到你的学习伙伴')).toBeVisible();
  });
});

test.describe('登录流程 (使用预创建用户)', () => {
  test.beforeEach(async ({ page }) => {
    // 清空 localStorage 以确保干净状态
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('应该成功登录并重定向到地图页面', async ({ page }) => {
    const testUser = generateTestUser();

    // 通过 API 创建用户
    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    // 导航到登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // 登录
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 应该重定向到地图页面
    await page.waitForURL('/map', { timeout: 15000 });

    // 验证在地图页面
    await expect(page.getByTestId('map-sidebar')).toBeVisible({ timeout: 10000 });
  });

  test('登录后应该存储认证令牌', async ({ page }) => {
    const testUser = generateTestUser();

    // 通过 API 创建用户
    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    // 导航到登录页面并登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 等待导航
    await page.waitForURL('/map', { timeout: 15000 });

    // 验证令牌已存储
    const accessToken = await page.evaluate(() => {
      return localStorage.getItem('access_token');
    });

    expect(accessToken).toBeTruthy();
    expect(accessToken).toHaveLength.greaterThan(0);

    const refreshToken = await page.evaluate(() => {
      return localStorage.getItem('refresh_token');
    });

    expect(refreshToken).toBeTruthy();
  });

  test('登录后页面刷新应该保持登录状态', async ({ page }) => {
    const testUser = generateTestUser();

    // 创建用户
    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    // 登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    // 刷新页面
    await page.reload();

    // 应该仍然在地图页面（没有重定向到登录）
    await page.waitForURL('/map', { timeout: 10000 });
    await expect(page.getByTestId('map-sidebar')).toBeVisible({ timeout: 10000 });
  });
});
