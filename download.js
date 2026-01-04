#!/usr/bin/env node

import { chromium } from 'playwright';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfLib from 'pdf-lib';
import { outlinePdfFactory } from '@lillallol/outline-pdf';
import epubGenMemory from 'epub-gen-memory';

const { PDFDocument } = pdfLib;
const outlinePdf = outlinePdfFactory(pdfLib);
const epub = epubGenMemory.default || epubGenMemory;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 全局变量：跟踪当前浏览器实例和是否正在关闭
let globalBrowser = null;
let isShuttingDown = false;

// 优雅退出处理
async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        return; // 防止重复调用
    }
    isShuttingDown = true;

    console.log(chalk.yellow(`\n\n⚠️  收到 ${signal} 信号，正在优雅退出...\n`));

    if (globalBrowser) {
        try {
            console.log(chalk.gray('正在关闭浏览器...'));
            await globalBrowser.close();
            console.log(chalk.gray('浏览器已关闭'));
        } catch (error) {
            console.log(chalk.gray('浏览器关闭失败:', error.message));
        }
    }

    console.log(chalk.yellow('✓ 已清理资源，程序退出\n'));
    process.exit(0);
}

// 注册信号处理器
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 打印样式修复 CSS
const PRINT_FIX_CSS = `
@media print {
    /* 让正文容器高度自适应 */
    .simplebar-content-wrapper,
    .simplebar-content,
    .simplebar-offset,
    .simplebar-mask,
    .simplebar-wrapper,
    .Index_contentWrap_qmM23,
    .Index_contentWrapScroller_UOaGU,
    .Index_main_3MKag,
    .Index_wrap_2Piiq,
    .Index_mainAreaWrapper_Z4kqi,
    .Index_contentWidth_3_1Sf,
    #article-content-container,
    .Index_articleContent_QBG5G {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        overflow-y: visible !important;
    }

    /* 隐藏所有侧边栏、导航栏、工具栏等 */
    .simplebar-track,
    .simplebar-scrollbar,
    nav,
    header:not(.article-header),
    footer,
    aside,
    /* 左侧边栏和目录 */
    .Index_side_2umED,
    .Index_leftSideScrollArea_2llPX,
    .Index_leftSide,
    .Index_catalog,
    .Index_directory,
    .catalog,
    .directory,
    .toc,
    .table-of-contents,
    [class*="catalog"],
    [class*="directory"],
    [class*="toc"],
    [class*="sidebar"],
    [class*="Sidebar"],
    [class*="leftSide"],
    [class*="LeftSide"],
    /* 右侧边栏 */
    .Index_rightSide_3pR3c,
    .Index_rightSide,
    .Index_outline_1uoMm,
    /* 顶部导航 */
    .Index_navWrap_2P51R,
    .Index_nav,
    .navbar,
    /* 底部栏 */
    .Index_bottomBar_1-vh2,
    .Index_bottomBar,
    /* 键盘快捷键提示 */
    .keyboard-wrapper,
    /* 评论区 */
    .comment,
    .comments,
    .Index_comment,
    /* 推荐和广告 */
    .recommend,
    .advertisement,
    .ad,
    .banner,
    /* 分享按钮 */
    .share,
    .social,
    /* 返回顶部等按钮 */
    .back-to-top,
    .scroll-top,
    /* 浮动元素 */
    .float-bar,
    .fixed-bar,
    /* 订阅提示 */
    .subscribe,
    .subscription,
    /* 作者信息卡片（如果不想要的话） */
    .author-card,
    /* 相关推荐 */
    .related,
    .recommendation {
        display: none !important;
    }

    /* 确保html和body高度自适应和全宽 */
    html, body {
        height: auto !important;
        overflow: visible !important;
        width: 100% !important;
    }

    /* 破坏所有可能的布局容器约束，强制全宽 */
    body > *,
    body > * > *,
    .Index_wrap_2Piiq,
    .Index_mainAreaWrapper_Z4kqi,
    .Index_mainArea,
    .Index_contentWrap_qmM23,
    .Index_contentWrapScroller_UOaGU,
    .Index_main_3MKag,
    .Index_contentWidth_3_1Sf,
    main,
    [class*="wrap"],
    [class*="Wrap"],
    [class*="container"],
    [class*="Container"],
    [class*="mainArea"],
    [class*="MainArea"] {
        width: 100% !important;
        max-width: none !important;
        min-width: 100% !important;
        margin: 0 !important;
        padding: 20px !important;
        flex: none !important;
        grid-column: 1 / -1 !important;
        /* 破坏 flexbox 和 grid 布局 */
        display: block !important;
    }

    /* 优化正文排版 */
    .Index_articleContent_QBG5G,
    .article-content,
    article,
    [class*="articleContent"],
    [class*="ArticleContent"] {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 100% !important;
        padding: 0 !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
    }

    /* 确保所有内容元素不溢出 */
    * {
        box-sizing: border-box !important;
        max-width: 100% !important;
    }

    /* 确保代码块完整显示且不溢出 */
    pre, code {
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow: visible !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        /* 由于关闭了printBackground，用边框区分代码块 */
        border: 1px solid #ddd !important;
        padding: 10px !important;
    }

    /* 内联代码样式 */
    code {
        padding: 2px 6px !important;
        border-radius: 3px !important;
    }

    /* 代码块容器样式 */
    pre {
        border-radius: 5px !important;
        padding: 15px !important;
    }

    /* 确保图片适应页面且不溢出 */
    img {
        max-width: 100% !important;
        height: auto !important;
        page-break-inside: avoid;
        box-sizing: border-box !important;
    }

    /* 确保表格不溢出 */
    table {
        max-width: 100% !important;
        table-layout: auto !important;
        word-wrap: break-word !important;
        box-sizing: border-box !important;
    }

    /* 确保长文本自动换行 */
    p, div, span, li {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        box-sizing: border-box !important;
    }
}
`;

// 解析 cookie 字符串
function parseCookies(cookieString) {
    return cookieString.split(';').map(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        return {
            name: name.trim(),
            value: valueParts.join('=').trim(),
            domain: '.geekbang.org',
            path: '/'
        };
    });
}

// 获取专栏所有文章列表(通过API)
function getValueByPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => {
        if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
            return acc[key];
        }
        return undefined;
    }, obj);
}

function collectAuthorNamesFromData(data) {
    if (!data || typeof data !== 'object') {
        return [];
    }

    const candidates = new Set();

    const pushCandidate = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(pushCandidate);
            return;
        }
        if (typeof value === 'object') {
            const possibleKeys = ['name', 'nickname', 'author_name', 'teacher_name', 'lecturer_name'];
            possibleKeys.forEach(key => {
                if (value[key]) {
                    pushCandidate(value[key]);
                }
            });
            // 遍历其他 name 相关字段
            Object.keys(value).forEach(key => {
                if (typeof value[key] === 'string' && key.toLowerCase().includes('name')) {
                    pushCandidate(value[key]);
                }
            });
            return;
        }
        const text = String(value).trim();
        if (text) {
            candidates.add(text);
        }
    };

    const fieldPaths = [
        'author', 'author_name', 'authorName',
        'teachers', 'teacher', 'teacher_name', 'teacherName', 'teacher_info', 'teacherInfo',
        'lecturer', 'lecturer_name', 'lecturerName', 'lecturers',
        'authors', 'column_author', 'columnAuthor', 'column_author_name',
        'column_teacher', 'columnTeacher', 'product_author', 'productAuthor',
        'product_teacher', 'productTeacher',
        'owner', 'owner_name', 'speaker', 'speaker_name',
        'contributors', 'writer', 'writers', 'author_list', 'authorList'
    ];

    fieldPaths.forEach(path => {
        const value = getValueByPath(data, path);
        pushCandidate(value);
    });

    return Array.from(candidates);
}

function extractColumnAuthor(columnInfoData, articlesData) {
    const sources = [];
    if (columnInfoData && columnInfoData.data) {
        sources.push(columnInfoData.data);
    }
    if (articlesData && articlesData.data) {
        sources.push(articlesData.data);
    }
    if (articlesData && articlesData.data && Array.isArray(articlesData.data.list) && articlesData.data.list.length > 0) {
        sources.push(articlesData.data.list[0]);
    }

    for (const data of sources) {
        const names = collectAuthorNamesFromData(data);
        if (names.length > 0) {
            return names.join(', ');
        }
    }
    return '';
}

