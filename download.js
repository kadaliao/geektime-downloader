#!/usr/bin/env node

import { chromium } from 'playwright';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { load as loadHtml } from 'cheerio';
import crypto from 'crypto';
import mime from 'mime-types';
import { createRequire } from 'module';
import * as pdfLib from 'pdf-lib';
import { outlinePdfFactory } from '@lillallol/outline-pdf';
import epubGenMemory from 'epub-gen-memory';
import sharp from 'sharp';

const { PDFDocument } = pdfLib;
const outlinePdf = outlinePdfFactory(pdfLib);
const epub = epubGenMemory.default || epubGenMemory;
const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let globalCookieHeader = '';

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

// 代码高亮彩色语法（覆盖Prism/Highlight.js常见class）
const CODE_HIGHLIGHT_CSS = `
pre[class*="language-"],
code[class*="language-"],
pre code,
code.hljs,
pre.hljs {
    color: #2d2d2d;
    background: #f7f7f7;
}
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata,
.hljs-comment,
.hljs-quote {
    color: #6a737d;
    font-style: italic;
}
.token.punctuation,
.hljs-punctuation {
    color: #5e6687;
}
.token.property,
.token.tag,
.token.constant,
.token.symbol,
.token.deleted,
.hljs-keyword,
.hljs-selector-tag,
.hljs-subst,
.hljs-attribute {
    color: #d73a49;
}
.token.boolean,
.token.number,
.token.selector,
.token.attr-name,
.token.char,
.token.builtin,
.token.inserted,
.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable {
    color: #b76bff;
}
.token.string,
.token.attr-value,
.token.operator,
.token.entity,
.token.url,
.token.statement,
.token.regex,
.token.important,
.token.variable,
.token.bold,
.hljs-string,
.hljs-doctag,
.hljs-addition {
    color: #22863a;
}
.token.function,
.token.class-name,
.token.keyword,
.hljs-title,
.hljs-section,
.hljs-type,
.hljs-selector-id,
.hljs-selector-class {
    color: #005cc5;
}
.token.operator,
.token.entity,
.token.url,
.hljs-bullet,
.hljs-built_in,
.hljs-builtin-name,
.hljs-link {
    color: #e36209;
}
.token.italic {
    font-style: italic;
}
.token.bold {
    font-weight: 600;
}
.token.deleted,
.hljs-deletion {
    color: #b31d28;
}
`;

const GEEKTIME_BASE_URL = 'https://time.geekbang.org';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EPUB_IMAGE_BATCH_SIZE = 5;
const TEMP_ASSET_PREFIX = '__epub_assets__';
const KINDLE_SAFE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/bmp']);
const KINDLE_SAFE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp']);
const KINDLE_CONVERT_TARGET = { ext: 'png', mime: 'image/png' };
const ARTICLE_CONTENT_SELECTORS = [
    '#article-content',
    '#article-content-container',
    '.article-content',
    '.article-detail',
    '.article-detail-content',
    '.article-content__body',
    '.Index_articleContent_QBG5G',
    '.ArticleContent_articleContent',
    'article .content',
    'main article',
    '.content-container article'
];
const ARTICLE_REMOVAL_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    '.comment', '.comments', '.Index_comment', '.CommentArea', '.comment-area', '.CommentWrapper', '.Comment-module', '.CommentList',
    '#comments', '#comment', '[data-section="comment"]',
    '.recommend', '.recommendation', '.related', '.advertisement', '.ad', '.banner',
    '.subscribe', '.subscription', '.toolbar', '.Index_shareIcons_1vtJa',
    '.keyboard-wrapper', '.app-download', '.article-actions', '.article-bottom',
    '.note', '.notes', '.annotation', '.translation', '.trans', '.translator',
    '.audio', '.audio-player', '.voice', '.player', '.geek-player', '.podcast', '.radio',
    '.AudioPlayer', '.VoicePlayer', '.AudioWrapper', '.voice-player',
    '.reward', '.appreciate', '.appreciation', '.donate', '.sponsor', '.thanks', '.support',
    '.qrcode', '.qr-code', '.qr', '.promotion', '.promo', '.ad-banner',
    '.copyright', '.statement', '.disclaimer',
    '.app-download-banner', '.article-plugin', '.article-notification', '.float-bar',
    '.article-plugin-wrapper',
    '[class*="Share"]', '[data-widget="audio"]', '[data-widget="Audio"]',
    'audio', 'video',
    '[class*="Note"]', '[class*="note"]', '[class*="Translation"]', '[class*="translation"]',
    '[class*="Audio"]', '[class*="audio"]', '[class*="Reward"]', '[class*="reward"]',
    '[data-plugin]', '[data-track]', '[data-track-section]', '[data-translation]', '[data-audio]',
    '[data-role="toolbar"]',
    'button[data-role="comment"]',
    'script[data-role="plugin"]',
    '.ArticleBottomBar',
    '.bottom-toolbar'
];
const ARTICLE_PLUGIN_KEYWORDS = [
    'note', 'translation', 'audio', 'player', 'reward', 'donate',
    'appreciation', 'sponsor', 'qrcode', 'toolbar', 'plugin',
    'copyright', 'geeknote', 'bilingual', 'comment'
];
const ARTICLE_MINDMAP_SELECTORS = [
    '.mindmap', '.mind-map', '.MindMap', '.Mind-map',
    '[data-type="mindmap"]', '[data-role="mindmap"]', '[data-widget="mindmap"]',
    '[class*="MindMap"]', '[class*="mindMap"]'
];
const PDF_BASE_CSS = `
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    margin: 0;
    padding: 0;
    background: #fff;
    color: #1f2329;
}
.article-pdf-wrapper {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 56px 60px;
}
.article-title {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 16px;
    line-height: 1.3;
    color: #111;
}
.article-meta {
    color: #7f8c8d;
    font-size: 14px;
    margin-bottom: 32px;
}
.article-content p,
.article-content div {
    margin: 1.1em 0;
    line-height: 1.9;
    font-size: 16px;
}
.article-content p + p,
.article-content div + p,
.article-content p + div {
    margin-top: 1.6em;
}
.article-content h2,
.article-content h3,
.article-content h4 {
    margin-top: 2.2em;
    margin-bottom: 1em;
    font-weight: 600;
    color: #111;
}
.article-content h2 {
    font-size: 26px;
}
.article-content h3 {
    font-size: 22px;
}
.article-content h4 {
    font-size: 18px;
}
.article-content img {
    max-width: 100%;
    margin: 1.2em auto;
    display: block;
    border-radius: 4px;
}
.article-content blockquote {
    margin: 1.3em 0;
    padding: 0.8em 1.2em;
    border-left: 4px solid #d0d7de;
    background: #f8fafc;
    color: #4b5563;
}
.article-content ul,
.article-content ol {
    margin: 1em 0;
    padding-left: 2em;
}
.article-content pre {
    background: #0b1220;
    color: #d9e2ff;
    border-radius: 6px;
    padding: 16px 20px;
    overflow: auto;
    margin: 1.4em 0;
    font-size: 14px;
    line-height: 1.6;
}
.article-content pre code {
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
}
.article-content code {
    font-family: "Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    background: rgba(15, 23, 42, 0.08);
    border-radius: 4px;
    padding: 0.2em 0.4em;
}
.article-content hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2.4em 0;
}
`;

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function normalizeCookieSameSite(value) {
    if (!value) return undefined;
    const lower = value.toString().toLowerCase();
    if (lower.includes('lax')) return 'Lax';
    if (lower.includes('strict')) return 'Strict';
    if (lower.includes('none') || lower.includes('no_restriction')) return 'None';
    return undefined;
}

function normalizeCookieDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return '.geekbang.org';
    }
    return domain.trim();
}

async function loadCookiesFromJsonFile(filePath) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    let raw;
    try {
        raw = await fs.readFile(absolutePath, 'utf-8');
    } catch (error) {
        throw new Error(`无法读取 cookie JSON 文件: ${error.message}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`cookie JSON 解析失败: ${error.message}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('cookie JSON 必须是数组格式');
    }

    const cookies = parsed
        .filter(item => item && typeof item.name === 'string' && item.value !== undefined)
        .map(item => {
            const cookieValue = typeof item.value === 'string' ? item.value : String(item.value ?? '');
            const cookie = {
                name: item.name,
                value: cookieValue,
                domain: normalizeCookieDomain(item.domain),
                path: item.path || '/',
                secure: Boolean(item.secure),
                httpOnly: Boolean(item.httpOnly)
            };
            const sameSite = normalizeCookieSameSite(item.sameSite);
            if (sameSite) {
                cookie.sameSite = sameSite;
            }
            return cookie;
        });

    if (cookies.length === 0) {
        throw new Error('cookie JSON 中没有有效的 cookie 项');
    }

    const withExpiry = parsed
        .filter(item => item && typeof item.name === 'string' && item.value !== undefined)
        .map((item, idx) => ({ item, target: cookies[idx] }))
        .filter(entry => entry.target);
    withExpiry.forEach(({ item, target }) => {
        const expires = item.expires || item.expirationDate;
        if (expires) {
            target.expires = Math.floor(Number(expires));
        }
    });

    const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    return { cookieHeader, cookies, absolutePath };
}

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

