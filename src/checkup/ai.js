import Anthropic from "@anthropic-ai/sdk";
import { ITEMS } from "./catalog";

const MODEL = "claude-opus-5-5";

// The API key is entered by the user and kept in this browser's localStorage.
// That is fine for a single-person app; never ship a key inside the bundle.
function client(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileBlock(file) {
  const data = await fileToBase64(file);
  if (file.type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  const mediaType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string", description: "표준 항목 key, 해당 없으면 \"other\"" },
    name: { type: "string", description: "결과지에 적힌 항목명" },
    value: { type: "string", description: "결과값. 숫자 항목은 숫자만 (예: \"104\"), 정성 항목은 결과 그대로 (예: \"음성\")" },
    unit: { type: "string" },
    ref_range: { type: "string", description: "결과지에 적힌 참고치, 없으면 빈 문자열" },
  },
  required: ["key", "name", "value", "unit", "ref_range"],
  additionalProperties: false,
};

const FINDING_SCHEMA = {
  type: "object",
  properties: {
    area: { type: "string", description: "검사 이름 (예: 상복부초음파, 관상동맥 CT, 요추 X선, 종합소견)" },
    text: { type: "string", description: "소견 내용을 한국어로 간결하게" },
  },
  required: ["area", "text"],
  additionalProperties: false,
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    exams: {
      type: "array",
      description: "검사일별로 하나씩",
      items: {
        type: "object",
        properties: {
          exam_date: { type: "string", description: "검사일 YYYY-MM-DD. 모르면 빈 문자열" },
          hospital: { type: "string", description: "검사 기관명. 모르면 빈 문자열" },
          items: { type: "array", items: ITEM_SCHEMA },
          findings: { type: "array", items: FINDING_SCHEMA },
        },
        required: ["exam_date", "hospital", "items", "findings"],
        additionalProperties: false,
      },
    },
  },
  required: ["exams"],
  additionalProperties: false,
};

const catalogText = ITEMS.map(
  (i) => `- ${i.key}: ${i.name}${i.unit ? ` [${i.unit}]` : ""}${i.aliases.length ? ` (별칭: ${i.aliases.join(", ")})` : ""}`
).join("\n");

const EXTRACTION_PROMPT = `첨부한 건강검진·검사 결과지에서 결과를 모두 뽑아 주세요.

검사일별로 나누기:
- 결과지에 여러 검사일의 값이 나란히 있으면(예: 2026/06/19, 2025/08/19, 2024/07/19 열) 검사일마다 exams 항목을 하나씩 만들고, 각 날짜의 값을 그 항목에 넣으세요.
- 사진이나 파일이 여러 장이고 검사일이 서로 다르면(예: CT 검사일과 혈액검사 시행일) 역시 날짜별로 나누세요. 검사일은 처방일·시행일·검사일시를 쓰고, 출력일이나 판독일은 쓰지 마세요.

수치 항목(items):
아래 표준 항목 중 하나에 해당하면 그 key를 쓰고, 해당하지 않는 검사는 key를 "other"로 두세요.
${catalogText}

- 표준 항목의 단위와 결과지 단위가 다르면 표준 단위로 환산한 값과 표준 단위를 쓰세요. 결과지 단위 표기가 명백히 잘못된 경우(예: eGFR이 mg/dL로 적힘)는 표준 단위를 쓰면 됩니다.
- 같은 검사가 직접 측정값과 계산값으로 둘 다 있으면(예: LDL Cholesterol과 LDL C(계산값)) 직접 측정값을 표준 항목에 넣고, 계산값은 "other"로 두세요.
- 혈압이 "120/80"처럼 함께 적혀 있으면 sbp와 dbp로 나눠 주세요.
- 판정 문구(정상A, 정상B, 질환의심 등)와 문진 답변은 항목으로 넣지 마세요. 읽을 수 없거나 비어 있는 값도 넣지 마세요.

소견(findings):
- 초음파, 내시경, X선, CT, 심전도 같은 영상·기능 검사 결과와 의사 종합소견 중 이상이 있거나 추적 관찰이 필요한 내용을 검사별로 한 줄씩 간결하게 적으세요. 수치·크기·부위(예: 간 우엽 결절 6mm, pLCX 중등도 협착)는 빠뜨리지 마세요.
- 이미 items에 들어간 수치를 되풀이하는 소견(예: "콜레스테롤이 높습니다")이나 단순히 "정상"인 검사는 넣지 마세요.
- 이름, 주민번호, 주소, 연락처 같은 개인정보는 어디에도 넣지 마세요.`;

function guardRefusal(message) {
  if (message.stop_reason === "refusal") {
    throw new Error("요청이 처리되지 않았어요. 잠시 후 다시 시도해 주세요.");
  }
}

function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return new Error("API 키가 올바르지 않아요. 설정에서 키를 확인해 주세요.");
  if (e instanceof Anthropic.RateLimitError) return new Error("요청이 많아요. 잠시 후 다시 시도해 주세요.");
  if (e instanceof Anthropic.BadRequestError) {
    return new Error(
      /pdf|document/i.test(e.message)
        ? "PDF를 읽지 못했어요. 암호가 걸린 PDF라면 암호를 풀어서 다시 저장한 뒤 올려 주세요."
        : `요청 오류: ${e.message}`
    );
  }
  if (e instanceof Anthropic.APIConnectionError) return new Error("네트워크에 연결할 수 없어요.");
  if (e instanceof Anthropic.APIError) return new Error(`API 오류 (${e.status}): ${e.message}`);
  return e;
}

// Reads checkup PDFs or photos and returns { exams: [{ exam_date, hospital,
// items: [{ key, name, value, unit, ref_range }], findings: [{ area, text }] }] },
// one entry per test date found in the files.
export async function extractCheckup(apiKey, files) {
  try {
    const blocks = await Promise.all(files.map(fileBlock));
    const message = await client(apiKey)
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
        messages: [{ role: "user", content: [...blocks, { type: "text", text: EXTRACTION_PROMPT }] }],
      })
      .finalMessage();
    guardRefusal(message);
    if (message.stop_reason === "max_tokens") throw new Error("결과지가 너무 길어요. 페이지를 나눠서 올려 주세요.");
    const text = message.content.find((b) => b.type === "text")?.text;
    return JSON.parse(text);
  } catch (e) {
    throw friendlyError(e);
  }
}

const SUMMARY_PROMPT = `아래는 한 사람의 연도별 건강검진 수치와 검사 소견입니다.

{history}

이 사람이 직접 읽을 건강 리포트를 한국어로 써 주세요.
1. 전체 요약 (2~3문장)
2. 신경 써야 할 항목: 수치가 범위를 벗어났거나 해마다 나빠지는 항목을 중요한 순서대로. 정상 범위 안이라도 꾸준히 나빠지는 흐름이 있으면 짚어 주세요.
3. 좋아진 항목
4. 생활에서 해볼 것: 위 항목과 직접 연결되는 구체적인 행동 몇 가지
5. 다음 진료·검진 때 물어볼 것

진단을 내리지 말고, 걱정되는 부분은 의사와 상담하도록 안내해 주세요. 마크다운 기호(#, *, |) 없이 번호와 줄바꿈만 써 주세요.`;

export async function summarizeHistory(apiKey, historyText) {
  try {
    const message = await client(apiKey)
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        messages: [{ role: "user", content: SUMMARY_PROMPT.replace("{history}", historyText) }],
      })
      .finalMessage();
    guardRefusal(message);
    return message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  } catch (e) {
    throw friendlyError(e);
  }
}
