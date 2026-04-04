/**
 * 地图页面对象
 */
import { Page, Locator, expect } from '@playwright/test';

export class MapPage {
  readonly page: Page;
  readonly usernameDisplay: Locator;
  readonly logoutButton: Locator;
  readonly sidebar: Locator;
  readonly mapContainer: Locator;
  readonly nearbyUsersList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameDisplay = page.getByTestId('map-username');
    this.logoutButton = page.getByTestId('map-logout-btn');
    this.sidebar = page.getByTestId('map-sidebar');
    this.mapContainer = page.getByTestId('map-container');
    this.nearbyUsersList = page.locator('[data-testid="map-sidebar"] > div > div > div');
  }

  /**
   * 导航到地图页面
   */
  async goto() {
    await this.page.goto('/map');
  }

  /**
   * 等待地图加载
   */
  async waitForLoad() {
    // 等待侧边栏或地图容器任一出现
    await Promise.race([
      this.sidebar.waitFor({ state: 'visible' }),
      this.mapContainer.waitFor({ state: 'visible' }),
    ]);
  }

  /**
   * 获取用户名
   */
  async getUsername(): Promise<string | null> {
    const element = this.usernameDisplay.first();
    if (!(await element.isVisible())) {
      return null;
    }
    return element.textContent();
  }

  /**
   * 点击退出按钮
   */
  async logout() {
    await this.logoutButton.click();
  }

  /**
   * 获取附近用户数量
   */
  async getNearbyUsersCount(): Promise<number> {
    await this.sidebar.waitFor({ state: 'visible' });
    return this.nearbyUsersList.count();
  }

  /**
   * 验证用户已登录
   */
  async verifyUserLoggedIn(expectedUsername: string) {
    await this.waitForLoad();
    const username = await this.getUsername();
    expect(username).toContain(expectedUsername);
  }

  /**
   * 验证侧边栏显示
   */
  async verifySidebarVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  /**
   * 验证地图容器显示
   */
  async verifyMapVisible() {
    await expect(this.mapContainer).toBeVisible();
  }

  /**
   * 检查是否显示"附近暂无正在学习的伙伴"消息
   */
  async hasEmptyState(): Promise<boolean> {
    try {
      const emptyText = this.page.getByText(/附近暂无正在学习的伙伴/);
      await emptyText.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// 导出便捷函数
export async function gotoMapPage(page: Page): Promise<MapPage> {
  const mapPage = new MapPage(page);
  await mapPage.goto();
  return mapPage;
}
