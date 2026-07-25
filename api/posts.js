import { readFile, writeFile, checkAuth } from './utils.js';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
  try {
    if (!checkAuth(req)) {
      return res.status(401).json({ error: '密码错误' });
    }

    const result = await readFile(MAIN_REPO, 'wenzhang.json');
    const posts = result.data;
    const sha = result.sha;

    if (req.method === 'GET') {
      return res.status(200).json(posts);
    }

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

    if (req.method === 'PUT') {
      const { id, title, content, tags, date, hardDelete, articles } = req.body;
      
      // 硬删除：直接用前端传过来的新数组覆盖
      if (hardDelete && articles) {
        await writeFile(MAIN_REPO, 'wenzhang.json', { announcements: articles }, sha, '硬删除文章');
        return res.status(200).json({ success: true, message: '已硬删除' });
      }
      
      // 普通编辑
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