async function getArticleList(page, columnUrl, timeout = 60000) {
    const spinner = ora('正在获取专栏信息...').start();

    // 从 URL 提取专栏 ID
    let columnId = null;
    const urlMatch = columnUrl.match(/\/column\/intro\/(\d+)|\/column\/article\/(\d+)/);
    if (urlMatch) {
        columnId = urlMatch[1] || urlMatch[2];
    }

    // 监听多个API响应
    let articlesData = null;
    let columnInfoData = null;
    let articlesHandler = null;
    let columnInfoHandler = null;

    // 用于同步的 Promise
    const articlesPromise = new Promise((resolve, reject) => {
        articlesHandler = async (response) => {
            const url = response.url();
            // 监听文章列表 API
            if (url.includes('/serv/v1/column/articles')) {
                try {
                    const data = await response.json();
                    if (process.env.DEBUG) {
                        console.log(chalk.gray('\n收到文章列表API响应'));
                    }
                    resolve(data);
                } catch (e) {
                    console.error('解析文章列表API失败:', e);
                }
            }
        };
        page.on('response', articlesHandler);
    });

    const columnInfoPromise = new Promise((resolve) => {
        columnInfoHandler = async (response) => {
            const url = response.url();
            // 监听专栏详情相关的 API
            if (url.includes('/serv/v1/column/intro') ||
                url.includes('/serv/v3/column/info') ||
                url.includes('/serv/v1/column/detail')) {
                try {
                    const data = await response.json();
                    if (process.env.DEBUG) {
                        console.log(chalk.gray(`收到专栏信息API响应: ${url}`));
                    }
                    resolve(data);
                } catch (e) {
                    console.error('解析专栏信息API失败:', e);
                }
            }
        };
        page.on('response', columnInfoHandler);
    });

    try {
        // 先设置监听器，再访问页面
        spinner.text = '正在加载页面...';
        await page.goto(columnUrl, { waitUntil: 'networkidle', timeout });

        spinner.text = '正在获取文章列表...';

        // 等待文章列表 API（必须的）
        articlesData = await Promise.race([
            articlesPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('文章列表API调用超时')), 30000))
        ]);

        // 尝试等待专栏信息 API（可选的，5秒超时）
        try {
            columnInfoData = await Promise.race([
                columnInfoPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
        } catch (e) {
            // 获取专栏信息失败不是致命错误
            if (process.env.DEBUG) {
                console.log(chalk.gray('未获取到专栏信息API响应（将使用其他方法）'));
            }
        }

    } catch (error) {
        // 如果是因为浏览器关闭导致的错误，静默处理
        if (isShuttingDown || error.message.includes('Target page, context or browser has been closed')) {
            spinner.stop();
            return { articles: [], columnTitle: 'unknown' };
        }
        spinner.fail('获取文章列表失败');
        throw error;
    } finally {
        // 确保移除所有监听器，防止内存泄漏
        if (articlesHandler) {
            try {
                page.off('response', articlesHandler);
            } catch (e) {
                // 忽略page已关闭的错误
            }
        }
        if (columnInfoHandler) {
            try {
                page.off('response', columnInfoHandler);
            } catch (e) {
                // 忽略page已关闭的错误
            }
        }
    }

    if (!articlesData || !articlesData.data || !articlesData.data.list) {
        spinner.fail('API响应数据格式错误');

        // 智能判断可能的原因
        if (!articlesData) {
            console.log(chalk.yellow('\n⚠️  未能获取到文章列表数据\n'));
            console.log(chalk.cyan('可能的原因：'));
            console.log(chalk.gray('  1. Cookie 已过期或无效 - 请重新获取 Cookie'));
            console.log(chalk.gray('  2. 网络连接问题 - 请检查网络'));
            console.log(chalk.gray('  3. 专栏 ID 不正确 - 请检查 URL\n'));
        } else if (articlesData.code === -3000 || articlesData.code === -3001) {
            console.log(chalk.red('\n❌ Cookie 已失效\n'));
            console.log(chalk.cyan('📖 请重新获取 Cookie：'));
            console.log(chalk.gray('  1. 浏览器登录极客时间'));
            console.log(chalk.gray('  2. 按 F12 打开开发者工具'));
            console.log(chalk.gray('  3. Network 标签 → 刷新页面'));
            console.log(chalk.gray('  4. 点击任意请求 → 复制 Cookie\n'));
        } else if (articlesData.error) {
            console.log(chalk.yellow(`\n⚠️  API 返回错误: ${articlesData.error.msg || articlesData.error}\n`));
        }

        return { articles: [], columnTitle: 'unknown' };
    }

    // 调试信息：记录完整的API响应结构（仅在环境变量DEBUG存在时）
    if (process.env.DEBUG) {
        console.log(chalk.gray('\n========== 文章列表 API 响应数据 =========='));
        console.log(chalk.gray(JSON.stringify(articlesData.data, null, 2)));
        if (columnInfoData) {
            console.log(chalk.gray('\n========== 专栏信息 API 响应数据 =========='));
            console.log(chalk.gray(JSON.stringify(columnInfoData.data, null, 2)));
        }
        console.log(chalk.gray('=========================================\n'));
    }

    // 获取专栏标题 - 优先从专栏信息API获取
    let columnTitle = '';

    // 方法1（最优先）: 从专栏信息 API 数据中获取
    if (columnInfoData && columnInfoData.data) {
        columnTitle = columnInfoData.data.title
            || columnInfoData.data.column_title
            || columnInfoData.data.name
            || columnInfoData.data.product_title
            || columnInfoData.data.subtitle;
    }

    // 方法2: 从文章列表 API 数据中获取
    if (!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') {
        columnTitle = articlesData.data.column_title
            || articlesData.data.column_subtitle
            || articlesData.data.title
            || articlesData.data.name
            || articlesData.data.columnTitle
            || articlesData.data.product_title;

        // 如果还是没有，尝试从第一篇文章的信息中提取
        if (!columnTitle && articlesData.data.list && articlesData.data.list.length > 0) {
            const firstArticle = articlesData.data.list[0];
            columnTitle = firstArticle.column_title || firstArticle.product_title;
        }
    }

    // 方法3: 从页面标题提取
    if (!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') {
        try {
            const pageTitle = await page.title();
            // 页面标题格式通常是："文章标题 - 专栏名称 - 极客时间"
            const parts = pageTitle.split('-').map(p => p.trim());
            if (parts.length >= 2) {
                columnTitle = parts[1]; // 取第二部分作为专栏名称
            }
        } catch (e) {
            console.error('从页面标题提取失败:', e);
        }
    }

    // 方法4: 从页面DOM中提取
    if (!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') {
        try {
            columnTitle = await page.evaluate(() => {
                // 尝试多个可能的选择器
                const selectors = [
                    '.column-title',
                    '.product-title',
                    '[class*="columnTitle"]',
                    '[class*="productTitle"]',
                    'h1.title',
                    '.bread-crumb a:last-child'
                ];

                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return null;
            });
        } catch (e) {
            console.error('从页面DOM提取失败:', e);
        }
    }

    // 方法5: 使用专栏ID（如果提取到了）
    if (!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') {
        if (columnId) {
            columnTitle = `专栏_${columnId}`;
        }
    }

    // 最后的默认值（添加时间戳避免冲突）
    if (!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        columnTitle = `专栏_${timestamp}`;
    }

    // 清理标题
    columnTitle = columnTitle
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);

    // 调试信息：记录API响应的结构（仅在环境变量DEBUG存在时）
    if (process.env.DEBUG) {
        console.log(chalk.gray('\nAPI响应数据字段:'));
        console.log(chalk.gray(`  column_title: ${articlesData.data.column_title}`));
        console.log(chalk.gray(`  column_subtitle: ${articlesData.data.column_subtitle}`));
        console.log(chalk.gray(`  title: ${articlesData.data.title}`));
        console.log(chalk.gray(`  提取的专栏名: ${columnTitle}\n`));
    }

    const columnAuthor = extractColumnAuthor(columnInfoData, articlesData) || '极客时间';

    // 解析文章列表
    const rawArticles = articlesData.data.list;

    const articles = rawArticles.map((article, index) => {
        const title = article.article_title || article.article_sharetitle || 'Untitled';
        const id = article.id;

        // 清理标题中的非法字符
        const cleanTitle = title
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/\|/g, '-')
            .substring(0, 100);

        return {
            title: cleanTitle,
            url: `https://time.geekbang.org/column/article/${id}`,
            originalTitle: title,
            id: id,
            sectionName: article.section_name || '',
            chapterIndex: article.chapter_index || 0,
            originalIndex: index
        };
    });

    spinner.succeed(`找到 ${chalk.green(articles.length)} 篇文章 - ${columnTitle}`);
    return { articles, columnTitle, columnAuthor };
}

