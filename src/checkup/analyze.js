import { ITEMS, ITEM_BY_KEY } from "./catalog";

// exam: { id, date: "YYYY-MM-DD", hospital, values: { [key]: number | string }, others: [{ name, value, unit, ref }] }

export const STATUS_LABEL = { normal: "정상", caution: "주의", abnormal: "이상" };

function band(spec, sex) {
  if (!spec) return null;
  return Array.isArray(spec) ? spec : spec[sex === "F" ? "F" : "M"];
}

function inBand([lo, hi], v) {
  return (lo === null || v >= lo) && (hi === null || v <= hi);
}

export function rangeText(item, sex) {
  if (item.rangeLabel) return typeof item.rangeLabel === "string" ? item.rangeLabel : band(item.rangeLabel, sex);
  const n = band(item.normal, sex);
  if (!n) return "";
  const [lo, hi] = n;
  if (lo !== null && hi !== null) return `${lo}~${hi}`;
  if (hi !== null) return `${hi} 이하`;
  return `${lo} 이상`;
}

export function statusOf(item, value, sex) {
  if (item.qualitative) {
    if (typeof value !== "string" || !value.trim()) return null;
    return /양성|\+|positive/i.test(value) && !/음성|negative/i.test(value) ? "caution" : "normal";
  }
  if (item.info || typeof value !== "number" || Number.isNaN(value)) return null;
  if (inBand(band(item.normal, sex), value)) return "normal";
  if (inBand(band(item.caution, sex), value)) return "caution";
  return "abnormal";
}

export function sortedExams(exams) {
  return [...exams].sort((a, b) => a.date.localeCompare(b.date));
}

export function seriesOf(exams, key) {
  return sortedExams(exams)
    .filter((e) => e.values && e.values[key] !== undefined && e.values[key] !== "")
    .map((e) => ({ date: e.date, year: e.date.slice(0, 4), value: e.values[key] }));
}

// How "bad" a value is along the item's bad direction; larger = worse. Used to
// tell whether a change between two checkups is an improvement or not.
function badness(item, v, sex) {
  if (item.bad === "high") return v;
  if (item.bad === "low") return -v;
  const [lo, hi] = band(item.normal, sex);
  return Math.abs(v - (lo + hi) / 2);
}

function stepDirection(item, prev, next, sex) {
  const scale = Math.max(Math.abs(prev), 1e-6);
  if (Math.abs(next - prev) < scale * 0.02) return "flat";
  return badness(item, next, sex) > badness(item, prev, sex) ? "worse" : "better";
}

export function trendOf(item, series, sex) {
  const nums = series.filter((p) => typeof p.value === "number");
  if (item.info || item.qualitative || nums.length < 2) return null;
  const last = nums[nums.length - 1].value;
  const prev = nums[nums.length - 2].value;
  let worseStreak = 0;
  for (let i = nums.length - 1; i > 0; i--) {
    if (stepDirection(item, nums[i - 1].value, nums[i].value, sex) !== "worse") break;
    worseStreak++;
  }
  return { last, prev, delta: last - prev, direction: stepDirection(item, prev, last, sex), worseStreak };
}

// Normal now, but within 10% of the normal band's edge on the bad side.
function nearLimit(item, value, sex) {
  const n = band(item.normal, sex);
  if (!n || typeof value !== "number") return false;
  const [lo, hi] = n;
  const margin = (edge) => Math.abs(edge) * 0.1 || 0.1;
  if ((item.bad === "high" || item.bad === "both") && hi !== null && value > hi - margin(hi)) return true;
  if ((item.bad === "low" || item.bad === "both") && lo !== null && value < lo + margin(lo)) return true;
  return false;
}

function fmt(v) {
  return typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
}

// Tests are not all repeated every time (a coronary CT, a hospital blood test
// between annual checkups), so an item's latest value still counts if it was
// measured within this window of the most recent record. Older values are
// history, not the current state.
const RECENT_DAYS = 548;

function isRecent(date, latestDate) {
  return (new Date(latestDate) - new Date(date)) / 86400000 <= RECENT_DAYS;
}

