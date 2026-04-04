# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "创建账号" [level=2] [ref=e5]
      - paragraph [ref=e6]: 加入 StudyTogether，开始你的学习之旅
    - generic [ref=e7]:
      - generic [ref=e8]: 1 validation error for UserResponse id Input should be a valid string [type=string_type, input_value=UUID('1a86d4e7-23da-4f6a-912d-dfc5dce596f5'), input_type=UUID] For further information visit https://errors.pydantic.dev/2.10/v/string_type
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: 用户名
          - textbox "用户名" [ref=e12]:
            - /placeholder: xiaoming
            - text: testuser_1770807231851_346
        - generic [ref=e13]:
          - generic [ref=e14]: 邮箱地址
          - textbox "邮箱地址" [ref=e15]:
            - /placeholder: your@email.com
            - text: user_1770807231851_8266@example.com
        - generic [ref=e16]:
          - generic [ref=e17]: 密码
          - textbox "密码" [ref=e18]:
            - /placeholder: 至少8个字符
            - text: TestPassword123!
        - generic [ref=e19]:
          - generic [ref=e20]: 确认密码
          - textbox "确认密码" [ref=e21]:
            - /placeholder: 再次输入密码
            - text: TestPassword123!
      - button "注册" [ref=e22] [cursor=pointer]
      - generic [ref=e23]:
        - text: 已有账号？
        - link "立即登录" [ref=e24] [cursor=pointer]:
          - /url: /login
    - link "← 返回首页" [ref=e26] [cursor=pointer]:
      - /url: /
  - alert [ref=e27]
```