import React, { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import {
  FileUp,
  Pencil,
  Sparkles,
  Loader2,
  ArrowLeft,
  Settings as SettingsIcon,
  Trash2,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { storage } from "../storage";
import { ITEMS, ITEM_BY_KEY, CATEGORIES } from "./catalog";
import { STATUS_LABEL, statusOf, seriesOf, trendOf, findConcerns, rangeText, sortedExams, historyForPrompt, allFindings } from "./analyze";
import { extractCheckup, summarizeHistory } from "./ai";

const HEADING = { fontFamily: "Oswald, sans-serif" };
const INPUT =
  "w-full bg-zinc-900 rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-orange-500";
const STATUS_STYLE = {
  normal: "bg-teal-500/15 text-teal-300",
  caution: "bg-amber-500/15 text-amber-300",
  abnormal: "bg-rose-500/15 text-rose-300",
};
const STATUS_COLOR = { normal: "#2dd4bf", caution: "#fbbf24", abnormal: "#fb7185" };

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function parseValue(item, raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!item || item.qualitative) return s;
  const n = parseFloat(s.replace(/,/g, "").replace(/^[<>≤≥]=?\s*/, ""));
  return Number.isNaN(n) ? null : n;
}

function fmt(v) {
  return typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v ?? "");
}