function normalizeArticleHtml(html = '') {
    if (!html) return '';
    return html
        .replace(/<!--\s*\[\[\[read_end]]\]\s*-->/gi, '')
        .replace(/src="\/\//gi, 'src="https://')
        .replace(/src='\/\//gi, "src='https://")
        .replace(/href="\/\//gi, 'href="https://')
        .replace(/href='\/\//gi, "href='https://");
}

function resolveImageUrl(rawSrc = '') {
    if (!rawSrc) return null;
    let src = rawSrc.trim();
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        return null;
    }
    if (src.startsWith('//')) {
        return `https:${src}`;
    }
    if (src.startsWith('/')) {
        return `${GEEKTIME_BASE_URL}${src}`;
    }
    if (/^https?:/i.test(src)) {
        return src;
    }
    try {
        return new URL(src, GEEKTIME_BASE_URL).toString();
    } catch {
        return null;
    }
}

async function fetchBinaryWithContext(context, url) {
    const headers = {
        'user-agent': DEFAULT_USER_AGENT,
        'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'referer': GEEKTIME_BASE_URL,
        ...(globalCookieHeader ? { 'cookie': globalCookieHeader } : {})
    };
    const response = await context.request.get(url, { headers, failOnStatusCode: true });
    if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
    }
    const buffer = await response.body();
    const headersMap = response.headers();
    return {
        buffer,
        contentType: headersMap['content-type'] || '',
        finalUrl: response.url()
    };
}

function determineImageExtension(resourceUrl = '', contentType = '') {
    let ext = '';
    if (resourceUrl) {
        try {
            const { pathname } = new URL(resourceUrl);
            ext = path.extname(pathname).replace('.', '');
        } catch {
            ext = '';
        }
    }
    if (!ext && contentType) {
        ext = (mime.extension(contentType) || '').toString();
    }
    if (!ext) {
        ext = 'bin';
    }
    return ext.toLowerCase();
}

function isKindleFriendlyImage(ext = '', mimeType = '') {
    const normalizedExt = (ext || '').replace('.', '').toLowerCase();
    const normalizedMime = (mimeType || '').toLowerCase();
    if (normalizedExt && KINDLE_SAFE_EXTENSIONS.has(normalizedExt)) {
        return true;
    }
    if (normalizedMime && KINDLE_SAFE_MIME_TYPES.has(normalizedMime)) {
        return true;
    }
    return false;
}

async function convertImageBufferForKindle(buffer) {
    if (!buffer || buffer.length === 0) {
        return null;
    }
    try {
        const converted = await sharp(buffer).png().toBuffer();
        return {
            buffer: converted,
            ext: KINDLE_CONVERT_TARGET.ext,
            mime: KINDLE_CONVERT_TARGET.mime
        };
    } catch (error) {
        console.log(chalk.yellow(`  ⚠️  图片格式转换失败: ${error.message}`));
        return null;
    }
}

async function downloadImageToLocal(context, normalizedUrl, assetsDir, articleIndex) {
    const { buffer, contentType, finalUrl } = await fetchBinaryWithContext(context, normalizedUrl);
    let finalBuffer = buffer;
    let finalMime = contentType;
    let ext = determineImageExtension(finalUrl || normalizedUrl, finalMime);

    if (!isKindleFriendlyImage(ext, finalMime)) {
        const conversion = await convertImageBufferForKindle(buffer);
        if (conversion) {
            finalBuffer = conversion.buffer;
            finalMime = conversion.mime;
            ext = conversion.ext;
        }
    }

    const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex').slice(0, 10);
    const filename = `article_${String(articleIndex + 1).padStart(3, '0')}_${hash}.${ext}`;
    const filepath = path.join(assetsDir, filename);
    await fs.writeFile(filepath, finalBuffer);
    return {
        fileUrl: pathToFileURL(filepath).href,
        localPath: filepath
    };
}

function mapSameSiteForExport(value) {
    if (!value) return 'unspecified';
    const lower = value.toString().toLowerCase();
    if (lower.includes('strict')) return 'strict';
    if (lower.includes('lax')) return 'lax';
    if (lower.includes('none')) return 'no_restriction';
    return 'unspecified';
}

async function updateGlobalCookieHeaderFromContext(context) {
    if (!context) return;
    try {
        const cookies = await context.cookies();
        if (!cookies || cookies.length === 0) {
            return;
        }
        const header = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        if (header) {
            globalCookieHeader = header;
        }
    } catch {
        // ignore
    }
}

async function persistCookiesToFile(context, targetPath) {
    if (!context || !targetPath) return;
    try {
        const cookies = await context.cookies();
        if (!cookies || cookies.length === 0) {
            return;
        }
        const serialized = cookies.map(cookie => ({
            domain: cookie.domain,
            expirationDate: cookie.expires || undefined,
            hostOnly: !cookie.domain.startsWith('.'),
            httpOnly: cookie.httpOnly,
            name: cookie.name,
            path: cookie.path,
            sameSite: mapSameSiteForExport(cookie.sameSite),
            secure: cookie.secure,
            session: !cookie.expires,
            storeId: '0',
            value: cookie.value
        }));
        await fs.writeFile(targetPath, JSON.stringify(serialized, null, 2), 'utf-8');
        console.log(chalk.gray(`🍪 已刷新 Cookie → ${targetPath}`));
    } catch (error) {
        console.log(chalk.yellow(`⚠️  保存 Cookie 失败: ${error.message}`));
    }
}

async function saveDataUriImage(dataUri, assetsDir, articleIndex, dataIndex) {
    if (!dataUri || typeof dataUri !== 'string') {
        return null;
    }
    const match = dataUri.match(/^data:(.+?);base64,(.+)$/i);
    if (!match) {
        return null;
    }
    let mimeType = match[1] || 'application/octet-stream';
    const base64Data = match[2];
    let buffer;
    try {
        buffer = Buffer.from(base64Data, 'base64');
    } catch {
        return null;
    }
    if (!buffer || buffer.length === 0) {
        return null;
    }
    let ext = mime.extension(mimeType) || 'bin';
    if (!isKindleFriendlyImage(ext, mimeType)) {
        const conversion = await convertImageBufferForKindle(buffer);
        if (conversion) {
            buffer = conversion.buffer;
            ext = conversion.ext;
            mimeType = conversion.mime;
        }
    }
    const filename = `article_${String(articleIndex + 1).padStart(3, '0')}_inline_${String(dataIndex).padStart(3, '0')}.${ext}`;
    const filepath = path.join(assetsDir, filename);
    await fs.writeFile(filepath, buffer);
    return pathToFileURL(filepath).href;
}

async function rewriteImagesWithLocalFiles(context, htmlContent, assetsDir, articleIndex, sharedCache) {
    if (!htmlContent || htmlContent.indexOf('<img') === -1) {
        return { html: htmlContent, replaced: 0 };
    }

    const $ = loadHtml(htmlContent, { decodeEntities: false });
    const images = $('img');
    if (images.length === 0) {
        return { html: htmlContent, replaced: 0 };
    }

    const pendingDownloads = new Map();
    const dataUriImages = [];

    images.each((_, element) => {
        const originalSrc = $(element).attr('src') || '';
        if (/^data:/i.test(originalSrc.trim())) {
            dataUriImages.push({ element, src: originalSrc.trim() });
            return;
        }
        const normalizedUrl = resolveImageUrl(originalSrc);
        if (!normalizedUrl) {
            return;
        }
        if (sharedCache.has(normalizedUrl)) {
            return;
        }
        if (!pendingDownloads.has(normalizedUrl)) {
            pendingDownloads.set(normalizedUrl, null);
        }
    });

    const downloadTargets = Array.from(pendingDownloads.keys());
    for (let i = 0; i < downloadTargets.length; i += EPUB_IMAGE_BATCH_SIZE) {
        const batch = downloadTargets.slice(i, i + EPUB_IMAGE_BATCH_SIZE).map(async (targetUrl) => {
            try {
                const info = await downloadImageToLocal(context, targetUrl, assetsDir, articleIndex);
                sharedCache.set(targetUrl, info.fileUrl);
                pendingDownloads.set(targetUrl, info.fileUrl);
            } catch (error) {
                console.log(chalk.yellow(`  ⚠️  图片下载失败: ${targetUrl} (${error.message})`));
                pendingDownloads.set(targetUrl, null);
            }
        });
        await Promise.all(batch);
    }

    images.each((_, element) => {
        const originalSrc = $(element).attr('src') || '';
        if (/^data:/i.test(originalSrc.trim())) {
            return;
        }
        const normalizedUrl = resolveImageUrl(originalSrc);
        if (!normalizedUrl) {
            return;
        }
        const localUrl = sharedCache.get(normalizedUrl) || pendingDownloads.get(normalizedUrl);
        if (localUrl) {
            $(element).attr('src', localUrl);
        }
    });

    let processedInlineImages = 0;
    for (let i = 0; i < dataUriImages.length; i++) {
        const item = dataUriImages[i];
        try {
            const localUrl = await saveDataUriImage(item.src, assetsDir, articleIndex, i);
            if (localUrl) {
                $(item.element).attr('src', localUrl);
                processedInlineImages++;
            } else {
                $(item.element).remove();
            }
        } catch (error) {
            console.log(chalk.yellow(`  ⚠️  内联图片处理失败: ${error.message}`));
            $(item.element).remove();
        }
    }

    const finalHtml = $.root().html() || htmlContent;

    return {
        html: finalHtml,
        replaced: downloadTargets.length + processedInlineImages
    };
}

async function rewriteEpubContentImages(context, contentResults, assetsDir) {
    const cache = new Map();
    let processedArticles = 0;
    let processedImages = 0;

    const spinner = ora('正在缓存 EPUB 图片...').start();

    const updatedResults = [];
    for (let i = 0; i < contentResults.length; i++) {
        const result = contentResults[i];
        if (!result || !result.success || !result.content) {
            updatedResults.push(result);
            continue;
        }
        try {
            const { html, replaced } = await rewriteImagesWithLocalFiles(context, result.content, assetsDir, i, cache);
            processedImages += replaced;
            if (replaced > 0) {
                processedArticles++;
            }
            updatedResults.push({ ...result, content: html });
        } catch (error) {
            spinner.stop();
            console.log(chalk.yellow(`⚠️  处理第 ${i + 1} 篇文章图片失败: ${error.message}`));
            spinner.start();
            updatedResults.push(result);
        }
    }

    if (processedImages === 0) {
        spinner.stop();
        console.log(chalk.gray('📷 没有检测到需要缓存的图片'));
    } else {
        spinner.succeed(`已缓存 EPUB 图片: ${processedImages} 张（${processedArticles} 篇文章）`);
    }

    return updatedResults;
}

async function createTempAssetsDir(baseDir) {
    const tempDir = path.join(baseDir, `${TEMP_ASSET_PREFIX}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}

async function cleanupTempAssetsDir(dir) {
    if (!dir) return;
    try {
        await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
        console.log(chalk.gray(`清理临时目录失败: ${error.message}`));
    }
}

async function sanitizeArticleHtml(page, rawHtml) {
    return page.evaluate(({ html, removalSelectors, pluginKeywords, mindmapSelectors }) => {
        const template = document.createElement('template');
        template.innerHTML = html;

        removalSelectors.forEach(selector => {
            template.content.querySelectorAll(selector).forEach(el => el.remove());
        });

        const pluginElements = Array.from(template.content.querySelectorAll('*')).filter(el => {
            const className = (el.className || '').toString().toLowerCase();
            const idValue = (el.id || '').toString().toLowerCase();
            const roleValue = (el.getAttribute && el.getAttribute('role')) ? el.getAttribute('role').toLowerCase() : '';
            const datasetValues = el.dataset ? Object.values(el.dataset).join(' ').toLowerCase() : '';
            const combined = `${className} ${idValue} ${roleValue} ${datasetValues}`;
            return pluginKeywords.some(keyword => combined.includes(keyword));
        });
        pluginElements.forEach(el => el.remove());

        mindmapSelectors.forEach(selector => {
            template.content.querySelectorAll(selector).forEach(el => el.remove());
        });
        const vectorCandidates = Array.from(template.content.querySelectorAll('svg, canvas, object, embed'));
        vectorCandidates.forEach(el => {
            const className = typeof el.className === 'object' ? el.className.baseVal : (el.className || '');
            const meta = `${className} ${el.id || ''} ${el.getAttribute('data-type') || ''}`.toLowerCase();
            if (meta.includes('mind') || meta.includes('mindmap') || meta.includes('mind-map')) {
                el.remove();
            }
        });

        const allowedTags = new Set([
            'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'UL', 'OL', 'LI',
            'BLOCKQUOTE', 'PRE', 'CODE',
            'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FIGURE', 'FIGCAPTION',
            'STRONG', 'EM', 'B', 'I', 'SPAN', 'DIV', 'BR', 'HR',
            'A', 'SUP', 'SUB'
        ]);

        const blockDisplayTags = new Set(['DIV', 'SECTION', 'ARTICLE', 'FIGURE']);
        const allowedAttributes = new Set(['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel']);

        function sanitizeNode(node) {
            const children = Array.from(node.children || []);
            for (const child of children) {
                if (!allowedTags.has(child.tagName)) {
                    child.replaceWith(...child.childNodes);
                    continue;
                }

                if (blockDisplayTags.has(child.tagName)) {
                    child.style.display = 'block';
                }

                const attributes = Array.from(child.attributes);
                for (const attr of attributes) {
                    if (!allowedAttributes.has(attr.name.toLowerCase())) {
                        child.removeAttribute(attr.name);
                    }
                }

                sanitizeNode(child);
            }
        }

        sanitizeNode(template.content || template);

        const images = template.content ? template.content.querySelectorAll('img') : [];
        images.forEach(img => {
            img.setAttribute('loading', 'eager');
            img.setAttribute('decoding', 'sync');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        });

        return template.innerHTML;
    }, {
        html: rawHtml,
        removalSelectors: ARTICLE_REMOVAL_SELECTORS,
        pluginKeywords: ARTICLE_PLUGIN_KEYWORDS,
        mindmapSelectors: ARTICLE_MINDMAP_SELECTORS
    });
}

function normalizeTextContent(text = '') {
    return text.replace(/\s+/g, ' ').trim();
}

function escapeHtml(text = '') {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function removeDuplicateTitle(html, title = '') {
    if (!html || !title) {
        return html;
    }
    const normalizedTitle = normalizeTextContent(title);
    if (!normalizedTitle) {
        return html;
    }
    try {
        const $ = loadHtml(html, { decodeEntities: false });
        const firstHeading = $('h1, h2').first();
        if (firstHeading.length) {
            const headingText = normalizeTextContent(firstHeading.text());
            if (headingText && headingText === normalizedTitle) {
                firstHeading.remove();
            }
        }
        return $.root().html() || html;
    } catch {
        return html;
    }
}

function buildPdfHtml(title, sanitizedHtml, articleMeta = '') {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<base href="${GEEKTIME_BASE_URL}">
<style>${PDF_BASE_CSS}${PRINT_FIX_CSS}${CODE_HIGHLIGHT_CSS}</style>
</head>
<body>
  <article class="article-pdf-wrapper">
    <section class="article-content">
      <h1 class="article-title">${escapeHtml(title)}</h1>
      ${articleMeta ? `<div class="article-meta">${escapeHtml(articleMeta)}</div>` : ''}
      ${sanitizedHtml}
    </section>
  </article>
</body>
</html>`;
}

function enhanceCodeBlocks(html) {
    if (!html) return html;
    try {
        const $ = loadHtml(html, { decodeEntities: false });
        const wrapCodeElement = ($source, innerHtml) => {
            const wrapper = $('<pre class="code-block"></pre>');
            const codeEl = $('<code></code>').html(innerHtml);
            wrapper.append(codeEl);
            $source.replaceWith(wrapper);
        };

        $('code').each((_, element) => {
            const $el = $(element);
            const parent = $el.parent();
            const text = $el.text() || '';
            const isBlocky = text.includes('\n') || text.length > 120 || $el.html().includes('<br');
            if (isBlocky && parent.length && parent[0].tagName !== 'PRE') {
                wrapCodeElement($el, $el.html());
            }
        });
        $('pre').each((_, element) => {
            const $el = $(element);
            if (!$el.hasClass('code-block')) {
                $el.addClass('code-block');
            }
            if ($el.find('code').length === 0) {
                const text = $el.html();
                $el.empty().append($('<code></code>').html(text));
            }
        });

        const codeLikeSelectors = [
            '[class*="code"]',
            '[class*="Code"]',
            '[class*="code-block"]',
            '[class*="CodeBlock"]',
            '[class*="hljs"]',
            '[class*="language-"]',
            '.highlight',
            '.prism-code'
        ];
        const blockTags = ['P', 'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'TABLE', 'IMG', 'FIGURE'];
        const isLikelyCodeText = (text = '') => {
            const trimmed = text.trim();
            if (trimmed.length === 0) return false;
            if (trimmed.length > 1200) return false;
            return trimmed.includes('\n') || trimmed.includes('{') || trimmed.includes(';') || trimmed.includes('    ');
        };
        $(codeLikeSelectors.join(',')).each((_, element) => {
            const $el = $(element);
            if ($el.is('pre') || $el.find('pre').length > 0) {
                return;
            }
            const hasBlockChildren = blockTags.some(tag => $el.find(tag).length > 0);
            if (hasBlockChildren) {
                return;
            }
            const text = $el.text() || '';
            if (!isLikelyCodeText(text)) {
                return;
            }
            wrapCodeElement($el, $el.html());
        });

        $('figure').each((_, element) => {
            const $el = $(element);
            if ($el.find('pre').length === 1 && $el.children().length === 1) {
                $el.replaceWith($el.find('pre').first());
            }
        });

        const highlightSelectors = [
            '[class*="hljs"]',
            '[class*="language-"]',
            '.simplebar-content',
            '[data-language]',
            '[data-code-block]',
            '[class*="RichContent"]'
        ];
        const containerClassHints = ['simplebar', 'code', 'hljs', 'prism', 'syntax', 'monaco', 'ace', 'terminal', 'shell'];
        const containerStyleHints = ['white-space: pre', 'white-space:pre', 'font-family: monospace', 'font-family:monospace'];
        const inlineTags = new Set(['span', 'code', 'em', 'strong', 'b', 'i', 'u', 'a', 'label']);
        const newlineTags = new Set(['DIV', 'P', 'LI', 'SECTION', 'ARTICLE', 'FIGURE', 'PRE', 'CODE', 'BR', 'TR', 'TD', 'TH']);
        const looksLikeCodeBlock = (text = '') => {
            if (!text) return false;
            const trimmed = text.trim();
            if (!trimmed) return false;
            if (trimmed.includes('\n')) return true;
            const keywords = ['{', '}', ';', '=>', '->', '#!', 'SELECT ', 'INSERT ', 'docker ', 'kubectl ', 'sudo ', 'printf', 'def ', 'class ', 'function ', 'const ', 'let ', 'var ', 'public ', 'private ', 'import ', 'package ', 'namespace ', 'http '];
            return keywords.some(keyword => trimmed.includes(keyword));
        };
        const getTextWithBreaks = (node) => {
            if (!node) return '';
            if (node.type === 'text') {
                return node.data || '';
            }
            if (!node.children || node.children.length === 0) {
                return newlineTags.has((node.tagName || node.name || '').toUpperCase()) ? '\n' : '';
            }
            let text = '';
            for (const child of node.children) {
                text += getTextWithBreaks(child);
            }
            if (newlineTags.has((node.tagName || node.name || '').toUpperCase())) {
                text += '\n';
            }
            return text;
        };
        const normalizeCodeText = (text = '') => {
            const lines = text
                .replace(/\r\n?/g, '\n')
                .split('\n')
                .map(line => line.replace(/\u00a0/g, ' ').replace(/\t/g, '    ').replace(/\s+$/, ''));
            while (lines.length && !lines[0].trim()) {
                lines.shift();
            }
            while (lines.length && !lines[lines.length - 1].trim()) {
                lines.pop();
            }
            const result = [];
            let previousBlank = false;
            for (const line of lines) {
                const isBlank = line.trim().length === 0;
                if (isBlank && previousBlank) {
                    continue;
                }
                result.push(line);
                previousBlank = isBlank;
            }
            return result.join('\n').trim();
        };
        const convertToCodeBlock = ($target) => {
            if (!$target || !$target.length) {
                return false;
            }
            const rawText = getTextWithBreaks($target[0]) || '';
            const normalized = normalizeCodeText(rawText);
            if (!looksLikeCodeBlock(normalized)) {
                return false;
            }
            const $pre = $('<pre class="code-block"></pre>');
            const $code = $('<code></code>').text(normalized);
            $pre.append($code);
            $target.replaceWith($pre);
            return true;
        };
        const processedCandidates = new Set();
        $(highlightSelectors.join(',')).each((_, node) => {
            const $start = $(node);
            if (!$start || !$start.length) {
                return;
            }
            let $candidate = null;
            let $current = $start;
            for (let depth = 0; depth < 8 && $current && $current.length; depth++) {
                const rawTag = ($current[0]?.tagName || $current[0]?.name || '').toLowerCase();
                const classAttr = ($current.attr('class') || '').toLowerCase();
                const styleAttr = ($current.attr('style') || '').toLowerCase();
                const hasClassHint = containerClassHints.some(keyword => classAttr.includes(keyword));
                const hasStyleHint = containerStyleHints.some(keyword => styleAttr.includes(keyword));
                if (!inlineTags.has(rawTag) && (hasClassHint || hasStyleHint)) {
                    $candidate = $current;
                }
                $current = $current.parent();
            }
            if (!$candidate || !$candidate.length || $candidate.is('pre')) {
                return;
            }
            const key = $candidate[0];
            if (processedCandidates.has(key)) {
                return;
            }
            if (convertToCodeBlock($candidate)) {
                processedCandidates.add(key);
            }
        });

        const simplebarWrappers = [
            '.simplebar-wrapper',
            '.simplebar-height-auto-observer-wrapper',
            '.simplebar-height-auto-observer',
            '.simplebar-mask',
            '.simplebar-offset',
            '.simplebar-content-wrapper',
            '.simplebar-placeholder'
        ];
        simplebarWrappers.forEach(selector => {
            $(selector).each((_, element) => {
                const $el = $(element);
                if ($el.find('pre.code-block').length > 0 || !$el.text().trim()) {
                    $el.replaceWith($el.contents());
                }
            });
        });
        $('.simplebar-track, .simplebar-scrollbar').remove();

        return $.root().html() || html;
    } catch {
        return html;
    }
}

async function detectAccessIssuesOnPage(page) {
    return page.evaluate(() => {
        const bodyText = document.body ? (document.body.innerText || '') : '';
        if (!bodyText) {
            return null;
        }
        const normalized = bodyText.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            return null;
        }

        const checks = [
            {
                keywords: ['请先登录', '重新登录', '立即登录', '登录后'],
                message: '页面提示需要登录，Cookie 可能已失效或未正确导入'
            },
            {
                keywords: ['试看结束', '购买专栏', '立即订阅', '购买课程', '仅对付费用户开放', '开通会员'],
                message: '检测到购买/试看提示，可能未订阅该专栏或 Cookie 已失效'
            },
            {
                keywords: ['暂无权限', '没有权限', '权限不足'],
                message: '账号没有访问该专栏的权限'
            }
        ];

        const lower = normalized.toLowerCase();
        for (const check of checks) {
            for (const keyword of check.keywords) {
                if (lower.includes(keyword.toLowerCase())) {
                    return check.message;
                }
            }
        }
        return null;
    });
}

async function waitForArticleContentSelector(page, timeout = 60000) {
    const start = Date.now();
    while ((Date.now() - start) < timeout) {
        for (const selector of ARTICLE_CONTENT_SELECTORS) {
            const handle = await page.$(selector);
            if (handle) {
                await handle.dispose();
                return selector;
            }
        }
        await page.waitForTimeout(300);
    }
    return null;
}

async function autoScrollArticle(page, { step = 400, delay = 120, maxIterations = 80 } = {}) {
    await page.evaluate(({ step, delay, maxIterations }) => {
        return new Promise((resolve) => {
            let iterations = 0;
            const timer = setInterval(() => {
                window.scrollBy(0, step);
                iterations += 1;
                const reachedBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 50;
                if (reachedBottom || iterations >= maxIterations) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, delay);
        });
    }, { step, delay, maxIterations });
}

async function fetchArticleContentFromPage(page, article, timeout = 60000) {
    const targetUrl = article.url || `${GEEKTIME_BASE_URL}/column/article/${article.id}`;
    let response;
    try {
        response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
        throw new Error(`页面加载失败: ${error.message}`);
    }

    if (response && !response.ok()) {
        throw new Error(`页面响应异常: HTTP ${response.status()} ${response.statusText()}`);
    }

    try {
        await page.waitForLoadState('networkidle', { timeout: Math.min(10000, timeout) });
    } catch {
        // 部分页面可能没有额外请求，忽略 networkidle 超时
    }

    await autoScrollArticle(page);
    await page.waitForTimeout(500);

    const selector = await waitForArticleContentSelector(page, timeout);
    if (!selector) {
        const issue = await detectAccessIssuesOnPage(page);
        if (issue) {
            throw new Error(issue);
        }
        throw new Error('未能定位到文章正文，请重试或检查 Cookie 是否有效');
    }

    let extraction;
    try {
        extraction = await page.$eval(selector, (el) => {
            const clone = el.cloneNode(true);
            const removalSelectors = [
                '.article-share',
                '.article-actions',
                '.article-copyright',
                '.article-bottom',
                '.reward',
                '.share',
                '.Index_recommend',
                '.recommend',
                '.audio-player',
                '.AudioPlayer',
                '.voice-player',
                '.VoicePlayer',
                '.audio-wrapper',
                '.AudioWrapper',
                '.geek-player',
                '.Player',
                '.plugin',
                '.Plugin',
                '[data-widget="audio"]',
                '[data-widget="Audio"]',
                '[data-role="audio"]',
                '.comment-area',
                '.CommentArea',
                '.comment-wrapper',
                '.CommentWrapper',
                '#comments',
                '#comment',
                '.comments',
                '.Comments'
            ];
            removalSelectors.forEach(sel => {
                clone.querySelectorAll(sel).forEach(node => node.remove());
            });

            const toAbsoluteUrl = (value) => {
                if (!value || typeof value !== 'string') {
                    return '';
                }
                const trimmed = value.trim();
                if (!trimmed) {
                    return '';
                }
                if (trimmed.startsWith('blob:')) {
                    return '';
                }
                if (trimmed.startsWith('data:')) {
                    return trimmed;
                }
                if (/^https?:/i.test(trimmed)) {
                    return trimmed;
                }
                if (trimmed.startsWith('//')) {
                    return `${location.protocol}${trimmed}`;
                }
                try {
                    const url = new URL(trimmed, location.href);
                    return url.href;
                } catch {
                    return '';
                }
            };

            const imageFallbackAttrs = [
                'data-src',
                'data-original',
                'data-actualsrc',
                'data-url',
                'data-image',
                'data-origin',
                'data-thumbnail',
                'data-bigimgsrc',
                'data-download',
                'data-href'
            ];

            clone.querySelectorAll('img').forEach(img => {
                let finalSrc = toAbsoluteUrl(img.getAttribute('src'));
                if (!finalSrc) {
                    for (const attr of imageFallbackAttrs) {
                        const candidate = toAbsoluteUrl(img.getAttribute(attr));
                        if (candidate) {
                            finalSrc = candidate;
                            break;
                        }
                    }
                }

                if (!finalSrc) {
                    img.remove();
                } else {
                    img.setAttribute('src', finalSrc);
                }
            });

            const textLength = clone.innerText ? clone.innerText.trim().length : 0;
            return {
                html: clone.innerHTML,
                textLength
            };
        });
    } catch (error) {
        throw new Error(`读取文章内容失败: ${error.message}`);
    }

    if (!extraction || !extraction.html || extraction.textLength < 20) {
        const issue = await detectAccessIssuesOnPage(page);
        if (issue) {
            throw new Error(issue);
        }
        throw new Error('正文内容为空，可能是 Cookie 失效或只获取到试看内容');
    }

    const normalizedHtml = normalizeArticleHtml(extraction.html);
    const sanitizedHtml = await sanitizeArticleHtml(page, normalizedHtml);

    if (!sanitizedHtml || sanitizedHtml.trim().length === 0) {
        throw new Error('正文清洗后为空，可能是页面结构变化');
    }

    const cleaned = removeDuplicateTitle(sanitizedHtml, article.originalTitle || article.title || '');
    return enhanceCodeBlocks(cleaned);
}

function isRetryableContentError(message = '') {
    if (!message) return true;
    const lower = message.toLowerCase();
    const nonRetryableKeywords = [
        'cookie', '登录', '登陆', '订阅', '试看', '权限', '购买', '未授权', '无权限'
    ];
    return !nonRetryableKeywords.some(keyword => lower.includes(keyword));
}

async function fetchArticleContentWithRetry(page, article, options = {}) {
    const {
        timeout = 60000,
        maxAttempts = 3,
        delayMs = 1500
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (attempt > 1) {
                await page.waitForTimeout(400);
            }
            return await fetchArticleContentFromPage(page, article, timeout);
        } catch (error) {
            lastError = error;
            const message = error?.message || '';
            if (!isRetryableContentError(message) || attempt === maxAttempts) {
                throw error;
            }
            const waitTime = delayMs * attempt;
            if (process.env.DEBUG) {
                console.log(chalk.gray(`重试文章 ${article.id} (第${attempt}次失败: ${message})，等待 ${waitTime}ms`));
            }
            try {
                await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
            } catch {
                // 忽略
            }
            await page.waitForTimeout(waitTime);
        }
    }

    throw lastError || new Error('无法获取文章内容');
}

async function extractArticlesFromPageDom(page) {
    return page.evaluate((baseUrl) => {
        const selectors = [
            '[class*="catalog"] a[href*="/column/article/"]',
            '[class*="directory"] a[href*="/column/article/"]',
            '[class*="Catalogue"] a[href*="/column/article/"]',
            '[class*="Catalog"] a[href*="/column/article/"]',
            'nav a[href*="/column/article/"]',
            'a[href*="/column/article/"]'
        ];

        const collectedAnchors = [];
        const seenElements = new Set();
        selectors.forEach(selector => {
            const nodes = document.querySelectorAll(selector);
            nodes.forEach(node => {
                if (!seenElements.has(node)) {
                    seenElements.add(node);
                    collectedAnchors.push(node);
                }
            });
        });

        if (collectedAnchors.length === 0) {
            return [];
        }

        const seenIds = new Set();
        const articles = [];

        const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

        collectedAnchors.forEach((anchor, index) => {
            const href = anchor.getAttribute('href') || '';
            const match = href.match(/column\/article\/(\d+)/i);
            if (!match) {
                return;
            }

            const id = parseInt(match[1], 10);
            if (!id || seenIds.has(id)) {
                return;
            }
            seenIds.add(id);

            let title = cleanText(anchor.innerText || anchor.textContent || anchor.getAttribute('title') || '');
            if (!title) {
                const titleNode = anchor.querySelector('[class*="title"], span, div');
                if (titleNode) {
                    title = cleanText(titleNode.textContent);
                }
            }
            if (!title) {
                title = `文章_${id}`;
            }

            let absoluteUrl = href;
            try {
                absoluteUrl = new URL(href, baseUrl).toString();
            } catch {
                if (href.startsWith('/')) {
                    absoluteUrl = `${baseUrl.replace(/\/$/, '')}${href}`;
                }
            }

            const sectionNode = anchor.closest('[data-section],[data-chapter],[class*="section"],[class*="Section"],[class*="chapter"],[class*="Chapter"]');
            let sectionName = '';
            if (sectionNode) {
                sectionName = cleanText(
                    sectionNode.getAttribute('data-section') ||
                    sectionNode.getAttribute('data-chapter') ||
                    sectionNode.getAttribute('data-title') ||
                    sectionNode.querySelector('h2, h3, h4, .title, .section-title')?.textContent ||
                    ''
                );
            }

            articles.push({
                id,
                article_title: title,
                article_sharetitle: title,
                url: absoluteUrl,
                section_name: sectionName,
                chapter_index: index + 1,
                originalIndex: index
            });
        });

        return articles;
    }, GEEKTIME_BASE_URL);
}

async function extractColumnAuthorFromPage(page) {
    try {
        return await page.evaluate(() => {
            const selectors = [
                '.author-name',
                '.author',
                '.teacher-name',
                '.lecturer-name',
                '.Index_teacherName',
                '.ProductHeader_teacherName',
                '.ColumnIntro_teacher__name',
                '.ColumnIntro_author__name'
            ];
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent && el.textContent.trim()) {
                    return el.textContent.trim();
                }
            }
            const metaAuthor = document.querySelector('meta[name="author"]');
            if (metaAuthor && metaAuthor.content) {
                return metaAuthor.content.trim();
            }
            return null;
        });
    } catch {
        return null;
    }
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
    const articlesPromise = Promise.race([
        new Promise((resolve) => {
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
                        resolve(null);
                    }
                }
            };
            page.on('response', articlesHandler);
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 30000))
    ]);

    const columnInfoPromise = Promise.race([
        new Promise((resolve) => {
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
                        resolve(null);
                    }
                }
            };
            page.on('response', columnInfoHandler);
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]);

    try {
        // 先设置监听器，再访问页面
        spinner.text = '正在加载页面...';
        await page.goto(columnUrl, { waitUntil: 'networkidle', timeout });

        spinner.text = '正在获取文章列表...';

        // 等待文章列表 API（如果失败将返回 null）
        articlesData = await articlesPromise;

        // 尝试等待专栏信息 API（可选）
        columnInfoData = await columnInfoPromise;
        if (!columnInfoData && process.env.DEBUG) {
            console.log(chalk.gray('未获取到专栏信息API响应（将使用其他方法）'));
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

    let useDomExtraction = false;
    let domArticles = [];

    if (!articlesData || !articlesData.data || !Array.isArray(articlesData.data.list) || articlesData.data.list.length === 0) {
        spinner.text = 'API 不可用，尝试从页面解析文章列表...';
        try {
            domArticles = await extractArticlesFromPageDom(page);
        } catch (error) {
            if (process.env.DEBUG) {
                console.log(chalk.gray(`DOM文章提取失败: ${error.message}`));
            }
        }

        if (!domArticles || domArticles.length === 0) {
            spinner.fail('无法获取文章列表');

            if (!articlesData) {
                console.log(chalk.yellow('\n⚠️  未能从接口或页面获取文章列表\n'));
                console.log(chalk.cyan('可能的原因：'));
                console.log(chalk.gray('  1. Cookie 已过期或无效 - 请重新获取 Cookie'));
                console.log(chalk.gray('  2. 页面结构发生变化 - 请联系开发者更新解析逻辑'));
                console.log(chalk.gray('  3. 网络连接问题或URL无效\n'));
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

            return { articles: [], columnTitle: 'unknown', columnAuthor: '极客时间' };
        }

        useDomExtraction = true;
    }

    // 调试信息：记录完整的API响应结构（仅在环境变量DEBUG存在时）
    if (!useDomExtraction && process.env.DEBUG) {
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
    if ((!columnTitle || columnTitle === '专栏' || columnTitle === '极客时间') && articlesData && articlesData.data) {
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

    let columnAuthor = '极客时间';
    if (!useDomExtraction && articlesData) {
        columnAuthor = extractColumnAuthor(columnInfoData, articlesData) || '极客时间';
    } else {
        columnAuthor = await extractColumnAuthorFromPage(page) || '极客时间';
    }

    // 解析文章列表
    const rawArticles = useDomExtraction ? domArticles : (articlesData.data.list || []);

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
            url: article.url || `${GEEKTIME_BASE_URL}/column/article/${id}`,
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
                const result = await downloadArticleSilent(page, article, outputDir, index + 1, total, timeout);
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
async function downloadArticleSilent(page, article, outputDir, index, total, timeout = 60000) {
    try {
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[silent] 准备处理文章 ${article.id} - ${article.originalTitle || article.title}`));
        }
        const sanitizedHtml = await fetchArticleContentWithRetry(page, article, { timeout });
        const meta = article.sectionName ? `章节：${article.sectionName}` : '';
        const printableHtml = buildPdfHtml(article.originalTitle || article.title, sanitizedHtml, meta);

        await page.setContent(printableHtml, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {
            // ignore
        }

        // 优化图片大小：将大图片转换为合适的尺寸，减小PDF体积
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[silent] 开始处理图片 ${article.id}`));
        }
        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const promises = Array.from(images).map(img => {
                return new Promise((resolve) => {
                    let resolved = false;
                    const safeResolve = () => {
                        if (!resolved) {
                            resolved = true;
                            resolve();
                        }
                    };
                    const attachTimeout = () => setTimeout(safeResolve, 15000);
                    let fallbackTimer = null;

                    // 如果图片还未加载完成，等待加载
                    if (!img.complete) {
                        fallbackTimer = attachTimeout();
                        img.onload = () => {
                            if (fallbackTimer) clearTimeout(fallbackTimer);
                            processImage(img, safeResolve);
                        };
                        img.onerror = () => {
                            if (fallbackTimer) clearTimeout(fallbackTimer);
                            safeResolve(); // 图片加载失败，跳过
                        };
                    } else {
                        processImage(img, safeResolve);
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
                    let hasResolved = false;
                    const finalize = () => {
                        if (!hasResolved) {
                            hasResolved = true;
                            resolve();
                        }
                    };
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            img.src = url;
                        }
                        img.style.width = maxWidth + 'px';
                        img.style.height = 'auto';
                        finalize();
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
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[silent] 图片处理完成 ${article.id}`));
        }

        // 等待图片处理完成
        await page.waitForTimeout(1200);
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[silent] 已准备生成PDF ${article.id}`));
        }

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
            printBackground: true,
            preferCSSPageSize: false
        });
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[silent] PDF生成完成 ${article.id}`));
        }

        return { success: true, title: article.title };

    } catch (error) {
        if (process.env.DEBUG) {
            console.log(chalk.red(`[silent] 文章 ${article.id} 失败: ${error.message}`));
        }
        return { success: false, title: article.title, error: error.message };
    }
}

// 下载单篇文章为 PDF
async function downloadArticle(page, article, outputDir, index, total, timeout = 60000) {
    const spinner = ora(`[${index}/${total}] 正在下载: ${article.title}`).start();

    try {
        const sanitizedHtml = await fetchArticleContentWithRetry(page, article, { timeout });
        const meta = article.sectionName ? `章节：${article.sectionName}` : '';
        const printableHtml = buildPdfHtml(article.originalTitle || article.title, sanitizedHtml, meta);

        await page.setContent(printableHtml, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {
            // 忽略
        }

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
            printBackground: true,
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
async function extractArticleContent(page, article, index, total, timeout = 60000) {
    try {
        const sanitizedHtml = await fetchArticleContentWithRetry(page, article, { timeout });

        if (!sanitizedHtml) {
            throw new Error('未能提取到文章内容');
        }

        return {
            success: true,
            title: article.originalTitle || article.title,
            content: sanitizedHtml
        };

    } catch (error) {
        console.error(`[${index}/${total}] 提取文章内容失败: ${article.originalTitle || article.title}`, error);
        return {
            success: false,
            title: article.originalTitle || article.title,
            error: error.message,
            content: ''
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
                const result = await extractArticleContent(page, article, index + 1, total, timeout);
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
                p, div {
                    margin: 1.2em 0;
                    text-indent: 0;
                    line-height: 1.9;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    display: block;
                    page-break-inside: avoid;
                }
                p + p,
                div + p,
                p + div {
                    margin-top: 1.6em;
                }
                /* 代码块样式 */
                pre {
                    background-color: #0b1220;
                    color: #d9e2ff;
                    border: 1px solid #e1e4e8;
                    border-radius: 6px;
                    padding: 18px 20px;
                    overflow-x: auto;
                    margin: 1em 0;
                    line-height: 1.6;
                    font-size: 14px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-family: 'Fira Code', 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
                    page-break-inside: avoid;
                }
                code {
                    font-family: 'Fira Code', 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
                    font-size: 0.9em;
                    background-color: rgba(15, 23, 42, 0.1);
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                    border: 1px solid rgba(15, 23, 42, 0.1);
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

    // 获取配置：优先级 命令行 > 配置文件 > 默认 cookies.json
    let cookie = options.cookie;
    let cookieFile = options.cookieFile;
    let columnUrl = options.url;

    // 如果命令行没有提供所需信息，尝试从配置文件读取
    if (!cookie || !columnUrl || !cookieFile) {
        // 使用当前工作目录的config.json，而不是脚本所在目录
        const configPath = path.join(process.cwd(), 'config.json');
        try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);

            // 使用配置文件中的值作为默认值
            if (!cookie) cookie = config.cookie;
            if (!columnUrl) columnUrl = config.columnUrl;
            if (!cookieFile) cookieFile = config.cookieFile;
        } catch (error) {
            // 配置文件不存在或读取失败，不是致命错误
            // 只有在命令行也没提供时才报错
        }
    }

    // 如果没有cookie字符串但存在 cookies.json 文件，自动使用
    if (!cookie && !cookieFile) {
        const defaultCookieJsonPath = path.join(process.cwd(), 'cookies.json');
        if (await fileExists(defaultCookieJsonPath)) {
            cookieFile = defaultCookieJsonPath;
        }
    }

    const cookieSavePath = cookieFile || path.join(process.cwd(), 'cookies.json');

    // 验证必要参数
    if (!cookie && !cookieFile) {
        console.error(chalk.red('❌ 缺少 Cookie！'));
        console.log(chalk.yellow('\n请通过以下方式之一提供 Cookie：'));
        console.log(chalk.gray('1. 命令行参数：--cookie "你的cookie字符串"'));
        console.log(chalk.gray('2. 配置文件 config.json：'));
        console.log(chalk.gray('   {'));
        console.log(chalk.gray('     "cookie": "你的cookie字符串",'));
        console.log(chalk.gray('     "columnUrl": "https://time.geekbang.org/column/article/xxxxx",'));
        console.log(chalk.gray('     "cookieFile": "cookies.json"  // 可选，导入JSON文件'));
        console.log(chalk.gray('   }'));
        console.log(chalk.gray('3. 提供 Cookie JSON 文件：'));
        console.log(chalk.gray('   - 命令行参数：--cookie-file ./cookies.json'));
        console.log(chalk.gray('   - 或将 cookies.json 放到当前目录\n'));
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
        userAgent: DEFAULT_USER_AGENT
    });

    let normalizedCookie = '';
    let cookiesForContext = [];

    if (cookie) {
        normalizedCookie = cookie.trim();
        if (/^cookie:/i.test(normalizedCookie)) {
            normalizedCookie = normalizedCookie.replace(/^cookie:\s*/i, '');
        }
        cookiesForContext = parseCookies(normalizedCookie);
    } else if (cookieFile) {
        try {
            const { cookieHeader, cookies, absolutePath } = await loadCookiesFromJsonFile(cookieFile);
            normalizedCookie = cookieHeader.trim();
            cookiesForContext = cookies;
            console.log(chalk.gray(`🍪 已从 ${absolutePath} 导入 Cookie`));
        } catch (error) {
            console.error(chalk.red(`❌ 读取 Cookie JSON 失败: ${error.message}`));
            process.exit(1);
        }
    }

    globalCookieHeader = normalizedCookie;

    // 设置 cookies
    await context.addCookies(cookiesForContext);
    await updateGlobalCookieHeaderFromContext(context);
    context.on('response', (response) => {
        try {
            const headers = response.headers();
            if (headers && headers['set-cookie']) {
                updateGlobalCookieHeaderFromContext(context);
            }
        } catch {
            // ignore
        }
    });

    // 确保所有极客时间域名的请求都携带原始Cookie串，避免Playwright丢失关键字段
    await context.route('**/*', (route) => {
        const request = route.request();
        let url;
        try {
            url = new URL(request.url());
        } catch {
            return route.continue();
        }

        const hostname = url.hostname || '';
        const isGeekbangDomain =
            hostname === 'geekbang.org' ||
            hostname.endsWith('.geekbang.org');

        if (!isGeekbangDomain) {
            return route.continue();
        }

        const headers = {
            ...request.headers()
        };
        const outgoingCookieHeader = globalCookieHeader || normalizedCookie;
        if (outgoingCookieHeader) {
            headers.cookie = outgoingCookieHeader;
        }
        route.continue({ headers });
    });

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
                !r.success && r.error && /timeout/i.test(r.error)
            ).length;
            const authIssueCount = results.filter(r =>
                !r.success && r.error && /(Cookie|登录|登陆|订阅|权限|试看|购买)/i.test(r.error)
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
            } else if (authIssueCount > 0) {
                console.log(chalk.yellow('⚠️  检测到登录或权限相关异常\n'));
                console.log(chalk.gray('  1. 在浏览器中重新登录极客时间，进入该专栏任意文章'));
                console.log(chalk.gray('  2. 复制最新的 Cookie（或重新导出 cookies.json）'));
                console.log(chalk.gray('  3. 使用新的 --cookie 或 --cookie-file 参数后重试\n'));
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
                !r.success && r.error && /timeout/i.test(r.error)
            ).length;
            const authIssueCount = contentResults.filter(r =>
                !r.success && r.error && /(Cookie|登录|登陆|订阅|权限|试看|购买)/i.test(r.error)
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
            } else if (authIssueCount > 0) {
                console.log(chalk.yellow('⚠️  检测到登录/权限问题，建议步骤：\n'));
                console.log(chalk.gray('  1. 浏览器重新登录极客时间并打开该专栏文章'));
                console.log(chalk.gray('  2. 重新复制最新 Cookie 或导出 cookies.json'));
                console.log(chalk.gray('  3. 更新 --cookie 或 --cookie-file 后再次执行\n'));
            }

            // 生成 EPUB
            if (successCount > 0) {
                const hasImageContent = contentResults.some(result =>
                    result && result.success && typeof result.content === 'string' && result.content.includes('<img')
                );

                let processedContent = contentResults;
                let tempAssetsDir = null;

                try {
                    if (hasImageContent) {
                        tempAssetsDir = await createTempAssetsDir(outputDir);
                        processedContent = await rewriteEpubContentImages(context, contentResults, tempAssetsDir);
                    }

                    const epubPath = await generateEPUB(
                        outputDir,
                        columnTitle,
                        columnAuthor,
                        articlesToDownload,
                        processedContent
                    );
                    if (epubPath) {
                        console.log(chalk.green(`\n✅ EPUB 生成完成: ${epubPath}\n`));
                    }
                } finally {
                    if (tempAssetsDir) {
                        await cleanupTempAssetsDir(tempAssetsDir);
                    }
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
        try {
            await persistCookiesToFile(context, cookieSavePath);
        } catch {
            // ignore
        }
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
    .version(version)
    .option('-u, --url <url>', '专栏文章URL（任意一篇）')
    .option('-c, --cookie <cookie>', 'Cookie字符串（用于认证）')
    .option('--cookie-file <path>', '从 JSON 文件导入 Cookie（如 chrome 扩展导出的 cookies.json）')
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
