import { readFile, writeFile, checkAuth } from './utils.js';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
  try {
    // ===== CSRF 防护：校验 Referer =====
    const referer = req.headers.referer || '';
    const allowedDomains = ['admin.cuizi.top', 'cuizi.top', 'localhost'];
    let isAllowed = false;
    for (const domain of allowedDomains) {
      if (referer.includes(domain)) {
        isAllowed = true;
        break;
      }
    }
    if (!isAllowed) {
      return res.status(403).json({ error: '请求来源不合法' });
    }

    if (!checkAuth(req)) {
      return res.status(401).json({ error: '密码错误' });
    }

    const result = await readFile(MAIN_REPO, 'wenzhang.json');
    const posts = result.data;
    const sha = result.sha;

    // ===== GET =====
    if (req.method === 'GET') {
      return res.status(200).json(posts);
    }

    // ===== POST（新建） =====
    if (req.method === 'POST') {
      const { title, content, tags, date } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: '标题和内容不能为空' });
      }
      const now = date || new Date().toISOString().slice(0, 10);
      posts.announcements.push({
        title: title.trim(),
        date: now,
        tags: tags || [],
        delete: false,
        content: content
      });
      await writeFile(MAIN_REPO, 'wenzhang.json', posts, sha, `发布文章：${title.trim()}`);
      return res.status(200).json({ success: true, message: '发布成功', id: posts.announcements.length - 1 });
    }

    // ===== PUT（编辑 / 硬删除） =====
    if (req.method === 'PUT') {
      // ✅ 关键修复：同时兼容前端的 items 和 articles
      const { id, title, content, tags, date, hardDelete, articles, items } = req.body;
      
      // 统一成 targetItems
      const targetItems = articles || items;

      // 1️⃣ 如果是硬删除（直接替换整个数组，根本不检查 id）
      if (hardDelete && targetItems) {
        await writeFile(MAIN_REPO, 'wenzhang.json', { announcements: targetItems }, sha, '硬删除文章');
        return res.status(200).json({ success: true, message: '已硬删除' });
      }

      // 2️⃣ 如果不是硬删除，走编辑或软删除（这时才需要检查 id）
      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= posts.announcements.length) {
        return res.status(400).json({ error: '文章不存在' });
      }
      
      const article = posts.announcements[idx];
      if (title !== undefined) article.title = title.trim();
      if (content !== undefined) article.content = content;
      if (tags !== undefined) article.tags = tags;
      if (date !== undefined && date) article.date = date;
      await writeFile(MAIN_REPO, 'wenzhang.json', posts, sha, `编辑文章：${article.title}`);
      return res.status(200).json({ success: true, message: '保存成功' });
    }

    // ===== DELETE（软删除 / 恢复） =====
    if (req.method === 'DELETE') {
      const { id, restore } = req.body;
      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= posts.announcements.length) {
        return res.status(400).json({ error: '文章不存在' });
      }
      const article = posts.announcements[idx];
      article.delete = restore ? false : true;
      await writeFile(MAIN_REPO, 'wenzhang.json', posts, sha, `${restore ? '恢复' : '删除'}文章：${article.title}`);
      return res.status(200).json({ success: true, message: restore ? '已恢复' : '已删除' });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
