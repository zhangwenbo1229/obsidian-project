# obsidian-project

`obsidian-project` 是一个本地优先的 Obsidian 项目与任务管理插件。任务、项目配置和人员配置均保存在 Vault 内的 Markdown 文件中，可参与 Obsidian Sync、Git 或其他文件同步。

## 功能

- Jira 风格的项目代码和不可复用任务编号，例如 `PROJ-123.md`。
- UUID v4 永久标识，任务迁移项目后仍保持身份不变。
- 项目级任务类型、正文模板、自定义字段和可配置工作流。
- 可拖拽、缩放和独立配置的个人工作台，支持任务、天气、日历、笔记统计、最近文件、资讯、目录、Markdown 文本和图表卡片；每张卡片可设置背景颜色。
- 普通关联、项目内父子任务和可编辑备注。
- 项目代码、任务项目、自定义字段键和完整任务树迁移。
- 可恢复的持久化迁移日志；中断后可从数据问题中心继续，且不会重复分配 Key。
- 重复 UUID、重复 Key、失效关系和文件名不一致检测。
- 桌面端完整功能；移动端支持查看和编辑，不提供新增任务入口。

## 安装

将以下发布文件复制到 `<Vault>/.obsidian/plugins/obsidian-project/`：

- `main.js`
- `manifest.json`
- `styles.css`

随后在 **设置 → 第三方插件** 中启用 **obsidian-project**。

## 首次使用

1. 打开 **设置 → obsidian-project**。
2. 确认全局配置路径，默认是 `项目管理/全局配置.md`。
3. 设置当前用户并维护共享人员列表。
4. 创建项目，然后配置任务目录、任务类型、模板、自定义字段和工作流。
5. 执行命令 **obsidian-project: 新增任务**。

详细说明见 [用户指南](docs/user-guide.md)，开发规格见 [实施计划](docs/superpowers/plans/2026-07-12-obsidian-project.md)。

## 本地开发

要求 Node.js 20+ 和 npm。

```powershell
npm install
$env:OBSIDIAN_VAULT_PATH='D:\path\to\vault'
npm run dev
```

每次 watch 编译成功后会自动复制发布产物到测试 Vault。生产构建同样强制部署：

```powershell
npm test
npm run lint
npm run build
```

CI 和 Release 使用 `npm run build:ci`，因为远程环境没有本地 Vault。发布 Tag 必须与 `package.json`、`manifest.json` 版本完全一致。

Obsidian 以 `--remote-debugging-port=9222` 运行时，可重复生成完整的 `PLAY` 演示项目与测试任务：

```powershell
npm run seed:demo
```

## 隐私与安全

- 插件不包含遥测，也不执行远程代码；所有联网卡片默认关闭，并且需要逐卡片明确启用。
- 天气卡片启用后只向用户选择的 Open-Meteo、和风天气或 OpenWeatherMap 发送经纬度，不发送 Vault、笔记或任务数据。和风天气和 OpenWeatherMap 的 API Key 保存在插件 `data.json` 中。
- 资讯卡片启用后只访问用户填写的 RSS/Atom 地址；订阅内容以纯文本渲染，不执行其中的 HTML 或脚本。
- 插件只通过 Obsidian API 读写当前 Vault。
- Markdown 是业务主数据；`data.json` 只保存启动路径和设备 UI 状态。
- 批量迁移会在 `项目管理/.迁移/` 中写入任务前后快照和逐文件进度；失败后可在 **数据问题** 中继续。

## 验证

```powershell
npm test
npm run lint
npm run build
```

手工发布前检查见 [manual-checklist.md](tests/e2e/manual-checklist.md)。