function currentValues(exams) {
  const sorted = sortedExams(exams);
  const latestDate = sorted.at(-1).date;
  const values = {};
  for (const e of sorted) {
    if (!isRecent(e.date, latestDate)) continue;
    Object.assign(values, e.values);
  }
  return values;
}

// "a~b", "a-b", "0-" (lower bound only) as printed on the report.
export function parseRefRange(ref) {
  const m = String(ref || "").replace(/,/g, "").match(/^\s*(-?\d+(?:\.\d+)?)\s*[~\-–]\s*(-?\d+(?:\.\d+)?)?\s*$/);
  if (!m) return null;
  const lo = parseFloat(m[1]);
  const hi = m[2] !== undefined ? parseFloat(m[2]) : null;
  // Placeholder ranges like "0~0" carry no information.
  if (hi !== null && hi <= lo) return null;
  return [lo, hi];
}

// Non-catalog tests are judged against the reference range printed on the
// report itself, so things like a CPK spike are not silently ignored.
function otherConcerns(exams, latestDate) {
  const byName = new Map();
  for (const e of sortedExams(exams)) {
    for (const o of e.others || []) {
      if (!byName.has(o.name)) byName.set(o.name, []);
      byName.get(o.name).push({ date: e.date, ...o });
    }
  }
  const out = [];
  for (const [name, points] of byName) {
    const last = points.at(-1);
    if (!isRecent(last.date, latestDate)) continue;
    const range = parseRefRange(last.ref);
    const v = parseFloat(String(last.value).replace(/,/g, ""));
    if (!range || Number.isNaN(v)) continue;
    const [lo, hi] = range;
    const high = hi !== null && v > hi;
    const low = v < lo;
    if (!high && !low) continue;
    const far = high ? v > hi * 2 : v < lo / 2;
    out.push({
      key: `other:${name}`,
      score: far ? 2.5 : 1.2,
      status: far ? "abnormal" : "caution",
      title: `${name} ${last.value}${last.unit ? ` ${last.unit}` : ""}`,
      detail: `결과지 참고치(${last.ref})보다 ${high ? "높아요" : "낮아요"}`,
      history: points.length > 1 ? points.slice(-4).map((p) => p.value).join(" → ") : null,
    });
  }
  return out;
}

function hasCoronaryCalcium(exams) {
  return seriesOf(exams, "cac").some((p) => typeof p.value === "number" && p.value > 0);
}

// Imaging/endoscopy/doctor's findings, newest first.
export function allFindings(exams) {
  return sortedExams(exams)
    .reverse()
    .flatMap((e) => (e.findings || []).map((f) => ({ date: e.date, ...f })));
}

