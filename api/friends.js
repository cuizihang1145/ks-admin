export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        message: '函数运行正常，可以正常访问了'
    });
}