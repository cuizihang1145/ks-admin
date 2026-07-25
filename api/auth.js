const failedAttempts = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (failedAttempts[ip] && failedAttempts[ip].lockedUntil > now) {
    const remaining = Math.ceil((failedAttempts[ip].lockedUntil - now) / 60000);
    return res.status(429).json({
      error: '尝试次数过多，请 ' + remaining + ' 分钟后重试'
    });
  }

  const inviteCode = req.headers['x-invite-code'] || '';
  const password = req.headers['x-admin-password'] || '';
  const mathAnswer = parseInt(req.headers['x-math-answer']) || 0;
  const mathExpected = parseInt(req.headers['x-math-expected']) || 0;

  const validInvite = inviteCode === (process.env.INVITE_CODE || '').trim();
  const validPassword = password === (process.env.ADMIN_PASSWORD || '').trim();
  const validMath = mathAnswer === mathExpected;

  if (!validMath) {
    return res.status(400).json({ error: '数学题答错了' });
  }

  if (!validInvite || !validPassword) {
    if (!failedAttempts[ip]) {
      failedAttempts[ip] = { count: 0, lockedUntil: 0 };
    }
    failedAttempts[ip].count++;
    if (failedAttempts[ip].count >= 5) {
      failedAttempts[ip].lockedUntil = Date.now() + 15 * 60 * 1000;
      return res.status(429).json({
        error: '尝试次数过多，请 15 分钟后重试'
      });
    }
    return res.status(401).json({ error: '验证失败' });
  }

  delete failedAttempts[ip];
  return res.status(200).json({ success: true });
}
