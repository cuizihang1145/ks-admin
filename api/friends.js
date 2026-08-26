// 这个文件的唯一作用：让 Vercel 构建日志显示它被识别为 Serverless Function
export default function handler(req) {
    return new Response(JSON.stringify({
        status: 'ok',
        timestamp: Date.now(),
        message: '如果看到这条消息，说明函数已成功部署并执行'
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}