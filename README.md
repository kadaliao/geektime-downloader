# 极客时间专栏下载器

一键批量下载极客时间专栏文章为 PDF 格式。支持通过 `npx` 直接运行，无需安装。

## ✨ 特性

- 🚀 **零安装**：支持 `npx` 直接使用
- 📦 **批量下载**：自动获取整个专栏的所有文章
- 📄 **完整内容**：自动处理滚动容器，确保 PDF 包含完整内容
- 🔗 **智能合并**：自动将所有章节合并为一个 PDF，以专栏名称命名（可选）
- ⚙️ **灵活配置**：命令行参数或配置文件，任选其一
- 🎨 **友好界面**：彩色进度提示，实时显示下载状态

## 🚀 快速开始

## 🚀 使用方式

### 方式一：命令行参数方式（推荐）

直接通过命令行参数指定配置，适合一次性使用：

```bash
npx @kadaliao/geektime-downloader \
  --url "https://time.geekbang.org/column/article/200822" \
  --cookie "你的cookie字符串"
```

### 方式二：配置文件方式

创建配置文件后，直接运行命令即可，适合需要多次使用的情况：

1. 在项目目录创建 `config.json`：

```json
{
  "cookie": "你的完整 cookie 字符串",
  "columnUrl": "https://time.geekbang.org/column/article/200822"
}
```

2. 运行命令：

```bash
npx @kadaliao/geektime-downloader
```

## 📖 使用说明

### 获取 Cookie

1. 浏览器登录极客时间
2. 打开任意专栏文章
3. 按 **F12** 打开开发者工具
4. 切换到 **Network（网络）** 标签
5. 刷新页面，找到任意请求
6. 在 **Request Headers** 中复制完整 `Cookie` 值

### 命令行选项

你可以通过以下两种方式运行本工具：

1. 使用 `npx`（推荐，无需安装）：
```bash
npx @kadaliao/geektime-downloader [选项]
```

2. 或者全局安装后使用：
```bash
# 安装
npm install -g @kadaliao/geektime-downloader

# 使用
geektime-dl [选项]
```

可用选项：
```
  -V, --version          显示版本号
  -u, --url <url>        专栏文章URL（任意一篇）
  -c, --cookie <cookie>  Cookie字符串（用于认证）
  -o, --output <dir>     输出目录 (默认: "./downloads")
  --headless <boolean>   无头模式 (默认: true)
  --concurrency <number> 并发下载数量 (默认: 5)
  --delay <ms>           每篇文章间延迟(ms) (默认: 2000)
  --dry-run              预览模式，只显示文章列表
  --limit <number>       限制下载数量（测试用）
  --no-merge             禁用PDF合并（默认会合并所有文章为一个PDF）
  -h, --help             显示帮助
```

### 使用示例

**预览文章列表**

```bash
npx @kadaliao/geektime-downloader \
  -u "https://time.geekbang.org/column/article/200822" \
  -c "your_cookie" \
  --dry-run
```

**测试下载**

```bash
npx @kadaliao/geektime-downloader \
  -u "https://time.geekbang.org/column/article/200822" \
  -c "your_cookie" \
  --limit 2
```

**下载整个专栏**

```bash
npx @kadaliao/geektime-downloader \
  -u "https://time.geekbang.org/column/article/200822" \
  -c "your_cookie"
```

**自定义输出目录**

```bash
npx @kadaliao/geektime-downloader \
  -u "https://..." \
  -c "..." \
  --output ~/Documents/极客时间
```

**禁用 PDF 合并（仅保留单独章节）**

```bash
npx @kadaliao/geektime-downloader \
  -u "https://..." \
  -c "..." \
  --no-merge
```

## 📁 输出文件

下载完成后，会在输出目录生成以下文件：

### 单独章节 PDF（始终生成）

```
001_开篇词___想吃透架构？你得看看真实、接地气的架构案例.pdf
002_01___架构的本质：如何打造一个有序的系统？.pdf
003_02___业务架构：作为开发，你真的了解业务吗？.pdf
```

- 三位数字编号保持文章顺序
- 自动清理非法字符
- 限制文件名长度

### 合并后的 PDF（默认生成）

```
专栏名称.pdf
```

- 默认会将所有章节合并为一个完整的 PDF 文件
- 文件名为专栏的标题（自动从 API 获取）
- 包含所有成功下载的章节，按顺序排列
- 如不需要合并版本，使用 `--no-merge` 选项

## ⚙️ 配置方式

### 优先级

命令行参数 > 配置文件

### 配置文件示例

创建 `config.json`（可选）：

```json
{
  "cookie": "你的完整 cookie 字符串",
  "columnUrl": "https://time.geekbang.org/column/article/xxxxx"
}
```

**注意**：
- Cookie 必须完整，包含所有认证信息
- columnUrl 可以是专栏任意一篇文章的 URL
- Cookie 有过期时间，失败时请重新获取
- 配置文件完全可选，也可纯命令行使用

## 🐛 常见问题

### Cookie 和 URL 必须通过命令行传吗？

不是。三种方式任选：
1. **纯命令行**：`npx @kadaliao/geektime-downloader -u "..." -c "..."`
2. **配置文件**：创建 `config.json` 后直接运行
3. **混合使用**：命令行参数会覆盖配置文件

### Cookie 过期了怎么办？

重新获取 Cookie 并更新：
- 命令行方式：`-c "新cookie"`
- 配置文件方式：更新 `config.json`

### PDF 内容不完整？

增加页面加载延迟：

```bash
npx @kadaliao/geektime-downloader -u "..." -c "..." --delay 5000
```

### 如何下载多个专栏？

每次运行下载一个，只需更改 URL：

```bash
npx @kadaliao/geektime-downloader -u "专栏A的URL" -c "..."
npx @kadaliao/geektime-downloader -u "专栏B的URL" -c "..."
```

## 🛠 本地开发

```bash
# 克隆项目
git clone https://github.com/yourusername/geektime-downloader.git
cd geektime-downloader

# 安装依赖
npm install

# 安装浏览器
npx playwright install chromium

# 本地测试
npm link
geektime-dl --help
```

## 📝 项目结构

```
geektime-downloader/
├── download.js           # 主程序
├── package.json          # npm 配置
├── config.example.json   # 配置模板
├── README.md             # 使用文档
├── PUBLISH.md            # 发布指南（维护者）
└── .gitignore            # Git 忽略规则
```

## 🎯 技术栈

- **Playwright**: 浏览器自动化
- **Commander**: 命令行解析
- **Chalk**: 彩色输出
- **Ora**: 进度提示
- **pdf-lib**: PDF 文档操作和合并

## 📄 License

MIT

## ⚠️ 免责声明

本工具仅供个人学习使用，请勿用于商业用途。下载内容版权归极客时间所有，请遵守相关法律法规。
