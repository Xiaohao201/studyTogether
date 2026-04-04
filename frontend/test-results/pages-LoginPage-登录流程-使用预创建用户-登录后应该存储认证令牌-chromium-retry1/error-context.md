# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "欢迎回来" [level=2] [ref=e5]
      - paragraph [ref=e6]: 登录 StudyTogether，找到你的学习伙伴
    - generic [ref=e7]:
      - generic [ref=e8]: 1 validation error for UserResponse id Input should be a valid string [type=string_type, input_value=UUID('35345e9c-1a16-484e-ad05-18f417120c03'), input_type=UUID] For further information visit https://errors.pydantic.dev/2.10/v/string_type
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: 邮箱地址
          - textbox "邮箱地址" [ref=e12]:
            - /placeholder: your@email.com
            - text: user_1770807155710_8660@example.com
        - generic [ref=e13]:
          - generic [ref=e14]: 密码
          - generic [ref=e15]:
            - textbox "密码" [ref=e16]:
              - /placeholder: ••••••••
              - text: TestPassword123!
            - button "显示" [ref=e17] [cursor=pointer]
      - button "登录" [ref=e18] [cursor=pointer]
      - generic [ref=e19]:
        - text: 还没有账号？
        - link "立即注册" [ref=e20] [cursor=pointer]:
          - /url: /register
    - link "← 返回首页" [ref=e22] [cursor=pointer]:
      - /url: /
  - alert [ref=e23]
```