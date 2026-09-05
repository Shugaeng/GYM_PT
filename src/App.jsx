import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { storage } from "./storage";
import {
  Calendar as CalendarIcon,
  Dumbbell,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  Flame,
  Check,
  RotateCcw,
  PlayCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// bg: zinc-950/900 (graphite floor of a gym)  |  accent: orange-500 (chalk-line / equipment tape)
// heading font: Oswald (condensed, signage-like)  |  body font: Inter
// ---------------------------------------------------------------------------

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`;

const BODY_PARTS = ["가슴", "등", "하체", "어깨", "팔", "코어"];
const JOINTS = ["어깨", "허리", "무릎", "손목", "목", "팔꿈치"];
const EQUIPMENT_CATEGORIES = [
  { category: "프리웨이트 · 공용", items: ["덤벨", "바벨", "EZ바", "벤치", "인클라인 벤치", "스쿼트랙", "파워랙", "스미스 머신", "케틀벨", "짐볼", "저항밴드", "풀업바", "딥스바"] },
  { category: "가슴", items: ["시티드 체스트 프레스", "버터플라이", "케이블 크로스오버"] },
  { category: "등", items: ["렛머신", "시티드 로우 머신", "T바로우 머신", "어시스트 풀업 머신", "백 익스텐션 벤치"] },
  { category: "하체", items: ["레그프레스 머신", "시티드 레그익스텐션", "라잉 레그컬", "핵스쿼트 머신", "힙 어브덕션 머신", "힙 어덕션 머신", "카프레이즈 머신"] },
  { category: "어깨", items: ["숄더프레스", "레터럴레이즈 머신"] },
  { category: "팔", items: ["케이블 머신", "프리처컬 벤치"] },
  { category: "코어", items: ["로만체어", "AB크런치 머신"] },
  { category: "유산소", items: ["러닝머신", "사이클", "일립티컬", "로잉 머신", "천국의 계단"] },
];
const EQUIPMENT_OPTIONS = EQUIPMENT_CATEGORIES.flatMap((c) => c.items);
const ADD_BODY_PARTS = [...BODY_PARTS, "유산소"];
function equipmentOptionsFor(bodyPart) {
  const common = EQUIPMENT_CATEGORIES.find((c) => c.category === "프리웨이트 · 공용")?.items || [];
  const specific = EQUIPMENT_CATEGORIES.find((c) => c.category === bodyPart)?.items || [];
  return [...specific, ...common];
}

const EXERCISES = {
  가슴: [
    { name: "푸시업", sets: 3, reps: "12~15", strain: ["손목", "어깨"], equipment: [], alt: { name: "인클라인 푸시업 (벽/의자)", sets: 3, reps: "12~15", equipment: [] } },
    { name: "덤벨 벤치프레스", sets: 3, reps: "10~12", strain: ["어깨", "손목"], equipment: ["덤벨", "벤치"], alt: { name: "인클라인 푸시업 (벽/의자)", sets: 3, reps: "12~15", equipment: [] } },
    { name: "딥스", sets: 3, reps: "8~10", strain: ["어깨", "손목"], equipment: ["벤치"], alt: { name: "밴드 체스트 프레스", sets: 3, reps: "12~15", equipment: ["저항밴드"] } },
  ],
  등: [
    { name: "풀업 (또는 랫풀다운)", sets: 3, reps: "8~10", strain: ["손목", "어깨"], equipment: ["풀업바"], alt: { name: "밴드 로우", sets: 3, reps: "12~15", equipment: ["저항밴드"] } },
    { name: "덤벨 로우", sets: 3, reps: "10~12", strain: ["허리", "손목"], equipment: ["덤벨"], alt: { name: "밴드 로우", sets: 3, reps: "12~15", equipment: ["저항밴드"] } },
    { name: "슈퍼맨 (백 익스텐션)", sets: 3, reps: "15", strain: ["허리"], equipment: [], alt: { name: "버드독", sets: 3, reps: "12 (좌우)", equipment: [] } },
  ],
  하체: [
    { name: "스쿼트", sets: 4, reps: "10~12", strain: ["무릎", "허리"], equipment: [], alt: { name: "박스 스쿼트 (얕게)", sets: 3, reps: "12~15", equipment: [] } },
    { name: "런지", sets: 3, reps: "12 (좌우)", strain: ["무릎"], equipment: [], alt: { name: "글루트 브릿지", sets: 3, reps: "15", equipment: [] } },
    { name: "카프레이즈", sets: 3, reps: "15~20", strain: ["무릎"], equipment: [], alt: { name: "시티드 카프레이즈", sets: 3, reps: "15~20", equipment: [] } },
  ],
  어깨: [
    { name: "숄더프레스", sets: 3, reps: "10~12", strain: ["어깨", "목"], equipment: ["덤벨"], alt: { name: "밴드 숄더프레스", sets: 3, reps: "12~15", equipment: ["저항밴드"] } },
    { name: "사이드 레터럴레이즈", sets: 3, reps: "12~15", strain: ["어깨"], equipment: ["덤벨"], alt: { name: "밴드 사이드 레이즈", sets: 3, reps: "15", equipment: ["저항밴드"] } },
    { name: "리버스 펙덱 (밴드 페이스풀)", sets: 3, reps: "12~15", strain: ["어깨", "목"], equipment: ["저항밴드"], alt: { name: "밴드 페이스풀 (저강도)", sets: 3, reps: "15", equipment: ["저항밴드"] } },
  ],
  팔: [
    { name: "덤벨 컬", sets: 3, reps: "12~15", strain: ["팔꿈치", "손목"], equipment: ["덤벨"], alt: { name: "밴드 컬", sets: 3, reps: "15", equipment: ["저항밴드"] } },
    { name: "트라이셉스 익스텐션", sets: 3, reps: "12~15", strain: ["팔꿈치"], equipment: ["덤벨"], alt: { name: "밴드 트라이셉스 푸시다운", sets: 3, reps: "15", equipment: ["저항밴드"] } },
    { name: "해머 컬", sets: 3, reps: "12", strain: ["손목", "팔꿈치"], equipment: ["덤벨"], alt: { name: "밴드 해머 컬", sets: 3, reps: "15", equipment: ["저항밴드"] } },
  ],
  코어: [
    { name: "플랭크", sets: 3, reps: "40~60초", strain: ["허리", "손목"], equipment: [], alt: { name: "무릎 플랭크", sets: 3, reps: "30~40초", equipment: [] } },
    { name: "크런치", sets: 3, reps: "15~20", strain: ["목", "허리"], equipment: [], alt: { name: "데드버그", sets: 3, reps: "12 (좌우)", equipment: [] } },
    { name: "레그레이즈", sets: 3, reps: "12~15", strain: ["허리"], equipment: [], alt: { name: "리버스 크런치 (저강도)", sets: 3, reps: "12", equipment: [] } },
  ],
};

function pad(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function ytSearchUrl(name) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " 운동 자세 올바르게")}`;
}

