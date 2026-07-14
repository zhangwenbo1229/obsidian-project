# Obsidian Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个以 Markdown 为唯一任务事实来源、参考 Jira 数据模型的 Obsidian 项目与任务管理插件。

**Architecture:** 插件采用“领域模型与纯函数 → Vault 数据仓库与增量索引 → 应用服务 → Obsidian 视图/弹窗/命令”的分层结构。全局配置、项目配置和任务均保存在 Vault 内并随 Vault 同步；插件 `data.json` 只保存设备本地 UI 状态和全局配置文件路径。所有本地开发编译在成功后必须立即部署到测试 Vault 的 `.obsidian/plugins/obsidian-project/`。

**Tech Stack:** TypeScript strict mode、Obsidian API、esbuild、Vitest、原生 DOM/CSS、YAML frontmatter、Obsidian Flavored Markdown。

---

## 1. 文档用途

本文档是 `obsidian-project` 首版的产品规格、数据协议、架构约束、验收标准和实施计划。AI 开发者应以本文档为需求基线；未写入首版范围的能力不得自行扩展。遇到本文档内部冲突时，优先级依次为：

1. 数据不变量与安全规则。
2. 已确认的产品行为。
3. UI 规格。
4. 实施步骤中的建议实现。

## 2. 产品范围

### 2.1 首版目标

- 管理多个项目，每个项目拥有独立代码、任务目录、任务类型、模板、自定义字段和工作流。
- 每个任务对应一个 Markdown 文件，可脱离插件直接阅读和编辑。
- 提供个人视图，统计整个 Vault 中的全部有效任务。
- 提供项目视图，并支持看板、列表和只读日历三种模式。
- 提供新增任务与编辑任务弹窗。
- 支持普通关联、项目内父子关系、备注以及项目迁移。
- 支持 Vault 多设备同步，并显式处理 UUID、Key 和配置迁移冲突。
- 桌面端支持全部功能；移动端只支持查看和编辑，不支持新增任务。

### 2.2 首版非目标

- 不开发时间线视图或任务变更审计时间线。
- 不支持保存常用查询，筛选状态只保留在当前会话。
- 不支持自定义任务关系类型。
- 不支持跨项目父子关系。
- 不支持日历拖动或缩放修改日期。
- 不支持任务类型层级约束。
- 不支持英文界面或其他语言。
- 不提供网络服务、协作服务器、账号登录、遥测或远程代码。
- 不保证两台离线设备能够无冲突地分配相同项目编号；同步后的冲突必须由用户处理。

## 3. 术语与身份模型

| 术语 | 定义 |
|---|---|
| `uid` | 任务永久身份，UUID v4，创建后不允许通过普通编辑修改。 |
| `key` | 人类可读任务编号，格式为 `<项目代码>-<递增数字>`，同时作为文件名。任务迁移项目或项目代码迁移时可以合法改变。 |
| `project-uid` | 项目永久身份，UUID v4；项目代码变化时保持不变。 |
| 项目代码 | 全局唯一的可读大写代码，例如 `PROJ`。 |
| 状态 | 用户可见的工作流节点，例如“待处理”。 |
| 状态分类 | 固定为 `todo`、`in_progress`、`done`，供统计和日期自动化使用。 |
| 结束结果 | `done` 状态必须标记为 `completed` 或 `terminated`。 |
| 当前用户 | 全局配置中的共享用户，用作新任务默认提报人和新备注作者。 |
| 有效任务 | 通过数据校验且不存在 UUID/Key 冲突的任务。只有有效任务进入统计和项目视图。 |

## 4. 默认 Vault 目录

首次启用时创建或引导用户确认以下目录。所有路径均为 Vault 相对路径：

```text
项目管理/
├─ 全局配置.md
├─ 项目配置/
│  ├─ PROJ.md
│  └─ OPS.md
└─ 任务/
   ├─ PROJ/
   └─ OPS/
```

- 全局配置文件路径可在插件设置中修改。
- 项目配置目录可在全局配置中修改。
- 每个项目可配置自己的任务目录。
- 启用按月分组后，任务创建到 `<任务目录>/YYYY-MM/<key>.md`。
- 月份取任务创建时 Obsidian 设备本地日期；迁移项目后仍按原始创建月份放入目标目录。
- 插件索引 Vault 中所有带 `pm-kind: task` 的 Markdown，而不是只索引配置目录。目录只决定插件创建或迁移文件时的目标位置。

## 5. 全局配置协议

默认文件为 `项目管理/全局配置.md`：

```yaml
---
pm-kind: global-config
pm-schema: 1
project-config-directory: 项目管理/项目配置
default-task-directory: 项目管理/任务
current-user-id: 8a67a66f-0109-47b3-9463-5d05b4295949
people:
  - id: 8a67a66f-0109-47b3-9463-5d05b4295949
    name: 张三
    active: true
  - id: 2cb0474e-cb69-4d04-8dbd-a45e233950cb
    name: 李四
    active: true
---
```

规则：

- 人员 ID 使用 UUID v4，所有项目共享人员列表。
- 显示名称可修改；任务和备注始终保存人员 ID。
- 已被引用的人员不能硬删除，只能停用或迁移引用。
- 当前用户随 Vault 同步，在所有设备间一致。
- `data.json` 只允许保存全局配置文件路径、当前会话视图模式等非业务数据；人员和项目业务配置不得以 `data.json` 为主数据。

