import { readFile, writeFile, checkAuth } from './utils.js';

const ADMIN_REPO = 'cuizihang1145/ks-admin';

export default async function handler(req, res) {
  try {
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

    let drafts, sha;
    try {
      const result = await readFile(ADMIN_REPO, 'draft.json');
      drafts = result.data;
      sha = result.sha;
    } catch {
      drafts = { drafts: [] };
      sha = null;
    }

    if (req.method === 'GET') {
      return res.status(200).json(drafts);
    }

    if (req.method === 'POST') {
      const { id, title, content, tags, date, location, type, name, url, desc, logo, feed } = req.body;

      if (id) {
        const idx = drafts.drafts.findIndex(d => d.id === id);
        if (idx === -1) return res.status(404).json({ error: '草稿不存在' });

        const draft = drafts.drafts[idx];
        if (draft.type === 'friend') {
          if (name !== undefined) draft.name = name;
          if (url !== undefined) draft.url = url;
          if (desc !== undefined) draft.desc = desc;
          if (logo !== undefined) draft.logo = logo;
          if (feed !== undefined) draft.feed = feed;
        } else {
          if (title !== undefined) draft.title = title;
          if (content !== undefined) draft.content = content;
          if (tags !== undefined) draft.tags = tags;
          if (date !== undefined) draft.date = date;
          if (location !== undefined) draft.location = location;
          if (type !== undefined) draft.type = type;
        }
        draft.updated = new Date().toISOString();
      } else {
        if (type === 'friend') {
          if (!name || name.trim() === '') {
            return res.status(400).json({ error: '名称不能为空' });
          }
          if (!url || url.trim() === '') {
            return res.status(400).json({ error: '链接不能为空' });
          }
          if (!desc || desc.trim() === '') {
            return res.status(400).json({ error: '简介不能为空' });
          }
          drafts.drafts.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: 'friend',
            name: name.trim(),
            url: url.trim(),
            desc: desc.trim(),
            logo: logo?.trim() || '',
            feed: feed?.trim() || '',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          });
        } else {
          drafts.drafts.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title: title || '无标题',
            content: content || '',
            tags: tags || [],
            date: date || '',
            location: location || '',
            type: type || 'article',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          });
        }
      }

      await writeFile(ADMIN_REPO, 'draft.json', drafts, sha, '保存草稿');
      return res.status(200).json({ success: true, drafts });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      drafts.drafts = drafts.drafts.filter(d => d.id !== id);
      await writeFile(ADMIN_REPO, 'draft.json', drafts, sha, '删除草稿');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