// 并发下载控制器
async function downloadWithConcurrency(context, articles, outputDir, concurrency = 5, delay = 2000, timeout = 60000) {
    const results = [];
    const total = articles.length;
    let completed = 0;

    // 使用一个全局进度条
    const progressSpinner = ora(`下载进度: 0/${total}`).start();

    // 创建并发池
    const pool = [];
    for (let i = 0; i < Math.min(concurrency, articles.length); i++) {
        pool.push(context.newPage());
    }
    const pages = await Promise.all(pool);

    // 为每个页面设置默认超时
    pages.forEach(page => {
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
    });

    // 处理队列
    let currentIndex = 0;

    const processNext = async (page, pageIndex) => {
        while (currentIndex < articles.length) {
            const index = currentIndex++;
            const article = articles[index];

            try {
                const result = await downloadArticleSilent(page, article, outputDir, index + 1, total);
                results[index] = result;
                completed++;

                // 更新进度条
                progressSpinner.text = `下载进度: ${completed}/${total}`;

                // 立即打印完成的文章（在进度条下方）
                if (result.success) {
                    progressSpinner.stopAndPersist({
                        symbol: chalk.green('✓'),
                        text: `[${index + 1}/${total}] ${article.originalTitle || article.title}`
                    });
                } else {
                    progressSpinner.stopAndPersist({
                        symbol: chalk.red('✗'),
                        text: `[${index + 1}/${total}] ${article.originalTitle || article.title} - ${result.error}`
                    });
                }

                // 重新启动进度条
                progressSpinner.start();
                progressSpinner.text = `下载进度: ${completed}/${total}`;

                // 添加延迟，避免请求过快
                if (currentIndex < articles.length) {
                    await page.waitForTimeout(delay);
                }
            } catch (error) {
                results[index] = { success: false, title: article.title, error: error.message };
                completed++;

                progressSpinner.stopAndPersist({
                    symbol: chalk.red('✗'),
                    text: `[${index + 1}/${total}] ${article.title} - ${error.message}`
                });

                progressSpinner.start();
                progressSpinner.text = `下载进度: ${completed}/${total}`;
            }
        }
    };

    // 启动所有worker
    await Promise.all(pages.map((page, idx) => processNext(page, idx)));

    progressSpinner.succeed(`下载完成: ${completed}/${total}`);

    // 关闭所有page
    await Promise.all(pages.map(page => page.close()));

    return results;
}

// 下载单篇文章为 PDF（静默模式，不显示单独的spinner）
async function downloadArticleSilent(page, article, outputDir, index, total) {
    try {
        // 访问文章页面
        await page.goto(article.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 注入打印修复样式
        await page.addStyleTag({ content: PRINT_FIX_CSS });

        // 激进的布局重构：提取正文并重建页面结构
        await page.evaluate((titleText) => {
            // 1. 找到文章正文内容
            const articleContent = document.querySelector('.Index_articleContent_QBG5G, .article-content, article, [class*="articleContent"]');

            if (articleContent) {
                // 2. 克隆正文内容
                const contentClone = articleContent.cloneNode(true);

                // 3. 清空body的所有内容
                document.body.innerHTML = '';

                // 4. 重置body样式为全宽
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                document.body.style.width = '100%';
                document.body.style.maxWidth = 'none';
                document.body.style.boxSizing = 'border-box';

                // 5. 创建一个简单的容器
                const wrapper = document.createElement('div');
                wrapper.style.width = '100%';
                wrapper.style.maxWidth = '100%';
                wrapper.style.margin = '0';
                wrapper.style.padding = '0';
                wrapper.style.boxSizing = 'border-box';

                // 6. 创建标题元素（使用传入的标题文本）
                if (titleText) {
                    const titleElement = document.createElement('h1');
                    titleElement.textContent = titleText;
                    // 设置标题样式
                    titleElement.style.fontSize = '32px';
                    titleElement.style.fontWeight = 'bold';
                    titleElement.style.marginBottom = '30px';
                    titleElement.style.marginTop = '0';
                    titleElement.style.lineHeight = '1.4';
                    titleElement.style.color = '#000';
                    wrapper.appendChild(titleElement);
                }

                // 7. 将正文插入容器
                wrapper.appendChild(contentClone);

                // 8. 将容器插入body
                document.body.appendChild(wrapper);

                // 9. 确保正文内容使用全宽且不溢出
                contentClone.style.width = '100%';
                contentClone.style.maxWidth = '100%';
                contentClone.style.margin = '0';
                contentClone.style.padding = '0';
                contentClone.style.boxSizing = 'border-box';
                contentClone.style.overflowWrap = 'break-word';
                contentClone.style.wordBreak = 'break-word';
            } else {
                // 如果找不到正文，使用原有的删除方法
                const selectors = [
                    'aside',
                    '[class*="leftSide"]',
                    '[class*="LeftSide"]',
                    '[class*="sidebar"]',
                    '[class*="Sidebar"]',
                    '[class*="side_"]',
                    '[class*="catalog"]',
                    '[class*="directory"]',
                    '[class*="toc"]',
                    '[class*="outline"]',
                    '[class*="Outline"]',
                    'nav',
                    '[class*="nav"]',
                    '[class*="Nav"]',
                    '[class*="rightSide"]',
                    '[class*="RightSide"]',
                    '[class*="comment"]',
                    '[class*="recommend"]',
                    '[class*="footer"]',
                    '[class*="bottom"]'
                ];

                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => el.remove());
                    } catch (e) {
                        // 忽略无效选择器
                    }
                });
            }

            // 额外：删除所有包含"大纲"的元素
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const text = el.textContent || el.innerText || '';
                if (text.trim() === '大纲' ||
                    (text.length < 200 && text.includes('大纲') && el.children.length <= 10)) {
                    el.remove();
                }
            });
        }, article.originalTitle || article.title);

        // 等待文章内容加载
        await page.waitForSelector('.Index_articleContent_QBG5G, .content');

        // 优化图片大小：将大图片转换为合适的尺寸，减小PDF体积
        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const promises = Array.from(images).map(img => {
                return new Promise((resolve) => {
                    // 如果图片还未加载完成，等待加载
                    if (!img.complete) {
                        img.onload = () => processImage(img, resolve);
                        img.onerror = () => resolve(); // 图片加载失败，跳过
                    } else {
                        processImage(img, resolve);
                    }
                });
            });

            function processImage(img, resolve) {
                try {
                    const maxWidth = 800; // 最大宽度
                    const quality = 0.7; // JPEG质量（0-1）

                    // 只处理较大的图片
                    if (img.naturalWidth <= maxWidth) {
                        resolve();
                        return;
                    }

                    // 创建canvas压缩图片
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const ratio = maxWidth / img.naturalWidth;
                    canvas.width = maxWidth;
                    canvas.height = img.naturalHeight * ratio;

                    // 绘制图片
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // 转换为压缩后的data URL
                    canvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        img.src = url;
                        img.style.width = maxWidth + 'px';
                        img.style.height = 'auto';
                        resolve();
                    }, 'image/jpeg', quality);
                } catch (e) {
                    // 如果压缩失败，至少限制大小
                    img.style.maxWidth = '800px';
                    img.style.height = 'auto';
                    resolve();
                }
            }

            return Promise.all(promises);
        });

        // 等待图片处理完成
        await page.waitForTimeout(1000);

        // 生成 PDF
        const filename = `${String(index).padStart(3, '0')}_${article.title}.pdf`;
        const filepath = path.join(outputDir, filename);

        await page.pdf({
            path: filepath,
            format: 'A4',
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
            printBackground: false,  // 关闭背景打印，显著减小文件大小
            preferCSSPageSize: false
        });

        return { success: true, title: article.title };

    } catch (error) {
        return { success: false, title: article.title, error: error.message };
    }
}

