> **注意：** 这是 README.md 的翻译版本，原始英文版本可能包含更新的内容。

# AS Notes（个人知识管理 VS Code 扩展）

网站：[asnotes.io](https://www.asnotes.io) | 开发者：[App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|安装 | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Pro 功能 | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|文档 | [docs.asnotes.io](https://docs.asnotes.io)|
|博客 | [blog.asnotes.io](https://blog.asnotes.io)|
|路线图 / 项目看板| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## 什么是 AS Notes？

**AS Notes 将 Markdown 和 `[[wikilink]]` 编辑功能直接带入 [VS Code](https://code.visualstudio.com/) 及兼容编辑器（如 [Antigravity](https://antigravity.google/)、[Cursor](https://cursor.com/)、[Windsurf](https://windsurf.com/)），支持笔记、文档、博客和 Wiki。**

**随时捕捉灵感、建立概念链接、专注写作 - 无需离开你的编辑器。**

AS Notes 提供生产力工具，将你最喜欢的 IDE 变成个人知识管理系统（PKMS），包括反向链接视图、任务管理、日记本、看板、Markdown 编辑工具、Mermaid 图表、LaTeX 数学公式支持以及类似 Jekyll / Hugo 的静态发布功能。

（1 分钟介绍视频）

[![AS Notes 演示](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

（1 分钟演示视频）

[![AS Notes 演示](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## 为什么选择 VS Code？

我们中的许多人每天都在使用 VS Code 及类似的兼容编辑器，即使使用单独的工具管理笔记和知识，我们通常仍会在 IDE 中编写文档、博客和 Wiki。AS Notes 提供在 IDE 中完成所有工作的工具。

在 VS Code 中管理笔记的一些主要优势（除了 AS Notes 直接提供的功能之外）：

- 跨平台兼容性 + Web（通过 Workspaces）
- 在其他知识管理工具可能无法获得批准的受限工作环境中被接受
- 庞大的扩展库，可与 AS Notes 配合使用以进一步扩展功能
- 内置 AI 代理框架（GitHub CoPilot / Claude 等），可用于处理你的笔记
- 最先进的文本编辑和 UI 功能
- 语法高亮
- 以及 VS Code 拥有的所有其他功能

## AS Notes 功能

### 通用功能

- 注重隐私 - AS Notes 不会将你的数据或遥测信息发送到任何地方
- 版本控制友好（Git & GitOps）
- 轻量级笔记索引（本地 sqlite3 WASM）

- 在大型知识库（约 20k 个 Markdown 文件）上表现出色

### Wiki 链接

- Logseq / Roam / Obsidian 风格的 `[[wikilinks]]`，支持嵌套链接，例如 `[[[[AS Notes]] Page]]`
- 链接解析到工作区中任何位置的目标页面。嵌套 Wiki 链接可解析多个目标
- 重命名链接会更新目标文件和所有匹配的引用
- 自动 Wiki 链接 / 文件重命名跟踪

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

有关 Wiki 链接的更多信息，请参阅 [Wiki 链接文档](https://docs.asnotes.io/wikilinks.html)。

### 任务管理

使用 `Ctrl+Shift+Enter`（Windows/Linux）/ `Cmd+Shift+Enter`（macOS）切换 Markdown 待办事项：

```
- [ ] 添加待办标记
- [x] 标记为已完成
移除待办标记
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

#### 任务元数据标签

在任务行的任意位置添加结构化的标签元数据，以分类和组织任务。标签会从显示的任务文本中剥离 - 只显示干净的描述。

| 标签 | 描述 |
|---|---|
| `#P1` | 优先级 1 - 严重 |
| `#P2` | 优先级 2 - 高 |
| `#P3` | 优先级 3 - 普通 |
| `#W` | 等待中 - 任务被阻塞或等待某人/某事 |
| `#D-YYYY-MM-DD` | 截止日期 - 例如 `#D-2026-03-15` |
| `#C-YYYY-MM-DD` | 完成日期 - 例如 `#C-2026-03-15` |

使用示例：

```markdown
- [ ] #P1 修复关键的生产环境 bug
- [ ] #P2 #W 等待新仪表板的设计审批
- [x] #D-2026-03-10 提交季度报告
```

可以组合使用多个标签。只使用一个优先级标签 - 如果存在多个，以第一个为准。

#### 任务管理

**AS Notes** 活动栏图标打开任务侧边栏，显示整个工作区中的所有任务。

**分组方式** - 选择任务分组方式：

| 视图 | 描述 |
|---|---|
| **页面** | 任务按源页面字母顺序分组 |
| **优先级** | 任务按优先级分组（P1 → P2 → P3 → 无优先级），每组内按截止日期排序 |
| **截止日期** | 任务按截止日期分组 |
| **完成日期** | 任务按完成日期分组 |

**筛选器：**

- **仅待办** - 只显示未完成的任务（默认开启）
- **仅等待中** - 只显示标记了 `#W` 的任务
- **按页面筛选** - 输入文本以缩小到名称包含搜索文本的页面（不区分大小写）

### 反向链接面板

反向链接面板显示对页面的引用。引用通过页面提及、大纲模式下另一个 Wiki 链接的缩进或嵌套在另一个 Wiki 链接中来捕获。反向链接跟踪捕获周围上下文，适用于前向引用（具有 Wiki 链接但尚未创建的页面），并在索引更改时实时更新。

使用以下快捷键在当前标签旁打开反向链接编辑器标签：`Ctrl+Alt+B`（Windows/Linux）/ `Cmd+Alt+B`（macOS）

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

#### 视图模式

面板支持两种视图模式，可通过面板标题中的按钮切换：

- **按页面平铺**（默认）- 所有反向链接实例按源页面名称字母顺序排列。提供线性时间线视图，日记文件按时间顺序排列。
- **按链分组** - 反向链接按链模式（页面名称序列）分组，带有可折叠的标题。适用于基于概念的探索。

默认模式通过 `as-notes.backlinkGroupByChain`（默认 `false`）配置。

单独的切换控制**上下文详细程度** - 紧凑（单行，截断）或换行（完整文本可见）。默认通过 `as-notes.backlinkWrapContext`（默认 `false`）配置。

#### 链优先显示

- **模式分组** - 反向链接按链模式分组（例如来自不同文件的所有 `[[Project]] → [[Tasks]] → [[NGINX]]` 出现在一个组中）。
- **独立提及** - 直接 `[[wikilink]]` 引用显示为单链接链，排在最前面。
- **大纲上下文** - 如果 Wiki 链接缩进在另一个 Wiki 链接下方，完整的层次结构显示为链（例如 `Page A → Page B → Page C`），每个链接可点击。
- **每链接行号** - 每个链接显示其行号（例如 `[L12]`），用于精确导航。
- **行上下文** - 每个链实例显示周围的行文本，Wiki 链接被高亮显示，无需打开文件即可获得即时上下文。
- **不区分大小写分组** - `[[server]]` 和 `[[Server]]` 产生相同的链模式。

#### 上下文菜单 - 查看反向链接

在编辑器中右键点击任何 Wiki 链接以打开该特定页面的反向链接：

- 支持别名 - 如果 Wiki 链接指向别名，则显示规范页面的反向链接。
- 支持前向引用 - 尚不存在的页面仍然显示任何传入链接。

### 看板

AS Notes 内置看板功能，由 Markdown 文件支持，可以像 AS Notes 下的任何其他页面一样使用和编辑。

使用看板跟踪长期项目。标准任务可以在看板卡片文件中使用，就像 AS Notes 中的任何其他笔记一样。

### 每日日记

按 **Ctrl+Alt+J**（macOS 上为 Cmd+Alt+J）创建或打开今天的每日日记页面。

日记文件以 `YYYY-MM-DD.md` 格式创建在专用的 `journals/` 文件夹中（可配置）。新页面从模板文件夹（默认：`templates/`）中的 `Journal.md` 模板生成。编辑 `Journal.md` 以添加自己的栏目和提示。支持所有模板占位符 - 请参阅 [模板](#模板pro)。

侧边栏中的**日历**面板显示当前月份及日记指示器。点击任何一天即可打开其日记条目。详情请参阅 [日历](#日历)。

> **注意：** 每日日记需要已初始化的工作区（`.asnotes/` 目录）。请参阅 [开始使用](#开始使用)。

### 与其他 Markdown PKMS 工具的兼容性

由于相似的文件结构，AS Notes 可以与 Obsidian 或 Logseq 创建的知识库一起工作。但请注意存在格式和行为上的差异。

### 斜杠命令

在任何 Markdown 文件中键入 `/` 以打开快速命令菜单。继续键入以过滤列表，按 Enter 运行命令，或按 Escape 关闭并保留 `/`。斜杠命令在围栏代码块、内联代码段和 YAML 前置信息中被禁止。

#### 标准命令

| 命令 | 操作 |
|---|---|
| **Today** | 插入今天日期的 Wiki 链接，例如 `[[2026-03-06]]` |
| **Date Picker** | 打开预填今天日期的日期输入框。编辑日期或按 Enter 将其插入为 Wiki 链接 |
| **Code (inline)** | 插入 `` ` `` `` ` ``，光标放置在反引号之间 |
| **Code (multiline)** | 插入围栏代码块，光标在起始 ` ``` ` 之后 - 输入语言标识符（例如 `js`）然后按 Enter |

#### 发布命令 *（前置信息）*

这些命令切换或循环文件 YAML 前置信息中的发布相关字段。详情请参阅 [发布静态网站](#发布静态网站)。

| 命令 | 操作 |
|---|---|
| **Public** | 在前置信息中切换 `public: true` / `public: false` |
| **Layout** | 在前置信息中循环 `layout`：`docs`、`blog` 和 `minimal` |
| **Retina** | 在前置信息中切换 `retina: true` / `retina: false` |
| **Assets** | 在前置信息中切换 `assets: true` / `assets: false` |

#### 看板卡片命令 *（仅看板卡片文件）*

以下命令仅在编辑看板卡片文件（`kanban/card_*.md`）时出现。

| 命令 | 操作 |
|---|---|
| **Card: Entry Date** | 在光标处插入 `## entry YYYY-MM-DD` 标题，预填今天的日期 |

#### 任务命令 *（仅任务行）*

这些命令仅在光标位于任务行（`- [ ]` 或 `- [x]`）上时出现。标签插入在复选框之后以及行中已有标签之后。

| 命令 | 操作 |
|---|---|
| **Task: Priority 1** | 在任务文本开头插入 `#P1`。替换行中任何现有的优先级标签（`#P1`-`#P9`） |
| **Task: Priority 2** | 插入 `#P2`，替换任何现有的优先级标签 |
| **Task: Priority 3** | 插入 `#P3`，替换任何现有的优先级标签 |
| **Task: Waiting** | 在任务文本开头切换 `#W`（不存在则插入，存在则移除） |
| **Task: Due Date** | 打开预填今天（YYYY-MM-DD）的日期输入。在任务文本开头插入 `#D-YYYY-MM-DD`。替换任何现有的截止日期标签 |
| **Task: Completion Date** | 打开预填今天（YYYY-MM-DD）的日期输入。在任务文本开头插入 `#C-YYYY-MM-DD`。替换任何现有的完成日期标签 |
| **Convert to Kanban Card** *(Pro)* | 将任务标记为完成，在 **TODO** 泳道中创建看板卡片，包含任务标题（去除标签）、匹配的优先级和截止日期以及 **Waiting** 标志。仅适用于未选中的任务 |

优先级和等待标签可切换：再次使用相同的标签会将其移除。使用不同的优先级会替换现有的。截止日期和完成日期标签会替换同类型的现有标签。

#### Pro 命令

Pro 命令需要 Pro 许可证。免费用户会在菜单中看到附加 **(Pro)** 标记的命令。

| 命令 | 操作 |
|---|---|
| **Template** | 打开模板文件夹中的模板快速选择列表，在光标处插入所选模板。支持占位符（请参阅 [模板](#模板pro)） |
| **Table** | 提示输入列数和行数，然后插入格式化的 Markdown 表格 |
| **Table: Format** | 将周围表格中的所有列宽标准化为最长的单元格内容 |
| **Table: Add Column(s)** | 提示输入数量，然后在光标当前列之后添加列 |
| **Table: Add Row(s)** | 提示输入数量，然后在光标当前行之后添加行 |
| **Table: Remove Row (Current)** | 移除光标所在行（拒绝标题/分隔符） |
| **Table: Remove Column (Current)** | 移除光标所在列（拒绝单列表格） |
| **Table: Remove Row(s) Above** | 提示输入数量，然后移除光标上方的数据行（限制到可用行） |
| **Table: Remove Row(s) Below** | 提示输入数量，然后移除光标下方的行（限制到可用行） |
| **Table: Remove Column(s) Right** | 提示输入数量，然后移除光标右侧的列（限制到可用列） |
| **Table: Remove Column(s) Left** | 提示输入数量，然后移除光标左侧的列（限制到可用列，保留缩进） |

### 文件拖放 / 复制 + 粘贴

从文件管理器将文件拖放到 Markdown 编辑器上，或从剪贴板粘贴图片 - VS Code 的内置 Markdown 编辑器会自动处理复制和链接插入。

AS Notes 配置内置的 `markdown.copyFiles.destination` 工作区设置，使拖放/粘贴的文件保存到专用的资源文件夹，而不是保存在 Markdown 文件旁边。

| 设置 | 默认值 | 描述 |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | 拖放/粘贴文件保存的工作区相对文件夹 |

该设置在 AS Notes 初始化或值更改时自动应用。目标文件夹由 VS Code 在首次使用时创建。

**提示：**

- **拖放位置指示器：** 拖动文件时按住 **Shift** 可以在释放前看到光标位置指南 - 有助于精确放置链接位置。

### 图片悬停预览

将鼠标悬停在 Markdown 文件中的任何图片链接上可以内联预览图片。标准实现由 VS Code 内置的 Markdown 扩展提供，无需配置 - 支持标准 `![alt](path)` 链接和拖放/粘贴的图片。内联 Markdown 编辑器模式包含增强的图片显示。

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### 代码块自动完成

代码块自动完成在**所有** Markdown 文件中工作 - 不需要大纲模式。

当你键入 `` ``` ``（可选语言，例如 `` ```javascript ``）并按 **Enter** 时，AS Notes 会自动插入闭合的 `` ``` `` 并将光标放在代码块内。在项目符号行上，内容会缩进以匹配 Markdown 列表续行。

扩展能感知已有的围栏对：如果反引号已经平衡（即在相同缩进处有匹配的闭合围栏），Enter 只会插入换行而不是第二个框架。

在大纲模式中，在属于项目符号代码块的闭合 `` ``` `` 行上按 Enter 会在父级缩进处插入新的项目符号。

## AS Notes Pro 功能

**Pro 许可证**解锁高级功能。当有效密钥处于活动状态时，状态栏显示 **AS Notes (Pro)**。

要获取许可证密钥，请访问 [asnotes.io](https://www.asnotes.io/pricing)

**输入许可证密钥：**

- 从命令面板（`Ctrl+Shift+P`）运行 **AS Notes: Enter Licence Key** - 最快捷的方式。
- 或打开 VS Code 设置（`Ctrl+,`），搜索 `as-notes.licenceKey`，然后粘贴你的密钥。

### 内联编辑器 Markdown 样式、Mermaid 和 LaTeX 渲染（Pro）

AS Notes Pro 包含可选的内联 Markdown（类似 Typora）样式、VS Code（或兼容编辑器）编辑器标签中的 Mermaid 图表和 LaTeX 渲染。标准 Markdown 语法字符（`**`、`##`、`[]()`等）在你书写时会被替换为视觉等价物。

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

有关更多信息，请参阅 [内联编辑器 Markdown 样式、Mermaid 和 LaTeX 渲染](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html)。

AS Notes 包含内置的内联 Markdown 编辑器，可直接在文本编辑器中渲染格式，类似于 Typora。

**三态可见性：**

| 状态 | 时机 | 你看到的内容 |
|---|---|---|
| **渲染** | 光标在其他位置 | 干净的格式化文本（语法隐藏） |
| **幽灵** | 光标在该行 | 降低透明度的语法字符 |
| **原始** | 光标在构造内部 | 完整的 Markdown 源代码 |

**支持的构造：**

粗体、斜体、删除线、标题（H1-H6）、内联代码、链接、图片、引用块、水平线、无序/任务列表、代码块（带语言标签）、YAML 前置信息、GFM 表格、Emoji 短代码（`:smile:` 等）、Mermaid 图表（内联 SVG）、LaTeX/数学公式（KaTeX/MathJax）、GitHub 提及和问题引用。

**切换：** 使用 **AS Notes: Toggle Inline Editor** 命令或点击编辑器标题栏中的眼睛图标。切换状态按工作区持久化。

**大纲模式感知：** 当大纲模式活动时，项目符号标记和复选框语法会在大纲结构旁边内联样式化（项目符号渲染为样式化的项目符号，复选框渲染为项目符号和复选框图形）。

| 设置 | 默认值 | 描述 |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | 启用/禁用内联渲染 |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | 幽灵状态语法字符的透明度 |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | 单击打开链接（而非 Ctrl+Click） |

有关内联编辑器设置的完整列表，请参阅 [设置](#设置)。

### 模板（Pro）

在专用模板文件夹（默认：`templates/`）中创建可重用的笔记模板作为 Markdown 文件。通过 `/Template` 斜杠命令在任何位置插入。

**设置：** 初始化工作区时会自动创建模板。默认包含用于每日日记条目的 `Journal.md` 模板。

**创建模板：** 将任何 `.md` 文件添加到模板文件夹中。支持子目录 - 子文件夹中的模板在选择器中显示为 `folder/name`。

**插入模板：** 在任何 Markdown 文件中键入 `/`，选择 **Template**，然后从列表中选择。模板内容将在光标位置插入，所有占位符都会被替换。

**占位符：**

| 占位符        | 描述                                                    | 示例                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | 当前日期（YYYY-MM-DD）                                      | `2026-03-18`                          |
| `{{time}}`         | 当前时间（HH:mm:ss）                                        | `14:30:45`                            |
| `{{datetime}}`     | 完整日期和时间（YYYY-MM-DD HH:mm:ss）                       | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | 当前文件名（不含扩展名）                            | `My Page`                             |
| `{{title}}`        | `{{filename}}` 的别名                                       | `My Page`                             |
| `{{cursor}}`       | 插入后的光标位置                                | *（光标在此处）*                 |
| 自定义日期格式 | `YYYY`、`MM`、`DD`、`HH`、`mm`、`ss` 标记的任意组合 | `{{DD/MM/YYYY}}` 变为 `18/03/2026` |

要在模板中输出字面量 `{{date}}`，使用反斜杠转义：`\{{date}}`。

**日记模板：** 模板文件夹中的 `Journal.md` 文件用作新每日日记条目的模板。编辑它以自定义未来的日记页面。

### 表格命令

斜杠命令菜单（`/`）中的所有表格操作都是 Pro 功能。免费用户会看到附加 **(Pro)** 的列表 - 可见但在许可证激活前被阻止。

有关表格命令的完整列表，请参阅 [斜杠命令](#斜杠命令)。

### 加密笔记（Pro）

Pro 用户可以将敏感笔记存储在加密文件中。任何扩展名为 `.enc.md` 的文件都被视为加密笔记 - 它被排除在搜索索引之外，扩展程序永远不会将其作为纯文本读取。

**开始使用加密：**

1. 从命令面板运行 **AS Notes: Set Encryption Key**。你的密码短语安全存储在操作系统密钥链中（VS Code SecretStorage）- 永远不会写入磁盘或设置文件。
2. 使用 **AS Notes: Create Encrypted Note**（或 **AS Notes: Create Encrypted Journal Note** 用于日期日记条目）创建加密笔记。
3. 在编辑器中编写笔记。当你想锁定它时，运行 **AS Notes: Encrypt [All|Current] Note(s)** - 所有纯文本 `.enc.md` 文件将被就地加密。
4. 要阅读笔记，运行 **AS Notes: [All|Current] Note(s)** - 文件使用存储的密码短语就地解密。

**加密详情：**

- 算法：AES-256-GCM，每次加密随机 12 字节 nonce
- 密钥派生：PBKDF2-SHA256（100,000 次迭代），基于你的密码短语
- 文件格式：单行 `ASNOTES_ENC_V1:<base64url payload>` 标记 - 用于帮助防止通过 Git pre-commit hook 意外提交。

**命令：**

- `AS Notes: Set Encryption Key` - 将密码短语保存到操作系统密钥链
- `AS Notes: Clear Encryption Key` - 移除存储的密码短语
- `AS Notes: Create Encrypted Note` - 在笔记文件夹中创建新的命名 `.enc.md` 文件
- `AS Notes: Create Encrypted Journal Note` - 将今天的日记条目创建为 `.enc.md`
- `AS Notes: Encrypt All Notes` - 加密所有纯文本 `.enc.md` 文件
- `AS Notes: Decrypt All Notes` - 解密所有加密的 `.enc.md` 文件
- `AS Notes: Encrypt Current Note` - 加密活动的 `.enc.md` 文件（读取未保存的编辑器内容）
- `AS Notes: Decrypt Current Note` - 解密活动的 `.enc.md` 文件（从磁盘读取）

### 大纲模式

启用**大纲模式**（`as-notes.outlinerMode` 设置或 **AS Notes: Toggle Outliner Mode** 命令）将编辑器转变为项目符号优先的大纲编辑器。每行以 `-` 开头，自定义快捷键让你保持高效：

| 按键 | 操作 |
|---|---|
| **Enter** | 在相同缩进处插入新项目符号。待办行（`- [ ]`）继续为未选中的待办。 |
| **Tab** | 将项目符号缩进一级（上限为比上方项目符号深一级）。 |
| **Shift+Tab** | 将项目符号减少一级缩进。 |
| **Ctrl+Shift+Enter** | 循环：普通项目符号 → `- [ ]` → `- [x]` → 普通项目符号。 |
| **Ctrl+V / Cmd+V** | 多行粘贴：剪贴板中的每行变为单独的项目符号。 |

## 开始使用

有关示例知识库，请克隆 <https://github.com/appsoftwareltd/as-notes-demo-notes> 并按照其中的说明进行初始化。

### 初始化工作区

AS Notes 在你的工作区根目录或配置的 `rootDirectory` 子目录中找到 `.asnotes/` 目录时激活（类似于 `.git/` 或 `.obsidian/`）。没有它，扩展在**被动模式**下运行 - 命令显示友好的通知提示你初始化，状态栏邀请你进行设置。

要初始化：

1. 打开命令面板（`Ctrl+Shift+P`）
2. 运行 **AS Notes: Initialise Workspace**

这将创建 `.asnotes/` 目录，构建所有 Markdown 文件的 SQLite 索引，并激活所有功能。索引文件（`.asnotes/index.db`）通过自动生成的 `.gitignore` 排除在 Git 之外。

### 在源代码旁使用 AS Notes

AS Notes 非常适合作为软件项目中的知识库。你可以将笔记、日记和文档保存在子目录（例如 `docs/` 或 `notes/`）中，而仓库的其余部分包含源代码。当配置了根目录时，所有 AS Notes 功能（Wiki 链接高亮、补全、悬停提示、斜杠命令）都限定在该目录中。其外部的 Markdown 文件（如工作区根目录的 `README.md`）完全不受影响。

在初始化过程中，**Initialise Workspace** 命令会要求你选择位置：

- **工作区根目录** - 默认选项，使用整个工作区
- **选择子目录** - 打开限定在工作区内的文件夹选择器

所选路径保存为 `as-notes.rootDirectory` 工作区设置。设置后，所有 AS Notes 数据都存在该目录中：`.asnotes/`、`.asnotesignore`、日记、模板、笔记、看板和索引。扫描、文件监视和索引都限定在此目录中，因此外部文件不受影响。

如果在运行 **Initialise Workspace** 之前已配置 `as-notes.rootDirectory`，命令将直接使用配置的路径。

> **警告：** 如果在初始化后更改 `rootDirectory`，你必须手动将笔记目录（包括 `.asnotes/`）移动到新位置并重新加载窗口。设置更改时扩展会显示警告。

### 重建索引

如果索引变得陈旧或损坏，从命令面板运行 **AS Notes: Rebuild Index**。这将删除并重新创建整个索引，带有进度指示器。

### 清理工作区

如果扩展处于异常状态（例如崩溃后持续的 WASM 错误），从命令面板运行 **AS Notes: Clean Workspace**。这将：

- 移除 `.asnotes/` 目录（索引数据库、日志、Git hook 配置）
- 释放所有内存中的状态并切换到被动模式

AS Notes 根目录的 `.asnotesignore` 被有意保留。之后运行 **AS Notes: Initialise Workspace** 以重新开始。

### 从索引中排除文件

当 AS Notes 初始化工作区时，它会在 AS Notes 根目录创建 `.asnotesignore` 文件。该文件使用 [`.gitignore` 模式语法](https://git-scm.com/docs/gitignore)，控制哪些文件和目录被排除在 AS Notes 索引之外。

**默认内容：**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

没有前导 `/` 的模式在任何深度匹配 - `logseq/` 排除 `logseq/pages/foo.md` 和 `vaults/work/logseq/pages/foo.md`。使用 `/` 前缀将模式锚定到仅 AS Notes 根目录（例如 `/logseq/`）。

随时编辑 `.asnotesignore`。AS Notes 监视该文件，并在更改时自动重新扫描索引 - 新忽略的文件从索引中移除，取消忽略的文件被添加。

> **注意：** `.asnotesignore` 是一个用户可编辑的、受版本控制的文件。AS Notes 在初始创建后永远不会覆盖它。

---

## 故障排除

### 在文件同步工具管理下性能不佳

已观察到当目录由某些同步工具（例如 MS OneDrive、Google Drive、Dropbox 等）管理时，VS Code 编辑器可能会感觉较慢。

AS Notes 目录可以通过同步管理，但推荐使用 Git，因为它不会像同步工具那样监视文件，并且具有完整的冲突解决功能。

### "此文件尚未索引"

当当前文件不在 AS Notes 索引中时，反向链接面板会显示此消息。常见原因：

- **VS Code `files.exclude` / `search.exclude` 设置** - AS Notes 使用 `vscode.workspace.findFiles()` 来发现 Markdown 文件，这遵循这些 VS Code 设置。排除文件夹中的文件（例如 `logseq/version-files/`）会被静默地从扫描中省略，永远不会被索引。如果你期望索引的文件缺失，请检查 **Settings → Files: Exclude** 和 **Settings → Search: Exclude**。
- **`.asnotesignore` 模式** - 与 AS Notes 根目录的 `.asnotesignore` 中模式匹配的文件被排除在索引之外。请参阅上面的 [从索引中排除文件](#从索引中排除文件)。
- **文件尚未保存** - 新的未保存文件在首次保存到磁盘之前不会被索引。

要解决此问题，请检查你的工作区设置和 `.asnotesignore` 文件。如果文件应该被索引，请确保它不被任何排除模式匹配，然后从命令面板运行 **AS Notes: Rebuild Index**。

## 开发

仓库结构为包含三个包的 monorepo：

| 包 | 描述 |
|---|---|
| `common/` | 共享的 Wiki 链接解析库（`Wikilink`、`WikilinkService`、`MarkdownItWikilinkPlugin`） |
| `vs-code-extension/` | VS Code 扩展 |
| `publish/` | 将 AS Notes 笔记本（Markdown + Wiki 链接）转换为静态 HTML 的 CLI 工具 |

文档源码位于 `docs-src/`（一个 AS Notes 工作区）。`publish` 工具将其转换为 `docs/`。

### VS Code 扩展

```bash
cd vs-code-extension
npm install
npm run build    # 构建扩展
npm run watch    # 监视模式（更改时重建）
npm test         # 运行单元测试
npm run lint     # 类型检查
```

### 从 AS Notes 发布为 HTML（HTML 转换）

转换器作为 npm 包发布：

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

有关完整文档，请参阅 [发布静态网站](https://docs.asnotes.io/publishing-a-static-site.html)

### 调试

在 VS Code 中按 **F5** 启动加载了扩展的扩展开发主机。

调试版本优先于 Marketplace 安装版本，因此两者可以共存。

VS Code 会记住扩展开发主机中最后打开的文件夹。[演示知识库](https://github.com/appsoftwareltd/as-notes-demo-notes) 旨在涵盖常见的使用场景。

### 测试

单元测试使用 [vitest](https://vitest.dev/)，涵盖 Wiki 链接解析器、基于偏移的查找、段计算、索引服务 CRUD、标题提取、重命名检测数据流和嵌套链接索引。使用 `npm test` 运行。

### 发布

发布手动发送到 VS Code Marketplace，然后在推送版本标签时自动创建 GitHub Release。

**步骤 1 - 升级版本号**

更新 `package.json` 中的 `version` 并在 `CHANGELOG.md` 中添加条目。

**步骤 2 - 发布到 VS Code Marketplace**

```bash
cd .\vs-code-extension\
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # 如果认证过期则输入 PAT token
npx @vscode/vsce publish
```

**步骤 3 - 创建标签并推送**

```bash
cd ..
git add .
git commit -m "Release v2.3.2"   # 更改版本号
git tag v2.3.2                   # 更改版本号
git push origin main --tags
```

推送标签会触发 [Release 工作流](.github/workflows/release.yml)，自动创建带有自动生成发布说明和 VS Code Marketplace 安装链接的 GitHub Release。

### 发布 npm CLI（`asnotes-publish`）

**步骤 1 - 升级版本号**

更新 `publish/package.json` 中的 `version`。

**步骤 2 - 构建和发布**

```bash
cd publish
npm run build
npm login
npm publish
```

**步骤 3 - 验证**

```bash
npx asnotes-publish --help
```

## Agent Skills

AS Notes 提供 [agent skill](https://skills.sh/)。安装它可以让你的 AI 助手（GitHub Copilot、Claude 等）完全了解该扩展 - Wiki 链接语法、命令、设置、键盘快捷键等。

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

安装后，你的 AI 助手可以回答有关 AS Notes 的问题，帮助配置设置，解释功能，并协助你的笔记工作流程。

## 免责声明

本软件按"原样"提供，不提供任何形式的担保，无论是明示还是暗示的。作者和贡献者对因使用或误用本扩展而导致的任何数据、文件或系统的丢失、损坏或破坏不承担任何责任或义务，包括但不限于在工作区中创建、重命名、移动或修改文件的操作。

**你有责任维护数据的备份。** 强烈建议使用版本控制（例如 Git）或其他备份策略来管理你使用此扩展管理的任何笔记或文件。

本扩展根据 [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE) 授权。

你可以自由使用、共享和改编此扩展用于**非商业目的**，需注明出处。商业使用需要单独的商业许可证。有关完整条款，请参阅 [LICENSE](LICENSE) 或联系我们 <https://www.appsoftware.com/contact>。