// Editable rows shared by the extraction result and manual entry screens.
// One draft per test date found in the uploaded files.
function draftsFromExtraction(result) {
  return result.exams
    .filter((e) => e.items.length || e.findings.length)
    .map((e) => ({
      id: null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(e.exam_date) ? e.exam_date : "",
      hospital: e.hospital || "",
      rows: e.items.map((r) => ({
        rid: uid(),
        key: ITEM_BY_KEY[r.key] ? r.key : "other",
        name: r.name,
        value: r.value,
        unit: r.unit,
        ref: r.ref_range,
      })),
      findings: e.findings.map((f) => ({ rid: uid(), area: f.area, text: f.text })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function emptyDraft() {
  return { id: null, date: todayStr(), hospital: "", rows: [], findings: [] };
}

function draftFromExam(exam) {
  return {
    id: exam.id,
    date: exam.date,
    hospital: exam.hospital || "",
    rows: [
      ...Object.entries(exam.values).map(([key, value]) => ({
        rid: uid(), key, name: ITEM_BY_KEY[key]?.name || key, value: String(value), unit: ITEM_BY_KEY[key]?.unit || "", ref: "",
      })),
      ...(exam.others || []).map((o) => ({ rid: uid(), key: "other", name: o.name, value: o.value, unit: o.unit, ref: o.ref })),
    ],
    findings: (exam.findings || []).map((f) => ({ rid: uid(), area: f.area, text: f.text })),
  };
}

function examFromDraft(draft) {
  const values = {};
  const others = [];
  for (const row of draft.rows) {
    const item = ITEM_BY_KEY[row.key];
    if (item) {
      const v = parseValue(item, row.value);
      if (v !== null) values[row.key] = v;
    } else if (row.name.trim() && String(row.value).trim()) {
      others.push({ name: row.name.trim(), value: String(row.value).trim(), unit: row.unit || "", ref: row.ref || "" });
    }
  }
  const findings = draft.findings
    .filter((f) => f.text.trim())
    .map((f) => ({ area: f.area.trim(), text: f.text.trim() }));
  return { id: draft.id || uid(), date: draft.date, hospital: draft.hospital.trim(), values, others, findings };
}

export default function CheckupTab() {
  const [exams, setExams] = useState([]);
  const [prefs, setPrefs] = useState({ sex: "", apiKey: "" });
  const [report, setReport] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ name: "home" });

  useEffect(() => {
    (async () => {
      const load = async (key, fallback) => {
        const r = await storage.get(key);
        try { return r ? JSON.parse(r.value) : fallback; } catch { return fallback; }
      };
      setExams(await load("pt-checkups", []));
      setPrefs({ sex: "", apiKey: "", ...(await load("pt-checkup-prefs", {})) });
      setReport(await load("pt-checkup-report", null));
      setLoaded(true);
    })();
  }, []);

  const persistExams = (next) => {
    setExams(next);
    storage.set("pt-checkups", JSON.stringify(next)).catch(() => {});
  };
  const persistPrefs = (next) => {
    setPrefs(next);
    storage.set("pt-checkup-prefs", JSON.stringify(next)).catch(() => {});
  };
  const persistReport = (next) => {
    setReport(next);
    storage.set("pt-checkup-report", JSON.stringify(next)).catch(() => {});
  };

  const saveExams = (list) => {
    let next = exams;
    for (const exam of list) {
      // A second upload for the same date (e.g. a separate page with the blood
      // results) is merged into the existing record instead of duplicating it.
      const sameDate = next.find((e) => e.id !== exam.id && e.date === exam.date);
      if (sameDate) {
        const merged = {
          ...sameDate,
          hospital: sameDate.hospital || exam.hospital,
          values: { ...sameDate.values, ...exam.values },
          others: [...(sameDate.others || []).filter((o) => !exam.others.some((n) => n.name === o.name)), ...exam.others],
          findings: [
            ...(sameDate.findings || []).filter((f) => !exam.findings.some((n) => n.area === f.area && n.text === f.text)),
            ...exam.findings,
          ],
        };
        next = next.filter((e) => e.id !== exam.id).map((e) => (e.id === sameDate.id ? merged : e));
      } else {
        next = next.some((e) => e.id === exam.id) ? next.map((e) => (e.id === exam.id ? exam : e)) : [...next, exam];
      }
    }
    persistExams(next);
    setView({ name: "home" });
  };

  const deleteExam = (id) => {
    persistExams(exams.filter((e) => e.id !== id));
    setView({ name: "home" });
  };

  if (!loaded) return <div className="px-5 pt-6 text-sm text-zinc-500">불러오는 중...</div>;

  if (view.name === "review") {
    return (
      <ReviewScreen
        initial={view.drafts}
        sex={prefs.sex}
        onCancel={() => setView({ name: "home" })}
        onSave={saveExams}
        onDelete={view.drafts[0].id ? () => deleteExam(view.drafts[0].id) : null}
      />
    );
  }
  if (view.name === "item") {
    return <ItemScreen itemKey={view.key} exams={exams} sex={prefs.sex} onBack={() => setView({ name: "home" })} />;
  }
  if (view.name === "prefs") {
    return (
      <PrefsScreen
        prefs={prefs}
        exams={exams}
        onSave={(p) => { persistPrefs(p); setView({ name: "home" }); }}
        onImport={(list) => {
          // Merge by id so importing an old backup never wipes newer records.
          const byId = new Map(exams.map((e) => [e.id, e]));
          for (const e of list) if (e && e.id && e.date && e.values) byId.set(e.id, e);
          persistExams([...byId.values()]);
        }}
        onBack={() => setView({ name: "home" })}
      />
    );
  }

  return (
    <HomeScreen
      exams={exams}
      prefs={prefs}
      report={report}
      onReport={persistReport}
      onReview={(drafts) => setView({ name: "review", drafts })}
      onItem={(key) => setView({ name: "item", key })}
      onPrefs={() => setView({ name: "prefs" })}
    />
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function HomeScreen({ exams, prefs, report, onReport, onReview, onItem, onPrefs }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [showAllConcerns, setShowAllConcerns] = useState(false);

  const concerns = useMemo(() => findConcerns(exams, prefs.sex), [exams, prefs.sex]);
  const findings = useMemo(() => allFindings(exams), [exams]);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const sorted = useMemo(() => sortedExams(exams).reverse(), [exams]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (!prefs.apiKey) { setError("먼저 설정에서 Claude API 키를 입력해 주세요."); return; }
    setError("");
    setBusy(true);
    try {
      const drafts = draftsFromExtraction(await extractCheckup(prefs.apiKey, files));
      if (!drafts.length) throw new Error("결과지에서 검사 결과를 찾지 못했어요. 더 선명한 사진이나 PDF로 다시 시도해 주세요.");
      onReview(drafts);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const makeReport = async () => {
    if (!prefs.apiKey) { setError("먼저 설정에서 Claude API 키를 입력해 주세요."); return; }
    setError("");
    setReportBusy(true);
    try {
      const text = await summarizeHistory(prefs.apiKey, historyForPrompt(exams, prefs.sex));
      onReport({ text, createdAt: todayStr(), examCount: exams.length });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setReportBusy(false);
    }
  };

  const shownConcerns = showAllConcerns ? concerns : concerns.slice(0, 3);
  const reportStale = report && report.examCount !== exams.length;

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center justify-between mb-1">
        <div style={HEADING} className="text-lg font-medium">건강검진</div>
        <button onClick={onPrefs} className="p-1.5 -mr-1.5 text-zinc-500" aria-label="검진 설정">
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-5">매년 결과지를 올리면 추세와 신경 쓸 항목을 정리해 드려요.</p>

      {!prefs.sex && (
        <button onClick={onPrefs} className="w-full text-left text-[11px] text-amber-300 bg-amber-500/10 rounded-md px-3 py-2 mb-3">
          성별을 입력하면 남녀 기준이 다른 항목(허리둘레, 감마GTP, 혈색소 등)을 정확히 판정해요 →
        </button>
      )}

      <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={onFiles} />
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-2 bg-orange-500 text-zinc-950 font-semibold text-sm rounded-md py-3 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          {busy ? "결과지 읽는 중... (1분 정도)" : "결과지 올리기 (PDF·사진)"}
        </button>
        <button
          onClick={() => onReview([emptyDraft()])}
          disabled={busy}
          className="flex items-center gap-1.5 bg-zinc-900 text-zinc-300 text-sm rounded-md px-3"
        >
          <Pencil className="w-3.5 h-3.5" /> 직접 입력
        </button>
      </div>
      <p className="text-[11px] text-zinc-600 mb-4">
        여러 파일·사진을 함께 선택해도 돼요. 결과지에 지난 연도 값이 같이 있거나 검사일이 다르면 날짜별로 나눠서 읽어요.
      </p>
      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 rounded-md px-3 py-2 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {exams.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg px-4 py-8 text-center text-xs text-zinc-500 leading-relaxed">
          아직 검진 기록이 없어요.
          <br />
          지난 몇 년 치 결과지를 한 번에 올려 두면 첫날부터 추세를 볼 수 있어요.
        </div>
      ) : (
        <>
          <Section title="신경 쓸 항목">
            {concerns.length === 0 ? (
              <div className="bg-zinc-900 rounded-lg px-4 py-4 text-xs text-zinc-400">
                최근 검진에서 범위를 벗어나거나 나빠지는 항목이 없어요. 👍
              </div>
            ) : (
              <div className="space-y-2">
                {shownConcerns.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => ITEM_BY_KEY[c.key] && onItem(c.key)}
                    className="w-full text-left bg-zinc-900 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <StatusChip status={c.status} />
                      <span className="text-sm font-medium text-zinc-100">{c.title}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1.5">{c.detail}</div>
                    {c.history && <div className="text-[11px] text-zinc-500 mt-1">추이 {c.history}</div>}
                    {c.tip && <div className="text-[11px] text-zinc-600 mt-1">{c.tip}</div>}
                  </button>
                ))}
                {concerns.length > 3 && (
                  <button onClick={() => setShowAllConcerns((v) => !v)} className="w-full text-xs text-zinc-500 py-1">
                    {showAllConcerns ? "접기" : `${concerns.length - 3}개 더 보기`}
                  </button>
                )}
              </div>
            )}
          </Section>

          {findings.length > 0 && (
            <Section title="검사 소견">
              <div className="bg-zinc-900 rounded-lg">
                {(showAllFindings ? findings : findings.slice(0, 4)).map((f, i) => (
                  <div key={i} className="px-4 py-2.5 border-b border-zinc-800/60 last:border-0">
                    <div className="text-[11px] text-zinc-500">{f.date} · {f.area}</div>
                    <div className="text-xs text-zinc-200 mt-0.5 leading-relaxed">{f.text}</div>
                  </div>
                ))}
              </div>
              {findings.length > 4 && (
                <button onClick={() => setShowAllFindings((v) => !v)} className="w-full text-xs text-zinc-500 py-2">
                  {showAllFindings ? "접기" : `${findings.length - 4}개 더 보기`}
                </button>
              )}
            </Section>
          )}

          <Section title="AI 리포트">
            <div className="bg-zinc-900 rounded-lg px-4 py-3">
              {report ? (
                <>
                  <div className="text-[11px] text-zinc-500 mb-2">
                    {report.createdAt} 작성 · 검진 {report.examCount}회 기준
                    {reportStale && <span className="text-amber-300"> · 새 기록이 있어요</span>}
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.text}</div>
                </>
              ) : (
                <div className="text-xs text-zinc-500">전체 기록을 바탕으로 요약, 생활 습관, 다음 진료 때 물어볼 것을 정리해 드려요.</div>
              )}
              <button
                onClick={makeReport}
                disabled={reportBusy}
                className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 disabled:opacity-60"
              >
                {reportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {reportBusy ? "작성 중..." : report ? "다시 작성" : "리포트 만들기"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">참고용 정보예요. 진단이나 치료는 꼭 의사와 상의하세요.</p>
          </Section>

          <Section title="항목별 추세">
            <TrendList exams={exams} sex={prefs.sex} onItem={onItem} />
          </Section>

          <Section title="검진 기록">
            <div className="space-y-1.5">
              {sorted.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onReview([draftFromExam(e)])}
                  className="w-full flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm text-zinc-100">{e.date}</div>
                    <div className="text-[11px] text-zinc-500">{e.hospital || "기관 미입력"}</div>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {Object.keys(e.values).length + (e.others || []).length}개 항목
                    {(e.findings || []).length > 0 && ` · 소견 ${e.findings.length}`}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs text-zinc-500 mb-2">{title}</div>
      {children}
    </div>
  );
}

function StatusChip({ status }) {
  if (!status) return null;
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function TrendIcon({ trend }) {
  if (!trend) return null;
  const Icon = trend.delta > 0 ? TrendingUp : trend.delta < 0 ? TrendingDown : Minus;
  const color = trend.direction === "worse" ? "text-rose-400" : trend.direction === "better" ? "text-teal-400" : "text-zinc-500";
  return <Icon className={`w-3.5 h-3.5 ${color}`} />;
}

function TrendList({ exams, sex, onItem }) {
  const groups = CATEGORIES.map((category) => ({
    category,
    rows: ITEMS.filter((i) => i.category === category)
      .map((item) => ({ item, series: seriesOf(exams, item.key) }))
      .filter((r) => r.series.length),
  })).filter((g) => g.rows.length);

  return (
    <div className="space-y-3">
      {groups.map(({ category, rows }) => (
        <div key={category} className="bg-zinc-900 rounded-lg">
          <div className="text-[11px] text-zinc-600 px-4 pt-2.5">{category}</div>
          {rows.map(({ item, series }) => {
            const last = series.at(-1);
            const status = statusOf(item, last.value, sex);
            const trend = trendOf(item, series, sex);
            const nums = series.filter((p) => typeof p.value === "number");
            return (
              <button
                key={item.key}
                onClick={() => onItem(item.key)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60 last:border-0 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-300 truncate">{item.name}</div>
                  <div className="text-[10px] text-zinc-600">{last.year}</div>
                </div>
                {nums.length >= 2 && <Sparkline data={nums} color={STATUS_COLOR[status] || "#a1a1aa"} />}
                <div className="w-16 text-right">
                  <div className="text-sm text-zinc-100 tabular-nums">{fmt(last.value)}</div>
                  <div className="text-[10px] text-zinc-600">{item.unit}</div>
                </div>
                <div className="w-4"><TrendIcon trend={trend} /></div>
                <div className="w-8 text-right"><StatusChip status={status} /></div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color }) {
  return (
    <div className="w-14 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item detail
// ---------------------------------------------------------------------------

function ItemScreen({ itemKey, exams, sex, onBack }) {
  const item = ITEM_BY_KEY[itemKey];
  const series = seriesOf(exams, itemKey);
  const nums = series.filter((p) => typeof p.value === "number");
  const normal = item.normal ? (Array.isArray(item.normal) ? item.normal : item.normal[sex === "F" ? "F" : "M"]) : null;

  let domain = ["auto", "auto"];
  if (nums.length) {
    const vals = nums.map((p) => p.value).concat(normal ? normal.filter((x) => x !== null) : []);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.2, Math.abs(max) * 0.05, 0.5);
    domain = [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }

  return (
    <div className="px-5 pt-6">
      <BackButton onClick={onBack} />
      <div style={HEADING} className="text-lg font-medium mb-1">{item.name}</div>
      <div className="text-xs text-zinc-500 mb-4">
        {item.unit && `단위 ${item.unit}`}
        {rangeText(item, sex) && ` · 정상 ${rangeText(item, sex)}`}
        {!sex && Array.isArray(item.normal) === false && item.normal && " (남성 기준)"}
      </div>

      {nums.length >= 2 ? (
        <div className="bg-zinc-900 rounded-lg pt-3 pr-3 pb-1 mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={nums} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {normal && (
                <ReferenceArea
                  y1={normal[0] ?? domain[0]}
                  y2={normal[1] ?? domain[1]}
                  fill="#2dd4bf"
                  fillOpacity={0.08}
                  ifOverflow="hidden"
                />
              )}
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis domain={domain} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#fb923c" }}
                formatter={(v) => [`${v} ${item.unit || ""}`, item.name]}
              />
              <Line type="monotone" dataKey="value" stroke="#fb923c" strokeWidth={2} dot={{ r: 3, fill: "#fb923c" }} />
            </LineChart>
          </ResponsiveContainer>
          {normal && <div className="text-[10px] text-zinc-600 px-4 pb-2">초록 영역이 정상 범위예요.</div>}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg px-4 py-6 text-center text-[11px] text-zinc-600 mb-4">
          두 번 이상 기록되면 추세 그래프가 나타나요.
        </div>
      )}

      {item.tip && <div className="text-xs text-zinc-400 bg-zinc-900 rounded-lg px-4 py-3 mb-4">{item.tip}</div>}

      <div className="bg-zinc-900 rounded-lg">
        {[...series].reverse().map((p) => (
          <div key={p.date} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 last:border-0">
            <span className="text-xs text-zinc-400">{p.date}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-zinc-100 tabular-nums">{fmt(p.value)}</span>
              <StatusChip status={statusOf(item, p.value, sex)} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-xs text-zinc-500 mb-4 -ml-1">
      <ArrowLeft className="w-4 h-4" /> 뒤로
    </button>
  );
}

// ---------------------------------------------------------------------------
// Review / edit one checkup
// ---------------------------------------------------------------------------

function ReviewScreen({ initial, sex, onCancel, onSave, onDelete }) {
  const [drafts, setDrafts] = useState(initial);
  const [active, setActive] = useState(0);
  const [addKey, setAddKey] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const draft = drafts[active];
  const setDraft = (fn) => setDrafts((all) => all.map((d, i) => (i === active ? fn(d) : d)));
  const removeDraft = () => {
    setDrafts((all) => all.filter((_, i) => i !== active));
    setActive(0);
  };
  const setFinding = (rid, patch) =>
    setDraft((d) => ({ ...d, findings: d.findings.map((f) => (f.rid === rid ? { ...f, ...patch } : f)) }));
  const removeFinding = (rid) => setDraft((d) => ({ ...d, findings: d.findings.filter((f) => f.rid !== rid) }));
  const addFinding = () => setDraft((d) => ({ ...d, findings: [...d.findings, { rid: uid(), area: "", text: "" }] }));

  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const setRow = (rid, patch) => setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.rid === rid ? { ...r, ...patch } : r)) }));
  const removeRow = (rid) => setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.rid !== rid) }));
  const addRow = (key) => {
    if (!key) return;
    const item = ITEM_BY_KEY[key];
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, { rid: uid(), key, name: item ? item.name : "", value: "", unit: item?.unit || "", ref: "" }],
    }));
    setAddKey("");
  };

  const standardRows = draft.rows
    .filter((r) => ITEM_BY_KEY[r.key])
    .sort((a, b) => ITEMS.indexOf(ITEM_BY_KEY[a.key]) - ITEMS.indexOf(ITEM_BY_KEY[b.key]));
  const otherRows = draft.rows.filter((r) => !ITEM_BY_KEY[r.key]);
  const usedKeys = new Set(standardRows.map((r) => r.key));
  const isNew = !initial[0].id;
  const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date);
  const valid = validDate(draft);
  const allValid = drafts.every(validDate);

  return (
    <div className="px-5 pt-6">
      <BackButton onClick={onCancel} />
      <div style={HEADING} className="text-lg font-medium mb-1">{isNew ? "검진 결과 확인" : "검진 기록 수정"}</div>
      {isNew && (draft.rows.length > 0 || draft.findings.length > 0) && (
        <p className="text-xs text-zinc-500 mb-4">자동으로 읽은 값이에요. 결과지와 다른 곳이 있으면 고친 뒤 저장해 주세요.</p>
      )}

      {drafts.length > 1 && (
        <div className="mb-4">
          <div className="text-[11px] text-zinc-500 mb-1.5">검사일 {drafts.length}개를 찾았어요. 날짜를 눌러 각각 확인하세요.</div>
          <div className="flex flex-wrap gap-1.5">
            {drafts.map((d, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`px-3 py-1.5 rounded-full text-xs ${
                  i === active ? "bg-orange-500 text-zinc-950" : validDate(d) ? "bg-zinc-900 text-zinc-400" : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {d.date || "날짜 없음"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5 mt-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">검진일</label>
          <input type="date" value={draft.date} onChange={(e) => setField("date", e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">검진 기관</label>
          <input value={draft.hospital} onChange={(e) => setField("hospital", e.target.value)} placeholder="선택" className={INPUT} />
        </div>
      </div>
      {!valid && <p className="text-[11px] text-amber-300 -mt-3 mb-4">검진일을 입력해 주세요.</p>}

      <Section title={`표준 항목 (${standardRows.length})`}>
        <div className="bg-zinc-900 rounded-lg">
          {standardRows.length === 0 && <div className="px-4 py-3 text-xs text-zinc-600">아래에서 항목을 추가하세요.</div>}
          {standardRows.map((r) => {
            const item = ITEM_BY_KEY[r.key];
            const status = statusOf(item, parseValue(item, r.value), sex);
            return (
              <div key={r.rid} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-300 truncate">{item.name}</div>
                  {r.name && r.name !== item.name && <div className="text-[10px] text-zinc-600 truncate">결과지: {r.name}</div>}
                </div>
                <input
                  value={r.value}
                  onChange={(e) => setRow(r.rid, { value: e.target.value })}
                  inputMode={item.qualitative ? "text" : "decimal"}
                  className="w-20 bg-zinc-950 rounded px-2 py-1.5 text-sm text-right text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="w-12 text-[10px] text-zinc-600 truncate">{item.unit}</span>
                <span className="w-8 text-right"><StatusChip status={status} /></span>
                <button onClick={() => removeRow(r.rid)} className="text-zinc-600" aria-label="삭제"><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <select value={addKey} onChange={(e) => setAddKey(e.target.value)} className={`${INPUT} flex-1`}>
            <option value="">항목 추가...</option>
            {ITEMS.filter((i) => !usedKeys.has(i.key)).map((i) => (
              <option key={i.key} value={i.key}>{i.category} · {i.name}</option>
            ))}
          </select>
          <button onClick={() => addRow(addKey)} className="bg-zinc-900 rounded-md px-3 text-zinc-300" aria-label="추가">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </Section>

      <Section title={`기타 항목 (${otherRows.length})`}>
        <div className="bg-zinc-900 rounded-lg">
          {otherRows.map((r) => (
            <div key={r.rid} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 last:border-0">
              <input
                value={r.name}
                onChange={(e) => setRow(r.rid, { name: e.target.value })}
                placeholder="항목명"
                className="flex-1 min-w-0 bg-transparent text-xs text-zinc-300 outline-none"
              />
              <input
                value={r.value}
                onChange={(e) => setRow(r.rid, { value: e.target.value })}
                className="w-20 bg-zinc-950 rounded px-2 py-1.5 text-sm text-right text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500"
              />
              <span className="w-12 text-[10px] text-zinc-600 truncate">{r.unit}</span>
              <button onClick={() => removeRow(r.rid)} className="text-zinc-600" aria-label="삭제"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => addRow("other")} className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs text-zinc-500">
            <Plus className="w-3.5 h-3.5" /> 기타 항목 추가
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">기타 항목은 기록과 AI 리포트에만 쓰이고, 추세 판정에는 들어가지 않아요.</p>
      </Section>

      <Section title={`검사 소견 (${draft.findings.length})`}>
        <div className="bg-zinc-900 rounded-lg">
          {draft.findings.map((f) => (
            <div key={f.rid} className="px-3 py-2 border-b border-zinc-800/60 last:border-0">
              <div className="flex items-center gap-2">
                <input
                  value={f.area}
                  onChange={(e) => setFinding(f.rid, { area: e.target.value })}
                  placeholder="검사 (예: 상복부초음파)"
                  className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-500 outline-none"
                />
                <button onClick={() => removeFinding(f.rid)} className="text-zinc-600" aria-label="삭제"><X className="w-3.5 h-3.5" /></button>
              </div>
              <textarea
                value={f.text}
                onChange={(e) => setFinding(f.rid, { text: e.target.value })}
                rows={Math.max(2, Math.ceil(f.text.length / 26))}
                placeholder="소견 내용"
                className="w-full mt-1 bg-zinc-950 rounded px-2 py-1.5 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </div>
          ))}
          <button onClick={addFinding} className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs text-zinc-500">
            <Plus className="w-3.5 h-3.5" /> 소견 추가
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">초음파·CT·내시경 같은 검사의 소견이에요. AI 리포트에 함께 반영돼요.</p>
      </Section>

      <button
        onClick={() => onSave(drafts.map(examFromDraft))}
        disabled={!allValid}
        className="w-full bg-orange-500 text-zinc-950 font-semibold text-sm rounded-md py-3 disabled:opacity-40 mb-3"
      >
        {drafts.length > 1 ? `${drafts.length}개 검사일 모두 저장` : "저장"}
      </button>
      {drafts.length > 1 && (
        <button onClick={removeDraft} className="w-full text-xs text-zinc-500 py-2 mb-2">
          이 날짜({draft.date || "날짜 없음"})는 저장하지 않기
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-400 py-2 mb-4"
        >
          <Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? "한 번 더 누르면 삭제돼요" : "이 검진 기록 삭제"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferences: sex, API key, backup
// ---------------------------------------------------------------------------

function PrefsScreen({ prefs, exams, onSave, onImport, onBack }) {
  const [sex, setSex] = useState(prefs.sex);
  const [apiKey, setApiKey] = useState(prefs.apiKey);
  const [note, setNote] = useState("");
  const importRef = useRef(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exams }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkups-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.exams)) throw new Error();
      onImport(data.exams);
      setNote(`${data.exams.length}개 검진 기록을 불러왔어요.`);
    } catch {
      setNote("백업 파일 형식이 올바르지 않아요.");
    }
  };

  return (
    <div className="px-5 pt-6">
      <BackButton onClick={onBack} />
      <div style={HEADING} className="text-lg font-medium mb-5">검진 설정</div>

      <div className="mb-6">
        <label className="text-xs text-zinc-500 mb-2 block">성별</label>
        <div className="flex gap-1.5">
          {[["M", "남성"], ["F", "여성"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setSex(v)}
              className={`px-4 py-1.5 rounded-full text-xs ${sex === v ? "bg-orange-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs text-zinc-500 mb-1.5 block">Claude API 키</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value.trim())}
          placeholder="sk-ant-..."
          autoComplete="off"
          className={INPUT}
        />
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
          결과지를 읽고 리포트를 쓸 때만 쓰여요. 키는 이 기기의 브라우저에만 저장되고, 결과지는 Anthropic API로만 전송돼요.
          키는 console.anthropic.com 에서 만들 수 있어요.
        </p>
      </div>

      <button onClick={() => onSave({ ...prefs, sex, apiKey })} className="w-full bg-orange-500 text-zinc-950 font-semibold text-sm rounded-md py-3 mb-8">
        저장
      </button>

      <div className="mb-6">
        <label className="text-xs text-zinc-500 mb-2 block">백업</label>
        <p className="text-[11px] text-zinc-600 mb-2">
          기록은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 사라지니 가끔 백업 파일로 내려받아 두세요.
        </p>
        <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importBackup} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportBackup} className="flex items-center justify-center gap-1.5 bg-zinc-900 text-zinc-300 text-xs rounded-md py-2.5">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>
          <button onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-1.5 bg-zinc-900 text-zinc-300 text-xs rounded-md py-2.5">
            <Upload className="w-3.5 h-3.5" /> 불러오기
          </button>
        </div>
        {note && <p className="text-[11px] text-teal-300 mt-2">{note}</p>}
      </div>
    </div>
  );
}
