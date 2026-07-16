const GAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const JI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

const CATEGORY_DEFS = [
  { title: "평소에", icon: "常" },
  { title: "밥 먹을 때", icon: "食" },
  { title: "여행 갈 때", icon: "旅" },
  { title: "대화할 때", icon: "話" },
  { title: "서로의 속마음", icon: "心" },
  { title: "일할 때", icon: "事" },
  { title: "세상이 종말을 맞았을 때", icon: "末" },
];
이걸지우세요
function safeJsonBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function isValidPillar(pillar) {
  const parts = [pillar?.year, pillar?.month, pillar?.day, pillar?.hour];
  return parts.every(
    (part) =>
      Number.isInteger(part?.gan) &&
      part.gan >= 0 &&
      part.gan < 10 &&
      Number.isInteger(part?.ji) &&
      part.ji >= 0 &&
      part.ji < 12
  );
}

function pillarToText(pillar) {
  const format = (part) => `${GAN[part.gan]}${JI[part.ji]}`;
  return {
    year: format(pillar.year),
    month: format(pillar.month),
    day: format(pillar.day),
    hour: format(pillar.hour),
    dayStem: GAN[pillar.day.gan],
  };
}

function categorySchema() {
  return {
    type: "array",
    minItems: CATEGORY_DEFS.length,
    maxItems: CATEGORY_DEFS.length,
    items: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "상황별 관계를 재치 있게 압축한 짧은 한줄 제목",
        },
        detail: {
          type: "string",
          description: "관계의 장점, 충돌 가능성, 현실적인 팁을 담은 2~3문장",
        },
      },
      required: ["summary", "detail"],
      additionalProperties: false,
    },
  };
}

function makeResponseSchema(mode, memberCount) {
  if (mode === "pair") {
    return {
      type: "object",
      properties: {
        relLabel: {
          type: "string",
          description: "두 사람 관계의 핵심을 짧게 요약한 문구",
        },
        categories: categorySchema(),
      },
      required: ["relLabel", "categories"],
      additionalProperties: false,
    };
  }

  return {
    type: "object",
    properties: {
      group: {
        type: "object",
        properties: {
          roles: {
            type: "array",
            minItems: memberCount,
            maxItems: memberCount,
            items: {
              type: "object",
              properties: {
                tag: {
                  type: "string",
                  description: "관계 속 역할을 짧게 나타낸 태그",
                },
              },
              required: ["tag"],
              additionalProperties: false,
            },
          },
          summary: {
            type: "string",
            description: "전체 무리의 케미를 짧게 요약한 문구",
          },
          detail: {
            type: "string",
            description: "전체 관계의 장점, 주의점, 잘 지내는 법을 2~3문장으로 설명",
          },
        },
        required: ["roles", "summary", "detail"],
        additionalProperties: false,
      },
      groupCategories: categorySchema(),
    },
    required: ["group", "groupCategories"],
    additionalProperties: false,
  };
}

function normalizeCategories(categories) {
  const source = Array.isArray(categories) ? categories : [];

  return CATEGORY_DEFS.map((definition, index) => {
    const item = source[index] && typeof source[index] === "object"
      ? source[index]
      : {};

    return {
      icon: definition.icon,
      title: definition.title,
      summary: String(item.summary || "이 관계의 케미를 한마디로 정리했어요."),
      detail: String(item.detail || "상세 분석 내용을 충분히 생성하지 못했습니다."),
    };
  });
}

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(text) {
  const cleaned = stripCodeFence(text);
  if (!cleaned) return "";

  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    return cleaned.slice(firstObject, lastObject + 1);
  }

  const firstArray = cleaned.indexOf("[");
  const lastArray = cleaned.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    return cleaned.slice(firstArray, lastArray + 1);
  }

  return cleaned;
}

function parseModelJson(text) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const candidate = extractJsonCandidate(cleaned);
    if (candidate && candidate !== cleaned) {
      return JSON.parse(candidate);
    }
    throw firstError;
  }
}

function extractInteractionText(data) {
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  return steps
    .filter((step) => step?.type === "model_output")
    .flatMap((step) => (Array.isArray(step?.content) ? step.content : []))
    .filter((content) => content?.type === "text" && typeof content?.text === "string")
    .map((content) => content.text)
    .join("")
    .trim();
}

