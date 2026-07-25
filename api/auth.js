import { checkAuth } from './utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }
  const valid = checkAuth(req);
  if (valid) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
}
