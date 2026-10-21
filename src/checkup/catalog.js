// Standard checkup items. Results from different hospitals name the same test
// differently (AST / SGOT / GOT), so every extracted value is mapped onto one
// of these keys before it is stored or compared across years.
//
// Thresholds follow the Korean national health screening (국가건강검진) cut-offs
// where one exists, otherwise a commonly used lab reference range.
//   bad: "high" -> higher is worse, "low" -> lower is worse, "both" -> outside range is worse
//   normal / caution: [min, max] bands (null = open-ended). Anything outside
//   caution is "abnormal". Either may be split by sex: { M: [...], F: [...] }.
//   rangeLabel: optional display text for the normal range when the raw band reads awkwardly.

export const CATEGORIES = ["신체계측", "혈압", "당뇨", "이상지질", "간기능", "신장", "빈혈·혈액", "기타", "종양표지자"];

export const ITEMS = [
  { key: "height", name: "신장", unit: "cm", category: "신체계측", aliases: ["키", "Height"], info: true },
  { key: "weight", name: "체중", unit: "kg", category: "신체계측", aliases: ["몸무게", "Weight"], info: true },
  { key: "bmi", name: "체질량지수(BMI)", unit: "kg/m²", category: "신체계측", aliases: ["BMI", "체질량지수"],
    bad: "both", normal: [18.5, 22.9], caution: [18.5, 24.9],
    tip: "BMI 23~24.9는 과체중, 25 이상은 비만 범위입니다." },
  { key: "waist", name: "허리둘레", unit: "cm", category: "신체계측", aliases: ["복부둘레", "Waist"],
    bad: "high", normal: { M: [null, 89.9], F: [null, 84.9] }, caution: { M: [null, 89.9], F: [null, 84.9] },
    rangeLabel: { M: "90 미만", F: "85 미만" },
    tip: "남성 90cm, 여성 85cm 이상이면 복부비만입니다." },
  { key: "body_fat", name: "체지방률", unit: "%", category: "신체계측", aliases: ["체지방"], info: true },

  { key: "sbp", name: "수축기 혈압", unit: "mmHg", category: "혈압", aliases: ["최고혈압", "SBP", "Systolic"],
    bad: "high", normal: [null, 119], caution: [null, 139],
    tip: "120~139는 고혈압 전단계, 140 이상은 고혈압 의심입니다." },
  { key: "dbp", name: "이완기 혈압", unit: "mmHg", category: "혈압", aliases: ["최저혈압", "DBP", "Diastolic"],
    bad: "high", normal: [null, 79], caution: [null, 89],
    tip: "80~89는 고혈압 전단계, 90 이상은 고혈압 의심입니다." },

  { key: "fbs", name: "공복혈당", unit: "mg/dL", category: "당뇨", aliases: ["식전혈당", "Glucose", "FBS", "혈당"],
    bad: "high", normal: [null, 99], caution: [null, 125],
    tip: "100~125는 공복혈당장애(당뇨 전단계), 126 이상은 당뇨 의심입니다." },
  { key: "hba1c", name: "당화혈색소", unit: "%", category: "당뇨", aliases: ["HbA1c", "A1c"],
    bad: "high", normal: [null, 5.6], caution: [null, 6.4],
    tip: "5.7~6.4%는 당뇨 전단계, 6.5% 이상은 당뇨 기준입니다." },

  { key: "total_chol", name: "총콜레스테롤", unit: "mg/dL", category: "이상지질", aliases: ["T-Chol", "Total Cholesterol", "콜레스테롤"],
    bad: "high", normal: [null, 199], caution: [null, 239] },
  { key: "hdl", name: "HDL 콜레스테롤", unit: "mg/dL", category: "이상지질", aliases: ["HDL", "고밀도 콜레스테롤", "좋은 콜레스테롤"],
    bad: "low", normal: [40, null], caution: [40, null],
    tip: "HDL은 높을수록 좋습니다. 40 미만이면 낮은 편입니다." },
  { key: "ldl", name: "LDL 콜레스테롤", unit: "mg/dL", category: "이상지질", aliases: ["LDL", "저밀도 콜레스테롤", "나쁜 콜레스테롤"],
    bad: "high", normal: [null, 129], caution: [null, 159] },
  { key: "tg", name: "중성지방", unit: "mg/dL", category: "이상지질", aliases: ["TG", "Triglyceride", "트리글리세라이드"],
    bad: "high", normal: [null, 149], caution: [null, 199],
    tip: "음주·야식·탄수화물 섭취에 민감하게 반응하는 수치입니다." },

  { key: "ast", name: "AST(SGOT)", unit: "U/L", category: "간기능", aliases: ["AST", "SGOT", "GOT"],
    bad: "high", normal: [null, 40], caution: [null, 50] },
  { key: "alt", name: "ALT(SGPT)", unit: "U/L", category: "간기능", aliases: ["ALT", "SGPT", "GPT"],
    bad: "high", normal: [null, 35], caution: [null, 45],
    tip: "지방간이 있으면 ALT가 먼저 오르는 경우가 많습니다." },
  { key: "ggt", name: "감마지티피(γ-GTP)", unit: "U/L", category: "간기능", aliases: ["GGT", "γ-GTP", "r-GTP", "감마GTP"],
    bad: "high", normal: { M: [null, 63], F: [null, 35] }, caution: { M: [null, 77], F: [null, 45] },
    tip: "음주량을 잘 반영하는 수치입니다." },

  { key: "creatinine", name: "혈청 크레아티닌", unit: "mg/dL", category: "신장", aliases: ["Creatinine", "Cr", "크레아티닌"],
    bad: "high", normal: [null, 1.5], caution: [null, 1.5] },
  { key: "egfr", name: "신사구체여과율(eGFR)", unit: "mL/min/1.73m²", category: "신장", aliases: ["eGFR", "GFR", "신사구체여과율"],
    bad: "low", normal: [60, null], caution: [60, null],
    tip: "60 미만이 3개월 이상 지속되면 만성콩팥병 기준입니다." },
  { key: "urine_protein", name: "요단백", category: "신장", aliases: ["뇨단백", "Urine Protein"], qualitative: true },

  { key: "hb", name: "혈색소(헤모글로빈)", unit: "g/dL", category: "빈혈·혈액", aliases: ["Hb", "Hemoglobin", "혈색소"],
    bad: "both", normal: { M: [13, 16.5], F: [12, 15.5] }, caution: { M: [12, 17.5], F: [10, 16.5] } },
  { key: "wbc", name: "백혈구", unit: "10³/µL", category: "빈혈·혈액", aliases: ["WBC"],
    bad: "both", normal: [4, 10], caution: [3.5, 11] },
  { key: "plt", name: "혈소판", unit: "10³/µL", category: "빈혈·혈액", aliases: ["PLT", "Platelet"],
    bad: "both", normal: [150, 450], caution: [130, 500] },

  { key: "uric_acid", name: "요산", unit: "mg/dL", category: "기타", aliases: ["Uric Acid"],
    bad: "high", normal: { M: [null, 7.0], F: [null, 6.0] }, caution: { M: [null, 8.0], F: [null, 7.0] },
    tip: "높으면 통풍 위험이 커집니다." },
  { key: "tsh", name: "갑상선자극호르몬(TSH)", unit: "µIU/mL", category: "기타", aliases: ["TSH"],
    bad: "both", normal: [0.4, 4.5], caution: [0.3, 6] },
  { key: "vitd", name: "비타민 D", unit: "ng/mL", category: "기타", aliases: ["25(OH)D", "Vitamin D"],
    bad: "low", normal: [30, null], caution: [20, null] },
  { key: "bone_t", name: "골밀도 T-score", unit: "", category: "기타", aliases: ["T-score", "골밀도"],
    bad: "low", normal: [-1, null], caution: [-2.5, null],
    tip: "-1 ~ -2.5는 골감소증, -2.5 이하는 골다공증 범위입니다." },

  { key: "cea", name: "CEA", unit: "ng/mL", category: "종양표지자", aliases: ["암태아성항원"],
    bad: "high", normal: [null, 5], caution: [null, 5] },
  { key: "afp", name: "AFP", unit: "ng/mL", category: "종양표지자", aliases: ["알파태아단백"],
    bad: "high", normal: [null, 10], caution: [null, 10] },
  { key: "psa", name: "PSA", unit: "ng/mL", category: "종양표지자", aliases: ["전립선특이항원"],
    bad: "high", normal: [null, 4], caution: [null, 4] },
  { key: "ca199", name: "CA19-9", unit: "U/mL", category: "종양표지자", aliases: [],
    bad: "high", normal: [null, 37], caution: [null, 37] },
  { key: "ca125", name: "CA125", unit: "U/mL", category: "종양표지자", aliases: [],
    bad: "high", normal: [null, 35], caution: [null, 35] },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
