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

const { PDFDocument } = pdfLib;
const outlinePdf = outlinePdfFactory(pdfLib);

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

// 获取专栏所有文章列表（通过API）
async function getArticleList(page, columnUrl) {
    const spinner = ora('正在获取文章列表...').start();

    // 监听API响应并获取文章列表
    let articlesData = null;
    let handler = null;

    const responsePromise = new Promise((resolve, reject) => {
        handler = async (response) => {
            const url = response.url();
            if (url.includes('/serv/v1/column/articles')) {
                try {
                    const data = await response.json();
                    resolve(data);
                } catch (e) {
                    console.error('解析API响应失败:', e);
                    reject(e);
                }
            }
        };
        page.on('response', handler);
    });

    try {
        // 访问页面以触发API调用
        await page.goto(columnUrl, { waitUntil: 'networkidle' });

        // 等待API调用（最多10秒）
        articlesData = await Promise.race([
            responsePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('API调用超时')), 10000))
        ]);
    } catch (error) {
        // 如果是因为浏览器关闭导致的错误，静默处理
        if (isShuttingDown || error.message.includes('Target page, context or browser has been closed')) {
            spinner.stop();
            return { articles: [], columnTitle: 'unknown' };
        }
        spinner.fail('获取文章列表失败');
        throw error;
    } finally {
        // 确保移除监听器，防止内存泄漏
        if (handler) {
            try {
                page.off('response', handler);
            } catch (e) {
                // 忽略page已关闭的错误
            }
        }
    }

    if (!articlesData || !articlesData.data || !articlesData.data.list) {
        spinner.fail('API响应数据格式错误');
        return { articles: [], columnTitle: 'unknown' };
    }

    // 获取专栏标题 - 尝试多个可能的字段
    let columnTitle = articlesData.data.column_title
        || articlesData.data.column_subtitle
        || articlesData.data.title
        || articlesData.data.name
        || articlesData.data.columnTitle;

    // 如果还是没有，尝试从第一篇文章的信息中提取
    if (!columnTitle && articlesData.data.list && articlesData.data.list.length > 0) {
        const firstArticle = articlesData.data.list[0];
        columnTitle = firstArticle.column_title || firstArticle.product_title;
    }

    // 如果API中没有，从页面标题提取
    if (!columnTitle || columnTitle === '专栏') {
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

    // 最后的默认值
    columnTitle = columnTitle || '专栏';

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

    // 解析文章列表
    const rawArticles = articlesData.data.list;
    const articles = rawArticles.map((article) => {
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
            id: id
        };
    });

    spinner.succeed(`找到 ${chalk.green(articles.length)} 篇文章 - ${columnTitle}`);
    return { articles, columnTitle };
}

// 并发下载控制器
async function downloadWithConcurrency(context, articles, outputDir, concurrency = 5, delay = 2000) {
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
        await page.waitForSelector('.Index_articleContent_QBG5G, .content', { timeout: 10000 });

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
            printBackground: true
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
        await page.waitForSelector('.Index_articleContent_QBG5G, .content', { timeout: 10000 });

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
            printBackground: true
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

    // 创建输出目录（相对于当前工作目录）
    const outputDir = options.output || path.join(process.cwd(), 'downloads');
    await fs.mkdir(outputDir, { recursive: true });

    console.log(chalk.gray(`📁 输出目录: ${outputDir}\n`));

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
        // 获取文章列表
        const { articles, columnTitle } = await getArticleList(page, columnUrl);

        if (articles.length === 0) {
            console.log(chalk.yellow('⚠️  未找到任何文章'));
            return;
        }

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
        const concurrency = parseInt(options.concurrency) || 3;
        if (concurrency > 1) {
            console.log(chalk.gray(`📊 并发数: ${concurrency}\n`));
        }

        const results = await downloadWithConcurrency(
            context,
            articlesToDownload,
            outputDir,
            concurrency,
            parseInt(options.delay) || 2000
        );

        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(chalk.bold.cyan('\n📊 下载统计\n'));
        console.log(`  ${chalk.green('✓')} 成功: ${successCount}`);
        console.log(`  ${chalk.red('✗')} 失败: ${failCount}`);
        console.log(`  ${chalk.blue('📁')} 保存位置: ${outputDir}\n`);

        // 合并 PDF
        if (options.merge !== false && successCount > 0) {
            const mergedPath = await mergePDFs(
                outputDir,
                columnTitle,
                articlesToDownload,
                options.deleteAfterMerge
            );
            if (mergedPath) {
                console.log(chalk.green(`\n✅ 合并完成: ${mergedPath}\n`));
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
    .description('批量下载极客时间专栏文章为PDF')
    .version('1.0.1')
    .option('-u, --url <url>', '专栏文章URL（任意一篇）')
    .option('-c, --cookie <cookie>', 'Cookie字符串（用于认证）')
    .option('-o, --output <dir>', '输出目录', './downloads')
    .option('--headless <boolean>', '无头模式', true)
    .option('--delay <ms>', '每篇文章之间的延迟(ms)', '2000')
    .option('--concurrency <number>', '并发下载数量', '3')
    .option('--dry-run', '预览模式，只显示文章列表')
    .option('--limit <number>', '限制下载数量（用于测试）')
    .option('--no-merge', '禁用PDF合并（默认会合并所有文章为一个PDF）')
    .option('--delete-after-merge', '合并后删除单独的章节PDF文件')
    .addHelpText('after', `
示例:
  $ geektime-dl --url "https://time.geekbang.org/column/article/200822" --cookie "your_cookie"
  $ geektime-dl -u "https://time.geekbang.org/column/article/200822" -c "your_cookie" --dry-run
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