// 下载单篇文章为 PDF
async function downloadArticle(page, article, outputDir, index, total) {
    const spinner = ora(`[${index}/${total}] 正在下载: ${article.title}`).start();

    try {
        // 访问文章页面
        await page.goto(article.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 注入打印修复样式
        await page.addStyleTag({ content: PRINT_FIX_CSS });

        // 激进的布局重构：提取正文并重建页面结构
        await page.evaluate((titleText) => {
            // 1. 找到文章正文内容
            const articleContent = document.querySelector('.Index_articleContent_QBG5G, .article-content, article, [class*="articleContent"]');

            if (articleContent) {
                // 2. 克隆正文内容
                const contentClone = articleContent.cloneNode(true);

                // 3. 清空body的所有内容
                document.body.innerHTML = '';

                // 4. 重置body样式为全宽
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                document.body.style.width = '100%';
                document.body.style.maxWidth = 'none';
                document.body.style.boxSizing = 'border-box';

                // 5. 创建一个简单的容器
                const wrapper = document.createElement('div');
                wrapper.style.width = '100%';
                wrapper.style.maxWidth = '100%';
                wrapper.style.margin = '0';
                wrapper.style.padding = '0';
                wrapper.style.boxSizing = 'border-box';

                // 6. 创建标题元素（使用传入的标题文本）
                if (titleText) {
                    const titleElement = document.createElement('h1');
                    titleElement.textContent = titleText;
                    // 设置标题样式
                    titleElement.style.fontSize = '32px';
                    titleElement.style.fontWeight = 'bold';
                    titleElement.style.marginBottom = '30px';
                    titleElement.style.marginTop = '0';
                    titleElement.style.lineHeight = '1.4';
                    titleElement.style.color = '#000';
                    wrapper.appendChild(titleElement);
                }

                // 7. 将正文插入容器
                wrapper.appendChild(contentClone);

                // 8. 将容器插入body
                document.body.appendChild(wrapper);

                // 9. 确保正文内容使用全宽且不溢出
                contentClone.style.width = '100%';
                contentClone.style.maxWidth = '100%';
                contentClone.style.margin = '0';
                contentClone.style.padding = '0';
                contentClone.style.boxSizing = 'border-box';
                contentClone.style.overflowWrap = 'break-word';
                contentClone.style.wordBreak = 'break-word';
            } else {
                // 如果找不到正文，使用原有的删除方法
                const selectors = [
                    'aside',
                    '[class*="leftSide"]',
                    '[class*="LeftSide"]',
                    '[class*="sidebar"]',
                    '[class*="Sidebar"]',
                    '[class*="side_"]',
                    '[class*="catalog"]',
                    '[class*="directory"]',
                    '[class*="toc"]',
                    '[class*="outline"]',
                    '[class*="Outline"]',
                    'nav',
                    '[class*="nav"]',
                    '[class*="Nav"]',
                    '[class*="rightSide"]',
                    '[class*="RightSide"]',
                    '[class*="comment"]',
                    '[class*="recommend"]',
                    '[class*="footer"]',
                    '[class*="bottom"]'
                ];

                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => el.remove());
                    } catch (e) {
                        // 忽略无效选择器
                    }
                });
            }

            // 额外：删除所有包含"大纲"的元素
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const text = el.textContent || el.innerText || '';
                if (text.trim() === '大纲' ||
                    (text.length < 200 && text.includes('大纲') && el.children.length <= 10)) {
                    el.remove();
                }
            });
        }, article.originalTitle || article.title);

        // 等待文章内容加载
        await page.waitForSelector('.Index_articleContent_QBG5G, .content');

        // 优化图片大小：将大图片转换为合适的尺寸，减小PDF体积
        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const promises = Array.from(images).map(img => {
                return new Promise((resolve) => {
                    // 如果图片还未加载完成，等待加载
                    if (!img.complete) {
                        img.onload = () => processImage(img, resolve);
                        img.onerror = () => resolve(); // 图片加载失败，跳过
                    } else {
                        processImage(img, resolve);
                    }
                });
            });

            function processImage(img, resolve) {
                try {
                    const maxWidth = 800; // 最大宽度
                    const quality = 0.7; // JPEG质量（0-1）

                    // 只处理较大的图片
                    if (img.naturalWidth <= maxWidth) {
                        resolve();
                        return;
                    }

                    // 创建canvas压缩图片
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const ratio = maxWidth / img.naturalWidth;
                    canvas.width = maxWidth;
                    canvas.height = img.naturalHeight * ratio;

                    // 绘制图片
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // 转换为压缩后的data URL
                    canvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        img.src = url;
                        img.style.width = maxWidth + 'px';
                        img.style.height = 'auto';
                        resolve();
                    }, 'image/jpeg', quality);
                } catch (e) {
                    // 如果压缩失败，至少限制大小
                    img.style.maxWidth = '800px';
                    img.style.height = 'auto';
                    resolve();
                }
            }

            return Promise.all(promises);
        });

        // 等待图片处理完成
        await page.waitForTimeout(1000);

        // 生成 PDF
        const filename = `${String(index).padStart(3, '0')}_${article.title}.pdf`;
        const filepath = path.join(outputDir, filename);

        await page.pdf({
            path: filepath,
            format: 'A4',
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
            printBackground: false,  // 关闭背景打印，显著减小文件大小
            preferCSSPageSize: false
        });

        spinner.succeed(`[${index}/${total}] ${chalk.green('✓')} ${article.title}`);
        return { success: true, title: article.title };

    } catch (error) {
        spinner.fail(`[${index}/${total}] ${chalk.red('✗')} ${article.title}: ${error.message}`);
        return { success: false, title: article.title, error: error.message };
    }
}

// 合并所有 PDF 文件
async function mergePDFs(outputDir, columnTitle, articles, deleteAfterMerge = false) {
    const spinner = ora('正在合并所有 PDF 文件...').start();

    try {
        // 读取目录中的所有 PDF 文件
        const files = await fs.readdir(outputDir);
        const pdfFiles = files
            .filter(file => file.endsWith('.pdf') && file.match(/^\d{3}_/))
            .sort();

        if (pdfFiles.length === 0) {
            spinner.warn('没有找到可以合并的 PDF 文件');
            return null;
        }

        // 创建新的 PDF 文档
        const mergedPdf = await PDFDocument.create();

        // 用于存储书签信息
        const bookmarks = [];
        let currentPage = 0;

        // 逐个读取并合并 PDF
        for (let i = 0; i < pdfFiles.length; i++) {
            const file = pdfFiles[i];
            const filePath = path.join(outputDir, file);
            const pdfBytes = await fs.readFile(filePath);
            const pdf = await PDFDocument.load(pdfBytes);
            const pageCount = pdf.getPageCount();

            // 记录书签信息（章节标题和页码）
            if (articles && articles[i]) {
                bookmarks.push({
                    title: articles[i].originalTitle || articles[i].title,
                    pageIndex: currentPage
                });
            }

            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));

            currentPage += pageCount;
        }

        // 设置PDF元数据
        mergedPdf.setTitle(columnTitle);
        mergedPdf.setSubject(`包含 ${pdfFiles.length} 个章节`);

        spinner.text = '正在添加PDF书签...';

        // 添加PDF书签/大纲
        let finalPdf = mergedPdf;
        if (bookmarks.length > 0) {
            try {
                // 构建outline文本结构
                // 格式：页码(从1开始)||标题
                const outlineText = bookmarks
                    .map(b => `${b.pageIndex + 1}||${b.title}`)
                    .join('\n');

                // 调试信息
                if (process.env.DEBUG) {
                    console.log(chalk.gray('\n生成的书签格式:'));
                    console.log(chalk.gray(outlineText.split('\n').slice(0, 5).join('\n')));
                    console.log(chalk.gray(`...(共${bookmarks.length}个书签)\n`));
                }

                // 使用 outline-pdf 库添加书签
                finalPdf = await outlinePdf({
                    outline: outlineText,
                    pdf: mergedPdf
                });

                spinner.text = `已添加 ${bookmarks.length} 个书签`;
            } catch (outlineError) {
                console.log(chalk.yellow(`\n  ⚠️  书签添加失败: ${outlineError.message}`));
                console.log(chalk.gray(`  错误详情: ${outlineError.stack}`));
                console.log(chalk.gray('  将继续保存不带书签的PDF\n'));
            }
        }

        // 保存最终的PDF
        const mergedFileName = `${columnTitle}.pdf`;
        const mergedFilePath = path.join(outputDir, mergedFileName);
        const mergedPdfBytes = await finalPdf.save();
        await fs.writeFile(mergedFilePath, mergedPdfBytes);

        spinner.succeed(`已合并 ${pdfFiles.length} 个 PDF 文件 → ${chalk.green(mergedFileName)}${bookmarks.length > 0 ? chalk.gray(` (${bookmarks.length}个书签)`) : ''}`);

        // 如果需要删除单独的章节文件
        if (deleteAfterMerge) {
            spinner.text = '正在删除单独的章节PDF...';
            spinner.start();
            for (const file of pdfFiles) {
                await fs.unlink(path.join(outputDir, file));
            }
            spinner.succeed(`已删除 ${pdfFiles.length} 个单独的章节PDF文件`);
        }

        return mergedFilePath;

    } catch (error) {
        spinner.fail(`合并 PDF 失败: ${error.message}`);
        console.error(chalk.gray(error.stack));
        return null;
    }
}

