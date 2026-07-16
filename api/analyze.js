// api/analyze.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const { names, pillarsList } = req.body;
  
  const prompt = `너는 전문가야. ${JSON.stringify(pillarsList)} 데이터를 분석해줘.`;

  try {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await aiRes.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'AI 분석 실패' });
  }
};
