// api/index.js (이 코드를 복사하세요)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const { names, pillarsList } = req.body;
  
  // (중략: 서버 로직 그대로 활용)
  const prompt = `너는 전문가야. ${JSON.stringify(pillarsList)} 데이터를 분석해줘.`;

  const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  
  const data = await aiRes.json();
  res.json(data);
});

module.exports = app;
