const TOKEN = process.env.TOKEN;
const REPO = process.env.REPO || 'cuizihang1145/cuizihang1145.github.io';
const BRANCH = 'main';

export async function readFile(path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, 'User-Agent': 'ks-admin' }
  });
  if (!res.ok) throw new Error(`读取 ${path} 失败: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: data.sha };
}

export async function writeFile(path, jsonData, sha, commitMsg = '更新文件') {
  const content = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ks-admin'
    },
    body: JSON.stringify({
      message: commitMsg,
      content,
      sha,
      branch: BRANCH
    })
  });
  if (!res.ok) throw new Error(`写入 ${path} 失败: ${res.status}`);
  return await res.json();
}

export function checkAuth(req) {
  const password = req.headers['x-admin-password'];
  return password === process.env.ADMIN_PASSWORD;
      }