// 提取单篇文章的 HTML 内容（用于 EPUB 生成）
async function extractArticleContent(page, article, index, total) {
    try {
        // 访问文章页面
        await page.goto(article.url, { waitUntil: 'networkidle' });

        // 等待文章内容加载
        await page.waitForSelector('.Index_articleContent_QBG5G, .content', { timeout: 60000 });

        // 关键：等待文章完整内容加载，而不是试看内容
        // 滚动页面以触发懒加载内容
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // 再等待一段时间，确保内容完全加载
        await page.waitForTimeout(3000);

        // 提取文章 HTML 内容
        const content = await page.evaluate(() => {
            // 找到文章正文内容
            const articleContent = document.querySelector('.Index_articleContent_QBG5G, .article-content, article, [class*="articleContent"]');

            if (!articleContent) {
                return null;
            }

            // 克隆正文以避免修改原始DOM
            const contentClone = articleContent.cloneNode(true);

            // 白名单策略：只保留正文核心元素
            // 允许的元素标签
            const allowedTags = new Set([
                'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',           // 段落和标题
                'UL', 'OL', 'LI',                                   // 列表
                'BLOCKQUOTE',                                       // 引用
                'PRE', 'CODE',                                      // 代码
                'IMG',                                              // 图片
                'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',       // 表格
                'A',                                                // 链接
                'STRONG', 'B', 'EM', 'I', 'U',                     // 强调和样式
                'BR', 'HR',                                         // 换行和分隔线
                'FIGURE', 'FIGCAPTION', 'DETAILS', 'SUMMARY',
                'SPAN', 'DIV', 'SECTION', 'ARTICLE'                 // 容器（可能包含文本）
            ]);

            // 在清理前，移除常见的非正文区域
            const removalSelectors = [
                'nav', 'header', 'footer', 'aside',
                '.comment', '.comments', '.Index_comment',
                '.recommend', '.recommendation', '.related', '.advertisement', '.ad', '.banner',
                '.subscribe', '.subscription', '.toolbar', '.Index_shareIcons_1vtJa',
                '.keyboard-wrapper', '.app-download', '.article-actions', '.article-bottom',
                '.note', '.notes', '.annotation', '.translation', '.trans', '.translator',
                '.audio', '.audio-player', '.voice', '.player', '.geek-player', '.podcast', '.radio',
                '.reward', '.appreciate', '.appreciation', '.donate', '.sponsor', '.thanks', '.support',
                '.qrcode', '.qr-code', '.qr', '.promotion', '.promo', '.ad-banner',
                '.copyright', '.statement', '.disclaimer',
                '.app-download-banner', '.article-plugin', '.article-notification', '.float-bar',
                'audio', 'video',
                '[class*="Note"]', '[class*="note"]', '[class*="Translation"]', '[class*="translation"]',
                '[class*="Audio"]', '[class*="audio"]', '[class*="Reward"]', '[class*="reward"]',
                '[data-plugin]', '[data-track]', '[data-track-section]', '[data-translation]', '[data-audio]',
                '[data-role="toolbar"]',
                'button', 'iframe', 'script', 'style'
            ];
            removalSelectors.forEach(selector => {
                contentClone.querySelectorAll(selector).forEach(el => el.remove());
            });

            // 根据关键词进一步移除插件类元素
            const pluginKeywords = [
                'note', 'translation', 'audio', 'player', 'reward', 'donate',
                'appreciation', 'sponsor', 'qrcode', 'toolbar', 'plugin',
                'copyright', 'geeknote', 'bilingual'
            ];
            const pluginElements = Array.from(contentClone.querySelectorAll('*')).filter(el => {
                const className = (el.className || '').toString().toLowerCase();
                const idValue = (el.id || '').toString().toLowerCase();
                const roleValue = (el.getAttribute && el.getAttribute('role')) ? el.getAttribute('role').toLowerCase() : '';
                const datasetValues = el.dataset ? Object.values(el.dataset).join(' ').toLowerCase() : '';
                const combined = `${className} ${idValue} ${roleValue} ${datasetValues}`;
                return pluginKeywords.some(keyword => combined.includes(keyword));
            });
            pluginElements.forEach(el => el.remove());

            // 移除 MindMap 等 SVG/Canvas 思维导图内容（阅读器无法正确渲染）
            const mindmapSelectors = [
                '.mindmap', '.mind-map', '.MindMap', '.Mind-map',
                '[data-type="mindmap"]', '[data-role="mindmap"]', '[data-widget="mindmap"]',
                '[class*="MindMap"]', '[class*="mindMap"]'
            ];
            mindmapSelectors.forEach(selector => {
                contentClone.querySelectorAll(selector).forEach(el => el.remove());
            });
            const vectorCandidates = Array.from(contentClone.querySelectorAll('svg, canvas, object, embed'));
            vectorCandidates.forEach(el => {
                const className = typeof el.className === 'object' ? el.className.baseVal : (el.className || '');
                const meta = `${className} ${el.id || ''} ${el.getAttribute('data-type') || ''}`.toLowerCase();
                if (meta.includes('mind') || meta.includes('mindmap') || meta.includes('mind-map')) {
                    el.remove();
                }
            });

            // 将富文本中的代码块结构转换为标准 <pre><code>
            const blockSeparatorTags = new Set([
                'P','DIV','SECTION','ARTICLE','UL','OL','LI','FIGURE','FIGCAPTION',
                'TABLE','THEAD','TBODY','TR','TD'
            ]);

            function collectCodeText(node) {
                const parts = [];

                const ensureNewline = () => {
                    if (!parts.length) {
                        parts.push('\n');
                        return;
                    }
                    if (!parts[parts.length - 1].endsWith('\n')) {
                        parts.push('\n');
                    }
                };

                const traverse = (current) => {
                    if (!current) {
                        return;
                    }
                    if (current.nodeType === Node.TEXT_NODE) {
                        const textValue = current.textContent.replace(/\u00A0/g, ' ');
                        if (textValue) {
                            parts.push(textValue);
                        }
                        return;
                    }
                    if (current.nodeType !== Node.ELEMENT_NODE) {
                        return;
                    }
                    const tag = current.tagName.toUpperCase();
                    if (tag === 'BR') {
                        ensureNewline();
                        return;
                    }
                    Array.from(current.childNodes).forEach(traverse);
                    if (blockSeparatorTags.has(tag)) {
                        ensureNewline();
                    }
                };

                traverse(node);
                let text = parts.join('');
                text = text
                    .replace(/\r\n/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/[ \t]+\n/g, '\n')
                    .replace(/\n+$/g, '\n');
                return text.trim() ? text : '';
            }

            const codeLikeSelectors = [
                '[data-slate-type="code"]',
                '[data-slate-node="code"]',
                '[data-code-block]',
                '[data-code]',
                '[data-code-language]',
                '[class*="code-block"]',
                '[class*="CodeBlock"]'
            ];
            const codeCandidates = new Set();
            codeLikeSelectors.forEach(selector => {
                contentClone.querySelectorAll(selector).forEach(el => codeCandidates.add(el));
            });
            const replaceWithPre = (element) => {
                if (!element || !element.parentNode) {
                    return;
                }
                const codeText = collectCodeText(element);
                if (!codeText) {
                    element.remove();
                    return;
                }
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = codeText;
                pre.appendChild(code);
                element.parentNode.replaceChild(pre, element);
            };
            codeCandidates.forEach(el => {
                if (el.tagName && el.tagName.toUpperCase() === 'PRE') {
                    return;
                }
                replaceWithPre(el);
            });

            const multilineInlineCodes = Array.from(contentClone.querySelectorAll('code')).filter(codeEl => {
                const parent = codeEl.parentElement;
                return parent && parent.tagName.toUpperCase() !== 'PRE' && codeEl.textContent.includes('\n');
            });
            multilineInlineCodes.forEach(codeEl => {
                const codeText = collectCodeText(codeEl);
                if (!codeText) {
                    codeEl.remove();
                    return;
                }
                const pre = document.createElement('pre');
                const innerCode = document.createElement('code');
                innerCode.textContent = codeText;
                pre.appendChild(innerCode);
                codeEl.parentNode.replaceChild(pre, codeEl);
            });

            // 递归清理函数：移除不在白名单中的元素
            function cleanElement(element) {
                const children = Array.from(element.childNodes);

                for (const child of children) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const tagName = child.tagName.toUpperCase();

                        if (!allowedTags.has(tagName)) {
                            // 先递归处理子节点
                            cleanElement(child);

                            if (child.childNodes.length > 0) {
                                while (child.firstChild) {
                                    element.insertBefore(child.firstChild, child);
                                }
                                child.remove();
                            } else {
                                const textContent = (child.textContent || '').trim();
                                if (textContent) {
                                    const textNode = document.createTextNode(textContent + ' ');
                                    element.insertBefore(textNode, child);
                                }
                                child.remove();
                            }
                        } else {
                            cleanElement(child);
                        }
                    }
                }
            }

            cleanElement(contentClone);

            // 移除所有style属性，避免样式冲突
            const allElements = contentClone.querySelectorAll('*');
            allElements.forEach(el => {
                el.removeAttribute('style');
                el.removeAttribute('class');
                el.removeAttribute('id');
                el.removeAttribute('onclick');
                el.removeAttribute('onload');
            });

            // 处理图片URL
            const images = contentClone.querySelectorAll('img');
            const adKeywordLower = ['ad', 'advert', 'banner', 'qrcode', 'qr-code', 'reward', 'donate', 'appdownload', 'app-download', 'sponsor', 'thanks'];
            const adKeywordCn = ['广告', '二维码', '赞赏', '打赏', '版权', '推广'];
            images.forEach(img => {
                let src = img.getAttribute('src');
                const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');

                if (dataSrc && (dataSrc.startsWith('http://') || dataSrc.startsWith('https://'))) {
                    src = dataSrc;
                    img.setAttribute('src', src);
                }

                if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
                    img.remove();
                    return;
                }

                if (!src.startsWith('http://') && !src.startsWith('https://')) {
                    try {
                        const absoluteUrl = new URL(src, window.location.href).href;
                        img.setAttribute('src', absoluteUrl);
                        src = absoluteUrl;
                    } catch (e) {
                        img.remove();
                    }
                }

                const altText = img.getAttribute('alt') || '';
                const altLower = altText.toLowerCase();
                const srcLower = (src || '').toLowerCase();
                if (
                    adKeywordLower.some(keyword => srcLower.includes(keyword)) ||
                    adKeywordLower.some(keyword => altLower.includes(keyword)) ||
                    adKeywordCn.some(keyword => altText.includes(keyword))
                ) {
                    img.remove();
                    return;
                }

                // 清理图片属性
                const imgAttrs = img.attributes;
                for (let i = imgAttrs.length - 1; i >= 0; i--) {
                    const attrName = imgAttrs[i].name;
                    if (attrName !== 'src' && attrName !== 'alt') {
                        img.removeAttribute(attrName);
                    }
                }
            });

            // 清理空的div和span
            const containers = contentClone.querySelectorAll('div, span');
            containers.forEach(container => {
                if (!container.textContent.trim() && !container.querySelector('img, pre, code, table')) {
                    container.remove();
                }
            });

            // 将只包含纯文本的 div 转换为段落，避免没有段间距
            const blockLikeTags = new Set(['P','UL','OL','LI','TABLE','PRE','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','IMG','SECTION','ARTICLE','FIGURE','FIGCAPTION','DETAILS','SUMMARY']);
            const textContainers = Array.from(contentClone.querySelectorAll('div, section, article')).reverse();
            textContainers.forEach(container => {
                if (container === contentClone) {
                    return;
                }

                if (!container.textContent.trim()) {
                    return;
                }

                if (container.querySelector('img, pre, table, ul, ol, blockquote, h1, h2, h3, h4, h5, h6, figure')) {
                    return;
                }

                const hasBlockChildren = Array.from(container.children).some(child => blockLikeTags.has(child.tagName?.toUpperCase()));
                if (hasBlockChildren) {
                    return;
                }

                const paragraph = document.createElement('p');
                paragraph.innerHTML = container.innerHTML;
                container.parentNode.replaceChild(paragraph, container);
            });

            // 包装直接挂在容器下的文本或行内节点，避免散乱文本没有段落间距
            const inlineTags = new Set(['A','SPAN','STRONG','B','EM','I','U','CODE','SMALL','SUB','SUP','MARK']);

            function wrapInlineChildren(element) {
                const tagName = element.tagName ? element.tagName.toUpperCase() : '';
                if (['P','LI','PRE','CODE','TABLE','THEAD','TBODY','TR'].includes(tagName)) {
                    return;
                }

                const childNodes = Array.from(element.childNodes);
                let buffer = [];

                const flushBuffer = (referenceNode) => {
                    if (!buffer.length) {
                        return;
                    }
                    const paragraph = document.createElement('p');
                    buffer.forEach(node => paragraph.appendChild(node));
                    element.insertBefore(paragraph, referenceNode);
                    buffer = [];
                };

                for (const node of childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (node.textContent.trim()) {
                            buffer.push(node);
                        } else {
                            element.removeChild(node);
                        }
                        continue;
                    }

                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const childTag = node.tagName.toUpperCase();
                        if (inlineTags.has(childTag) || childTag === 'BR') {
                            buffer.push(node);
                            continue;
                        }

                        flushBuffer(node);
                        wrapInlineChildren(node);
                        continue;
                    }

                    flushBuffer(node);
                }

                flushBuffer(null);
            }

            wrapInlineChildren(contentClone);

            // 移除尾部的版权/广告声明
            const footerKeywords = ['版权', '未经许可', '未经授权', '不得转载', '未经允许', 'All Rights Reserved', '最终解释权', '转载'];
            const trailingElements = Array.from(contentClone.querySelectorAll('p, div, section')).slice(-6);
            trailingElements.forEach(el => {
                const text = (el.textContent || '').trim();
                if (!text) {
                    return;
                }
                if (text.length <= 200 && footerKeywords.some(keyword => text.includes(keyword))) {
                    el.remove();
                }
            });

            // 处理代码块
            const codeBlocks = contentClone.querySelectorAll('pre');
            codeBlocks.forEach(block => {
                const codeText = collectCodeText(block);
                if (!codeText) {
                    block.remove();
                    return;
                }
                let codeInside = block.querySelector('code');
                if (!codeInside) {
                    codeInside = document.createElement('code');
                    block.appendChild(codeInside);
                }
                codeInside.textContent = codeText;
            });

            return contentClone.innerHTML;
        });

        return {
            success: true,
            title: article.originalTitle || article.title,
            content: content || `<p>内容提取失败</p>`
        };

    } catch (error) {
        // 判断是否可能是 Cookie 失效
        let errorMessage = error.message;
        if (error.message.includes('Timeout') || error.message.includes('timeout')) {
            errorMessage = 'Cookie 可能已失效或页面加载超时';
        }

        return {
            success: false,
            title: article.originalTitle || article.title,
            content: `<p>下载失败: ${errorMessage}</p>`,
            error: errorMessage
        };
    }
}

