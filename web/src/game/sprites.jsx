// Персонажи игры — собственная векторная графика: Барсик в красной кепке и хрюшки-боссы.

const FUR = "#d9d3c4", FUR_D = "#b9b1a0", SPOT = "#3b3a36", CREAM = "#f7f3ea", CAP = "#d62828", CAP_D = "#a51d1d";

const spots = [[62, 150, 7, 5], [140, 146, 6, 5], [72, 176, 5, 4], [133, 178, 6, 4], [64, 96, 4, 3], [137, 98, 4, 3], [58, 80, 3, 3], [143, 82, 3, 3]];

const Head = () => (
  <g className="b-head">
    <circle cx="64" cy="50" r="15" fill={FUR} /><circle cx="64" cy="51" r="8" fill="#8c8478" />
    <circle cx="136" cy="50" r="15" fill={FUR} /><circle cx="136" cy="51" r="8" fill="#8c8478" />
    <circle cx="100" cy="88" r="46" fill={FUR} />
    {spots.slice(4).map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={SPOT} />)}
    <ellipse cx="100" cy="108" rx="23" ry="16" fill={CREAM} />
    <g className="b-eyes">
      <ellipse cx="82" cy="88" rx="8.5" ry="9" fill="#9bd13a" /><ellipse cx="118" cy="88" rx="8.5" ry="9" fill="#9bd13a" />
      <ellipse cx="83" cy="89" rx="3" ry="6" fill="#1b1c1f" /><ellipse cx="117" cy="89" rx="3" ry="6" fill="#1b1c1f" />
      <path d="M72 84 Q82 76 92 85 L92 78 L72 77 Z M108 85 Q118 76 128 84 L128 77 L108 78 Z" fill={FUR} />
      <path d="M72 82 Q82 76 93 84 M107 84 Q118 76 128 82" fill="none" stroke={SPOT} strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <g className="b-eyes-x" stroke={SPOT} strokeWidth="3.5" strokeLinecap="round"><path d="M76 82 l12 12 M88 82 l-12 12 M112 82 l12 12 M124 82 l-12 12" /></g>
    <path d="M94 100 h12 l-6 7 Z" fill="#3b2f2f" />
    <path className="b-mouth" d="M100 107 v5 M100 112 q-7 6 -13 1 M100 112 q7 6 13 1" fill="none" stroke="#3b2f2f" strokeWidth="2" strokeLinecap="round" />
    <path d="M78 108 h-22 M79 113 l-21 6 M122 108 h22 M121 113 l21 6" stroke="#8c8478" strokeWidth="1.3" strokeLinecap="round" />
    {/* красная кепка козырьком назад-вбок */}
    <path d="M142 62 Q178 50 186 68 Q166 76 144 78 Z" fill={CAP_D} />
    <path d="M55 80 Q54 34 100 32 Q146 34 146 78 Q100 60 55 80 Z" fill={CAP} />
    <path d="M100 33 Q88 50 84 69 M100 33 Q112 50 117 68" fill="none" stroke={CAP_D} strokeWidth="2" />
    <circle cx="100" cy="33" r="4.5" fill={CAP_D} />
  </g>
);

/** pose: idle | attack | hurt | win */
export function Barsik({ pose = "idle", size = 150, title = "Барсик" }) {
  return (
    <svg className={`barsik pose-${pose}`} viewBox="0 0 220 230" width={size} height={size * 1.045} role="img" aria-label={title}>
      <g className="b-tail"><path d="M148 190 Q200 196 196 150 Q194 128 178 126" fill="none" stroke={FUR} strokeWidth="16" strokeLinecap="round" />
        <path d="M186 186 l8 -10 M197 164 l-13 -2 M194 142 l-12 6" stroke={SPOT} strokeWidth="5" strokeLinecap="round" /></g>
      <g className="b-body">
        <ellipse cx="100" cy="165" rx="50" ry="46" fill={FUR} />
        <ellipse cx="100" cy="174" rx="29" ry="31" fill={CREAM} />
        <ellipse cx="72" cy="210" rx="21" ry="10" fill={FUR} /><ellipse cx="128" cy="210" rx="21" ry="10" fill={FUR} />
        {spots.slice(0, 4).map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke={SPOT} strokeWidth="3" />)}
        <ellipse className="b-arm-l" cx="80" cy="190" rx="11" ry="17" fill={FUR} stroke={FUR_D} strokeWidth="1.5" />
        <g className="b-arm-r"><ellipse cx="122" cy="190" rx="11" ry="17" fill={FUR} stroke={FUR_D} strokeWidth="1.5" />
          <circle className="b-ball" cx="122" cy="172" r="11" fill="#ffcc33" stroke="#b8860b" strokeWidth="2" /></g>
      </g>
      <Head />
    </svg>
  );
}

