import { readFile, writeFile, checkAuth } from './utils.js';
import { neon } from '@neondatabase/serverless';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';

export default async function handler(req, res) {
    console.log('===== friends.js 开始 =====');

    const sql = neon(process.env.DATABASE_URL);

    // ===== 在最开始就读一次文件，拿到 data 和 sha =====
    let result, friends, sha;
    try {
        result = await readFile(MAIN_REPO, 'youlian.json');
        friends = result.data;
        sha = result.sha;
        console.log('✅ 读取 youlian.json 成功，共', friends.length, '条');
    } catch (err) {
        console.error('❌ 读取 youlian.json 失败:', err);
        return res.status(500).json({ error: '读取 youlian.json 失败: ' + err.message });
    }

    // 后续所有操作都用这个 friends 和 sha，不再重新读

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

    if (method === 'OPTIONS') {
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
        return res.status(403).json({ error: '请求来源不合法' });
    }

    if (!checkAuth(req)) {
        return res.status(401).json({ error: '未授权' });
    }

    // ===== 通过审核 =====
    if (pathname === '/api/friends/approve' && method === 'POST') {
        try {
            const { id } = req.body;
            const result = await sql`SELECT * FROM friend_applications WHERE id = ${id}`;
            if (result.length === 0) {
                return res.status(404).json({ error: '申请不存在' });
            }
            const app = result[0];
            const newItem = {
                name: app.site_name,
                url: app.site_url,
                desc: app.site_desc || '',
                logo: app.logo_url || '',
                feed: app.feed_url || ''
            };
            friends.push(newItem);
            await writeFile(MAIN_REPO, 'youlian.json', friends, sha, `通过友链申请：${app.site_name}`);
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            return res.status(200).json({ success: true, message: '已通过审核' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== 打回 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/').pop());
            if (isNaN(id)) {
                return res.status(400).json({ error: '无效ID' });
            }
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            return res.status(200).json({ success: true, message: '已打回' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== 修改待审核 =====
    if (pathname.startsWith('/api/friends/pending/') && method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/').pop());
            if (isNaN(id)) {
                return res.status(400).json({ error: '无效ID' });
            }
            const { name, url, desc, logo, feed, reason, email } = req.body;
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
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }

    // ===== GET =====
    if (method === 'GET') {
        const type = url.searchParams.get('type');
        if (type === 'pending') {
            try {
                const rows = await sql`SELECT * FROM friend_applications ORDER BY created_at DESC`;
                return res.status(200).json(rows);
            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
        }
        return res.status(200).json(friends);
    }

    // ===== POST =====
    if (method === 'POST') {
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

    // ===== DELETE =====
    if (method === 'DELETE') {
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
}