// 并发提取文章内容（用于 EPUB）
async function extractWithConcurrency(context, articles, concurrency = 5, delay = 2000, timeout = 60000) {
    const results = [];
    const total = articles.length;
    let completed = 0;

    const progressSpinner = ora(`提取进度: 0/${total}`).start();

    // 创建并发池
    const pool = [];
    for (let i = 0; i < Math.min(concurrency, articles.length); i++) {
        pool.push(context.newPage());
    }
    const pages = await Promise.all(pool);

    // 为每个页面设置默认超时
    pages.forEach(page => {
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
    });

    // 处理队列
    let currentIndex = 0;

    const processNext = async (page, pageIndex) => {
        while (currentIndex < articles.length) {
            const index = currentIndex++;
            const article = articles[index];

            try {
                const result = await extractArticleContent(page, article, index + 1, total);
                results[index] = result;
                completed++;

                // 更新进度条
                progressSpinner.text = `提取进度: ${completed}/${total}`;

                if (result.success) {
                    progressSpinner.stopAndPersist({
                        symbol: chalk.green('✓'),
                        text: `[${index + 1}/${total}] ${article.originalTitle || article.title}`
                    });
                } else {
                    progressSpinner.stopAndPersist({
                        symbol: chalk.red('✗'),
                        text: `[${index + 1}/${total}] ${article.originalTitle || article.title} - ${result.error}`
                    });
                }

                progressSpinner.start();
                progressSpinner.text = `提取进度: ${completed}/${total}`;

                // 添加延迟
                if (currentIndex < articles.length) {
                    await page.waitForTimeout(delay);
                }
            } catch (error) {
                results[index] = {
                    success: false,
                    title: article.originalTitle || article.title,
                    content: `<p>提取失败</p>`,
                    error: error.message
                };
                completed++;

                progressSpinner.stopAndPersist({
                    symbol: chalk.red('✗'),
                    text: `[${index + 1}/${total}] ${article.title} - ${error.message}`
                });

                progressSpinner.start();
                progressSpinner.text = `提取进度: ${completed}/${total}`;
            }
        }
    };

    // 启动所有worker
    await Promise.all(pages.map((page, idx) => processNext(page, idx)));

    progressSpinner.succeed(`提取完成: ${completed}/${total}`);

    // 关闭所有page
    await Promise.all(pages.map(page => page.close()));

    return results;
}

