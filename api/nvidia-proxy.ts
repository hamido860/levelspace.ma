import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS for browser
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "") || process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
  if (!apiKey || apiKey === "MY_NVIDIA_API_KEY") {
    return res.status(503).json({ error: "NVIDIA API key not configured." });
  }

  try {
    const response = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    return res.status(response.status).json(response.data);
  } catch (err: any) {
    const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message;
    console.error("[NVIDIA Proxy] Error:", msg);
    return res.status(err?.response?.status || 502).json(err?.response?.data || { error: `NVIDIA API error: ${msg}` });
  }
}
