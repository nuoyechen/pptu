import type { VercelRequest, VercelResponse } from '@vercel/node';

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_INPAINT_URL = 'https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.VITE_BAIDU_AK || process.env.BAIDU_AK;
  const secretKey = process.env.VITE_BAIDU_SK || process.env.BAIDU_SK;

  if (!apiKey || !secretKey) {
    return res.status(500).json({
      error_code: 'CONFIG_ERROR',
      error_msg: '请在 Vercel 项目设置中配置 VITE_BAIDU_AK 和 VITE_BAIDU_SK 环境变量',
    });
  }

  const { image, rectangle } = req.body as { image?: string; rectangle?: unknown[] };
  if (!image || !rectangle || !Array.isArray(rectangle)) {
    return res.status(400).json({
      error_code: 'INVALID_REQUEST',
      error_msg: '缺少 image 或 rectangle 参数',
    });
  }

  try {
    // 1. 获取 Access Token
    const tokenRes = await fetch(
      `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
      { method: 'POST' }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Baidu token error:', errText);
      return res.status(502).json({
        error_code: 'TOKEN_FAILED',
        error_msg: 'Failed to get Baidu Access Token. 请检查 API Key 和 Secret Key 是否正确。',
      });
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(502).json({
        error_code: tokenData.error,
        error_msg: tokenData.error_description || 'Token 获取失败',
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(502).json({
        error_code: 'TOKEN_FAILED',
        error_msg: '未返回 access_token',
      });
    }

    // 2. 调用图像修复 API
    const inpaintRes = await fetch(
      `${BAIDU_INPAINT_URL}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json',
        },
        body: JSON.stringify({ image, rectangle }),
      }
    );

    const result = await inpaintRes.json();

    if (result.error_code) {
      return res.status(502).json({
        error_code: result.error_code,
        error_msg: result.error_msg || '图像修复失败',
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Baidu inpaint error:', err);
    return res.status(500).json({
      error_code: 'INTERNAL_ERROR',
      error_msg: err instanceof Error ? err.message : '服务器内部错误',
    });
  }
}
