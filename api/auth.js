const failedAttempts = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // 检查是否被锁定
  if (failedAttempts[ip] && failedAttempts[ip].lockedUntil > now) {
    const remaining = Math.ceil((failedAttempts[ip].lockedUntil - now) / 60000);
    return res.status(429).json({
      error: '尝试次数过多，请 ' + remaining + ' 分钟后重试'
    });
  }

  const pwd = req.headers['x-admin-password'];
  const valid = pwd === process.env.ADMIN_PASSWORD;

  if (!valid) {
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
    return res.status(401).json({ error: '密码错误' });
  }

  // 登录成功，重置失败计数
  delete failedAttempts[ip];
  return res.status(200).json({ success: true });
      }
