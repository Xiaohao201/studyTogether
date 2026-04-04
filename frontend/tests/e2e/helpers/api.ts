/**
 * API 测试辅助工具
 * 用于在测试前创建/清理测试数据
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * 通过 API 注册用户
 */
export async function registerUserViaApi(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Registration failed: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 通过 API 登录用户
 */
export async function loginUserViaApi(
  email: string,
  password: string
): Promise<AuthTokens & { user: User }> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * 删除用户 (如果后端支持)
 * 注意: 这需要后端提供删除用户的端点
 */
export async function deleteUserViaApi(
  userId: string,
  accessToken: string
): Promise<void> {
  // 注意: 目前后端可能没有删除端点
  // 如果有的话，可以这样实现:
  // await fetch(`${BACKEND_URL}/api/users/${userId}`, {
  //   method: 'DELETE',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //   },
  // });
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUserViaApi(accessToken: string): Promise<User> {
  const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get current user');
  }

  const data = await response.json();
  return data.data;
}
