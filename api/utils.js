// api/utils.js
const crypto = require('crypto');

const TOKEN = process.env.TOKEN;
const MAIN_REPO = 'cuizihang1145/cuizihang1145.github.io';
const ADMIN_REPO = 'cuizihang1145/ks-admin';
const BRANCH = 'main';

export async function readFile(repo, path) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: { 
      Authorization: `token ${TOKEN}`, 
      'User-Agent': 'ks-admin',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) {
    throw new Error(`读取 ${path} 失败: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: data.sha };
}

export async function writeFile(repo, path, jsonData, sha, commitMsg = '更新文件') {
  const content = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ks-admin',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: commitMsg,
      content,
      sha,
      branch: BRANCH
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`写入 ${path} 失败: ${res.status} ${res.statusText} - ${errText}`);
  }
  return await res.json();
}

// ===== 验证 Token（带签名校验） =====
function verifyToken(token) {
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    
    const payloadBase64 = parts[0];
    const signature = parts[1];
    
    // 验证签名
    const secret = process.env.TOKEN_SECRET || 'ks-admin-secret-key-change-me';
    const expected = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
    if (signature !== expected) return false;
    
    // 验证过期时间
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    if (payload.authenticated !== true) return false;
    if (payload.exp < Date.now()) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

// ===== 验证：支持 Token + 密码两种方式 =====
export function checkAuth(req) {
  // 1. 先检查带签名的 Token
  const token = req.headers['x-admin-token'] || '';
  if (token && verifyToken(token)) {
    return true;
  }

  // 2. 再检查密码（兼容旧方式）
  const password = req.headers['x-admin-password'];
  return password === process.env.ADMIN_PASSWORD;
}
