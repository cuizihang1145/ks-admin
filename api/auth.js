// api/auth.js
const crypto = require('crypto');
const failedAttempts = {};
const mathSessions = {};

function generateMathQuestion() {
  let a, b, answer, op, question;
  const operators = ['+', '-'];

  do {
    a = Math.floor(Math.random() * 89) + 10;
    b = Math.floor(Math.random() * 89) + 10;
    op = operators[Math.floor(Math.random() * operators.length)];

    if (op === '+') {
      answer = a + b;
      if (answer > 99) {
        a = Math.floor(Math.random() * (99 - 10 - b)) + 10;
        answer = a + b;
      }
      question = a + ' + ' + b + ' = ?';
    } else {
      if (a < b) {
        var temp = a;
        a = b;
        b = temp;
      }
      if (a === b) {
        b = a - Math.floor(Math.random() * 20) - 1;
        if (b < 10) b = 10;
        if (a <= b) { a = b + Math.floor(Math.random() * 20) + 5; }
      }
      answer = a - b;
      question = a + ' - ' + b + ' = ?';
    }
  } while (answer < 10 || answer > 99 || a === b || b === 0 || a === 0);

  return { question, answer };
}

function generateToken(payload) {
  const secret = process.env.TOKEN_SECRET || 'ks-admin-secret-key-change-me';
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
  return payloadBase64 + '.' + signature;
}

export default async function handler(req, res) {
  // GET：获取数学题
  if (req.method === 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const { question, answer } = generateMathQuestion();
    mathSessions[ip] = {
      answer: answer,
      expires: Date.now() + 5 * 60 * 1000
    };
    return res.status(200).json({ question: question });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // 后端限流
  if (failedAttempts[ip] && failedAttempts[ip].lockedUntil > now) {
    const remaining = Math.ceil((failedAttempts[ip].lockedUntil - now) / 60000);
    return res.status(429).json({
      error: '尝试次数过多，请 ' + remaining + ' 分钟后重试'
    });
  }

  // CSRF 防护
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

  const inviteCode = req.headers['x-invite-code'] || '';
  const password = req.headers['x-admin-password'] || '';
  const userAnswer = parseInt(req.headers['x-math-answer']) || 0;

  const mathSession = mathSessions[ip];
  let validMath = false;
  if (mathSession && mathSession.expires > Date.now()) {
    validMath = userAnswer === mathSession.answer;
  }
  delete mathSessions[ip];

  if (!validMath) {
    return res.status(400).json({ error: '数学题答错了或已过期，请刷新重试' });
  }

  const validInvite = inviteCode === (process.env.INVITE_CODE || '').trim();
  const validPassword = password === (process.env.ADMIN_PASSWORD || '').trim();

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

  // 生成带签名的 Token
  const token = generateToken({
    authenticated: true,
    exp: Date.now() + 24 * 60 * 60 * 1000
  });

  return res.status(200).json({ success: true, token: token });
            }