## 6. 项目配置协议

每个项目使用一个 Markdown 配置文件。示例 `项目管理/项目配置/PROJ.md`：

```yaml
---
pm-kind: project
pm-schema: 1
project-uid: 778de407-26bf-45ee-b22e-cf1f0bc826ce
code: PROJ
name: 示例项目
active: true
task-directory: 项目管理/任务/PROJ
group-by-month: true
next-number: 124
task-types:
  - id: task
    name: 任务
    icon: circle-check
    color: "#3b82f6"
    active: true
    template: |-
      请描述任务目标和验收结果。
  - id: bug
    name: 缺陷
    icon: bug
    color: "#ef4444"
    active: true
    template: |-
      ### 复现步骤

      ### 预期结果

      ### 实际结果
  - id: requirement
    name: 需求
    icon: lightbulb
    color: "#f59e0b"
    active: true
    template: null
custom-fields:
  - id: 94cc3537-5694-4d28-a655-f7beded32989
    key: severity
    name: 严重程度
    type: single-select
    required: false
    active: true
    default: normal
    options:
      - id: normal
        name: 普通
      - id: critical
        name: 严重
workflow:
  initial-status-id: waiting
  statuses:
    - id: waiting
      name: 待处理
      category: todo
      result: null
      active: true
    - id: doing
      name: 进行中
      category: in_progress
      result: null
      active: true
    - id: completed
      name: 已完成
      category: done
      result: completed
      active: true
    - id: cancelled
      name: 已取消
      category: done
      result: terminated
      active: true
  transitions:
    - id: start
      name: 开始处理
      from: waiting
      to: doing
    - id: finish
      name: 完成
      from: doing
      to: completed
    - id: cancel-waiting
      name: 取消
      from: waiting
      to: cancelled
    - id: cancel-doing
      name: 取消
      from: doing
      to: cancelled
    - id: reopen-completed
      name: 重新打开
      from: completed
      to: waiting
    - id: reopen-cancelled
      name: 重新打开
      from: cancelled
      to: waiting
---
```

### 6.1 项目不变量

- `project-uid` 为 UUID v4，创建后永久不变。
- 项目代码全局唯一，必须匹配 `^[A-Z][A-Z0-9]*$`。
- 已产生任务的项目代码只能通过批量“更改项目代码”操作修改。
- `next-number` 只能增加，任务删除、创建失败或迁移失败都不得回退。
- 新任务使用当前 `next-number`，持久化加一后的配置成功后才创建文件。编号空洞合法。
- 项目停用后禁止新增任务，但允许查看、编辑、迁移已有任务。
- 删除项目配置前必须迁移或删除全部任务。
- 每个项目只有一个工作流。
- 必须存在一个有效初始状态及至少一个 `done + completed` 状态。
- `done` 状态必须具有 `completed` 或 `terminated` 结果；其他分类的 `result` 必须为 `null`。
- 已被任务引用的类型、状态、自定义字段只能停用或迁移，不能直接删除。
- 各任务类型拥有独立模板；模板为 `null` 时不插入任何默认正文。
- 模板不得包含 `## 任务正文`、`## 链接`、`## 备注` 三个保留二级标题。

### 6.2 自定义字段类型

| 类型 | YAML 值 | 校验规则 |
|---|---|---|
| `text` | 字符串 | 单行文本。 |
| `multiline-text` | 字符串 | 允许换行。 |
| `number` | 数字 | 不接受数字字符串。 |
| `boolean` | 布尔值 | 仅 `true` 或 `false`。 |
| `date` | 字符串 | `YYYY-MM-DD`。 |
| `datetime` | 字符串 | 带本地时区偏移的 ISO 8601。 |
| `single-select` | 选项 ID | 必须引用当前或已停用选项。 |
| `multi-select` | 选项 ID 数组 | 去重并保留配置顺序。 |
| `user` | 人员 UUID | 允许 `null`。 |
| `task-reference` | 任务 UUID | 允许 `null`。 |

自定义字段值直接保存为任务 frontmatter 顶层属性。字段键必须使用 kebab-case，不得与基础字段或 `pm-` 前缀冲突。修改字段键时必须：检查目标键冲突、展示影响文件数量、确认操作、写入迁移日志、逐文件更新、报告失败文件并支持继续执行。不得静默覆盖已有同名属性。

## 7. 任务 Markdown 协议

### 7.1 完整示例

```markdown
---
pm-kind: task
pm-schema: 1
uid: 550e8400-e29b-41d4-a716-446655440000
key: PROJ-123
project-uid: 778de407-26bf-45ee-b22e-cf1f0bc826ce
title: 修复登录失败问题
task-type-id: bug
created-at: 2026-07-12T14:30:00+08:00
start-date: 2026-07-13
due-date: 2026-07-20
completed-at: null
terminated-at: null
reporter-id: 8a67a66f-0109-47b3-9463-5d05b4295949
assignee-id: 2cb0474e-cb69-4d04-8dbd-a45e233950cb
status-id: doing
tags:
  - 登录
  - 移动端
severity: critical
---

## 任务正文

移动端输入正确密码后仍停留在登录页。

## 链接

- 父任务：[[PROJ-100|完善认证流程]] <!-- op-relation-id: c2443c20-f09b-41e9-84fd-0eb4a3cd233d; target-uid: 104430ee-91c8-4aec-8182-755cce14e0b6 -->
- 关联：[[PROJ-118|补充移动端测试]] <!-- op-relation-id: 13cbdb39-949e-492d-bdb4-cedb36e3dc50; target-uid: 354622d0-d4c8-4ef2-a0fe-d43df1065399 -->

## 备注

### 2026-07-12 15:10 · 张三

<!-- op-note-id: 1c357dce-9e98-47ed-85cc-c589ab4c068d; author-id: 8a67a66f-0109-47b3-9463-5d05b4295949 -->

已确认问题只在移动端出现。
```

