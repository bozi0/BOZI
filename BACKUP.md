# Bozi 项目备份文档

## 一、架构
- 前端：GitHub Pages，仓库 github.com/bozi0/BOZI
  - 线上地址：https://bozi0.github.io/BOZI/
  - 主文件：index.html（HTML + CSS + JS 全在一个文件）
- 后端：Deno Deploy（Serverless）
  - 线上地址：https://bozi.bozi0.deno.net
  - 代码：api/index.js
- 数据库：Deno KV（键值数据库，无需额外配置）
- PWA：sw.js + manifest.json + icon.svg

## 二、功能清单
- 9 款产品：Neo8/Neo7/Neo6/Pad2/Pad1/Book1/Buds1/Watch1/TV1
- 每款产品：首页 + 详情页 + 购买页
- 4 步购买流程（确认/支付/协议/验证动画）
- 43 位订单号生成 + 本地校验 + 云端验证（三重防护）
- 分享卡片（Canvas 生成 + 系统分享 + 夸克适配）
- 全站搜索、主题切换、系统返回手势
- PWA 安装 + 离线可用
- 管理后台（数据统计 / 公告推送 / 订单导出）
- 隐藏后台入口（手势 + 密码）

## 三、安全机制
- 后端订单验证：需要内部密钥（存 Deno 环境变量）
- 管理后台：需要管理员密码（存 Deno 环境变量）
- 所有敏感信息不在代码里明文

## 四、部署流程
- 改前端：GitHub 网页编辑 index.html → Commit → 等 1-2 分钟自动部署
- 改后端：改 api/index.js → Deno 自动重新部署
- 改环境变量：Deno Settings 保存后需点 Deploy Default Branch 重新部署

## 五、常见问题
- 页面白屏：F12 Console 看红字，通常是括号不匹配
- 订单显示伪造：检查 Deno KV 是否挂载、后端是否在线
- 分享按钮不显示：只在详情页显示
- 夸克浏览器保存失败：已知问题，代码里有检测

## 六、待做功能（可选）
- 订单搜索、订单删除、库存管理
- 销量趋势图、订单云端同步

## 七、给下一个 AI 的建议
- 用户是未成年，用词简单直接
- 用户用 GitHub 网页版编辑，不要让他装本地环境
- 改代码前先让用户 Ctrl+F 搜索定位
- 大改动前提醒用户可 Revert 回退
- 用户喜欢一步一步来

## 八、敏感信息
敏感信息（账号、密码、环境变量名、后台入口手法）**未记录在本文件**。
请向用户本人索取，他会另行提供。
