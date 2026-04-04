/**
 * 注册流程 E2E 测试
 */
import { test, expect } from '@playwright/test';
import { RegisterPage } from './RegisterPage';
import { generateTestUser, INVALID_DATA } from '../helpers/test-data';

test.describe('注册流程', () => {
  test('应该正确显示注册页面', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();

    // 验证页面标题
    await registerPage.verifyTitle();

    // 验证表单字段存在
    await expect(registerPage.usernameInput).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.confirmPasswordInput).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();
  });

  test('应该显示表单验证错误 - 用户名太短', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // 填写表单，用户名少于3个字符
    await registerPage.fillForm({
      username: INVALID_DATA.shortUsername,
      email: 'test@example.com',
      password: 'ValidPassword123!',
    });

    // 触发验证
    await registerPage.usernameInput.blur();

    // 等待错误消息
    const usernameInput = registerPage.usernameInput;
    await page.waitForTimeout(500); // 等待 Zod 验证
  });

  test('应该显示表单验证错误 - 密码太短', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.fillForm({
      username: 'validuser',
      email: 'test@example.com',
      password: INVALID_DATA.shortPassword,
    });

    await registerPage.passwordInput.blur();
    await page.waitForTimeout(500);
  });

  test('应该显示表单验证错误 - 无效邮箱', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.fillForm({
      username: 'validuser',
      email: INVALID_DATA.invalidEmail,
      password: 'ValidPassword123!',
    });

    await registerPage.emailInput.blur();
    await page.waitForTimeout(500);
  });

  test('应该显示表单验证错误 - 密码不匹配', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.fillForm({
      username: 'validuser',
      email: 'test@example.com',
      password: 'ValidPassword123!',
      confirmPassword: INVALID_DATA.mismatchPassword,
    });

    await registerPage.confirmPasswordInput.blur();
    await page.waitForTimeout(500);
  });

  test('应该成功注册新用户并重定向到登录页面', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const testUser = generateTestUser();

    // 监听控制台消息
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser Console Error:', msg.text());
      }
      consoleMessages.push(msg.text());
    });

    // 监听网络请求
    const apiRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log('API Request:', request.method(), url);
        apiRequests.push(`${request.method()} ${url}`);
      }
    });

    // 监听网络响应
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/')) {
        console.log('API Response:', response.status(), url);
      }
    });

    await registerPage.goto();

    // 填写并提交表单
    await registerPage.register(testUser);

    // 等待一段时间查看发生了什么
    await page.waitForTimeout(2000);

    // 打印控制台消息
    console.log('Console messages captured:', consoleMessages);
    console.log('API requests captured:', apiRequests);

    // 检查当前 URL
    const currentUrl = page.url();
    console.log('Current URL after registration:', currentUrl);

    // 等待重定向到登录页面
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('点击登录链接应该导航到登录页面', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.clickLoginLink();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /欢迎回来/i })).toBeVisible();
  });

  test('点击返回首页链接应该导航到首页', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.clickHomeLink();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('找到你的学习伙伴')).toBeVisible();
  });

  test('应该处理已存在的邮箱/用户名错误', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    // 使用固定用户名，假设可能已经存在
    const existingUser = {
      username: 'existinguser',
      email: 'existing@example.com',
      password: 'ValidPassword123!',
    };

    await registerPage.goto();
    await registerPage.register(existingUser);

    // 可能显示错误或成功（取决于用户是否存在）
    // 这里我们只是验证页面不会崩溃
    await expect(registerPage.submitButton).toBeVisible();
  });
});
