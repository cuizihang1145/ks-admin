import { readFile, writeFile, checkAuth } from './utils.js';
import { neon } from '@neondatabase/serverless';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
  try {
    console.log('===== 🚀 friends.js 开始执行 =====');
    console.log('📌 请求方法:', req.method);
    console.log('📌 请求路径:', req.url);
    console.log('📌 请求体:', req.body);

    const sql = neon(process.env.DATABASE_URL);
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

    if (method === 'OPTIONS') {
      console.log('✅ OPTIONS 请求，返回 204');
      return res.status(204).end();
    }

    // 来源校验
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
      console.log('❌ 来源不合法:', referer);
      return res.status(403).json({ error: '请求来源不合法' });
    }
    console.log('✅ 来源校验通过');

    if (!checkAuth(req)) {
      console.log('❌ 未授权');
      return res.status(401).json({ error: '密码错误' });
    }
    console.log('✅ 授权校验通过');

    // ===== 读取文件 =====
    console.log('📖 开始读取 youlian.json...');
    const result = await readFile(MAIN_REPO, 'youlian.json');
    const friends = result.data;
    const sha = result.sha;
    console.log('✅ youlian.json 读取成功，共', friends.length, '条');

    console.log('🔍 路径解析:', pathname);
    console.log('🔍 方法解析:', method);

    // ===== 路由1：通过审核 =====
    if (pathname === '/api/friends/approve' && method === 'POST') {
      console.log('📍 匹配到【通过审核】路由');
      const { id } = req.body;
      console.log('📌 申请ID:', id);
      if (!id) {
        console.log('❌ 缺少申请ID');
        return res.status(400).json({ error: '缺少申请ID' });
      }
      const rows = await sql`SELECT * FROM friend_applications WHERE id = ${id}`;
      if (rows.length === 0) {
        console.log('❌ 申请不存在');
        return res.status(404).json({ error: '申请不存在' });
      }
      const app = rows[0];
      console.log('📌 申请数据:', app);
      friends.push({
        name: app.site_name,
        url: app.site_url,
        desc: app.site_desc || '',
        logo: app.logo_url || '',
        feed: app.feed_url || ''
      });
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `通过友链申请：${app.site_name}`);
      await sql`DELETE FROM friend_applications WHERE id = ${id}`;
      console.log('✅ 通过审核成功');
      return res.status(200).json({ success: true, message: '已通过审核' });
    }

    // ===== 路由2：打回 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'DELETE') {
      console.log('📍 匹配到【打回】路由');
      const id = parseInt(pathname.split('/').pop());
      console.log('📌 打回ID:', id);
      if (isNaN(id)) {
        console.log('❌ 无效ID');
        return res.status(400).json({ error: '无效ID' });
      }
      await sql`DELETE FROM friend_applications WHERE id = ${id}`;
      console.log('✅ 打回成功');
      return res.status(200).json({ success: true, message: '已打回' });
    }

    // ===== 路由3：修改待审核 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'PUT') {
      console.log('📍 匹配到【修改待审核】路由');
      const id = parseInt(pathname.split('/').pop());
      console.log('📌 修改ID:', id);
      if (isNaN(id)) {
        console.log('❌ 无效ID');
        return res.status(400).json({ error: '无效ID' });
      }
      const { name, url, desc, logo, feed, reason, email } = req.body;
      console.log('📌 修改数据:', { name, url, desc, logo, feed, reason, email });
      if (!name || !url || !desc) {
        console.log('❌ 必填字段缺失');
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
      console.log('✅ 修改待审核成功');
      return res.status(200).json({ success: true, message: '已更新' });
    }

    // ===== 路由4：GET =====
    if (method === 'GET') {
      console.log('📍 匹配到【GET】路由');
      const type = url.searchParams.get('type');
      if (type === 'pending') {
        console.log('📍 GET 待审核列表');
        const rows = await sql`SELECT * FROM friend_applications ORDER BY created_at DESC`;
        console.log('✅ 返回待审核列表，共', rows.length, '条');
        return res.status(200).json(rows);
      }
      console.log('✅ 返回已有友链，共', friends.length, '条');
      return res.status(200).json(friends);
    }

    // ===== 路由5：POST =====
    if (method === 'POST') {
      console.log('📍 匹配到【POST】路由（新增友链）');
      const { name, url, desc, logo, feed } = req.body;
      console.log('📌 新增数据:', { name, url, desc, logo, feed });
      if (!name || !url || !desc) {
        console.log('❌ 必填字段缺失');
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
      console.log('✅ 新增友链成功');
      return res.status(200).json({ success: true, message: '添加成功' });
    }

    // ===== 路由6：DELETE（删除已有友链） =====
    if (method === 'DELETE') {
      console.log('📍 匹配到【DELETE】路由（删除已有友链）');
      const { id } = req.body;
      const idx = parseInt(id);
      console.log('📌 删除索引:', idx);
      if (isNaN(idx) || idx < 0 || idx >= friends.length) {
        console.log('❌ 友链不存在');
        return res.status(400).json({ error: '友链不存在' });
      }
      const deleted = friends[idx];
      friends.splice(idx, 1);
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `删除友链：${deleted.name}`);
      console.log('✅ 删除友链成功');
      return res.status(200).json({ success: true, message: '删除成功' });
    }

    // ===== 路由7：PUT（编辑已有友链） =====
    if (method === 'PUT') {
      console.log('📍 匹配到【PUT】路由（编辑已有友链）');
      const { id, name, url, desc, logo, feed } = req.body;
      const idx = parseInt(id);
      console.log('📌 编辑索引:', idx);
      console.log('📌 编辑数据:', { name, url, desc, logo, feed });
      if (isNaN(idx) || idx < 0 || idx >= friends.length) {
        console.log('❌ 友链不存在');
        return res.status(400).json({ error: '友链不存在' });
      }
      const item = friends[idx];
      if (name !== undefined) item.name = name.trim();
      if (url !== undefined) item.url = url.trim();
      if (desc !== undefined) item.desc = desc.trim();
      if (logo !== undefined) item.logo = logo.trim();
      if (feed !== undefined) item.feed = feed.trim();
      await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `编辑友链：${item.name}`);
      console.log('✅ 编辑友链成功');
      return res.status(200).json({ success: true, message: '编辑成功' });
    }

    console.log('❌ 未匹配到任何路由，返回 405');
    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('❌ 全局错误:', error.message);
    console.error('❌ 错误堆栈:', error.stack);
    return res.status(500).json({ error: error.message });
  }
}