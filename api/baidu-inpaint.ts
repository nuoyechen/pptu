import type { VercelRequest, VercelResponse } from '@vercel/node';

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_INPAINT_URL = 'https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 服务端请使用 BAIDU_AK / BAIDU_SK（VITE_ 前缀的变量可能仅用于客户端构建）
  const apiKey = process.env.BAIDU_AK || process.env.VITE_BAIDU_AK;
  const secretKey = process.env.BAIDU_SK || process.env.VITE_BAIDU_SK;

  if (!apiKey || !secretKey) {
    return res.status(500).json({
      error_code: 'CONFIG_ERROR',
      error_msg: '请在 Vercel 项目设置 → Environment Variables 中添加 BAIDU_AK 和 BAIDU_SK，保存后重新部署',
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
    // 1. 获取 Access Token（百度支持 GET 和 POST，GET 在某些环境下更稳定）
    const tokenUrl = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const tokenText = await tokenRes.text();
    let tokenData: Record<string, unknown>;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error('Baidu token response (non-JSON):', tokenText.slice(0, 200));
      return res.status(502).json({
        error_code: 'TOKEN_FAILED',
        error_msg: `Token 接口返回异常 (${tokenRes.status})。请确认 Vercel 已配置环境变量 BAIDU_AK 和 BAIDU_SK，并重新部署。`,
      });
    }

    if (!tokenRes.ok || tokenData.error) {
      const msg = (tokenData.error_description as string) || (tokenData.error as string) || tokenText;
      return res.status(502).json({
        error_code: (tokenData.error as string) || 'TOKEN_FAILED',
        error_msg: `Token 获取失败: ${msg}。请检查 API Key 和 Secret Key 是否正确。`,
      });
    }

    const accessToken = tokenData.access_token as string | undefined;
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
