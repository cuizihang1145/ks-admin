import { checkAuth } from './utils.js';
import { neon } from '@neondatabase/serverless';

const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';
const sql = neon(process.env.DATABASE_URL);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

async function readYoulian() {
    const url = `https://raw.githubusercontent.com/${MAIN_REPO}/main/youlian.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('读取 youlian.json 失败');
    return await resp.json();
}

async function writeYoulian(data) {
    // 通过主站 API 写入
    const resp = await fetch('https://www.cuizi.top/api/youlian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
    });
    if (!resp.ok) throw new Error('写入 youlian.json 失败');
    return resp.json();
}

export default async function handler(req) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);
    const pathname = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
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
        return json({ error: '请求来源不合法' }, 403);
    }

    if (!checkAuth(req)) {
        return json({ error: '未授权' }, 401);
    }

    if (pathname === '/api/friends/approve' && method === 'POST') {
        try {
            const { id } = await req.json();
            const result = await sql`SELECT * FROM friend_applications WHERE id = ${id}`;
            if (result.length === 0) {
                return json({ error: '申请不存在' }, 404);
            }
            const app = result[0];
            const friends = await readYoulian();
            const newItem = {
                name: app.site_name,
                url: app.site_url,
                desc: app.site_desc || '',
                logo: app.logo_url || '',
                feed: app.feed_url || ''
            };
            friends.push(newItem);
            await writeYoulian(friends);
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            return json({ success: true, message: '已通过审核' });
        } catch (err) {
            console.error(err);
            return json({ error: err.message }, 500);
        }
    }

    if (pathname.startsWith('/api/friends/pending/') && method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/').pop());
            if (isNaN(id)) {
                return json({ error: '无效ID' }, 400);
            }
            await sql`DELETE FROM friend_applications WHERE id = ${id}`;
            return json({ success: true, message: '已打回' });
        } catch (err) {
            console.error(err);
            return json({ error: err.message }, 500);
        }
    }

    if (pathname.startsWith('/api/friends/pending/') && method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/').pop());
            if (isNaN(id)) {
                return json({ error: '无效ID' }, 400);
            }
            const { name, url, desc, logo, feed, reason, email } = await req.json();
            if (!name || !url || !desc) {
                return json({ error: '名称、链接、简介为必填' }, 400);
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
            return json({ success: true, message: '已更新' });
        } catch (err) {
            console.error(err);
            return json({ error: err.message }, 500);
        }
    }

    const friends = await readYoulian();

    if (method === 'GET') {
        const type = url.searchParams.get('type');
        if (type === 'pending') {
            try {
                const rows = await sql`SELECT * FROM friend_applications ORDER BY created_at DESC`;
                return json(rows);
            } catch (err) {
                console.error(err);
                return json({ error: err.message }, 500);
            }
        }
        return json(friends);
    }

    if (method === 'POST') {
        const { name, url, desc, logo, feed } = await req.json();
        if (!name || name.trim() === '') {
            return json({ error: '名称不能为空' }, 400);
        }
        if (!url || url.trim() === '') {
            return json({ error: '链接不能为空' }, 400);
        }
        if (!desc || desc.trim() === '') {
            return json({ error: '简介不能为空' }, 400);
        }
        const newItem = {
            name: name.trim(),
            url: url.trim(),
            desc: desc.trim(),
            logo: logo?.trim() || '',
            feed: feed?.trim() || ''
        };
        friends.push(newItem);
        await writeYoulian(friends);
        return json({ success: true, message: '添加成功' });
    }

    if (method === 'DELETE') {
        const { id } = await req.json();
        const idx = parseInt(id);
        if (isNaN(idx) || idx < 0 || idx >= friends.length) {
            return json({ error: '友链不存在' }, 400);
        }
        const deleted = friends[idx];
        friends.splice(idx, 1);
        await writeYoulian(friends);
        return json({ success: true, message: `删除友链：${deleted.name}` });
    }

    return json({ error: '方法不允许' }, 405);
}