const LEVELS = ["초급", "중급", "고급"];
const LEVEL_SET_ADJUST = { 초급: -1, 중급: 0, 고급: 1 };
// Guideline: at least 1~2 full rest days per week, and ~48~72h recovery before retraining the same muscle group.
const WEEKLY_MIN_REST = { 초급: 2, 중급: 1, 고급: 1 };
const MUSCLE_RECOVERY_DAYS = 2;

// Rough kcal-per-set by muscle group, calibrated to a 70kg reference body weight.
const CALORIE_PER_SET = { 가슴: 6, 등: 6, 하체: 9, 어깨: 4, 팔: 3.5, 코어: 4.5, 유산소: 10 };
function estimateCalories(entries, weightKg) {
  const factor = weightKg ? Number(weightKg) / 70 : 1;
  let total = 0;
  entries.forEach((e) => {
    const perSet = CALORIE_PER_SET[e.bodyPart] ?? 5;
    const sets = Number(e.sets) || 3;
    total += perSet * sets * factor;
  });
  return Math.round(total);
}
function findPrevWeight(weightLog, dateStr) {
  const dates = Object.keys(weightLog).filter((d) => d < dateStr).sort();
  if (dates.length === 0) return null;
  return weightLog[dates[dates.length - 1]];
}

function computeRecommendation(logs, todayStr, level) {
  const today = new Date(todayStr + "T00:00:00");
  const minRestPerWeek = WEEKLY_MIN_REST[level] ?? 1;

  // weekly full-rest quota: count rest days in the trailing 7 days (not including today)
  let restDaysInWeek = 0;
  for (let i = 1; i <= 7; i++) {
    const d = toDateStr(addDays(today, -i));
    if (!logs[d] || logs[d].length === 0) restDaysInWeek++;
  }

  if (restDaysInWeek < minRestPerWeek) {
    return { rest: true, reason: "weekly", restDaysInWeek, minRestPerWeek };
  }

  // days since each body part was last trained
  const lastTrained = {};
  BODY_PARTS.forEach((bp) => (lastTrained[bp] = Infinity));
  for (let i = 1; i <= 30; i++) {
    const d = toDateStr(addDays(today, -i));
    const entries = logs[d];
    if (!entries) continue;
    entries.forEach((e) => {
      if (lastTrained[e.bodyPart] === Infinity) lastTrained[e.bodyPart] = i;
    });
  }

  // exclude any muscle group trained within the last ~48h so it gets proper recovery
  const eligible = BODY_PARTS.filter((bp) => lastTrained[bp] >= MUSCLE_RECOVERY_DAYS);

  if (eligible.length === 0) {
    return { rest: true, reason: "recovery", restDaysInWeek, minRestPerWeek };
  }

  const bodyPart = eligible.reduce((a, b) => (lastTrained[b] > lastTrained[a] ? b : a));
  return { rest: false, bodyPart, lastTrained, restDaysInWeek, minRestPerWeek };
}

