/**
 * 注册页面对象
 */
import { Page, Locator, expect } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  readonly homeLink: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByTestId('register-username');
    this.emailInput = page.getByTestId('register-email');
    this.passwordInput = page.getByTestId('register-password');
    this.confirmPasswordInput = page.getByTestId('register-confirm-password');
    this.submitButton = page.getByTestId('register-submit');
    this.loginLink = page.getByRole('link', { name: /立即登录/i });
    this.homeLink = page.getByRole('link', { name: /返回首页/i });
    this.heading = page.getByRole('heading', { name: /创建账号/i });
  }

  /**
   * 导航到注册页面
   */
  async goto() {
    await this.page.goto('/register');
  }

  /**
   * 填写注册表单
   */
  async fillForm(data: {
    username: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) {
    // Wait for inputs to be ready
    await this.usernameInput.waitFor({ state: 'visible' });
    await this.emailInput.waitFor({ state: 'visible' });
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.confirmPasswordInput.waitFor({ state: 'visible' });

    // Clear inputs first
    await this.usernameInput.clear();
    await this.emailInput.clear();
    await this.passwordInput.clear();
    await this.confirmPasswordInput.clear();

    // Fill with data
    await this.usernameInput.fill(data.username);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword || data.password);

    // Verify values are filled
    await expect(this.usernameInput).toHaveValue(data.username);
    await expect(this.emailInput).toHaveValue(data.email);
    await expect(this.passwordInput).toHaveValue(data.password);
    await expect(this.confirmPasswordInput).toHaveValue(data.confirmPassword || data.password);
  }

  /**
   * 提交表单
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * 填写并提交表单
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
  }) {
    await this.fillForm({ ...data, confirmPassword: data.password });
    await this.submit();
  }

  /**
   * 点击登录链接
   */
  async clickLoginLink() {
    await this.loginLink.click();
  }

  /**
   * 点击返回首页链接
   */
  async clickHomeLink() {
    await this.homeLink.click();
  }

  /**
   * 等待表单验证错误消息
   */
  async waitForErrorMessage(field: 'username' | 'email' | 'password' | 'confirmPassword') {
    const input = this[`${field}Input` as keyof this] as Locator;
    await expect(input).toBeVisible();
  }

  /**
   * 验证页面标题
   */
  async verifyTitle() {
    await expect(this.heading).toBeVisible();
    await expect(this.heading).toContainText('创建账号');
  }
}

// 导出便捷函数
export async function gotoRegisterPage(page: Page): Promise<RegisterPage> {
  const registerPage = new RegisterPage(page);
  await registerPage.goto();
  return registerPage;
}
