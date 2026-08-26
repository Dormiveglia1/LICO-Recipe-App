# 栗刻 LICO

一个最多三人共享的手绘手账风菜谱 App。家庭成员可用邮箱验证码登录，通过邀请码共享菜谱、菜单和购物清单。

## 产品截图

<p align="center">
  <img src="assets/screenshots/recipe-book.jpg" alt="栗刻 LICO 菜谱本" width="320" />
  <img src="assets/screenshots/menu-shopping.jpg" alt="栗刻 LICO 菜单与购物清单" width="320" />
</p>

## 功能

- 菜谱的创建、编辑、分类、标签、收藏、评分与烹饪记录
- 按「想吃 / 计划本周做 / 今天做 / 已完成」管理菜单，并自动汇总购物清单
- 相册图片上传、家庭成员资料与成员备注
- 倒计时与本地通知提醒，支持深色模式和网页端
- Supabase 实时同步；每个家庭最多 3 位成员

## 技术栈

Expo 54、React Native、TypeScript、Supabase（Auth、Postgres、Storage 与 Realtime）。

## 本地运行

需要 Node.js 20+、npm，以及一个 Supabase 项目。

```powershell
git clone https://github.com/Dormiveglia1/LICO-Recipe-App.git
cd LICO-Recipe-App
npm install
Copy-Item .env.example .env
```

在 `.env` 中填写 Supabase 项目的 URL 和 **Publishable key**：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

不要填写 `service_role` key；它拥有管理员权限，绝不能放进客户端或提交到 GitHub。

接着在 Supabase Dashboard 的 SQL Editor 按以下顺序执行 SQL：

1. `supabase/schema.sql`
2. `supabase/media-and-profiles.sql`
3. `supabase/pending-cooking-and-favorites.sql`
4. `supabase/member-notes.sql`
5. `supabase/three-person-family.sql`
6. `supabase/family-session-and-leave.sql`
7. `supabase/sync-hardening.sql`

然后启动应用：

```powershell
npm start
```

在 iPhone 上安装 Expo Go 并扫描终端二维码，或运行 `npm run web` 在浏览器中预览。

## 常用命令

```powershell
npm run android
npm run ios
npm run web
npm run pwa:build
```

`npm run pwa:build` 会将网页构建产物生成到 `dist/`；该目录是可再生文件，不提交到仓库。

## 安全与提交约定

`.env`、依赖目录、Expo 缓存、构建产物、日志及签名/证书文件均已由 `.gitignore` 排除。`.env.example` 仅提供变量名和示例，应该保持可提交。

本仓库使用 Supabase 的公开客户端 Publishable key；它可以出现在客户端，但数据库安全必须依赖已包含的 Row Level Security 策略。任何管理员密钥、证书或真实用户数据都不应提交。

## 许可证

[MIT](LICENSE)
