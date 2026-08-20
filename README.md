# 栗刻 LICO

最多三人共享的手绘手账风菜谱 App。支持邮箱验证码登录、邀请码加入家庭、菜谱与菜单同步、相册图片、购物清单和系统计时提醒。

```powershell
cd F:\github_projects\菜谱app\lico
npm start
```

在 iPhone 安装 Expo Go 后扫描终端二维码即可预览。当前版本使用本地演示数据；登录、家庭同步、图片上传与系统后台通知将在接入后端和 Apple 开发者配置后实现。

## 测试

```powershell
cd F:\github_projects\菜谱app\lico
npm start -- --clear --port 8082
```

请在两个已加入同一家庭的设备上测试菜谱、菜单与购物清单的新增、编辑、删除和同步。正式提交 App Store 前，需要在 Apple Developer 后台配置唯一的 iOS Bundle Identifier 与签名证书。