export default function PTApp() {
  const [tab, setTab] = useState("recommend");
  const [settings, setSettings] = useState({ weight: "", height: "", difficultParts: [], equipment: [], level: "중급" });
  const [logs, setLogs] = useState({});
  const [adjustments, setAdjustments] = useState({});
  const [weightLog, setWeightLog] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await storage.get("pt-settings");
        if (s) setSettings((prev) => ({ ...prev, ...JSON.parse(s.value) }));
      } catch (e) {}
      try {
        const l = await storage.get("pt-logs");
        if (l) setLogs(JSON.parse(l.value));
      } catch (e) {}
      try {
        const a = await storage.get("pt-adjustments");
        if (a) setAdjustments(JSON.parse(a.value));
      } catch (e) {}
      try {
        const w = await storage.get("pt-weightlog");
        if (w) setWeightLog(JSON.parse(w.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const persistLogs = useCallback(async (next) => {
    setLogs(next);
    try {
      await storage.set("pt-logs", JSON.stringify(next));
    } catch (e) {}
  }, []);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      await storage.set("pt-settings", JSON.stringify(next));
    } catch (e) {}
  }, []);

  const setWeightForDate = useCallback(
    (dateStr, value) => {
      const next = { ...weightLog };
      if (value === "" || value === null || value === undefined) delete next[dateStr];
      else next[dateStr] = value;
      setWeightLog(next);
      storage.set("pt-weightlog", JSON.stringify(next)).catch(() => {});
    },
    [weightLog]
  );

  const recordFeedback = useCallback((name, level) => {
    setAdjustments((prev) => {
      const cur = prev[name] || 0;
      const delta = level === "easy" ? 1 : level === "hard" ? -1 : 0;
      const next = Math.max(-2, Math.min(3, cur + delta));
      const updated = { ...prev, [name]: next };
      storage.set("pt-adjustments", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const addExercise = useCallback(
    (dateStr, entry) => {
      const next = { ...logs, [dateStr]: [...(logs[dateStr] || []), { id: uid(), ...entry }] };
      persistLogs(next);
    },
    [logs, persistLogs]
  );

  const removeExercise = useCallback(
    (dateStr, id) => {
      const next = { ...logs, [dateStr]: (logs[dateStr] || []).filter((e) => e.id !== id) };
      persistLogs(next);
    },
    [logs, persistLogs]
  );

  if (!loaded) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        <style>{FONT_IMPORT}</style>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <style>{FONT_IMPORT}</style>

      <header className="px-5 pt-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif" }} className="text-xl font-semibold tracking-tight text-zinc-50">
            MY PT
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">개인 트레이너 노트</div>
        </div>
        <Flame className="w-5 h-5 text-orange-500" />
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {tab === "calendar" && (
          <CalendarTab
            logs={logs}
            settings={settings}
            weightLog={weightLog}
            onAdd={addExercise}
            onRemove={removeExercise}
            onSetWeight={setWeightForDate}
          />
        )}
        {tab === "recommend" && (
          <RecommendTab
            logs={logs}
            settings={settings}
            adjustments={adjustments}
            onAdd={addExercise}
            onFeedback={recordFeedback}
            onLevelChange={(level) => persistSettings({ ...settings, level })}
          />
        )}
        {tab === "settings" && (
          <SettingsTab settings={settings} onSave={persistSettings} note={saveNote} setNote={setSaveNote} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-900 flex">
        <TabButton icon={CalendarIcon} label="기록" active={tab === "calendar"} onClick={() => setTab("calendar")} />
        <TabButton icon={Dumbbell} label="추천" active={tab === "recommend"} onClick={() => setTab("recommend")} />
        <TabButton icon={SettingsIcon} label="설정" active={tab === "settings"} onClick={() => setTab("settings")} />
      </nav>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
        active ? "text-orange-500" : "text-zinc-600"
      }`}
    >
      <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Calendar tab
// ---------------------------------------------------------------------------

function CalendarTab({ logs, settings, weightLog, onAdd, onRemove, onSetWeight }) {
  const todayStr = toDateStr(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState(todayStr);
  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState(weightLog[todayStr] || "");

  useEffect(() => {
    setWeightInput(weightLog[selected] || "");
  }, [selected, weightLog]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const entries = logs[selected] || [];
  const prevWeight = findPrevWeight(weightLog, selected);
  const weightDelta = weightLog[selected] && prevWeight ? +(Number(weightLog[selected]) - Number(prevWeight)).toFixed(1) : null;
  const dayCalories = estimateCalories(entries, settings.weight);

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 text-zinc-500 hover:text-zinc-200">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div style={{ fontFamily: "Oswald, sans-serif" }} className="text-lg font-medium">
          {year}년 {month + 1}월
        </div>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 text-zinc-500 hover:text-zinc-200">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-zinc-600 mb-2">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 mb-6">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
          const has = (logs[dateStr] || []).length > 0;
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selected;
          const w = weightLog[dateStr];
          const prevW = w ? findPrevWeight(weightLog, dateStr) : null;
          const delta = w && prevW ? +(Number(w) - Number(prevW)).toFixed(1) : null;
          return (
            <button
              key={i}
              onClick={() => { setSelected(dateStr); setShowForm(false); }}
              className="flex flex-col items-center gap-1 py-1"
            >
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                  isSel
                    ? "bg-orange-500 text-zinc-950 font-semibold"
                    : isToday
                    ? "border border-orange-500 text-orange-400"
                    : has
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-600"
                }`}
              >
                {d}
              </span>
              <span className={`w-1 h-1 rounded-full ${has ? "bg-orange-500" : "bg-transparent"}`} />
              <span
                className={`text-[9px] leading-none whitespace-nowrap h-3 ${
                  delta === null ? "invisible" : delta > 0 ? "text-red-400" : delta < 0 ? "text-teal-400" : "text-zinc-500"
                }`}
              >
                {delta === null ? "-" : `${delta > 0 ? `+${delta}` : delta}kg`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-zinc-900 pt-4 grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-zinc-400">{selected} 기록</div>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1 text-xs text-orange-500 font-medium"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "닫기" : "추가"}
            </button>
          </div>

          {showForm && (
            <AddExerciseForm
              onSubmit={(entry) => { onAdd(selected, entry); setShowForm(false); }}
            />
          )}

          {entries.length === 0 && !showForm && (
            <div className="text-sm text-zinc-600 py-6 text-center">아직 기록된<br />운동이 없어요.</div>
          )}

          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="bg-zinc-900 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">{e.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {e.bodyPart} · {e.sets}세트 × {e.reps}
                      {e.weight ? ` · ${e.weight}kg` : ""}
                      {e.equipment && e.equipment.filter((eq) => eq !== e.name).length > 0
                        ? ` · ${e.equipment.filter((eq) => eq !== e.name).join(", ")}`
                        : ""}
                    </div>
                    <a
                      href={ytSearchUrl(e.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] text-teal-400"
                    >
                      <PlayCircle className="w-3 h-3" />
                      자세 영상
                    </a>
                  </div>
                  <button onClick={() => onRemove(selected, e.id)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {entries.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-900">
              <span className="text-xs text-zinc-500">예상 소모 칼로리</span>
              <span className="text-sm font-medium text-orange-400">{dayCalories} kcal</span>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <div className="text-sm text-zinc-400 mb-2">체중</div>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={() => onSetWeight(selected, weightInput)}
              inputMode="decimal"
              placeholder="kg"
              className="w-16 bg-zinc-900 rounded-md px-2 py-1.5 text-sm text-right text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-teal-500"
            />
            {weightDelta !== null && (
              <span className={`text-xs ${weightDelta > 0 ? "text-red-400" : weightDelta < 0 ? "text-teal-400" : "text-zinc-500"}`}>
                {weightDelta > 0 ? `+${weightDelta}` : weightDelta}kg
              </span>
            )}
          </div>
          <WeightChart weightLog={weightLog} />
        </div>
      </div>
    </div>
  );
}

function WeightChart({ weightLog }) {
  const dates = Object.keys(weightLog).sort();
  const recent = dates.slice(-14);
  const data = recent.map((d) => ({ date: d.slice(5), weight: Number(weightLog[d]) }));

  if (data.length < 2) {
    return (
      <div className="bg-zinc-900 rounded-lg h-36 flex items-center justify-center text-center px-3">
        <span className="text-[11px] text-zinc-600 leading-relaxed">체중을 이틀 이상 기록하면{"\n"}변화 그래프가 나타나요.</span>
      </div>
    );
  }

  const values = data.map((d) => d.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.3);

  return (
    <div className="bg-zinc-900 rounded-lg pt-3 pr-3 pb-1">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[min - pad, max + pad]} tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#a1a1aa" }}
            itemStyle={{ color: "#2dd4bf" }}
            formatter={(v) => [`${v}kg`, "체중"]}
          />
          <Line type="monotone" dataKey="weight" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2.5, fill: "#2dd4bf" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AddExerciseForm({ onSubmit }) {
  const [bodyPart, setBodyPart] = useState(ADD_BODY_PARTS[0]);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("12");
  const [weight, setWeight] = useState("");
  const [equipmentUsed, setEquipmentUsed] = useState(null);

  const equipmentChoices = equipmentOptionsFor(bodyPart);

  return (
    <div className="bg-zinc-900 rounded-lg p-4 mb-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ADD_BODY_PARTS.map((bp) => (
          <button
            key={bp}
            onClick={() => { setBodyPart(bp); setEquipmentUsed(null); }}
            className={`px-3 py-1 rounded-full text-xs ${bodyPart === bp ? "bg-orange-500 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}
          >
            {bp}
          </button>
        ))}
      </div>

      <div>
        <div className="text-[11px] text-zinc-500 mb-1.5">사용 기구 (선택하면 운동 이름에 자동 입력)</div>
        <div className="flex flex-wrap gap-1.5">
          {equipmentChoices.map((eq) => (
            <button
              key={eq}
              onClick={() => {
                setEquipmentUsed((cur) => {
                  const next = cur === eq ? null : eq;
                  setName(next || "");
                  return next;
                });
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] ${equipmentUsed === eq ? "bg-teal-500 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="운동 이름 (예: 스쿼트)"
        className="w-full bg-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-orange-500"
      />
      <div className="grid grid-cols-3 gap-2">
        <input value={sets} onChange={(e) => setSets(e.target.value)} placeholder="세트" className="bg-zinc-800 rounded-md px-2 py-2 text-sm text-center text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500" />
        <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="횟수" className="bg-zinc-800 rounded-md px-2 py-2 text-sm text-center text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500" />
        <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="중량(kg)" className="bg-zinc-800 rounded-md px-2 py-2 text-sm text-center text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500" />
      </div>

      <button
        onClick={() => {
          if (!name.trim()) return;
          onSubmit({ bodyPart, name: name.trim(), sets, reps, weight, equipment: equipmentUsed ? [equipmentUsed] : [] });
        }}
        className="w-full bg-orange-500 text-zinc-950 rounded-md py-2 text-sm font-semibold flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" /> 기록에 추가
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommend tab
// ---------------------------------------------------------------------------

function RecommendTab({ logs, settings, adjustments, onAdd, onFeedback, onLevelChange }) {
  const todayStr = toDateStr(new Date());
  const level = settings.level || "중급";
  const rec = useMemo(() => computeRecommendation(logs, todayStr, level), [logs, todayStr, level]);
  const difficultParts = settings.difficultParts || [];
  const equipment = settings.equipment || [];
  const [pending, setPending] = useState({});

  const levelToggle = (
    <div className="flex gap-1.5 mb-5">
      {LEVELS.map((lv) => (
        <button
          key={lv}
          onClick={() => onLevelChange(lv)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium ${
            level === lv ? "bg-orange-500 text-zinc-950" : "bg-zinc-900 text-zinc-500"
          }`}
        >
          {lv}
        </button>
      ))}
    </div>
  );

  const weeklyRestNote = (
    <div className="text-xs text-zinc-500 mb-5">
      이번 주 완전휴식 <span className="text-teal-400 font-semibold">{rec.restDaysInWeek}</span>일 (권장 <span className="text-orange-400 font-semibold">{rec.minRestPerWeek}</span>일 이상)
    </div>
  );

  if (rec.rest) {
    const isWeekly = rec.reason === "weekly";
    return (
      <div className="px-5 pt-6">
        <div style={{ fontFamily: "Oswald, sans-serif" }} className="text-lg font-medium mb-1">오늘의 추천</div>
        {levelToggle}
        {weeklyRestNote}
        <div className="bg-zinc-900 rounded-xl p-5">
          <div className="text-orange-500 font-semibold mb-2">
            {isWeekly ? "오늘은 완전휴식일이에요" : "오늘은 회복이 필요해요"}
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {isWeekly
              ? `${level} 기준 일주일에 최소 ${rec.minRestPerWeek}일은 완전히 쉬는 게 좋아요. 이번 주는 아직 ${rec.restDaysInWeek}일밖에 못 쉬었으니, 오늘은 근력 운동 없이 가볍게 산책이나 스트레칭 정도로 몸을 회복시켜 주세요.`
              : "최근 훈련한 부위들이 아직 48시간 회복 시간을 다 채우지 못했어요. 근육은 자극받은 후 48~72시간 정도 쉬어야 제대로 회복되니, 오늘은 가벼운 유산소나 스트레칭으로 대신해 주세요."}
          </p>
        </div>
      </div>
    );
  }

  const bodyPart = rec.bodyPart;
  const list = EXERCISES[bodyPart];

  const items = list.map((ex) => {
    const cautionJoints = ex.strain.filter((s) => difficultParts.includes(s));
    const missingEquip = (ex.equipment || []).filter((e) => !equipment.includes(e));
    const caution = cautionJoints.length > 0;
    const equipSwap = missingEquip.length > 0;
    const chosen = caution || equipSwap ? { ...ex.alt, bodyPart, caution, cautionJoints, equipSwap } : { ...ex, bodyPart, caution: false, equipSwap: false };
    const feedbackAdj = adjustments[chosen.name] || 0;
    const levelAdj = LEVEL_SET_ADJUST[level] ?? 0;
    return { ...chosen, sets: Math.max(1, chosen.sets + feedbackAdj + levelAdj) };
  });

  return (
    <div className="px-5 pt-6">
      <div style={{ fontFamily: "Oswald, sans-serif" }} className="text-lg font-medium mb-1">오늘의 추천</div>
      {levelToggle}
      {weeklyRestNote}
      <div className="text-xs text-zinc-500 mb-5">
        {rec.lastTrained[bodyPart] === Infinity ? "아직 기록이 없는 부위예요" : `${rec.lastTrained[bodyPart]}일 전에 마지막으로 훈련했어요 (48시간 이상 지나 회복됐어요)`}
      </div>

      <div className="bg-zinc-900 rounded-xl p-5 mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-orange-500 font-semibold text-base">{bodyPart} 운동</div>
          <span className="text-xs text-zinc-500">{items.length}개 운동</span>
        </div>
        <p className="text-xs text-zinc-500">가장 오래 쉰 부위를 우선으로 골랐어요.</p>
      </div>

      <div className="space-y-2.5">
        {items.map((it, idx) => {
          const loggedToday = (logs[todayStr] || []).some((e) => e.name === it.name);
          return (
          <div key={idx} className="bg-zinc-900 rounded-lg px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-100">{it.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{it.sets}세트 × {it.reps}</div>
                {it.equipment && it.equipment.length > 0 && (
                  <div className="text-[11px] text-zinc-600 mt-1">필요 장비: {it.equipment.join(", ")}</div>
                )}
                {(it.caution || it.equipSwap) && (
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    {it.caution && it.equipSwap
                      ? `${it.cautionJoints.join(", ")} 부담 및 보유 장비에 맞춘 대체 동작이에요`
                      : it.caution
                      ? `${it.cautionJoints.join(", ")} 부담 적은 대체 동작이에요`
                      : "보유 장비에 맞춘 대체 동작이에요"}
                  </div>
                )}
                <a
                  href={ytSearchUrl(it.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-teal-400"
                >
                  <PlayCircle className="w-3 h-3" />
                  자세 영상 보기
                </a>
              </div>
              {loggedToday ? (
                <button disabled className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 bg-zinc-800 text-zinc-500">
                  <Check className="w-3.5 h-3.5" /> 완료
                </button>
              ) : pending[idx] ? (
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  <span className="text-[10px] text-zinc-500 mb-0.5">어땠어요?</span>
                  <div className="flex gap-1">
                    {[
                      { key: "easy", label: "쉬웠음" },
                      { key: "normal", label: "보통" },
                      { key: "hard", label: "힘들었음" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => {
                          onAdd(todayStr, { bodyPart, name: it.name, sets: it.sets, reps: it.reps, weight: "" });
                          onFeedback(it.name, f.key);
                          setPending((p) => ({ ...p, [idx]: false }));
                        }}
                        className="px-2 py-1 rounded-md text-[11px] bg-zinc-800 text-zinc-300"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPending((p) => ({ ...p, [idx]: true }))}
                  className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 bg-orange-500 text-zinc-950"
                >
                  <Plus className="w-3.5 h-3.5" /> 기록
                </button>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab({ settings, onSave, note, setNote }) {
  const [weight, setWeight] = useState(settings.weight || "");
  const [height, setHeight] = useState(settings.height || "");
  const [difficultParts, setDifficultParts] = useState(settings.difficultParts || []);
  const [equipment, setEquipment] = useState(settings.equipment || []);

  const toggleJoint = (j) => {
    setDifficultParts((prev) => (prev.includes(j) ? prev.filter((p) => p !== j) : [...prev, j]));
  };

  const toggleEquipment = (eq) => {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((p) => p !== eq) : [...prev, eq]));
  };

  const bmi = weight && height ? (Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1) : null;
  const bmiLabel = bmi
    ? bmi < 18.5 ? "저체중" : bmi < 23 ? "정상" : bmi < 25 ? "과체중" : "비만"
    : null;

  return (
    <div className="px-5 pt-6">
      <div style={{ fontFamily: "Oswald, sans-serif" }} className="text-lg font-medium mb-5">내 정보</div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">몸무게 (kg)</label>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            placeholder="예: 68"
            className="w-full bg-zinc-900 rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">키 (cm)</label>
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            inputMode="decimal"
            placeholder="예: 172"
            className="w-full bg-zinc-900 rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        {bmi && (
          <div className="text-xs text-zinc-500">
            BMI {bmi} · <span className="text-zinc-300">{bmiLabel}</span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="text-xs text-zinc-500 mb-2 block">운동하기 힘든 부위 (선택)</label>
        <div className="flex flex-wrap gap-1.5">
          {JOINTS.map((j) => (
            <button
              key={j}
              onClick={() => toggleJoint(j)}
              className={`px-3 py-1.5 rounded-full text-xs ${
                difficultParts.includes(j) ? "bg-orange-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
              }`}
            >
              {j}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">선택한 부위에 부담이 되는 운동은 추천 탭에서 대체 동작으로 바뀌어요.</p>
      </div>

      <div className="mb-6">
        <label className="text-xs text-zinc-500 mb-2 block">보유/이용 가능 헬스 기구</label>
        <div className="space-y-3">
          {EQUIPMENT_CATEGORIES.map(({ category, items }) => (
            <div key={category}>
              <div className="text-[11px] text-zinc-600 mb-1.5">{category}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => toggleEquipment(eq)}
                    className={`px-3 py-1.5 rounded-full text-xs ${
                      equipment.includes(eq) ? "bg-teal-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">등록한 기구가 없는 운동은 추천 탭에서 맨몸/밴드 대체 동작으로 바뀌어요.</p>
      </div>

      <button
        onClick={() => { onSave({ weight, height, difficultParts, equipment }); setNote("저장됐어요"); setTimeout(() => setNote(""), 1500); }}
        className="w-full bg-orange-500 text-zinc-950 rounded-md py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" /> 저장
      </button>
      {note && <div className="text-center text-xs text-orange-400 mt-2 flex items-center justify-center gap-1"><RotateCcw className="w-3 h-3" />{note}</div>}
    </div>
  );
}