async function requestGemini({ apiKey, model, prompt, responseSchema, signal }) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal,
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
        generation_config: {
          thinking_level: "minimal",
          thinking_summaries: "none",
          temperature: 1.0,
          max_output_tokens: 5000,
        },
      }),
    }
  );

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { response, data, rawText: text };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 사용할 수 있습니다." });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Vercel 환경 변수 GEMINI_API_KEY가 등록되지 않았습니다.",
    });
  }

  try {
    const body = safeJsonBody(req.body);
    const names = Array.isArray(body.names)
      ? body.names.map((name, index) => String(name || `멤버 ${index + 1}`).trim())
      : [];
    const pillarsList = Array.isArray(body.pillarsList) ? body.pillarsList : [];
    const sinsalList = Array.isArray(body.sinsalList) ? body.sinsalList : [];

    if (pillarsList.length < 2 || !pillarsList.every(isValidPillar)) {
      return res.status(400).json({
        error: "사주 원국 데이터가 올바르지 않습니다. 두 명 이상의 정상 데이터를 보내주세요.",
      });
    }

    const safeNames = pillarsList.map(
      (_, index) => names[index] || (index === 0 ? "나" : `친구${index}`)
    );
    const mode = pillarsList.length === 2 ? "pair" : "group";
    const readablePillars = pillarsList.map(pillarToText);
    const responseSchema = makeResponseSchema(mode, pillarsList.length);

    const prompt = `
너는 한국어 사주 궁합 콘텐츠 작가다.
아래 원국은 이미 계산된 값이므로 다시 계산하거나 바꾸지 마라.
사주는 오락과 자기이해용으로 풀고 미래를 단정하거나 공포를 조장하지 마라.
관계의 강점, 갈등 가능성, 현실적인 조율법을 균형 있게 써라.

분석 모드: ${mode === "pair" ? "2인 궁합" : `${pillarsList.length}인 그룹 궁합`}
이름 순서: ${JSON.stringify(safeNames)}
사주 원국: ${JSON.stringify(readablePillars)}
주요 신살: ${JSON.stringify(sinsalList)}

카테고리 배열은 반드시 다음 순서로 정확히 7개 작성한다.
1. 평소에
2. 밥 먹을 때
3. 여행 갈 때
4. 대화할 때
5. 서로의 속마음
6. 일할 때
7. 세상이 종말을 맞았을 때

각 배열 항목에는 summary와 detail만 작성한다.
summary는 관계에 맞춘 재치 있고 눈에 띄는 한줄 제목이다.
detail은 누가 어떤 역할을 하는지, 잘 맞는 점과 부딪힐 점, 현실적인 팁을 2~3문장으로 쓴다.
마지막 항목은 실제 예언이 아니라 재난 영화 속 역할극처럼 유쾌하게 쓴다.
${mode === "group" ? `roles는 이름 순서대로 정확히 ${safeNames.length}개 작성한다.` : ""}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let apiResult;
    try {
      apiResult = await requestGemini({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        prompt,
        responseSchema,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const { response, data, rawText } = apiResult;

    if (!response.ok) {
      console.error("Gemini Interactions API 오류:", data || rawText);
      const googleMessage = data?.error?.message;
      return res.status(502).json({
        error: googleMessage
          ? `Gemini API 오류: ${googleMessage}`
          : `Gemini API 호출에 실패했습니다. (${response.status})`,
      });
    }

    if (data?.status && data.status !== "completed") {
      console.error("Gemini 응답 미완료:", data);
      const statusMessage = data.status === "incomplete" || data.status === "budget_exceeded"
        ? "Gemini 출력이 길이 제한에 걸렸습니다. 다시 시도해주세요."
        : `Gemini 분석이 완료되지 않았습니다. (${data.status})`;
      return res.status(502).json({ error: statusMessage });
    }

    const modelText = extractInteractionText(data);
    if (!modelText) {
      console.error("Gemini model_output 텍스트 없음:", data);
      return res.status(502).json({
        error: "Gemini가 분석 결과를 반환하지 않았습니다. 다시 시도해주세요.",
      });
    }

    let analysis;
    try {
      analysis = parseModelJson(modelText);
    } catch (parseError) {
      console.error("Gemini JSON 파싱 실패", {
        parseError: parseError?.message,
        status: data?.status,
        usage: data?.usage,
        modelText,
      });
      return res.status(502).json({
        error: "Gemini가 불완전한 분석 결과를 반환했습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    if (mode === "pair") {
      return res.status(200).json({
        names: safeNames,
        pillarsList,
        mode,
        relLabel: String(analysis?.relLabel || "두 사람의 관계를 분석했어요"),
        categories: normalizeCategories(analysis?.categories),
      });
    }

    const roles = Array.isArray(analysis?.group?.roles)
      ? analysis.group.roles.slice(0, safeNames.length).map((role) => ({
          tag: String(role?.tag || "멤버"),
        }))
      : [];

    while (roles.length < safeNames.length) roles.push({ tag: "멤버" });

    return res.status(200).json({
      names: safeNames,
      pillarsList,
      mode,
      group: {
        roles,
        summary: String(analysis?.group?.summary || "우리 무리의 관계를 분석했어요"),
        detail: String(
          analysis?.group?.detail || "항목별 결과에서 관계의 특징을 확인해주세요."
        ),
      },
      groupCategories: normalizeCategories(analysis?.groupCategories),
    });
  } catch (error) {
    console.error("analyze 함수 오류:", error);

    if (error?.name === "AbortError") {
      return res.status(504).json({
        error: "Gemini 응답 시간이 너무 오래 걸려 요청을 종료했습니다. 다시 시도해주세요.",
      });
    }

    return res.status(500).json({
      error: "AI 서버 통신 중 오류가 발생했습니다.",
    });
  }
};