### 7.2 基础字段规则

| 字段 | 必填 | 可普通编辑 | 说明 |
|---|---:|---:|---|
| `pm-kind` | 是 | 否 | 固定为 `task`。 |
| `pm-schema` | 是 | 否 | 首版固定为 `1`。 |
| `uid` | 是 | 否 | UUID v4，永久身份。 |
| `key` | 是 | 否 | 与文件 basename 一致。 |
| `project-uid` | 是 | 否 | 只能通过项目迁移改变。 |
| `title` | 是 | 是 | 去除首尾空白后不得为空。 |
| `task-type-id` | 是 | 是 | 必须引用所属项目的有效或停用类型。 |
| `created-at` | 是 | 否 | 创建时按设备本地时区生成。 |
| `start-date` | 否 | 是 | `YYYY-MM-DD`。 |
| `due-date` | 否 | 是 | `YYYY-MM-DD`。 |
| `completed-at` | 否 | 是 | 仅完成状态使用。 |
| `terminated-at` | 否 | 是 | 仅终止状态使用。 |
| `reporter-id` | 是 | 是 | 默认当前用户。 |
| `assignee-id` | 否 | 是 | 单一经办人，可为空或转交。 |
| `status-id` | 是 | 受限 | 只能执行工作流允许的转换。 |
| `tags` | 是 | 是 | 字符串数组，允许空数组。 |

- 所有时间解释和“今天”判断均使用 Obsidian 设备本地时区。
- 开始日期和计划完成日期只存日期；创建、完成、终止存带偏移的日期时间。
- 未注册的普通元数据必须原样保留。
- 基础字段固定使用英文 kebab-case；首版界面只显示简体中文。

### 7.3 正文结构

- 三个保留标题必须按 `任务正文 → 链接 → 备注` 顺序存在。
- 任务类型模板只插入 `## 任务正文` 下方。
- 用户可直接编辑三个区段。
- 缺少标题时，插件不得覆盖正文；应提供“修复正文结构”预览，由用户确认后移动现有内容。
- 普通 Wikilink 可以存在于链接区，但缺少合法关系注释时不参与结构化关系查询。

### 7.4 关系规则

- `关联` 为无方向多对多关系；关系只需存储在任一任务中，索引必须为双方计算反向显示。
- 每个任务最多有一个父任务，可以拥有多个由索引反向计算的子任务。
- 父子任务必须属于同一项目。
- 禁止自引用和祖先循环。
- 关系以 `target-uid` 为身份依据；Wikilink 只用于可读和跳转。
- 任务 Key 合法变化后，插件必须刷新所有结构化关系中的 Wikilink 文本。
- 链接区允许直接编辑。无法解析的结构化注释进入数据问题列表；普通 Wikilink 原样保留。

### 7.5 备注规则

- 每条备注拥有 UUID v4、作者 ID、创建时间和 Markdown 正文。
- 当前用户是新备注默认作者。
- 已有备注允许修改和删除。
- 用户删除备注标识后，内容保留为普通 Markdown，但不进入结构化备注列表。
- 插件不得因备注解析失败删除或重排用户正文。

## 8. 工作流与日期自动化

- 新任务使用项目 `initial-status-id`，创建弹窗不允许任意选择初始状态。
- 首次进入 `in_progress` 且 `start-date` 为空时，自动填写本地日期；已有值不覆盖。
- 进入 `done + completed` 时填写 `completed-at`，并清空 `terminated-at`。
- 进入 `done + terminated` 时填写 `terminated-at`，并清空 `completed-at`。
- 从任一 `done` 状态重新打开时清空 `completed-at` 与 `terminated-at`。
- 在两个结束结果之间合法转换时，只保留目标结果对应日期。
- 用户可以在编辑弹窗修改开始、完成、终止日期，但保存值必须与当前状态结果一致。
- 看板拖拽只允许执行配置中存在的状态转换；非法目标列应回弹并显示原因。

## 9. 编号、同步与冲突

### 9.1 本地编号分配

1. 读取项目配置与索引中的该项目最大历史编号。
2. 候选编号取 `max(next-number, 最大历史编号 + 1)`。
3. 检查候选 Key 和目标文件路径均未被占用。
4. 先将项目 `next-number` 写为候选编号加一。
5. 再创建任务文件。
6. 创建失败时保留编号空洞，不回滚计数器。

### 9.2 同步冲突

- UUID 重复：全部冲突文件退出统计，用户必须为错误副本生成新 UUID 或删除副本。
- Key 重复：冲突文件退出统计，用户选择一个任务执行“重新编号”；不得静默改名。
- Key 与文件名不一致：任务进入待修复状态，用户选择按 Key 重命名文件或为任务重新编号。
- 项目计数器落后：自动提升到现有最大编号加一，但不修改任何已有任务。
- 插件运行期间发现用户修改 `uid` 或 `key`，使用最近有效内存快照提示并恢复；重启或同步后无法确定原值时只报告异常，不猜测。