// 生成 EPUB 文件
async function generateEPUB(outputDir, columnTitle, columnAuthor, articles, contentResults) {
    const spinner = ora('正在生成 EPUB 文件...').start();

    try {
        // 构建章节数据
        const chapters = contentResults
            .filter(result => result.success)
            .map((result, index) => ({
                title: result.title,
                content: result.content,
                excludeFromToc: false
            }));

        if (chapters.length === 0) {
            spinner.warn('没有可用的章节内容，无法生成 EPUB');
            return null;
        }

                const options = {
            title: columnTitle,
            author: columnAuthor || '极客时间',
            publisher: '极客时间',
            version: 3,
            css: `
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                    line-height: 1.8;
                    color: #333;
                    padding: 1.5em;
                    font-size: 16px;
                    text-align: justify;
                    max-width: 48em;
                    margin: 0 auto;
                }
                h1, h2, h3, h4, h5, h6 {
                    font-weight: bold;
                    margin-top: 1.5em;
                    margin-bottom: 0.8em;
                    line-height: 1.4;
                    color: #000;
                    page-break-after: avoid;
                }
                h1 {
                    font-size: 2em;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 0.3em;
                }
                h2 {
                    font-size: 1.6em;
                }
                h3 {
                    font-size: 1.3em;
                }
                section, article {
                    margin: 1.5em 0;
                    padding: 0;
                }
                p {
                    margin: 1.2em 0;
                    text-indent: 0;
                    line-height: 1.8;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    display: block;
                    page-break-inside: avoid;
                }
                /* 确保段落之间有明显间隔 */
                p + p {
                    margin-top: 1.5em;
                }
                /* 代码块样式 */
                pre {
                    background-color: #f6f8fa;
                    border: 1px solid #e1e4e8;
                    border-radius: 6px;
                    padding: 16px;
                    overflow-x: auto;
                    margin: 1em 0;
                    line-height: 1.5;
                    font-size: 14px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
                    page-break-inside: avoid;
                }
                code {
                    font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
                    font-size: 0.9em;
                    background-color: #f6f8fa;
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                    border: 1px solid #e1e4e8;
                }
                pre code {
                    background-color: transparent;
                    border: none;
                    padding: 0;
                }
                /* 列表样式 */
                ul, ol {
                    margin: 1em 0;
                    padding-left: 2em;
                    line-height: 1.8;
                }
                li {
                    margin: 0.5em 0;
                }
                /* 引用样式 */
                blockquote {
                    margin: 1em 0;
                    padding: 0.5em 1em;
                    border-left: 4px solid #ddd;
                    background-color: #f9f9f9;
                    color: #666;
                    font-style: italic;
                }
                /* 图片样式 */
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 1em auto;
                    page-break-inside: avoid;
                }
                /* 表格样式 */
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                    font-size: 0.9em;
                    page-break-inside: avoid;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: left;
                    line-height: 1.6;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                /* 链接样式 */
                a {
                    color: #0366d6;
                    text-decoration: none;
                }
                /* 强调和加粗 */
                strong, b {
                    font-weight: bold;
                    color: #000;
                }
                em, i {
                    font-style: italic;
                }
                /* 分隔线 */
                hr {
                    border: none;
                    border-top: 1px solid #e1e4e8;
                    margin: 2em 0;
                }
            `,
            verbose: process.env.DEBUG ? true : false
        };

        // 生成 EPUB（注意：content 参数是第二个参数，不在 options 里）
        spinner.text = '正在生成 EPUB...';
        const epubBuffer = await epub(options, chapters);

        // 保存 EPUB 文件
        const epubFileName = `${columnTitle}.epub`;
        const epubFilePath = path.join(outputDir, epubFileName);
        await fs.writeFile(epubFilePath, epubBuffer);

        spinner.succeed(`已生成 EPUB 文件: ${chalk.green(epubFileName)} (${chapters.length} 章)`);
        return epubFilePath;

    } catch (error) {
        spinner.fail(`生成 EPUB 失败: ${error.message}`);

        // 提供更详细的错误信息
        if (error.message.includes('Only HTTP(S) protocols are supported')) {
            console.log(chalk.yellow('\n⚠️  图片URL格式问题：'));
            console.log(chalk.gray('  某些图片使用了非HTTP(S)协议（如本地路径、blob URL等）'));
            console.log(chalk.gray('  这是一个已知问题，正在修复中\n'));
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
            console.log(chalk.yellow('\n⚠️  网络问题：'));
            console.log(chalk.gray('  部分图片下载失败，可能是网络连接问题'));
            console.log(chalk.gray('  建议：检查网络连接或稍后重试\n'));
        }

        if (process.env.DEBUG) {
            console.error(chalk.gray(error.stack));
        }
        return null;
    }
}

