module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 1. 환경 변수에서 키를 가져오되, 없으면 undefined로 처리
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "환경 변수 GEMINI_API_KEY를 찾을 수 없습니다." });
  }

  try {
    const { pillarsList } = req.body;
    const prompt = `너는 전문가야. ${JSON.stringify(pillarsList)} 데이터를 분석해줘.`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await aiRes.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: '서버 분석 실패' });
  }
};
