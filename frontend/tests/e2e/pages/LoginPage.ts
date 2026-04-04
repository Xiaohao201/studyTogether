/**
 * 登录页面对象
 */
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;
  readonly homeLink: Locator;
  readonly heading: Locator;
  readonly showPasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('login-email');
    this.passwordInput = page.getByTestId('login-password');
    this.submitButton = page.getByTestId('login-submit');
    this.registerLink = page.getByRole('link', { name: /立即注册/i });
    this.homeLink = page.getByRole('link', { name: /返回首页/i });
    this.heading = page.getByRole('heading', { name: /欢迎回来/i });
    this.showPasswordButton = page.getByRole('button', { name: /显示|隐藏/i });
  }

  /**
   * 导航到登录页面
   */
  async goto() {
    await this.page.goto('/login');
  }

  /**
   * 填写登录表单
   */
  async fillForm(data: { email: string; password: string }) {
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  /**
   * 提交表单
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * 使用凭据登录
   */
  async login(data: { email: string; password: string }) {
    await this.fillForm(data);
    await this.submit();
  }

  /**
   * 点击注册链接
   */
  async clickRegisterLink() {
    await this.registerLink.click();
  }

  /**
   * 点击返回首页链接
   */
  async clickHomeLink() {
    await this.homeLink.click();
  }

  /**
   * 切换密码显示/隐藏
   */
  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  /**
   * 验证密码字段类型
   */
  async getPasswordInputType(): Promise<'password' | 'text'> {
    return (await this.passwordInput.getAttribute('type')) as 'password' | 'text';
  }

  /**
   * 验证页面标题
   */
  async verifyTitle() {
    await expect(this.heading).toBeVisible();
    await expect(this.heading).toContainText('欢迎回来');
  }
}

// 导出便捷函数
export async function gotoLoginPage(page: Page): Promise<LoginPage> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  return loginPage;
}
