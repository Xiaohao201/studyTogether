/**
 * 首页 E2E 测试
 */
import { test, expect } from '@playwright/test';
import { HomePage } from './HomePage';

test.describe('首页', () => {
  test('应该正确加载首页内容', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();

    // 验证标题
    await expect(homePage.title).toBeVisible();
    await expect(homePage.title).toContainText('找到你的学习伙伴');

    // 验证主要内容区域
    await expect(homePage.content).toBeVisible();

    // 验证功能卡片
    await expect(page.getByText('全球学习地图')).toBeVisible();
    await expect(page.getByText('附近匹配')).toBeVisible();
    await expect(page.getByText('隐私保护')).toBeVisible();
  });

  test('应该显示导航按钮', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // 验证主要操作按钮
    await expect(homePage.registerButton).toBeVisible();
    await expect(homePage.mapButton).toBeVisible();
    await expect(homePage.loginButton).toBeVisible();

    // 验证按钮文本
    await expect(homePage.registerButton).toContainText('开始学习之旅');
    await expect(homePage.mapButton).toContainText('查看学习地图');
  });

  test('点击注册按钮应该导航到注册页面', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.clickRegister();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: /创建账号/i })).toBeVisible();
  });

  test('点击地图按钮应该导航到地图页面', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.clickMap();

    await expect(page).toHaveURL(/\/map/);
  });

  test('点击登录按钮应该导航到登录页面', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.clickLogin();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /欢迎回来/i })).toBeVisible();
  });

  test('应该显示 StudyTogether logo', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.logo).toBeVisible();
    await expect(homePage.logo).toContainText('StudyTogether');
  });
});