## 10. 任务与项目迁移

### 10.1 任务迁移项目

- 目标项目必须处于启用状态。
- 没有父子关系的任务可单独迁移。
- 有父任务或子任务时禁止单独迁移；用户需解除关系或迁移整棵任务树。
- 整棵树迁移时，为每个任务从目标项目计数器分配新 Key，并保持父子结构。
- 目标路径按目标项目目录、原始创建月份和新 Key 计算。
- 使用 Obsidian `FileManager.renameFile` 完成移动，以触发原生 Wikilink 更新。
- `uid`、标题、正文、备注、标签、人员、日期和普通关联保持不变。
- 用户必须为每个来源任务类型选择目标任务类型，并选择目标工作流状态。
- 同名且同类型的自定义字段自动映射；其他字段由用户映射或明确放弃。
- 放弃值写入迁移报告，不写入不兼容字段。
- 迁移到非结束状态时清空完成与终止日期；迁移到结束状态时只保留目标结果对应日期。
- 任一步失败时停止后续写入，展示已完成和未完成文件；迁移操作必须可安全继续，不得重复分配已完成任务的 Key。

### 10.2 更改项目代码

- 修改前展示受影响任务数、文件数和关系数。
- 为所有任务保留数字部分，只替换代码前缀。
- 先检查全部目标 Key 和目标路径无冲突，再开始写入。
- 更新项目配置、任务 Key、文件名、目录和结构化关系 Wikilink。
- `project-uid`、任务 `uid` 和 `next-number` 保持不变。
- 使用持久化迁移日志支持失败后继续。

## 11. 删除规则

- 插件删除任务时使用 Obsidian 回收站能力，不直接永久删除。
- 存在父任务或子任务时默认禁止删除，必须先解除或迁移关系。
- 只有普通关联时允许删除，并清理其他任务中指向它的结构化关联。
- 用户直接从文件管理器删除任务时不自动修改其他文件；相关关系显示“目标缺失”，数据问题入口提供一键清理。
- 删除任务永不回退项目计数器。
- 删除项目配置前必须处理该项目全部任务。

## 12. 数据问题中心

个人视图和项目设置均应提供“数据问题”入口，显示文件路径、问题类型、影响和可用修复操作。

| 问题 | 行为 |
|---|---|
| 缺少必填字段或日期格式错误 | 可打开，不进入统计和项目视图。 |
| 找不到项目配置 | 标记为孤立任务。 |
| UUID 冲突 | 所有冲突任务暂停参与统计。 |
| Key 冲突 | 提供选择任务重新编号操作。 |
| Key 与文件名不一致 | 提供重命名文件或重新编号操作。 |
| 自定义值类型错误 | 保留原值并提示，不自动删除。 |
| 失效结构化关系 | 显示目标缺失并提供清理。 |
| 固定正文标题缺失 | 提供不覆盖原文的结构修复预览。 |
| 未知元数据 | 原样保留，不视为错误。 |

## 13. 视图规格

### 13.1 入口

- Ribbon 图标打开个人视图。
- 注册“打开个人视图”“打开项目视图”“新增任务”三个稳定命令。
- 个人视图和项目视图使用 Obsidian 主工作区叶子，支持并排和固定。
- 选择任务默认打开统一编辑弹窗；弹窗提供“在 Markdown 中打开”。
- 移动端隐藏或禁用新增任务命令和按钮，保留查看、筛选、状态转换和编辑。

### 13.2 个人视图

统计整个 Vault 中全部有效任务，不按当前经办人过滤。

- 完成数量：状态为 `done + completed`。
- 终止数量：状态为 `done + terminated`，单独展示。
- 未完成数量：状态分类为 `todo` 或 `in_progress`。
- 完成率：`完成数量 / (完成数量 + 未完成数量)`；终止任务不进入分母，分母为零时显示 `0%`。
- 逾期任务：未完成、有计划完成日期且日期早于设备本地今天。
- 待完成清单：全部未完成任务；有计划完成日期的按日期升序，无计划完成日期的排在末尾。
- 清单至少显示 Key、标题、项目、状态、经办人和计划完成日期。

### 13.3 项目视图通用行为

- 顶部必须先选择一个项目。
- 筛选只保留在当前会话，不写入配置。
- 不同条件之间使用 AND；同一条件多个选项使用 OR。
- 支持关键词匹配 Key、标题和任务正文。
- 支持任务类型、状态、状态分类、提报人、经办人、标签、四类日期范围和自定义字段筛选。
- 看板、列表、日历共享同一筛选结果。

### 13.4 看板

- 按工作流状态分列，状态顺序遵循项目配置。
- 卡片显示 Key、标题、类型、经办人、计划完成日期和标签。
- 拖拽只执行已配置转换；非法转换回弹。
- 选择卡片打开编辑弹窗。

### 13.5 列表

- 默认列：Key、标题、类型、状态、提报人、经办人、开始日期、计划完成日期。
- 用户可在当前会话临时选择基础字段或自定义字段作为列，不持久化列配置。
- 支持按可见列排序。
- 少于 1,000 个任务仍使用虚拟滚动，避免复杂筛选时产生大量 DOM。
- 选择行打开编辑弹窗。

### 13.6 日历

