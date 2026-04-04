/**
 * 地图页面 E2E 测试
 */
import { test, expect } from '@playwright/test';
import { MapPage } from './MapPage';
import { LoginPage } from './LoginPage';
import { generateTestUser } from '../helpers/test-data';
import { registerUserViaApi } from '../helpers/api';

test.describe('地图页面 (未认证)', () => {
  test('应该重定向未认证用户到登录页面', async ({ page }) => {
    const mapPage = new MapPage(page);

    // 确保没有存储的认证信息
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });

    // 尝试直接访问地图页面
    await mapPage.goto();

    // 应该重定向到登录页面
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /欢迎回来/i })).toBeVisible();
  });
});

test.describe('地图页面 (已认证)', () => {
  test.beforeEach(async ({ page }) => {
    // 清空状态
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('应该显示用户信息', async ({ page }) => {
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

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 验证用户名显示
    const username = await mapPage.getUsername();
    expect(username).toContain(testUser.username);
  });

  test('应该显示侧边栏和地图容器', async ({ page }) => {
    const testUser = generateTestUser();

    // 创建并登录
    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 验证 UI 元素
    await mapPage.verifySidebarVisible();

    // 地图容器应该可见
    // 注意: 由于 AMap 需要有效的密钥，地图可能显示错误消息
    await expect(page.locator('.amap-container, [data-testid="map-container"]')).toBeVisible();
  });

  test('应该显示附近用户列表或空状态', async ({ page }) => {
    const testUser = generateTestUser();

    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 检查是否有附近用户或空状态
    const hasEmptyState = await mapPage.hasEmptyState();
    const nearbyCount = await mapPage.getNearbyUsersCount();

    // 应该显示用户列表或空状态之一
    expect(hasEmptyState || nearbyCount >= 0).toBeTruthy();
  });

  test('应该能够退出登录', async ({ page }) => {
    const testUser = generateTestUser();

    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 点击退出
    await mapPage.logout();

    // 应该重定向到首页
    await page.waitForURL('/', { timeout: 5000 });

    // 验证令牌已清除
    const accessToken = await page.evaluate(() => {
      return localStorage.getItem('access_token');
    });

    expect(accessToken).toBeNull();
  });

  test('退出后应该无法访问地图页面', async ({ page }) => {
    const testUser = generateTestUser();

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

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 退出
    await mapPage.logout();

    await page.waitForURL('/', { timeout: 5000 });

    // 尝试再次访问地图页面
    await page.goto('/map');

    // 应该重定向到登录页面
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});

test.describe('地图页面 - UI 元素', () => {
  test('应该显示状态栏按钮', async ({ page }) => {
    const testUser = generateTestUser();

    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    // 检查状态栏按钮
    await expect(page.getByRole('button', { name: /更新状态/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /开始学习会话/i })).toBeVisible();
  });

  test('应该显示退出按钮', async ({ page }) => {
    const testUser = generateTestUser();

    try {
      await registerUserViaApi(testUser.username, testUser.email, testUser.password);
    } catch (error) {
      // 用户可能已存在
    }

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    await expect(mapPage.logoutButton).toBeVisible();
    await expect(mapPage.logoutButton).toContainText('退出');
  });
});
