import { readFile, writeFile, checkAuth } from './utils.js';

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: '密码错误' });
  }

  const { data: posts, sha } = await readFile('wenzhang.json');

  if (req.method === 'GET') {
    return res.status(200).json(posts);
  }

  if (req.method === 'POST') {
    const { title, content, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }
    const now = new Date().toISOString().slice(0, 10);
    posts.announcements.push({
      title: title.trim(),
      date: now,
      tags: tags || [],
      delete: false,
      content: content
    });
    await writeFile('wenzhang.json', posts, sha, `发布文章：${title.trim()}`);
    return res.status(200).json({ success: true, message: '发布成功', id: posts.announcements.length - 1 });
  }

  if (req.method === 'PUT') {
    const { id, title, content, tags, date } = req.body;
    const idx = parseInt(id);
    if (isNaN(idx) || idx < 0 || idx >= posts.announcements.length) {
      return res.status(400).json({ error: '文章不存在' });
    }
    const article = posts.announcements[idx];
    if (title !== undefined) article.title = title.trim();
    if (content !== undefined) article.content = content;
    if (tags !== undefined) article.tags = tags;
    if (date !== undefined) article.date = date;
    await writeFile('wenzhang.json', posts, sha, `编辑文章：${article.title}`);
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
    await writeFile('wenzhang.json', posts, sha, `${restore ? '恢复' : '删除'}文章：${article.title}`);
    return res.status(200).json({ success: true, message: restore ? '已恢复' : '已删除' });
  }

  return res.status(405).json({ error: '方法不允许' });
}