// 主函数
async function main(options) {
    console.log(chalk.bold.cyan('\n🚀 极客时间专栏下载器\n'));

    // 获取配置：优先级 命令行 > 配置文件
    let cookie = options.cookie;
    let columnUrl = options.url;

    // 如果命令行没有提供，尝试从配置文件读取
    if (!cookie || !columnUrl) {
        // 使用当前工作目录的config.json，而不是脚本所在目录
        const configPath = path.join(process.cwd(), 'config.json');
        try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);

            // 使用配置文件中的值作为默认值
            if (!cookie) cookie = config.cookie;
            if (!columnUrl) columnUrl = config.columnUrl;
        } catch (error) {
            // 配置文件不存在或读取失败，不是致命错误
            // 只有在命令行也没提供时才报错
        }
    }

    // 验证必要参数
    if (!cookie) {
        console.error(chalk.red('❌ 缺少 Cookie！'));
        console.log(chalk.yellow('\n请通过以下方式之一提供 Cookie：'));
        console.log(chalk.gray('1. 命令行参数：--cookie "你的cookie字符串"'));
        console.log(chalk.gray('2. 配置文件 config.json：'));
        console.log(chalk.gray('   {'));
        console.log(chalk.gray('     "cookie": "你的cookie字符串",'));
        console.log(chalk.gray('     "columnUrl": "https://time.geekbang.org/column/article/xxxxx"'));
        console.log(chalk.gray('   }\n'));
        process.exit(1);
    }

    if (!columnUrl) {
        console.error(chalk.red('❌ 缺少专栏 URL！'));
        console.log(chalk.yellow('\n请通过以下方式之一提供专栏 URL：'));
        console.log(chalk.gray('1. 命令行参数：--url "https://time.geekbang.org/column/article/xxxxx"'));
        console.log(chalk.gray('2. 配置文件 config.json\n'));
        process.exit(1);
    }

    console.log(chalk.gray(`📄 专栏地址: ${columnUrl}`));

    // 创建基础输出目录（相对于当前工作目录）
    const baseOutputDir = options.output || path.join(process.cwd(), 'downloads');
    await fs.mkdir(baseOutputDir, { recursive: true });

    console.log(chalk.gray(`📁 基础输出目录: ${baseOutputDir}\n`));

    // 启动浏览器
    let browser;
    try {
        browser = await chromium.launch({
            headless: options.headless !== false
        });
    } catch (error) {
        // 检查是否是浏览器未安装的错误
        if (error.message.includes("Executable doesn't exist") || error.message.includes('browsers')) {
            console.error(chalk.red('\n❌ Playwright 浏览器未安装！\n'));
            console.log(chalk.yellow('请运行以下命令安装浏览器：'));
            console.log(chalk.cyan('  npx playwright install chromium\n'));
            console.log(chalk.gray('或者使用 --with-deps 参数安装系统依赖：'));
            console.log(chalk.gray('  npx playwright install chromium --with-deps\n'));
            console.log(chalk.gray('提示：如果你是通过 npx 运行的，建议先全局安装：'));
            console.log(chalk.gray('  npm install -g @kadaliao/geektime-downloader\n'));
            process.exit(1);
        }
        // 其他错误直接抛出
        throw error;
    }

    // 保存到全局变量，用于信号处理
    globalBrowser = browser;

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    // 设置 cookies
    const cookies = parseCookies(cookie);
    await context.addCookies(cookies);

    const page = await context.newPage();

    try {
        // 获取配置的超时时间
        const timeout = parseInt(options.timeout) || 60000;

        // 为页面设置默认超时
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);

        // 获取文章列表
        const { articles, columnTitle, columnAuthor } = await getArticleList(page, columnUrl, timeout);

        if (articles.length === 0) {
            console.log(chalk.yellow('⚠️  未找到任何文章'));
            return;
        }

        // 为该专栏创建专用文件夹
        const outputDir = path.join(baseOutputDir, columnTitle);
        await fs.mkdir(outputDir, { recursive: true });
        console.log(chalk.gray(`📁 专栏输出目录: ${outputDir}`));
        console.log(chalk.gray(`✍️  作者: ${columnAuthor}\n`));

        // 如果是 dry-run 模式，只显示列表
        if (options.dryRun) {
            console.log(chalk.cyan('\n📋 文章列表（预览模式）:\n'));
            articles.forEach((article, index) => {
                console.log(`  ${index + 1}. ${article.originalTitle || article.title}`);
            });
            console.log(chalk.gray(`\n总共 ${articles.length} 篇文章`));
            console.log(chalk.gray(`\n提示：运行 'npm start' 开始下载`));
            return;
        }

        console.log(chalk.cyan('\n开始下载...\n'));

        // 下载所有文章（或限制数量）
        const limit = options.limit ? Math.min(parseInt(options.limit), articles.length) : articles.length;
        const articlesToDownload = articles.slice(0, limit);

        if (limit < articles.length) {
            console.log(chalk.yellow(`⚠️  限制模式：只下载前 ${limit} 篇文章\n`));
        }

        // 并发下载
        const concurrency = parseInt(options.concurrency) || 5;
        if (concurrency > 1) {
            console.log(chalk.gray(`📊 并发数: ${concurrency}\n`));
        }

        // 验证并规范化格式参数
        const format = (options.format || 'pdf').toLowerCase();
        if (!['pdf', 'epub', 'both'].includes(format)) {
            console.error(chalk.red(`\n❌ 无效的格式: ${options.format}`));
            console.log(chalk.yellow('支持的格式: pdf, epub, both\n'));
            return;
        }

        // 根据格式选择处理方式
        const needPdf = format === 'pdf' || format === 'both';
        const needEpub = format === 'epub' || format === 'both';

        let results, contentResults;

        // 生成 PDF
        if (needPdf) {
            console.log(chalk.cyan(`📄 格式: PDF${needEpub ? ' + EPUB' : ''}\n`));

            results = await downloadWithConcurrency(
                context,
                articlesToDownload,
                outputDir,
                concurrency,
                parseInt(options.delay) || 2000,
                timeout
            );

            // 统计结果
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            const timeoutCount = results.filter(r =>
                !r.success && r.error && (r.error.includes('timeout') || r.error.includes('Timeout'))
            ).length;

            console.log(chalk.bold.cyan('\n📊 PDF 下载统计\n'));
            console.log(`  ${chalk.green('✓')} 成功: ${successCount}`);
            console.log(`  ${chalk.red('✗')} 失败: ${failCount}`);
            console.log(`  ${chalk.blue('📁')} 保存位置: ${outputDir}\n`);

            // 如果大部分失败都是超时，提示 Cookie 可能失效
            if (timeoutCount > 0 && timeoutCount >= failCount * 0.8) {
                console.log(chalk.yellow('⚠️  检测到大量超时错误，可能的原因：\n'));
                console.log(chalk.gray('  1. Cookie 已失效 - 请重新获取 Cookie'));
                console.log(chalk.gray('  2. 网络连接慢 - 尝试使用 --timeout 120000 增加超时时间'));
                console.log(chalk.gray('  3. 需要登录或权限不足 - 确认已购买该专栏\n'));
            }

            // 合并 PDF
            if (options.merge !== false && successCount > 0) {
                const mergedPath = await mergePDFs(
                    outputDir,
                    columnTitle,
                    articlesToDownload,
                    options.deleteAfterMerge
                );
                if (mergedPath) {
                    console.log(chalk.green(`\n✅ PDF 合并完成: ${mergedPath}\n`));
                }
            }
        }

        // 生成 EPUB
        if (needEpub) {
            if (needPdf) {
                console.log(chalk.cyan('\n开始生成 EPUB...\n'));
            } else {
                console.log(chalk.cyan('📚 格式: EPUB\n'));
            }

            // 重要提醒：关于内容完整性
            console.log(chalk.yellow('⚠️  重要提醒：'));
            console.log(chalk.gray('  1. 确保 Cookie 有效且未过期'));
            console.log(chalk.gray('  2. 确认已购买该专栏（避免只获取试看内容）'));
            console.log(chalk.gray('  3. EPUB 生成需要下载文章完整内容，耗时较长'));
            console.log(chalk.gray('  4. 如果只获取到试看内容，说明 Cookie 失效或无权限\n'));

            contentResults = await extractWithConcurrency(
                context,
                articlesToDownload,
                concurrency,
                parseInt(options.delay) || 2000,
                timeout
            );

            // 统计结果
            const successCount = contentResults.filter(r => r.success).length;
            const failCount = contentResults.filter(r => !r.success).length;
            const timeoutCount = contentResults.filter(r =>
                !r.success && r.error && (r.error.includes('Cookie') || r.error.includes('timeout') || r.error.includes('Timeout'))
            ).length;

            console.log(chalk.bold.cyan('\n📊 EPUB 提取统计\n'));
            console.log(`  ${chalk.green('✓')} 成功: ${successCount}`);
            console.log(`  ${chalk.red('✗')} 失败: ${failCount}\n`);

            // 如果大部分失败都是超时，提示 Cookie 可能失效
            if (timeoutCount > 0 && timeoutCount >= failCount * 0.8) {
                console.log(chalk.yellow('⚠️  检测到大量超时错误，可能的原因：\n'));
                console.log(chalk.gray('  1. Cookie 已失效 - 请重新获取 Cookie'));
                console.log(chalk.gray('  2. 网络连接慢 - 尝试使用 --timeout 120000 增加超时时间'));
                console.log(chalk.gray('  3. 需要登录或权限不足 - 确认已购买该专栏\n'));
            }

            // 生成 EPUB
            if (successCount > 0) {
                const epubPath = await generateEPUB(
                    outputDir,
                    columnTitle,
                    columnAuthor,
                    articlesToDownload,
                    contentResults
                );
                if (epubPath) {
                    console.log(chalk.green(`\n✅ EPUB 生成完成: ${epubPath}\n`));
                }
            }
        }

    } catch (error) {
        // 如果是因为用户中断或浏览器关闭，不显示错误
        if (isShuttingDown || error.message.includes('Target page, context or browser has been closed')) {
            // 静默退出
            return;
        }
        console.error(chalk.red(`\n❌ 错误: ${error.message}`));
        if (process.env.DEBUG) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    } finally {
        // 确保浏览器完全关闭
        try {
            if (browser && !isShuttingDown) {
                await browser.close();
                globalBrowser = null;
            }
        } catch (closeError) {
            console.error(chalk.yellow('浏览器关闭时出现警告:', closeError.message));
        }
    }
}

// 命令行参数
program
    .name('geektime-dl')
    .description('批量下载极客时间专栏文章为PDF或EPUB')
    .version('1.1.1')
    .option('-u, --url <url>', '专栏文章URL（任意一篇）')
    .option('-c, --cookie <cookie>', 'Cookie字符串（用于认证）')
    .option('-o, --output <dir>', '输出目录', './downloads')
    .option('-f, --format <format>', '输出格式: pdf, epub, both', 'pdf')
    .option('--headless <boolean>', '无头模式', true)
    .option('--delay <ms>', '每篇文章之间的延迟(ms)', '2000')
    .option('--timeout <ms>', '页面加载超时时间(ms)', '60000')
    .option('--concurrency <number>', '并发下载数量', '5')
    .option('--dry-run', '预览模式，只显示文章列表')
    .option('--limit <number>', '限制下载数量（用于测试）')
    .option('--no-merge', '禁用PDF合并（默认会合并所有文章为一个PDF）')
    .option('--delete-after-merge', '合并后删除单独的章节PDF文件')
    .addHelpText('after', `
示例:
  $ geektime-dl --url "https://time.geekbang.org/column/article/200822" --cookie "your_cookie"
  $ geektime-dl -u "https://time.geekbang.org/column/article/200822" -c "your_cookie" --dry-run
  $ geektime-dl --url "..." --cookie "..." --format epub  # 生成EPUB格式
  $ geektime-dl --url "..." --cookie "..." --format both  # 同时生成PDF和EPUB
  $ npx @kadaliao/geektime-downloader --url "https://..." --cookie "..." --limit 5
  $ geektime-dl --url "..." --cookie "..." --no-merge  # 不合并PDF
    `)
    .parse();

const options = program.opts();

// 运行
main(options)
    .then(() => {
        // 显式退出进程，确保所有资源都已清理
        if (!isShuttingDown) {
            process.exit(0);
        }
    })
    .catch(error => {
        // 如果是优雅退出过程中的错误，不显示
        if (isShuttingDown || (error && error.message && error.message.includes('Target page, context or browser has been closed'))) {
            process.exit(0);
        } else {
            console.error(chalk.red('\n程序异常退出:'), error.message);
            if (process.env.DEBUG) {
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
