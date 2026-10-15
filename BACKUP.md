# Bozi 项目备份文档

## 一、账号
- GitHub：bozi0（用户自己知道密码）
- Deno Deploy：QQ邮箱 3903854310@qq.com（用 GitHub 登录）
- 废弃：Cloudflare、Zeabur、Vercel、Render（都用不上）

## 二、架构
- 前端：GitHub Pages，仓库 github.com/bozi0/BOZI
  - 线上地址：https://bozi0.github.io/BOZI/
  - 主文件：index.html
- 后端：Deno Deploy
  - 线上地址：https://bozi.bozi0.deno.net
  - 组织：bozi0，应用名：bozi
  - 代码：api/index.js
- 数据库：Deno KV，实例名 bozi-orders
- PWA：sw.js + manifest.json + icon.svg

## 三、管理后台
- 进入方式：底部 4 个 emoji（🌌⌚📱🔥）各点 2 次 + 长按 BOZI logo 3 秒
- 密码：存在 Deno 环境变量 ADMIN_PASSWORD（不写在代码里）
- 环境变量位置：dash.deno.com → bozi0 → Settings → Environment Variables

## 四、环境变量（Deno Deploy）
- INTERNAL_KEY：用于 /register 接口鉴权
- ADMIN_PASSWORD：管理员密码

## 五、API 端点
- GET  /                    健康检查
- POST /register            注册订单（需 X-Bozi-Key 头）
- POST /verify              验证订单
- POST /track/visit         记录访问
- GET  /announcement        获取公告
- GET  /admin/stats         统计（需 X-Admin-Pwd 头）
- GET  /admin/orders        订单列表（需 X-Admin-Pwd 头）
- POST /admin/publish       发布公告（需 X-Admin-Pwd 头）
- POST /admin/close-announcement  关闭公告（需 X-Admin-Pwd 头）

## 六、已修复的安全问题
- /register 加 X-Bozi-Key 鉴权 ✅
- CORS 白名单已更新 ✅
- 密码改从环境变量读 ✅
- 密码走 Header 不走 URL ✅
- ?admin=1 入口已删除 ✅

## 七、待做功能（可选）
- 订单搜索
- 订单删除
- 库存管理
- 销量趋势图
- 订单云端同步

## 八、部署方式
- 改前端：GitHub 网页编辑 → Commit → 等 1-2 分钟自动部署
- 改后端：改 api/index.js → Deno 自动重新部署
- 改环境变量：Deno Settings → 保存后点 Deploy Default Branch

## 九、常见问题
- 页面白屏：F12 Console 看红字，通常是括号不匹配
- 订单显示伪造：检查 Deno KV 是否挂载、后端是否在线
- 分享按钮不显示：只在详情页显示（page-neo8/page-tv1 等）
- 夸克保存失败：已知问题，代码里有夸克检测

## 十、给下一个 AI 的建议
- 用户是未成年，用词简单直接
- 用户用 GitHub 网页版编辑，不要让他装本地环境
- 改代码前先让用户 Ctrl+F 搜索定位
- 大改动前提醒用户可 Revert 回退
- 用户喜欢一步一步来