- 首版只读，不允许拖动或缩放修改日期。
- 同时具有开始日期和计划完成日期时显示跨日任务。
- 只有计划完成日期时显示单日任务。
- 只有开始日期或完全没有日期时不显示。
- 选择日历任务打开编辑弹窗。

## 14. 弹窗规格

### 14.1 新增任务弹窗

- 桌面端可用，移动端不可用。
- 字段：项目、任务类型、标题、提报人、经办人、开始日期、计划完成日期、标签、项目自定义字段、任务正文。
- 标题、项目、任务类型、提报人及所有项目必填自定义字段必须通过校验。
- 提报人默认当前用户；经办人允许为空。
- 状态固定为项目初始状态。
- 正文初值来自所选任务类型模板；没有模板时为空。
- 创建成功后打开新任务 Markdown 文件。
- 创建失败必须显示原因和目标路径，不清空用户已输入内容。

### 14.2 编辑任务弹窗

- 只读显示 UUID 和 Key。
- 编辑基础属性和自定义属性。
- 仅通过工作流操作改变状态。
- 支持转交经办人。
- 支持管理一个父任务、多个子任务和普通关联。
- 支持新增、修改、删除备注。
- 支持编辑任务正文。
- 提供“在 Markdown 中打开”“迁移项目”“删除任务”操作。
- 保存必须使用 `Vault.process` 合并当前磁盘内容，保留未知元数据与未识别 Markdown，避免覆盖同步期间的外部编辑。

## 15. 设置界面

- 全局配置文件路径与初始化状态。
- 当前用户与共享人员列表管理。
- 项目配置目录。
- 项目创建、停用、删除前检查和项目代码迁移。
- 项目任务目录、按月分组开关、任务类型模板、自定义字段和工作流可视化编辑。
- 所有配置写回 Markdown 主数据；设置页不得维护独立业务副本。
- 修改已引用配置项时提供停用或迁移，不直接删除。
- 自定义字段键迁移和项目代码迁移显示进度及持久化报告。

## 16. 索引与性能

- 目标规模：单 Vault 少于 1,000 个任务。
- 启动时通过 MetadataCache 找出 `pm-kind: task`，读取并校验完整任务正文。
- 监听 Vault `create`、`modify`、`rename`、`delete` 和 MetadataCache 变化，执行增量更新。
- 文件连续变化使用约 150ms 防抖；插件自身写入必须防止重复处理，但不能忽略随后到达的同步修改。
- 索引按 UID、Key、项目、状态、人员、标签、日期和自定义字段建立查询结构。
- 关系反向索引负责普通关联双方显示和父任务的子任务列表。
- 桌面端 1,000 个任务冷启动索引目标小于 2 秒，常用筛选目标小于 100ms；性能测试使用生成数据而非真实 Vault。
- 所有运行时依赖必须浏览器兼容；业务代码不得依赖 Node/Electron，以保留移动端能力。

## 17. 模块边界

```text
src/
├─ main.ts                         # 生命周期和模块装配
├─ constants.ts                    # 插件 ID、视图 ID、保留字段和标题
├─ domain/
│  ├─ types.ts                     # Task、Project、Workflow、User 等领域类型
│  ├─ validation.ts                # 纯数据校验
│  ├─ workflow.ts                  # 转换与日期规则
│  └─ relations.ts                 # 父子循环和关系不变量
├─ markdown/
│  ├─ frontmatter.ts               # 保留未知键的 frontmatter 读写
│  ├─ task-parser.ts               # 三段正文、关系、备注解析与序列化
│  └─ config-parser.ts             # 全局/项目配置解析与序列化
├─ repositories/
│  ├─ global-config-repository.ts
│  ├─ project-repository.ts
│  └─ task-repository.ts
├─ index/
│  ├─ task-index.ts
│  └─ issue-index.ts
├─ services/
│  ├─ task-service.ts              # 新增、编辑、删除、重新编号
│  ├─ workflow-service.ts
│  ├─ relation-service.ts
│  ├─ migration-service.ts
│  └─ project-service.ts
├─ commands/
│  └─ register-commands.ts
├─ views/
│  ├─ personal-view.ts
│  ├─ project-view.ts
│  ├─ board-renderer.ts
│  ├─ list-renderer.ts
│  └─ calendar-renderer.ts
├─ modals/
│  ├─ create-task-modal.ts
│  ├─ edit-task-modal.ts
│  ├─ migration-modal.ts
│  └─ data-issues-modal.ts
├─ settings/
│  └─ settings-tab.ts
└─ utils/
   ├─ dates.ts
   ├─ ids.ts
   └─ paths.ts

tests/
├─ fixtures/
├─ domain/
├─ markdown/
├─ repositories/
├─ index/
└─ services/

scripts/
└─ deploy.mjs
```

`main.ts` 只负责加载配置、构建索引、注册视图/命令/设置页和清理资源，不包含业务规则或 DOM 细节。

## 18. 安全写入原则

- 使用 Obsidian `Vault`、`FileManager`、`MetadataCache` API，不使用 Node 文件 API访问 Vault。
- 修改现有任务时使用 `Vault.process` 基于最新文本合并，避免盲目覆盖。
- 重命名或移动任务使用 `FileManager.renameFile`，保持 Obsidian 链接更新能力。
- 批量迁移先完整预检，再创建持久化迁移日志，然后逐文件执行。
- 解析器必须保留未知 frontmatter、普通 Wikilink、普通 Markdown 和用户格式。
- 插件不访问 Vault 外文件，不发送网络请求，不执行远程代码，不收集遥测。
- 所有事件和 DOM 监听通过插件 `register*` 或组件显式销毁机制清理。

