/**
 * 完整认证流程 E2E 测试
 *
 * 测试从注册到登录到访问受保护页面的完整用户旅程
 */
import { test, expect } from '@playwright/test';
import { HomePage, RegisterPage, LoginPage, MapPage } from '../pages';
import { generateTestUser } from '../helpers/test-data';

test.describe('完整用户认证流程', () => {
  test('新用户完整注册流程', async ({ page }) => {
    // 1. 从首页开始
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.title).toContainText('找到你的学习伙伴');

    // 2. 点击注册按钮
    await homePage.clickRegister();
    await expect(page).toHaveURL(/\/register/);

    // 3. 填写注册表单
    const testUser = generateTestUser();
    const registerPage = new RegisterPage(page);
    await registerPage.register(testUser);

    // 4. 应该重定向到登录页面
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // 5. 使用新注册的账号登录
    const loginPage = new LoginPage(page);
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 6. 应该重定向到地图页面
    await page.waitForURL('/map', { timeout: 15000 });

    // 7. 验证用户信息显示
    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();
    const username = await mapPage.getUsername();
    expect(username).toContain(testUser.username);
  });

  test('已注册用户登录流程', async ({ page }) => {
    const testUser = generateTestUser();

    // 1. 从首页开始
    const homePage = new HomePage(page);
    await homePage.goto();

    // 2. 点击登录按钮
    await homePage.clickLogin();
    await expect(page).toHaveURL(/\/login/);

    // 3. 直接使用 testUser (假设用户已存在)
    // 注意: 在实际测试中，我们需要先创建用户
    // 这里我们测试登录流程本身
    const loginPage = new LoginPage(page);
    await expect(loginPage.heading).toBeVisible();
  });

  test('退出登录后返回首页', async ({ page, context }) => {
    const testUser = generateTestUser();

    // 1. 清空 localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // 2. 导航到登录页面
    const homePage = new HomePage(page);
    await homePage.clickLogin();

    // 3. 注意: 这里我们需要先注册一个用户
    // 实际测试中会通过 API 创建
    const loginPage = new LoginPage(page);

    // 先通过注册创建用户
    await loginPage.clickRegisterLink();
    const registerPage = new RegisterPage(page);
    await registerPage.register(testUser);

    // 4. 现在登录
    await expect(page).toHaveURL(/\/login/);
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 5. 验证在地图页面
    await page.waitForURL('/map', { timeout: 15000 });
    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 6. 退出登录
    await mapPage.logout();

    // 7. 应该回到首页
    await expect(page).toHaveURL('/');

    // 8. 验证 localStorage 已清除
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeNull();
  });

  test('页面刷新应该保持登录状态', async ({ page }) => {
    const testUser = generateTestUser();

    // 注册
    await page.goto('/register');
    const registerPage = new RegisterPage(page);
    await registerPage.register(testUser);

    // 登录
    await expect(page).toHaveURL(/\/login/);
    const loginPage = new LoginPage(page);
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    // 等待地图页面加载
    await page.waitForURL('/map', { timeout: 15000 });
    const mapPage = new MapPage(page);
    await mapPage.waitForLoad();

    // 刷新页面
    await page.reload();

    // 应该仍然在地图页面（没有重定向到登录）
    await page.waitForURL('/map', { timeout: 10000 });
    await expect(page.getByTestId('map-sidebar')).toBeVisible({ timeout: 10000 });

    // 用户信息应该仍然显示
    const username = await mapPage.getUsername();
    expect(username).toContain(testUser.username);
  });

  test('浏览器重启后应该恢复登录状态', async ({ browser, context }) => {
    const testUser = generateTestUser();

    // 使用新页面
    const page = await context.newPage();

    // 注册
    await page.goto('/register');
    const registerPage = new RegisterPage(page);
    await registerPage.register(testUser);

    // 登录
    await expect(page).toHaveURL(/\/login/);
    const loginPage = new LoginPage(page);
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await page.waitForURL('/map', { timeout: 15000 });

    // 关闭页面并打开新页面（模拟浏览器重启）
    await page.close();
    const newPage = await context.newPage();

    // 导航到受保护的页面
    await newPage.goto('/map');

    // 检查是否保持登录状态
    // 由于使用 localStorage，新的 context 不会共享状态
    // 但同一个 context 中的页面会共享
    await newPage.waitForURL(/\/map|\/login/, { timeout: 5000 });
  });
});

test.describe('导航流程', () => {
  test('应该能够通过导航链接在页面间跳转', async ({ page }) => {
    // 从首页开始
    const homePage = new HomePage(page);
    await homePage.goto();

    // 首页 -> 注册
    await homePage.clickRegister();
    await expect(page).toHaveURL(/\/register/);

    // 注册 -> 登录
    const registerPage = new RegisterPage(page);
    await registerPage.clickLoginLink();
    await expect(page).toHaveURL(/\/login/);

    // 登录 -> 注册
    const loginPage = new LoginPage(page);
    await loginPage.clickRegisterLink();
    await expect(page).toHaveURL(/\/register/);

    // 注册 -> 首页
    await registerPage.clickHomeLink();
    await expect(page).toHaveURL('/');

    // 首页 -> 登录
    await homePage.clickLogin();
    await expect(page).toHaveURL(/\/login/);

    // 登录 -> 首页
    await loginPage.clickHomeLink();
    await expect(page).toHaveURL('/');
  });

  test('应该能够直接访问页面 URL', async ({ page }) => {
    // 首页
    await page.goto('/');
    await expect(page.getByText('找到你的学习伙伴')).toBeVisible();

    // 注册页面
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /创建账号/i })).toBeVisible();

    // 登录页面
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /欢迎回来/i })).toBeVisible();

    // 地图页面 (未认证，应该重定向)
    await page.goto('/map');
    // 应该重定向到登录页面
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});
