import React, { useState } from "react";

// Tappable muscle map for the recommend tab. Each muscle shape belongs to one
// of the app's body-part groups (BODY_PARTS), so tapping it selects that group.
// Coordinates are in a 200x260 viewBox: a figure standing with arms spread.

const SILHOUETTE = "#27272a";
const COLORS = {
  idle: "#5b5b63",
  recovering: "#323238",
  recommended: "rgba(249, 115, 22, 0.35)",
  selected: "#f97316",
};

// Each arm is drawn as the left-side shape plus its mirror around x = 100.
const mirror = (shape) => ({ ...shape, mirrored: true });

const FRONT = [
  { part: "어깨", type: "circle", cx: 72, cy: 54, r: 9 },
  { part: "가슴", type: "path", d: "M99,56 L99,84 Q88,91 77,83 Q73,69 81,57 Z" },
  { part: "팔", type: "ellipse", cx: 57, cy: 74, rx: 6, ry: 15, rotate: 31 },
  { part: "팔", type: "ellipse", cx: 36, cy: 111, rx: 5, ry: 13, rotate: 31 },
  { part: "코어", type: "rect", x: 89, y: 90, width: 22, height: 48, rx: 6, center: true },
  { part: "코어", type: "path", d: "M79,94 L87,92 L87,132 L81,134 Q77,114 79,94 Z" },
  { part: "하체", type: "ellipse", cx: 88, cy: 176, rx: 10, ry: 27 },
  { part: "하체", type: "ellipse", cx: 88, cy: 224, rx: 6, ry: 16 },
];

const BACK = [
  { part: "등", type: "path", d: "M100,40 L118,50 L108,70 L100,75 L92,70 L82,50 Z", center: true },
  { part: "어깨", type: "circle", cx: 72, cy: 54, r: 9 },
  { part: "등", type: "path", d: "M79,63 Q76,96 90,119 L98,111 L96,74 Z" },
  { part: "등", type: "rect", x: 92, y: 112, width: 16, height: 28, rx: 5, center: true },
  { part: "팔", type: "ellipse", cx: 57, cy: 74, rx: 6, ry: 15, rotate: 31 },
  { part: "팔", type: "ellipse", cx: 36, cy: 111, rx: 5, ry: 13, rotate: 31 },
  { part: "하체", type: "ellipse", cx: 89, cy: 151, rx: 12, ry: 11 },
  { part: "하체", type: "ellipse", cx: 88, cy: 184, rx: 9, ry: 22 },
  { part: "하체", type: "ellipse", cx: 88, cy: 222, rx: 7, ry: 15 },
];

function expand(shapes) {
  // Centered shapes sit on the midline; everything else gets a right-side twin.
  return shapes.flatMap((s) => (s.center ? [s] : [s, mirror(s)]));
}

function Shape({ shape, fill, stroke, onClick, label }) {
  const common = {
    fill,
    stroke,
    strokeWidth: stroke ? 1.5 : 0,
    onClick,
    style: { cursor: "pointer", transition: "fill 0.15s" },
    role: "button",
    "aria-label": label,
  };
  const flip = shape.mirrored ? "translate(200,0) scale(-1,1)" : undefined;
  let el;
  if (shape.type === "circle") el = <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
  else if (shape.type === "rect")
    el = <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...common} />;
  else if (shape.type === "ellipse")
    el = (
      <ellipse
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
        {...common}
      />
    );
  else el = <path d={shape.d} {...common} />;
  return flip ? <g transform={flip}>{el}</g> : el;
}

function Silhouette() {
  return (
    <g fill={SILHOUETTE} stroke={SILHOUETTE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="100" cy="22" r="13" stroke="none" />
      <rect x="94" y="32" width="12" height="12" stroke="none" />
      <path d="M72,48 Q100,40 128,48 L124,100 Q120,120 125,146 L75,146 Q80,120 76,100 Z" stroke="none" />
      {/* arms spread down and out */}
      <polyline points="70,52 46,92 24,128" fill="none" strokeWidth="14" />
      <polyline points="130,52 154,92 176,128" fill="none" strokeWidth="14" />
      <circle cx="20" cy="135" r="7" stroke="none" />
      <circle cx="180" cy="135" r="7" stroke="none" />
      {/* legs */}
      <rect x="77" y="140" width="22" height="64" rx="10" stroke="none" />
      <rect x="101" y="140" width="22" height="64" rx="10" stroke="none" />
      <rect x="80" y="198" width="16" height="48" rx="8" stroke="none" />
      <rect x="104" y="198" width="16" height="48" rx="8" stroke="none" />
      <ellipse cx="86" cy="249" rx="10" ry="5" stroke="none" />
      <ellipse cx="114" cy="249" rx="10" ry="5" stroke="none" />
    </g>
  );
}

export default function BodyMap({ selected, recommended, recovering = [], onSelect }) {
  const [side, setSide] = useState("front");
  const shapes = expand(side === "front" ? FRONT : BACK);

  const fillFor = (part) => {
    if (part === selected) return COLORS.selected;
    if (part === recommended) return COLORS.recommended;
    if (recovering.includes(part)) return COLORS.recovering;
    return COLORS.idle;
  };

  return (
    <div className="bg-zinc-900 rounded-xl px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">근육을 눌러 운동 보기</span>
        <div className="flex bg-zinc-950 rounded-md p-0.5">
          {[
            ["front", "앞"],
            ["back", "뒤"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSide(key)}
              className={`px-3 py-1 rounded text-[11px] font-medium ${
                side === key ? "bg-zinc-700 text-zinc-100" : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 200 260" className="w-full max-w-[190px] mx-auto block select-none" style={{ touchAction: "manipulation" }}>
        <Silhouette />
        {shapes.map((s, i) => (
          <Shape
            key={`${side}-${i}`}
            shape={s}
            fill={fillFor(s.part)}
            stroke={s.part === recommended && s.part !== selected ? "#f97316" : undefined}
            onClick={() => onSelect(s.part)}
            label={s.part}
          />
        ))}
      </svg>

      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-zinc-500">
        {recommended && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-orange-500" style={{ background: COLORS.recommended }} />
            오늘 추천
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.selected }} />
          선택
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.recovering }} />
          회복 중
        </span>
      </div>
    </div>
  );
}
