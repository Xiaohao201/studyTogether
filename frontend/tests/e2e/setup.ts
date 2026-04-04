/**
 * 全局测试设置和清理
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('=== E2E 测试开始 ===');
  console.log(`BASE_URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
  console.log(`BACKEND_URL: ${process.env.BACKEND_URL || 'http://localhost:8000'}`);

  // 在这里可以添加测试前的准备操作：
  // - 启动测试数据库
  // - 运行数据库迁移
  // - 创建测试用户
}

async function globalTeardown(config: FullConfig) {
  console.log('=== E2E 测试结束 ===');

  // 在这里可以添加测试后的清理操作：
  // - 清理测试数据库
  // - 删除测试用户
  // - 关闭测试服务器
}

export { globalSetup, globalTeardown };
