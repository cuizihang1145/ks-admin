import { readFile, writeFile, checkAuth } from './utils.js';
import { neon } from '@neondatabase/serverless';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
  try {
    console.log('===== friends.js 统一入口 =====');

    const sql = neon(process.env.DATABASE_URL);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

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

    const result = await readFile(MAIN_REPO, 'youlian.json');
    const friends = result.data;
    const sha = result.sha;

    const { action, id, name, url, desc, logo, feed, reason, email } = req.body;

    if (req.method === 'GET') {
      const type = req.query?.type || '';
      if (type === 'pending') {
        const rows = await sql`SELECT * FROM friend_applications ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
      return res.status(200).json(friends);
    }

    if (req.method === 'POST') {
      if (action === 'approve') {
        if (!id) return res.status(400).json({ error: '缺少申请ID' });
        const rows = await sql`SELECT * FROM friend_applications WHERE id = ${id}`;
        if (rows.length === 0) return res.status(404).json({ error: '申请不存在' });
        const app = rows[0];
        friends.push({
          name: app.site_name,
          url: app.site_url,
          desc: app.site_desc || '',
          logo: app.logo_url || '',
          feed: app.feed_url || ''
        });
        await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `通过友链申请：${app.site_name}`);
        return res.status(200).json({ success: true, message: '已通过审核' });
      }

      if (action === 'reject') {
        if (!id) return res.status(400).json({ error: '缺少申请ID' });
        await sql`DELETE FROM friend_applications WHERE id = ${id}`;
        return res.status(200).json({ success: true, message: '已打回' });
      }

      if (action === 'update') {
        if (!id) return res.status(400).json({ error: '缺少申请ID' });
        if (!name || !url || !desc) {
          return res.status(400).json({ error: '名称、链接、简介为必填' });
        }
        await sql`
          UPDATE friend_applications 
          SET site_name = ${name}, 
              site_url = ${url}, 
              site_desc = ${desc}, 
              logo_url = ${logo || ''}, 
              feed_url = ${feed || ''}, 
              apply_reason = ${reason || ''}, 
              contact_email = ${email || ''}
          WHERE id = ${id}
        `;
        return res.status(200).json({ success: true, message: '已更新' });
      }

      if (!action || action === 'add') {
        if (!name || !url || !desc) {
          return res.status(400).json({ error: '名称、链接、简介不能为空' });
        }
        friends.push({
          name: name.trim(),
          url: url.trim(),
          desc: desc.trim(),
          logo: logo?.trim() || '',
          feed: feed?.trim() || ''
        });
        await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `添加友链：${name.trim()}`);
        return res.status(200).json({ success: true, message: '添加成功' });
      }

      return res.status(400).json({ error: '未知 action: ' + action });
    }

    if (req.method === 'PUT') {
      const idx = parseInt(id);
      if (isNaN(idx) || idx < 0 || idx >= friends.length) {
        return res.status(400).json({ error: '友链不存在' });
      }
      const item = friends[idx];
      if (name !== undefined) item.name = name.trim();
      if (url !== undefined) item.url = url.trim();
      if (desc !== undefined) item.desc = desc.trim();
      if (logo !== undefined) item.logo = logo.trim();
      if (feed !== undefined) item.feed = feed.trim();
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `编辑友链：${item.name}`);
      return res.status(200).json({ success: true, message: '编辑成功' });
    }

    if (req.method === 'DELETE') {
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