## 19. 构建与部署闭环

本地开发必须配置环境变量：

```powershell
$env:OBSIDIAN_VAULT_PATH='D:\path\to\vault'
```

脚本约定：

- `npm run build:ci`：类型检查并生成生产 `main.js`，仅供 CI/Release 无 Vault 环境使用。
- `npm run deploy`：验证 Vault 和插件 ID，然后复制 `main.js`、`manifest.json`、存在时的 `styles.css` 到 `<Vault>/.obsidian/plugins/obsidian-project/`。
- `npm run build`：依次执行 `build:ci` 与 `deploy`。部署失败时整体命令失败，不得报告本地构建完成。
- `npm run dev`：esbuild watch 每次编译成功后调用部署逻辑；编译失败不部署旧产物。
- 部署脚本必须解析 `manifest.json` 获取 ID，校验目标绝对路径位于指定 Vault 的 `.obsidian/plugins/` 内，禁止接受任意外部目标。
- Obsidian CLI 可用时，部署后执行 `obsidian plugin:reload id=obsidian-project`，再检查 `obsidian dev:errors` 与错误级别控制台；CLI 不可用时打印明确的手动重载提示。
- CI 和 Release 工作流改用 `npm run build:ci`；Release 继续附加 `main.js`、`manifest.json`、可选 `styles.css`。

每个实施任务的验证顺序固定为：目标测试 → 全量测试 → Lint → `npm run build` → 在 Obsidian 中验证。任何编译成功的本地构建都必须完成部署，不能只停留在仓库根目录。

## 20. 测试策略

- 使用 Vitest 测试领域、解析器、索引和服务。
- Obsidian API 通过窄接口和测试替身隔离，不在单元测试中启动 Obsidian。
- 每个缺陷修复必须先添加能够复现根因的失败测试，再做最小修复，并运行相关回归集。
- Markdown 解析测试必须覆盖未知属性、未知 Wikilink、中文内容、CRLF/LF、缺失区段、破损注释和多行备注。
- 工作流测试覆盖所有分类/结果组合以及重新打开日期清理。
- 关系测试覆盖自引用、循环、跨项目父子、反向关联和缺失目标。
- 迁移测试覆盖预检冲突、部分失败后继续、自定义字段映射和任务树迁移。
- 同步冲突测试覆盖 UUID 重复、Key 重复、文件名不一致和计数器落后。
- 视图测试聚焦统计选择器和筛选纯函数；关键 Obsidian DOM 行为通过手工验收。

## 21. 实施计划

### Task 1: 建立插件身份、测试和强制部署链路

**Files:**

- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `esbuild.config.mjs`
- Modify: `.github/workflows/lint.yml`
- Modify: `.github/workflows/release.yml`
- Create: `scripts/deploy.mjs`
- Create: `vitest.config.ts`
- Create: `tests/deploy/deploy.test.ts`

- [x] 将插件 ID、名称和包名统一为 `obsidian-project`，保留语义化版本 `1.0.0`。
- [x] 先编写部署测试，覆盖缺少环境变量、非法 Vault、目标路径越界、三项产物复制和可选 CSS；运行 `npm test -- tests/deploy/deploy.test.ts`，预期因脚本不存在而失败。
- [x] 实现安全部署脚本和 `build:ci`、`build`、`deploy`、`test` 脚本；watch 构建只在成功回调中部署。
- [x] 将 CI/Release 改为 `npm run build:ci`，避免无 Vault 环境触发本地部署。
- [x] 运行部署测试与 `npm run lint`，预期全部通过。
- [x] 设置 `OBSIDIAN_VAULT_PATH` 后运行 `npm run build`，预期产物位于 `.obsidian/plugins/obsidian-project/`；重载插件并检查错误。

### Task 2: 定义领域类型和数据校验

**Files:**

- Create: `src/constants.ts`
- Create: `src/domain/types.ts`
- Create: `src/domain/validation.ts`
- Create: `src/utils/dates.ts`
- Create: `src/utils/ids.ts`
- Create: `tests/domain/validation.test.ts`

- [x] 为第 3～8 节所有字段和不变量编写失败测试，运行 `npm test -- tests/domain/validation.test.ts`，预期因模块不存在而失败。
- [x] 定义判别联合类型表示自定义字段、状态结果、数据问题和任务有效性；所有外部输入先作为 `unknown` 校验。
- [x] 实现 UUID、Key、日期、配置引用、自定义字段和工作流结构校验，返回结构化问题而非抛出不可恢复异常。
- [x] 运行目标测试、全量测试与 Lint，预期通过。
- [x] 运行 `npm run build` 并在 Obsidian 中确认插件可加载。

### Task 3: 实现 Markdown 与配置解析器

**Files:**

- Create: `src/markdown/frontmatter.ts`
- Create: `src/markdown/task-parser.ts`
- Create: `src/markdown/config-parser.ts`
- Create: `tests/markdown/task-parser.test.ts`
- Create: `tests/markdown/config-parser.test.ts`
- Create: `tests/fixtures/task-complete.md`
- Create: `tests/fixtures/project-complete.md`

