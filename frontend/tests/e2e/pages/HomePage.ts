/**
 * 首页页面对象
 */
import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly content: Locator;
  readonly title: Locator;
  readonly registerButton: Locator;
  readonly mapButton: Locator;
  readonly loginButton: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.content = page.getByTestId('home-content');
    this.title = page.locator('h1');
    this.registerButton = page.getByTestId('home-register-btn');
    this.mapButton = page.getByTestId('home-map-btn');
    this.loginButton = page.getByRole('link', { name: /登录/i });
    this.logo = page.locator('.text-2xl.font-bold');
  }

  /**
   * 导航到首页
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * 点击注册按钮
   */
  async clickRegister() {
    await this.registerButton.click();
  }

  /**
   * 点击地图按钮
   */
  async clickMap() {
    await this.mapButton.click();
  }

  /**
   * 点击登录按钮
   */
  async clickLogin() {
    await this.loginButton.click();
  }

  /**
   * 验证页面已加载
   */
  async isLoaded() {
    await this.content.waitFor({ state: 'visible' });
    await expect(async () => {
      const titleText = await this.title.textContent();
      expect(titleText).toContain('找到你的学习伙伴');
    })();
  }
}

// 导出便捷函数以便在测试中使用
export async function gotoHomePage(page: Page): Promise<HomePage> {
  const homePage = new HomePage(page);
  await homePage.goto();
  return homePage;
}
