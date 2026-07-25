# DataHive

DataHive 是一个内容采集与导出平台，基于开源项目 [wechat-article-exporter](https://github.com/wechat-article/wechat-article-exporter)（MIT）构建，用于抓取、整理并导出内容资产（图文 / 图片 / 文本 / 视频 / 评论 / 专辑），支持 Markdown / Word / PDF 导出、数据库入库与定时同步。

> DataHive 是在成熟能力之上面向**新业务场景**独立演进的一套，与既有部署相互独立。

## 技术栈

- **框架**：Nuxt 3（SPA，`ssr: false`）+ Vue 3 + TypeScript
- **UI**：TailwindCSS + @nuxt/ui + ag-grid-enterprise
- **本地存储**：Dexie（IndexedDB）
- **数据库**：MySQL（mysql2）
- **其他**：Monaco 编辑器、Sentry、Umami
- **运行环境**：Node ≥ 22，包管理 yarn

## 快速开始

```bash
# 1. 安装依赖
yarn

# 2. 配置环境变量
cp .env.example .env
# 按需填写 .env（数据库、AG-Grid 授权等），切勿把真实凭据提交到仓库

# 3. 本地开发
yarn dev
```

## 环境变量

见 [.env.example](.env.example)。数据库相关：

| 变量 | 说明 |
|------|------|
| `DB_HOST` | MySQL 主机 |
| `DB_USER` | 用户名 |
| `DB_PASSWORD` | 密码 |
| `DB_NAME` | 库名 |
| `DB_CONNECTION_LIMIT` | 连接池上限（默认 10） |

> ⚠️ 所有凭据一律通过环境变量注入，**禁止**硬编码到源码。

## 目录结构

| 目录 | 作用 |
|------|------|
| `server/api/` | 后端接口（登录、抓取、代理、对外 API、文章入库） |
| `utils/download/` | 核心导出引擎（Downloader / Exporter / ProxyManager） |
| `store/v2/` | 浏览器本地库（Dexie） |
| `pages/dashboard/` | 控制台 UI |
| `config/` | 代理池、公共 API 等配置 |

## License

MIT，见 [LICENSE](LICENSE)。基于 wechat-article-exporter，版权归原作者所有。