// Items worth paying attention to, most important first.
export function findConcerns(exams, sex) {
  if (!exams.length) return [];
  const latest = sortedExams(exams).at(-1);
  const out = [];

  for (const item of ITEMS) {
    const series = seriesOf(exams, item.key);
    if (!series.length) continue;
    const current = series.at(-1);
    if (!isRecent(current.date, latest.date)) continue;
    const status = statusOf(item, current.value, sex);
    if (!status) continue;
    const trend = trendOf(item, series, sex);
    const unit = item.unit ? ` ${item.unit}` : "";
    const history = series.slice(-4).map((p) => fmt(p.value)).join(" → ");

    let score = 0;
    const reasons = [];
    const normalText = rangeText(item, sex) ? ` (정상 ${rangeText(item, sex)})` : "";
    if (status === "abnormal") { score += 3; reasons.push(`${STATUS_LABEL.abnormal} 범위입니다${normalText}`); }
    if (status === "caution") { score += 2; reasons.push(item.qualitative ? "양성으로 나왔어요" : `${STATUS_LABEL.caution} 범위입니다${normalText}`); }
    if (status !== "normal") score += item.weight || 0;
    let outStreak = 0;
    for (let i = series.length - 1; i >= 0 && statusOf(item, series[i].value, sex) !== "normal"; i--) outStreak++;
    if (outStreak >= 2 && trend?.direction !== "better") { score += 1; reasons.push(`${outStreak}회 연속 범위 밖`); }
    const near = status === "normal" && nearLimit(item, current.value, sex);
    if (trend && trend.worseStreak >= 2) { score += 1.5; reasons.push(`최근 ${trend.worseStreak}회 연속 나빠지고 있어요`); }
    else if (trend && trend.direction === "worse") { score += 0.5; reasons.push("지난 검진보다 나빠졌어요"); }
    if (near && trend && trend.direction === "worse") {
      score += 1;
      reasons.push("아직 정상이지만 경계에 가까워지고 있어요");
    }
    // Coronary calcification usually means a stricter LDL goal than the general
    // screening cut-off, so an LDL that is "only" borderline matters more here.
    const ldlWithCalcium = item.key === "ldl" && typeof current.value === "number" && current.value >= 100 && hasCoronaryCalcium(exams);
    if (ldlWithCalcium) {
      score += 1.5;
      reasons.push("관상동맥 석회화가 있으면 LDL 목표를 보통 더 낮게(100 미만 등) 잡아요. 목표치는 의사와 상의하세요");
    }
    // Within the normal range, only a sustained slide is worth flagging: either
    // three worse checkups in a row, or two in a row that reach the boundary.
    if (status === "normal" && !ldlWithCalcium && !(trend && (trend.worseStreak >= 3 || (trend.worseStreak >= 2 && near)))) continue;

    out.push({
      key: item.key,
      score,
      status,
      title: `${item.name} ${fmt(current.value)}${unit}`,
      detail: reasons.join(" · "),
      history: series.length > 1 ? history : null,
      tip: item.tip,
    });
  }

  out.push(...otherConcerns(exams, latest.date));

  const ms = metabolicSyndrome({ values: currentValues(exams) }, sex);
  if (ms && ms.count >= 3) {
    out.push({
      key: "metabolic",
      score: 5,
      status: "abnormal",
      title: `대사증후군 기준 ${ms.count}/5 해당`,
      detail: `${ms.hits.join(", ")} — 5개 중 3개 이상이면 대사증후군입니다`,
      tip: "체중·허리둘레를 줄이고 유산소 운동을 늘리면 여러 항목이 함께 좋아지는 경우가 많습니다.",
    });
  } else if (ms && ms.count === 2) {
    out.push({
      key: "metabolic",
      score: 1.8,
      status: "caution",
      title: "대사증후군 기준 2/5 해당",
      detail: `${ms.hits.join(", ")} — 하나만 더 해당되면 대사증후군입니다`,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

// Korean criteria (NCEP-ATP III with the Korean waist cut-off).
export function metabolicSyndrome(exam, sex) {
  const v = exam.values || {};
  const num = (k) => (typeof v[k] === "number" ? v[k] : null);
  const checks = [
    ["복부비만", num("waist"), (x) => x >= (sex === "F" ? 85 : 90)],
    ["중성지방", num("tg"), (x) => x >= 150],
    ["낮은 HDL", num("hdl"), (x) => x < (sex === "F" ? 50 : 40)],
    ["혈압", num("sbp") ?? num("dbp"), () => (num("sbp") ?? 0) >= 130 || (num("dbp") ?? 0) >= 85],
    ["공복혈당", num("fbs"), (x) => x >= 100],
  ];
  const measured = checks.filter(([, val]) => val !== null);
  if (measured.length < 3) return null;
  const hits = measured.filter(([, val, test]) => test(val)).map(([label]) => label);
  return { count: hits.length, measured: measured.length, hits };
}

// Compact history used as context for the AI summary.
export function historyForPrompt(exams, sex) {
  const rows = sortedExams(exams).map((e) => {
    const vals = Object.entries(e.values || {})
      .map(([k, v]) => {
        const item = ITEM_BY_KEY[k];
        return item ? `${item.name}=${v}${item.unit ? item.unit : ""}` : null;
      })
      .filter(Boolean);
    const others = (e.others || []).map((o) => `${o.name}=${o.value}${o.unit || ""}${o.ref ? ` (참고치 ${o.ref})` : ""}`);
    const findings = (e.findings || []).map((f) => `\n  소견 - ${f.area}: ${f.text}`).join("");
    return `[${e.date}${e.hospital ? ` ${e.hospital}` : ""}] ${[...vals, ...others].join(", ")}${findings}`;
  });
  return `성별: ${sex === "F" ? "여성" : sex === "M" ? "남성" : "미입력"}\n${rows.join("\n")}`;
}