/** Барсик стоит со скейтом в лапах — для блока «BSL» на главной. */
export function BarsikSkater({ size = 190, title = "Барсик со скейтом" }) {
  return (
    <svg className="barsik pose-idle skater" viewBox="0 0 250 300" width={size} height={size * 1.2} role="img" aria-label={title}>
      <g className="b-tail"><path d="M132 232 Q196 244 196 192 Q196 170 180 166" fill="none" stroke={FUR} strokeWidth="15" strokeLinecap="round" />
        <path d="M184 228 l8 -10 M197 204 l-13 -2 M194 182 l-12 6" stroke={SPOT} strokeWidth="5" strokeLinecap="round" /></g>
      {/* ноги и кеды */}
      <rect x="76" y="218" width="20" height="56" rx="10" fill={FUR} /><rect x="108" y="218" width="20" height="56" rx="10" fill={FUR} />
      <path d="M66 282 q0 -14 16 -14 h14 v14 Z M102 282 v-14 h14 q16 0 16 14 Z" fill={CAP} /><path d="M66 282 h30 M102 282 h30" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      {/* тело */}
      <ellipse cx="102" cy="186" rx="40" ry="50" fill={FUR} /><ellipse cx="102" cy="194" rx="23" ry="34" fill={CREAM} />
      <ellipse cx="70" cy="170" rx="6" ry="4" fill="none" stroke={SPOT} strokeWidth="3" /><ellipse cx="134" cy="208" rx="5" ry="4" fill="none" stroke={SPOT} strokeWidth="3" /><ellipse cx="72" cy="212" rx="5" ry="4" fill="none" stroke={SPOT} strokeWidth="3" />
      {/* скейт: стоит торцом на земле, Барсик придерживает его лапами */}
      <g transform="rotate(8 196 190)">
        <rect x="181" y="86" width="26" height="198" rx="13" fill="#ffcc33" stroke="#b8860b" strokeWidth="3" />
        <path d="M194 104 v162" stroke="#d62828" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 14" />
        <rect x="207" y="112" width="9" height="30" rx="3" fill="#8d99ae" /><rect x="207" y="228" width="9" height="30" rx="3" fill="#8d99ae" />
        <circle cx="222" cy="118" r="9" fill="#1b1c1f" /><circle cx="222" cy="136" r="9" fill="#1b1c1f" /><circle cx="222" cy="234" r="9" fill="#1b1c1f" /><circle cx="222" cy="252" r="9" fill="#1b1c1f" />
        <circle cx="222" cy="118" r="3.5" fill="#ffcc33" /><circle cx="222" cy="136" r="3.5" fill="#ffcc33" /><circle cx="222" cy="234" r="3.5" fill="#ffcc33" /><circle cx="222" cy="252" r="3.5" fill="#ffcc33" />
      </g>
      {/* лапы: левая на поясе, правая держит доску */}
      <path d="M68 164 Q46 186 64 206" fill="none" stroke={FUR} strokeWidth="17" strokeLinecap="round" />
      <path d="M134 162 Q160 160 184 176" fill="none" stroke={FUR} strokeWidth="17" strokeLinecap="round" />
      <path d="M134 196 Q160 214 186 222" fill="none" stroke={FUR} strokeWidth="17" strokeLinecap="round" />
      <circle cx="188" cy="177" r="11" fill={CREAM} stroke={FUR_D} strokeWidth="1.5" /><circle cx="190" cy="223" r="11" fill={CREAM} stroke={FUR_D} strokeWidth="1.5" />
      <g transform="translate(2 36)"><Head /></g>
    </svg>
  );
}

