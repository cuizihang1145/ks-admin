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

    // 读取 shuoshuo.json（直接是数组，不是 { announcements: [...] }）
    const result = await readFile(MAIN_REPO, 'shuoshuo.json');
    const shuoshuo = result.data; // 数组
    const sha = result.sha;

    // ===== GET：获取所有说说 =====
    if (req.method === 'GET') {
      return res.status(200).json(shuoshuo);
    }

    // ===== POST：新增说说 =====
    if (req.method === 'POST') {
      const { content, tags, location, date } = req.body;
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: '内容不能为空' });
      }
      const now = date || new Date().toISOString().slice(0, 10);
      const newItem = {
        date: now,
        location: location || '',
        tags: tags || [],
        delete: false,
        content: content.trim()
      };
      shuoshuo.push(newItem); // ？傻逼ai 在最前面id不都自动变成0然后窜评论了吗 气死我了
      await writeFile(MAIN_REPO, 'shuoshuo.json', shuoshuo, sha, `发布说说：${content.trim().slice(0, 20)}...`);
      return res.status(200).json({ success: true, message: '发布成功', id: 0 });
    }

    // ===== PUT：更新说说 / 硬删除 =====
    if (req.method === 'PUT') {
      const { id, content, tags, location, date, hardDelete, items } = req.body;

      // 硬删除：直接替换整个数组
      if (hardDelete && items) {
        await writeFile(MAIN_REPO, 'shuoshuo.json', items, sha, '硬删除说说');
        return res.status(200).json({ success: true, message: '已硬删除' });
      }

      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= shuoshuo.length) {
        return res.status(400).json({ error: '说说不存在' });
      }
      const item = shuoshuo[idx];
      if (content !== undefined) item.content = content.trim();
      if (tags !== undefined) item.tags = tags;
      if (location !== undefined) item.location = location;
      if (date !== undefined && date) item.date = date;
      await writeFile(MAIN_REPO, 'shuoshuo.json', shuoshuo, sha, `编辑说说：${item.content.slice(0, 20)}...`);
      return res.status(200).json({ success: true, message: '保存成功' });
    }

    // ===== DELETE：软删除 / 恢复 =====
    if (req.method === 'DELETE') {
      const { id, restore } = req.body;
      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= shuoshuo.length) {
        return res.status(400).json({ error: '说说不存在' });
      }
      const item = shuoshuo[idx];
      item.delete = restore ? false : true;
      await writeFile(MAIN_REPO, 'shuoshuo.json', shuoshuo, sha, `${restore ? '恢复' : '删除'}说说：${item.content.slice(0, 20)}...`);
      return res.status(200).json({ success: true, message: restore ? '已恢复' : '已删除' });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
