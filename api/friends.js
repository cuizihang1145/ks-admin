import { readFile, writeFile, checkAuth } from './utils.js';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
  try {
    // CSRF 防护：校验 Referer
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
      return res.status(401).json({ error: '未授权' });
    }

    // 读取 youlian.json（直接是数组）
    const result = await readFile(MAIN_REPO, 'youlian.json');
    const friends = result.data; // 数组
    const sha = result.sha;

    // GET：获取所有友链
    if (req.method === 'GET') {
      return res.status(200).json(friends);
    }

    // POST：新增友链
    if (req.method === 'POST') {
      const { name, url, desc, logo, feed } = req.body;
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: '名称不能为空' });
      }
      if (!url || url.trim() === '') {
        return res.status(400).json({ error: '链接不能为空' });
      }
      if (!desc || desc.trim() === '') {
        return res.status(400).json({ error: '简介不能为空' });
      }
      const newItem = {
        name: name.trim(),
        url: url.trim(),
        desc: desc.trim(),
        logo: logo?.trim() || '',
        feed: feed?.trim() || ''
      };
      friends.push(newItem);
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `添加友链：${newItem.name}`);
      return res.status(200).json({ success: true, message: '添加成功' });
    }

    // DELETE：删除友链（按索引）
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= friends.length) {
        return res.status(400).json({ error: '友链不存在' });
      }
      const deleted = friends[idx];
      friends.splice(idx, 1);
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `删除友链：${deleted.name}`);
      return res.status(200).json({ success: true, message: '删除成功' });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
