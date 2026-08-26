import { neon } from '@neondatabase/serverless';
import { readFile, writeFile, checkAuth } from './utils.js';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
    console.log('========================================');
    console.log('📥 收到请求:', req.method, req.url);
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));

    const sql = neon(process.env.DATABASE_URL);

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);
    const pathname = url.pathname;
    const method = req.method;

    console.log('🔍 解析后 pathname:', pathname);
    console.log('🔍 解析后 method:', method);

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

    if (method === 'OPTIONS') {
        console.log('✅ OPTIONS 请求，返回 204');
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
        console.log('❌ 来源不合法:', referer);
        return res.status(403).json({ error: '请求来源不合法' });
    }
    console.log('✅ 来源校验通过');

    if (!checkAuth(req)) {
        console.log('❌ 未授权');
        return res.status(401).json({ error: '未授权' });
    }
    console.log('✅ 授权校验通过');

    // 读 youlian.json
    async function readYoulian() {
        console.log('📖 开始读取 youlian.json...');
        const result = await readFile(MAIN_REPO, 'youlian.json');
        console.log('✅ youlian.json 读取成功，共', result.data.length, '条');
        return result.data;
    }

    async function writeYoulian(data, msg) {
        console.log('✏️ 开始写入 youlian.json:', msg);
        const result = await readFile(MAIN_REPO, 'youlian.json');
        await writeFile(MAIN_REPO, 'youlian.json', data, result.sha, msg);
        console.log('✅ youlian.json 写入成功');
    }

    // ===== 路由1：通过审核 =====
    if (pathname === '/api/friends/approve' && method === 'POST') {
        console.log('📍 匹配到【通过审核】路由');
        try {
            const { id } = req.body;
            console.log('📌 申请ID:', id);
            const result = await sql`SELECT * FROM friend_applications WHERE id = ${id}`;
            if (result.length === 0) {
                console.log('❌ 申请不存在');
                return res.status(404).json({ error: '申请不存在' });
            }
            const app = result[0];
            console.log('📌 申请数据:', app);
            const friends = await readYoulian();
            const newItem = {
                name: app.site_name,
                url: app.site_url,
                desc: app.site_desc || '',
                logo: app.logo_url || '',
                feed: app.feed_url || ''
            };
            friends.push(newItem);
            await writeYoulian(friends, `通过友链申请：${app.site_name}`);
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            console.log('✅ 通过审核成功');
            return res.status(200).json({ success: true, message: '已通过审核' });
        } catch (err) {
            console.error('❌ 通过审核失败:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== 路由2：打回 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'DELETE') {
        console.log('📍 匹配到【打回】路由');
        try {
            const id = parseInt(pathname.split('/').pop());
            console.log('📌 打回ID:', id);
            if (isNaN(id)) {
                console.log('❌ 无效ID');
                return res.status(400).json({ error: '无效ID' });
            }
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            console.log('✅ 打回成功');
            return res.status(200).json({ success: true, message: '已打回' });
        } catch (err) {
            console.error('❌ 打回失败:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== 路由3：修改待审核 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'PUT') {
        console.log('📍 匹配到【修改待审核】路由');
        try {
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
        } catch (err) {
            console.error('❌ 修改待审核失败:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== 路由4：其他请求（GET / POST / DELETE） =====
    console.log('📍 进入主路由（GET/POST/DELETE）');
    try {
        const friends = await readYoulian();

        if (method === 'GET') {
            console.log('📍 GET 请求');
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

        if (method === 'POST') {
            console.log('📍 POST 请求（新增友链）');
            const { name, url, desc, logo, feed } = req.body;
            console.log('📌 新增数据:', { name, url, desc, logo, feed });
            if (!name || name.trim() === '') {
                console.log('❌ 名称不能为空');
                return res.status(400).json({ error: '名称不能为空' });
            }
            if (!url || url.trim() === '') {
                console.log('❌ 链接不能为空');
                return res.status(400).json({ error: '链接不能为空' });
            }
            if (!desc || desc.trim() === '') {
                console.log('❌ 简介不能为空');
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
            await writeYoulian(friends, `添加友链：${newItem.name}`);
            console.log('✅ 新增友链成功');
            return res.status(200).json({ success: true, message: '添加成功' });
        }

        if (method === 'DELETE') {
            console.log('📍 DELETE 请求（删除友链）');
            const { id } = req.body;
            const idx = parseInt(id);
            console.log('📌 删除索引:', idx);
            if (isNaN(idx) || idx < 0 || idx >= friends.length) {
                console.log('❌ 友链不存在');
                return res.status(400).json({ error: '友链不存在' });
            }
            const deleted = friends[idx];
            friends.splice(idx, 1);
            await writeYoulian(friends, `删除友链：${deleted.name}`);
            console.log('✅ 删除友链成功');
            return res.status(200).json({ success: true, message: '删除成功' });
        }

        console.log('❌ 方法不允许:', method);
        return res.status(405).json({ error: '方法不允许' });
    } catch (err) {
        console.error('❌ 主路由异常:', err);
        return res.status(500).json({ error: err.message });
    }
}