- [x] 使用第 5～7 节示例建立解析/往返测试，先运行并确认失败。
- [x] 实现保留未知属性的 frontmatter 合并、三个正文区段、结构化关系和备注解析/序列化。
- [x] 覆盖 CRLF、中文、多行模板、未知 Wikilink、破损注释和缺失区段，保证不删除无法识别内容。
- [x] 实现全局与项目配置解析，验证 `pm-kind` 和 `pm-schema`。
- [x] 运行目标测试、全量测试、Lint 和 `npm run build`；重载后确认无错误。

### Task 4: 实现配置与任务仓库

**Files:**

- Create: `src/repositories/global-config-repository.ts`
- Create: `src/repositories/project-repository.ts`
- Create: `src/repositories/task-repository.ts`
- Create: `tests/repositories/repositories.test.ts`

- [x] 使用 Vault 测试替身编写读取、创建、`Vault.process` 合并、回收站删除和 `FileManager.renameFile` 测试，先确认失败。
- [x] 实现全局配置初始化、项目发现和 Vault 全范围任务发现。
- [x] 实现安全合并写入，保证未知属性和 Markdown 不丢失。
- [x] 实现任务重命名/移动与回收站删除，业务校验留给服务层。
- [x] 运行全部验证并执行 `npm run build` 部署。

### Task 5: 构建增量索引和数据问题中心模型

**Files:**

- Create: `src/index/task-index.ts`
- Create: `src/index/issue-index.ts`
- Create: `tests/index/task-index.test.ts`
- Create: `tests/index/performance.test.ts`

- [x] 编写 UUID/Key/项目/人员/关系反向索引以及冲突退出统计的失败测试。
- [x] 实现初次扫描、文件事件增量更新和约 150ms 防抖。
- [x] 实现孤立任务、重复身份、无效日期、失效引用和正文结构问题聚合。
- [x] 使用 1,000 个生成任务验证桌面测试环境索引与查询性能目标。
- [x] 运行全部验证并执行 `npm run build` 部署。

### Task 6: 实现工作流、关系和任务服务

**Files:**

- Create: `src/domain/workflow.ts`
- Create: `src/domain/relations.ts`
- Create: `src/services/workflow-service.ts`
- Create: `src/services/relation-service.ts`
- Create: `src/services/task-service.ts`
- Create: `tests/services/workflow-service.test.ts`
- Create: `tests/services/relation-service.test.ts`
- Create: `tests/services/task-service.test.ts`

- [x] 编写编号分配、日期自动化、非法转换、自引用、循环、跨项目父子和删除规则测试，先确认失败。
- [x] 实现先推进计数器再创建任务的编号算法，允许编号空洞。
- [x] 实现工作流转换与完成/终止/重新打开日期规则。
- [x] 实现普通关联反向显示、单父任务约束、循环检测和结构化关系写入。
- [x] 实现创建、编辑、重新编号和删除用例。
- [x] 运行全部验证并执行 `npm run build` 部署。

### Task 7: 实现迁移与配置批量修改

**Files:**

- Create: `src/services/migration-service.ts`
- Create: `src/services/project-service.ts`
- Create: `tests/services/migration-service.test.ts`
- Create: `tests/services/project-service.test.ts`

- [x] 按第 10 节编写单任务、任务树、字段映射、项目代码迁移、目标冲突和失败继续测试。
- [x] 实现全量预检和持久化迁移日志，日志记录操作 ID、文件 UID、旧/新路径、旧/新 Key 和状态。
- [x] 实现任务/任务树迁移、项目代码修改和结构化 Wikilink刷新。
- [x] 实现自定义字段键批量修改，目标键存在时整批拒绝启动。
- [x] 运行全部验证并执行 `npm run build` 部署。

### Task 8: 实现新增与编辑弹窗

**Files:**

- Create: `src/modals/create-task-modal.ts`
- Create: `src/modals/edit-task-modal.ts`
- Create: `src/modals/migration-modal.ts`
- Create: `src/modals/data-issues-modal.ts`
- Create: `tests/modals/form-models.test.ts`
- Modify: `styles.css`

- [x] 先为表单初值、必填校验、工作流动作、模板切换不覆盖用户正文和移动端能力判断编写纯模型测试。
- [x] 实现新增弹窗，并在任务类型变化时仅对尚未编辑的正文应用对应模板。
- [x] 实现编辑弹窗的属性、状态、关系、备注、正文、迁移、删除和 Markdown 跳转操作。
- [x] 实现数据问题修复与迁移确认弹窗，批量操作必须展示影响范围。
- [x] 使用 Obsidian 原生 CSS 变量完成桌面和移动端布局，不引入 UI 框架。
- [x] 运行全部验证、`npm run build`，在 Obsidian 中手工创建、编辑、转交、备注和关联任务。

### Task 9: 实现个人视图和项目三模式视图

**Files:**

- Create: `src/views/personal-view.ts`
- Create: `src/views/project-view.ts`
- Create: `src/views/board-renderer.ts`
- Create: `src/views/list-renderer.ts`
- Create: `src/views/calendar-renderer.ts`
- Create: `tests/views/selectors.test.ts`
- Modify: `styles.css`

- [x] 按第 13 节编写统计、完成率、逾期、筛选组合、排序和日历区间选择器测试。
- [x] 实现全 Vault 个人统计和两个任务清单。
- [x] 实现项目选择、会话筛选和三种共享筛选结果的渲染器。
- [x] 实现看板合法拖拽、列表临时列和只读日历。
- [x] 实现移动端响应式查看/编辑，确保没有新增入口。
- [x] 运行全部验证、`npm run build`，在桌面与移动模拟模式手工验收。

