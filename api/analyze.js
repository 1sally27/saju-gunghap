module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "환경 변수(GEMINI_API_KEY)가 서버에 등록되지 않았습니다." });
  }

  try {
    const { pillarsList } = req.body;
    
    // 기본 fetch 사용
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: `너는 전문가야. ${JSON.stringify(pillarsList)} 데이터를 분석해줘.` }] }] 
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (error) {
    return res.status(500).json({ error: "AI 서버 통신 중 오류가 발생했습니다." });
  }
};
