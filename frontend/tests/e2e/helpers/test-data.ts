/**
 * 测试数据生成工具
 */

/**
 * 生成随机用户名
 */
export function generateRandomUsername(prefix: string = 'testuser'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 生成随机邮箱
 */
export function generateRandomEmail(domain: string = 'example.com'): string {
  const username = generateRandomUsername('user');
  return `${username}@${domain}`;
}

/**
 * 生成测试用户数据
 */
export interface TestUserData {
  username: string;
  email: string;
  password: string;
}

export function generateTestUser(override?: Partial<TestUserData>): TestUserData {
  const password = 'TestPassword123!';
  return {
    username: generateRandomUsername(),
    email: generateRandomEmail(),
    password,
    ...override,
  };
}

/**
 * 测试用固定用户 (用于已存在的测试用户)
 */
export const FIXED_TEST_USER = {
  username: 'e2e_test_user',
  email: 'e2e_test@example.com',
  password: 'TestPassword123!',
};

/**
 * 无效的测试数据 (用于验证测试)
 */
export const INVALID_DATA = {
  shortUsername: 'ab', // 少于3个字符
  shortPassword: '1234567', // 少于8个字符
  invalidEmail: 'not-an-email',
  mismatchPassword: 'Different123!',
};