const SKINS = {
  star: (
    <g><path d="M100 24 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2 Z" fill="#ffcc33" stroke="#b8860b" strokeWidth="2.5" />
      <path d="M40 150 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z M162 148 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill="#ffcc33" /></g>
  ),
  twin: <g opacity=".95"><circle cx="150" cy="70" r="30" fill="var(--pig-d)" /><path d="M128 48 l4 -18 14 12 Z M172 48 l-2 -18 -14 10 Z" fill="var(--pig-d)" /><circle cx="141" cy="64" r="5" fill="#fff" /><circle cx="160" cy="64" r="5" fill="#fff" /><circle cx="142" cy="65" r="2.2" /><circle cx="159" cy="65" r="2.2" /><ellipse cx="150" cy="78" rx="11" ry="8" fill="var(--pig-l)" /></g>,
  viking: (
    <g><path d="M48 62 Q20 40 30 14 Q44 36 62 46 Z M152 62 Q180 40 170 14 Q156 36 138 46 Z" fill="#f4f0e6" stroke="#8c8478" strokeWidth="2.5" />
      <path d="M44 70 Q46 26 100 24 Q154 26 156 70 Q100 50 44 70 Z" fill="#8d99ae" stroke="#56607a" strokeWidth="3" /><path d="M100 25 V58" stroke="#56607a" strokeWidth="5" /></g>
  ),
  nested: (
    <g fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="3"><circle cx="100" cy="158" r="22" /><circle cx="100" cy="158" r="13" /><circle cx="100" cy="158" r="5" fill="#fff" />
      <path d="M40 60 Q100 20 160 60" stroke="#6c5ce7" strokeOpacity="1" strokeWidth="9" strokeLinecap="round" /></g>
  ),
  clock: (
    <g><path d="M62 150 Q100 176 138 150" fill="none" stroke="#b8860b" strokeWidth="3" /><circle cx="100" cy="170" r="17" fill="#fff" stroke="#b8860b" strokeWidth="4" /><path d="M100 170 V159 M100 170 l8 5" stroke="#1b1c1f" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 40 h88 l-10 -22 h-68 Z" fill="#2d3436" /><rect x="46" y="38" width="108" height="8" rx="4" fill="#2d3436" /></g>
  ),
  miner: (
    <g><path d="M42 68 Q44 26 100 24 Q156 26 158 68 Z" fill="#ff9f1c" stroke="#b86e00" strokeWidth="3" /><rect x="34" y="62" width="132" height="10" rx="5" fill="#ff9f1c" stroke="#b86e00" strokeWidth="3" />
      <circle cx="100" cy="44" r="11" fill="#fff8d6" stroke="#b86e00" strokeWidth="3" /><rect x="86" y="164" width="28" height="7" rx="3" fill="#fff" /></g>
  ),
  king: (
    <g><path d="M52 58 L44 14 L72 36 L100 6 L128 36 L156 14 L148 58 Z" fill="#ffcc33" stroke="#b8860b" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="30" r="6" fill="#d62828" /><circle cx="64" cy="42" r="4" fill="#54a0ff" /><circle cx="136" cy="42" r="4" fill="#54a0ff" />
      <path d="M78 166 l22 10 22 -10 v20 l-22 -8 -22 8 Z" fill="#6c5ce7" /><circle cx="100" cy="176" r="5" fill="#ffcc33" /></g>
  ),
};

/** state: idle | hit | attack | dead */
export function Pig({ skin = "star", color = "#ff8fab", state = "idle", size = 150, title = "Хряк" }) {
  return (
    <svg className={`pig st-${state}`} viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={title}
      style={{ "--pig": color, "--pig-d": `color-mix(in srgb, ${color} 72%, #5a1a2b)`, "--pig-l": `color-mix(in srgb, ${color} 55%, #fff)` }}>
      <path d="M166 150 q22 -2 18 -20 q-3 -12 -14 -6 q-8 6 2 12" fill="none" stroke="var(--pig-d)" strokeWidth="6" strokeLinecap="round" />
      <rect x="62" y="186" width="22" height="26" rx="8" fill="var(--pig-d)" /><rect x="116" y="186" width="22" height="26" rx="8" fill="var(--pig-d)" />
      <path d="M38 76 L30 34 L70 56 Z M162 76 L170 34 L130 56 Z" fill="var(--pig-d)" />
      <circle cx="100" cy="122" r="72" fill="var(--pig)" stroke="var(--pig-d)" strokeWidth="4" />
      <ellipse cx="100" cy="134" rx="31" ry="23" fill="var(--pig-l)" stroke="var(--pig-d)" strokeWidth="3" />
      <ellipse cx="89" cy="134" rx="6" ry="9" fill="var(--pig-d)" /><ellipse cx="111" cy="134" rx="6" ry="9" fill="var(--pig-d)" />
      <g className="p-eyes"><circle cx="70" cy="98" r="15" fill="#fff" /><circle cx="130" cy="98" r="15" fill="#fff" /><circle cx="73" cy="101" r="6.5" fill="#1b1c1f" /><circle cx="127" cy="101" r="6.5" fill="#1b1c1f" /></g>
      <g className="p-eyes-x" stroke="#1b1c1f" strokeWidth="5" strokeLinecap="round"><path d="M60 88 l20 20 M80 88 l-20 20 M120 88 l20 20 M140 88 l-20 20" /></g>
      <path d="M50 80 L88 92 M150 80 L112 92" stroke="#3b1220" strokeWidth="8" strokeLinecap="round" />
      <path className="p-mouth" d="M82 166 q18 -12 36 0" fill="none" stroke="#3b1220" strokeWidth="4" strokeLinecap="round" />
      {SKINS[skin]}
    </svg>
  );
}

export const Heart = ({ on }) => (
  <svg viewBox="0 0 24 22" width="22" height="20" aria-hidden="true" className={on ? "heart on" : "heart"}><path d="M12 21 C-6 9 4 -3 12 5 C20 -3 30 9 12 21 Z" /></svg>
);
export const StarRow = ({ n, of = 3 }) => <span className="starrow" aria-label={`${n} из ${of} звёзд`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? "on" : ""}>★</i>)}</span>;