### Task 10: 实现设置、命令与生命周期装配

**Files:**

- Create: `src/settings/settings-tab.ts`
- Create: `src/commands/register-commands.ts`
- Modify: `src/main.ts`
- Delete: `src/settings.ts`
- Create: `tests/commands/command-registration.test.ts`

- [x] 编写三个稳定命令、移动端新增禁用、视图注册和 unload 清理测试。
- [x] 实现全局人员、项目目录及项目配置的可视化设置，所有保存写回 Markdown。
- [x] 注册 `open-personal-view`、`open-project-view`、`create-task` 命令和 Ribbon 入口。
- [x] 精简 `main.ts`，移除 Sample Plugin 的全局点击 Notice、示例命令、状态栏和定时日志。
- [x] 确认所有 Vault、workspace、DOM 和 interval 监听可在插件卸载时清理。
- [x] 运行全量测试、Lint、`npm run build`，重载插件并检查错误控制台。

### Task 11: 完成端到端验收与文档

**Files:**

- Modify: `README.md`
- Create: `docs/user-guide.md`
- Create: `tests/e2e/manual-checklist.md`

- [x] 按第 22 节生成逐项手工验收清单，不省略移动端、同步冲突和失败迁移场景。
- [x] 更新 README，说明本地离线原则、安装、配置、开发、构建、部署和发布产物。
- [x] 编写简体中文用户指南，展示全局配置、项目、任务、工作流、视图、迁移和数据修复流程。
- [x] 运行 `npm test`、`npm run lint` 和 `npm run build`，预期全部成功且产物已部署。
- [x] 重载插件，运行 `obsidian dev:errors` 与错误级别控制台检查；CLI 不可用时在开发者工具中完成等价检查。
- [x] 完成全部手工验收后再提交发布候选版本。

## 22. 首版验收标准

- [x] 首次启用可以创建中文默认目录、全局配置和第一个项目。
- [x] 项目可以配置任务目录、月份分组、三种默认任务类型、类型模板、自定义字段和统一工作流。
- [x] 新建任务生成 UUID、不可复用 Key、正确目录和固定三段正文。
- [x] 删除任务后下一任务不复用编号。
- [x] 直接编辑合法 Markdown 后索引和视图自动刷新，未知内容不丢失。
- [x] 非法 UUID/Key 编辑、重复 UUID/Key 和文件名不一致均进入数据问题中心。
- [x] 工作流转换严格受限，开始、完成、终止和重新打开日期符合规则。
- [x] 普通关联双向可见，父子关系禁止循环和跨项目。
- [x] 备注可以新增、修改、删除，直接编辑正文不会被覆盖。
- [x] 个人视图按确认口径统计全部有效任务。
- [x] 项目筛选 AND/OR 语义正确，三种视图共享结果。
- [x] 看板非法拖拽回弹；日历首版完全只读。
- [x] 项目迁移重分配 Key 并保持 UUID；任务树和字段映射符合规则。
- [x] 项目代码与自定义字段键批量迁移在冲突时拒绝，在中断后可继续。
- [x] 同步后重复 Key 不自动改名，必须由用户选择重新编号。
- [x] 桌面端支持全部功能；移动端可查看和编辑但不能新增。
- [x] 插件卸载后无残留监听、interval 或自定义视图资源。
- [x] `npm test`、`npm run lint`、`npm run build` 全部通过。
- [x] 每次本地成功编译后的 `main.js`、`manifest.json` 和可选 `styles.css` 已部署到测试 Vault 插件目录。

## 23. 缺陷修复规范

任何 BUG 修改必须遵循以下顺序：

1. 收集可稳定复现的输入文件、配置、操作步骤、期望结果和实际结果。
2. 沿“Markdown 原文 → 解析结果 → 校验/索引 → 服务规则 → UI”定位首次出现错误的层级，确认根本原因。
3. 评估同一函数、数据字段和写入路径的现有调用方，列出潜在回归范围。
4. 在最接近根因的层级添加失败测试，并确认测试在修改前因目标原因失败。
5. 制定只修改必要模块的方案；不得用 UI 特判掩盖数据层错误。
6. 实现最小修复并运行目标测试、相关模块测试和全量测试。
7. 运行 Lint 和生产构建；构建成功后必须执行部署脚本。
8. 在 Obsidian 中复现原场景，并验证至少一个相邻正常场景未受影响。
9. 检查插件错误和控制台；记录根因、修复点、测试覆盖和部署结果。

## 24. 最终自检

- 需求覆盖：数据层、个人视图、项目三模式视图、命令、设置、同步、移动端、异常修复、构建部署均有对应规格和任务。
- 术语一致：`uid` 仅指任务 UUID，`project-uid` 仅指项目 UUID，`key` 仅指可变的人类可读编号。
- 日期一致：创建/完成/终止为带本地偏移的日期时间；开始/计划完成为本地日期。
- 统计一致：终止任务单独统计，不进入完成率分母；逾期只针对未完成任务。
- 数据主权一致：Vault Markdown 是业务主数据，`data.json` 不保存业务副本。
- 首版边界一致：无时间线、无保存查询、无自定义关系、无跨项目父子、无日历写操作、移动端无新增。
