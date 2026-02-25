
export default async function handler(req, res) {
  // Allow CORS for local testing if needed, but Vercel handles same-origin automatically
  // res.setHeader('Access-Control-Allow-Origin', '*');

  const { type } = req.query; // 'token' or 'inpainting'

  // Get Env Vars (Securely on server side)
  const AK = process.env.VITE_BAIDU_AK;
  const SK = process.env.VITE_BAIDU_SK;

  if (!AK || !SK) {
    return res.status(500).json({ error: 'Missing Baidu Cloud API Keys configuration' });
  }

  try {
    if (type === 'token') {
      const tokenRes = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`, {
        method: 'POST'
      });
      const data = await tokenRes.json();
      return res.status(200).json(data);
    } 
    
    else if (type === 'inpainting') {
      const { access_token } = req.query;
      
      // Proxy the POST body (image & rectangle) directly to Baidu
      // Note: req.body in Vercel functions is already parsed if it's JSON, 
      // but Baidu expects x-www-form-urlencoded. 
      // However, our frontend sends x-www-form-urlencoded string.
      // If req.body is an object, we need to convert it back to string or forward it correctly.
      
      // Let's handle the forwarding carefully.
      // We will read the raw body or just forward what we got.
      
      const response = await fetch(`https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting?access_token=${access_token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: req.body // Vercel might parse this. If frontend sends string, it might be string.
      });

      const data = await response.json();
      
      if (data.error_code) {
        return res.status(400).json(data);
      }
      return res.status(200).json(data);
    }

    return res.status(404).json({ error: 'Invalid type' });

  } catch (error) {
    console.error('Baidu Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
