// TAIWA について(/about)のイラスト。ワークショップのカバー画像と同じく、紺・金・生成りと黄色い月の平たい図形で描く。
// どれも飾りなので aria-hidden にしている(意味は見出しと本文で伝える)

// 冒頭: 灯りを囲む4つのカップと湯気。夜空に月と星
export function AboutHeroIllustration() {
  return (
    <svg className="block h-auto w-full rounded-xl bg-[#0e1628] shadow-card" viewBox="0 0 800 380" aria-hidden="true">
    <defs><radialGradient id="about-hero-hg"><stop offset="0" stopColor="#e3b071" stopOpacity="0.32"/><stop offset="1" stopColor="#e3b071" stopOpacity="0"/></radialGradient></defs>
    <circle cx="90" cy="60" r="1.6" fill="#ece7dc" opacity="0.7"/><circle cx="180" cy="120" r="1.2" fill="#ece7dc" opacity="0.5"/><circle cx="250" cy="48" r="1" fill="#ece7dc" opacity="0.4"/><circle cx="560" cy="90" r="1" fill="#ece7dc" opacity="0.4"/><circle cx="700" cy="150" r="1.2" fill="#ece7dc" opacity="0.5"/><circle cx="470" cy="40" r="1.3" fill="#ece7dc" opacity="0.5"/>
    <path d="M656 54 a26 26 0 1 0 26 37 a21 21 0 1 1 -26 -37z" fill="#f0cf8f" opacity="0.92"/>
    <path d="M130 81 Q130 90 139 90 Q130 90 130 99 Q130 90 121 90 Q130 90 130 81Z" fill="#e3b071" opacity="0.95"/>
    <path d="M300 64 Q300 70 306 70 Q300 70 300 76 Q300 70 294 70 Q300 70 300 64Z" fill="#ece7dc" opacity="0.85"/><path d="M560 39 Q560 46 567 46 Q560 46 560 53 Q560 46 553 46 Q560 46 560 39Z" fill="#ece7dc" opacity="0.9"/>
    <path d="M740 194 Q740 200 746 200 Q740 200 740 206 Q740 200 734 200 Q740 200 740 194Z" fill="#e3b071" opacity="0.8"/>
    <circle cx="350" cy="30" r="1.4" fill="#ece7dc" opacity="0.7"/><circle cx="760" cy="40" r="1.2" fill="#ece7dc" opacity="0.5"/><circle cx="150" cy="230" r="1.1" fill="#ece7dc" opacity="0.4"/>
    <circle cx="400" cy="250" r="230" fill="url(#about-hero-hg)"/>
    <rect x="0" y="300" width="800" height="80" fill="#121a2c"/>
    <line x1="0" y1="300" x2="800" y2="300" stroke="#313d58" strokeWidth="1.5"/>
    <ellipse cx="400" cy="302" rx="260" ry="14" fill="#232e49"/>
    <line x1="400" y1="300" x2="400" y2="226" stroke="#3a4766" strokeWidth="5"/>
    <path d="M372 230 L428 230 L416 196 L384 196 Z" fill="#e3b071"/>
    <ellipse cx="400" cy="231" rx="28" ry="4" fill="#f0cf8f"/>
    <ellipse cx="196" cy="297" rx="32.8" ry="3.2" fill="#bcc3d1"/><path d="M178.0 271.66 Q163.2 272.29 165.2 281.96 Q167.2 289.76 179.0 289.14" fill="none" stroke="#d3d8e1" strokeWidth="3.0" strokeLinecap="round"/><path d="M176.0 264.8 L216.0 264.8 L212.8 292.26 Q212.0 296 208.0 296 L184.0 296 Q180.0 296 179.2 292.26 Z" fill="#d3d8e1"/><ellipse cx="196" cy="264.8" rx="20.0" ry="2.8" fill="#3b2b1d"/><ellipse cx="300" cy="299" rx="35.26" ry="3.44" fill="#bcc3d1"/><path d="M280.65 271.84 Q264.74 272.51 266.89 282.91 Q269.04 291.29 281.73 290.62" fill="none" stroke="#d3d8e1" strokeWidth="3.23" strokeLinecap="round"/><path d="M278.5 264.46 L321.5 264.46 L318.06 293.98 Q317.2 298 312.9 298 L287.1 298 Q282.8 298 281.94 293.98 Z" fill="#d3d8e1"/><ellipse cx="300" cy="264.46" rx="21.5" ry="3.01" fill="#3b2b1d"/><ellipse cx="500" cy="299" rx="35.26" ry="3.44" fill="#bcc3d1"/><path d="M519.35 271.84 Q535.26 272.51 533.11 282.91 Q530.96 291.29 518.27 290.62" fill="none" stroke="#d3d8e1" strokeWidth="3.23" strokeLinecap="round"/><path d="M478.5 264.46 L521.5 264.46 L518.06 293.98 Q517.2 298 512.9 298 L487.1 298 Q482.8 298 481.94 293.98 Z" fill="#d3d8e1"/><ellipse cx="500" cy="264.46" rx="21.5" ry="3.01" fill="#3b2b1d"/><ellipse cx="604" cy="297" rx="32.8" ry="3.2" fill="#bcc3d1"/><path d="M622.0 271.66 Q636.8 272.29 634.8 281.96 Q632.8 289.76 621.0 289.14" fill="none" stroke="#d3d8e1" strokeWidth="3.0" strokeLinecap="round"/><path d="M584.0 264.8 L624.0 264.8 L620.8 292.26 Q620.0 296 616.0 296 L592.0 296 Q588.0 296 587.2 292.26 Z" fill="#d3d8e1"/><ellipse cx="604" cy="264.8" rx="20.0" ry="2.8" fill="#3b2b1d"/>
    <path d="M196 258 C186 248.2 208 241.2 196 230" fill="none" stroke="#e3b071" strokeWidth="3.5" strokeLinecap="round" opacity="0.8"/><path d="M300 256 C290 244.8 312 236.8 300 224" fill="none" stroke="#e3b071" strokeWidth="3.5" strokeLinecap="round" opacity="0.9"/><path d="M500 256 C490 244.8 512 236.8 500 224" fill="none" stroke="#e3b071" strokeWidth="3.5" strokeLinecap="round" opacity="0.9"/><path d="M604 258 C594 248.2 616 241.2 604 230" fill="none" stroke="#e3b071" strokeWidth="3.5" strokeLinecap="round" opacity="0.8"/>
    </svg>
  )
}

// なんとなく感じる心のモヤモヤ: 夜の街の街灯の下に、ひとり立つ人。頭の上にもつれた線
export function AboutUneaseIllustration() {
  return (
    <svg className="block h-auto w-full rounded-xl bg-[#0e1628] shadow-card" viewBox="0 0 400 300" aria-hidden="true"><defs><radialGradient id="about-moya-m1g"><stop offset="0" stopColor="#e3b071" stopOpacity="0.35"/><stop offset="1" stopColor="#e3b071" stopOpacity="0"/></radialGradient><radialGradient id="about-moya-m1moon"><stop offset="0" stopColor="#f0cf8f" stopOpacity="0.3"/><stop offset="1" stopColor="#f0cf8f" stopOpacity="0"/></radialGradient></defs><circle cx="40" cy="30" r="1.3" fill="#ece7dc" opacity="0.6"/><circle cx="170" cy="20" r="1" fill="#ece7dc" opacity="0.4"/><circle cx="330" cy="26" r="1.2" fill="#ece7dc" opacity="0.5"/>
    <rect x="0" y="64" width="86" height="176" fill="#16203a"/><rect x="6" y="74" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="18" y="74" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="42" y="74" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="66" y="74" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="18" y="88" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="42" y="88" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="54" y="88" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="6" y="102" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="18" y="102" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="42" y="102" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="18" y="116" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="54" y="116" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="66" y="116" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="30" y="130" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="54" y="130" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="18" y="144" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="54" y="144" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="66" y="144" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="6" y="158" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="54" y="158" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="6" y="172" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="30" y="172" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="42" y="172" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="6" y="186" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="18" y="186" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="30" y="186" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="42" y="186" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="54" y="186" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="66" y="186" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="18" y="200" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="30" y="200" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="66" y="200" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="6" y="214" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="18" y="214" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="30" y="214" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="6" y="228" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="18" y="228" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="30" y="228" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="42" y="228" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="54" y="228" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="318" y="90" width="82" height="150" fill="#16203a"/><rect x="324" y="100" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="336" y="100" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="348" y="100" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="360" y="100" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="384" y="100" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="324" y="114" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="360" y="114" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="336" y="128" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="348" y="128" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="360" y="128" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="372" y="128" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="324" y="142" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="336" y="142" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="348" y="142" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="384" y="142" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="324" y="156" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="336" y="156" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="348" y="156" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="372" y="156" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="324" y="170" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="348" y="170" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="360" y="170" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="372" y="170" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="324" y="184" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="348" y="184" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="324" y="198" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="348" y="198" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="384" y="198" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="324" y="212" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="348" y="212" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="360" y="212" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="384" y="212" width="5" height="7" fill="#e3b071" opacity="0.7"/><rect x="324" y="226" width="5" height="7" fill="#e3b071" opacity="0.9"/><rect x="348" y="226" width="5" height="7" fill="#e3b071" opacity="0.5"/><rect x="384" y="226" width="5" height="7" fill="#e3b071" opacity="0.9"/>
    <circle cx="352" cy="44" r="30" fill="url(#about-moya-m1moon)"/><circle cx="352" cy="44" r="17" fill="#f0cf8f" opacity="0.95"/>
    <rect x="0" y="240" width="400" height="60" fill="#121a2c"/><line x1="0" y1="240" x2="400" y2="240" stroke="#313d58" strokeWidth="1.5"/>
    <circle cx="230" cy="200" r="80" fill="url(#about-moya-m1g)"/>
    <line x1="262" y1="240" x2="262" y2="130" stroke="#3a4766" strokeWidth="4"/><path d="M262 132 Q262 124 250 126" fill="none" stroke="#3a4766" strokeWidth="4"/>
    <path d="M242 126 h16 l-3 7 h-10 z" fill="#f0cf8f"/>
    <ellipse cx="214" cy="242" rx="44" ry="6" fill="#e3b071" opacity="0.18"/>
    <circle cx="210" cy="179.1" r="7.35" fill="#0b1120"/><path d="M200.55 189.6 Q210 185.4 219.45 189.6 L218.4 216.9 L201.6 216.9 Z" fill="#0b1120"/><rect x="203.7" y="214.8" width="4.73" height="25.2" rx="2.1" fill="#0b1120"/><rect x="211.57" y="214.8" width="4.73" height="25.2" rx="2.1" fill="#0b1120"/>
    <path d="M178.5 158 c6.8 -15.3 23.8 -11.9 18.7 1.7 c-5.1 11.9 -22.1 3.4 -10.2 -8.5 c11.9 -11.9 30.6 -1.7 23.8 10.2 c-5.1 8.5 -17.0 5.1 -11.9 -3.4 c6.8 -8.5 20.4 -5.1 25.5 1.7" fill="none" stroke="#5a6f9c" strokeWidth="2.5" strokeLinecap="round" opacity="0.85"/>
    </svg>
  )
}

// その違和感をみんなで話しあえる場所: 焚き火をはさんで、左右から言葉が交わされる
export function AboutDialogueIllustration() {
  return (
    <svg className="block h-auto w-full rounded-xl bg-[#0e1628] shadow-card" viewBox="0 0 400 300" aria-hidden="true">
    <defs><radialGradient id="about-place-pg4"><stop offset="0" stopColor="#e3b071" stopOpacity="0.42"/><stop offset="1" stopColor="#e3b071" stopOpacity="0"/></radialGradient></defs>
    <circle cx="40" cy="40" r="1.4" fill="#ece7dc" opacity="0.6"/><circle cx="360" cy="40" r="1.2" fill="#ece7dc" opacity="0.5"/><circle cx="320" cy="90" r="1" fill="#ece7dc" opacity="0.4"/><circle cx="80" cy="110" r="1" fill="#ece7dc" opacity="0.4"/><path d="M300 25 Q300 30 305 30 Q300 30 300 35 Q300 30 295 30 Q300 30 300 25Z" fill="#ece7dc" opacity="0.7"/>
    <circle cx="200" cy="220" r="120" fill="url(#about-place-pg4)"/>
    <rect x="0" y="262" width="400" height="38" fill="#121a2c"/><line x1="0" y1="262" x2="400" y2="262" stroke="#313d58" strokeWidth="1.5"/>
    <rect x="160" y="252" width="80" height="10" rx="5" fill="#4a3626" transform="rotate(-14 200 257)"/><rect x="160" y="252" width="80" height="10" rx="5" fill="#5a4230" transform="rotate(14 200 257)"/><ellipse cx="150" cy="264" rx="12" ry="6" fill="#3a4766"/><ellipse cx="172" cy="264" rx="10" ry="6" fill="#3a4766"/><ellipse cx="228" cy="264" rx="10" ry="6" fill="#3a4766"/><ellipse cx="250" cy="264" rx="12" ry="6" fill="#3a4766"/><path d="M200 186 C218 212 230 226 223 246 C218 258 182 258 177 246 C170 226 182 212 200 186 Z" fill="#e3b071"/><path d="M200 214 C210 226 213 234 210 244 C207 250 193 250 190 244 C187 234 190 226 200 214 Z" fill="#f0cf8f"/><circle cx="214" cy="176" r="2.2" fill="#e3b071" opacity="0.8"/><circle cx="186" cy="168" r="1.8" fill="#e3b071" opacity="0.6"/><circle cx="250" cy="150" r="1.5" fill="#e3b071" opacity="0.5"/><circle cx="140" cy="118" r="1.3" fill="#e3b071" opacity="0.4"/><rect x="22" y="178" width="88" height="32" rx="16.0" fill="#d3d8e1"/><path d="M36.0 208 L30.0 224 L52.0 208 Z" fill="#d3d8e1"/><circle cx="54" cy="194" r="3" fill="#3a4766"/><circle cx="66" cy="194" r="3" fill="#3a4766"/><circle cx="78" cy="194" r="3" fill="#3a4766"/><rect x="290" y="164" width="88" height="34" rx="17.0" fill="#e3b071"/><path d="M348.0 196 L370.0 212 L364.0 196 Z" fill="#e3b071"/><circle cx="322" cy="181" r="3" fill="#5a3f22"/><circle cx="334" cy="181" r="3" fill="#5a3f22"/><circle cx="346" cy="181" r="3" fill="#5a3f22"/><rect x="52" y="112" width="84" height="30" rx="15.0" fill="#e3b071"/><path d="M65.0 140 L59.0 156 L81.0 140 Z" fill="#e3b071"/><circle cx="82" cy="127" r="3" fill="#5a3f22"/><circle cx="94" cy="127" r="3" fill="#5a3f22"/><circle cx="106" cy="127" r="3" fill="#5a3f22"/><rect x="266" y="96" width="84" height="30" rx="15.0" fill="#d3d8e1"/><path d="M321.0 124 L343.0 140 L337.0 124 Z" fill="#d3d8e1"/><circle cx="296" cy="111" r="3" fill="#3a4766"/><circle cx="308" cy="111" r="3" fill="#3a4766"/><circle cx="320" cy="111" r="3" fill="#3a4766"/><g opacity="0.75"><rect x="18" y="46" width="72" height="28" rx="14.0" fill="#3a5684"/><path d="M28.0 72 L22.0 88 L44.0 72 Z" fill="#3a5684"/></g><g opacity="0.75"><rect x="306" y="36" width="70" height="26" rx="13.0" fill="#2f4a76"/><path d="M350.5 60 L372.5 76 L366.5 60 Z" fill="#2f4a76"/></g>
    </svg>
  )
}

// はじめての方へ: 灯りのこぼれる、少し開いたドア
export function AboutDoorIllustration() {
  return (
    <svg className="h-[140px] w-[120px]" viewBox="0 0 120 140" aria-hidden="true">
    <defs><radialGradient id="about-door-dg"><stop offset="0%" stopColor="#e3b071" stopOpacity="0.35"/><stop offset="100%" stopColor="#e3b071" stopOpacity="0"/></radialGradient></defs>
    <circle cx="56" cy="78" r="56" fill="url(#about-door-dg)"/>
    <path d="M40 120 L72 120 L104 136 L20 136 Z" fill="#e3b071" opacity="0.22"/>
    <rect x="34" y="22" width="44" height="98" rx="3" fill="#232e49"/>
    <rect x="38" y="26" width="36" height="94" rx="2" fill="#f0cf8f" opacity="0.9"/>
    <path d="M74 26 L92 18 L92 128 L74 120 Z" fill="#3a4766"/>
    <circle cx="88" cy="74" r="2.2" fill="#e3b071"/>
    <line x1="20" y1="120.5" x2="108" y2="120.5" stroke="#313d58" strokeWidth="1.5"/>
    <path d="M104 26 Q104 30 108 30 Q104 30 104 34 Q104 30 100 30 Q104 30 104 26Z" fill="#ece7dc" opacity="0.6"/><circle cx="16" cy="50" r="1.3" fill="#ece7dc" opacity="0.5"/><circle cx="108" cy="92" r="1.2" fill="#ece7dc" opacity="0.4"/>
    </svg>
  )
}

// 大切にしていることのアイコン
// 言葉: 点々の入った吹き出し
export function WordsIcon() {
  return (
    <svg className="h-14 w-14" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16 h40 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-22 l-10 8 v-8 h-8 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z"/></g><circle cx="24" cy="30" r="2" fill="#e3b071"/><circle cx="32" cy="30" r="2" fill="#e3b071" opacity="0.7"/><circle cx="40" cy="30" r="2" fill="#e3b071" opacity="0.45"/></svg>
  )
}

// 自分のペース: 湯気の立つ湯のみ
export function PaceIcon() {
  return (
    <svg className="h-14 w-14" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 30 h30 v6 a15 15 0 0 1 -30 0 z"/><path d="M44 33 h4 a5 5 0 0 1 0 10 h-5"/><path d="M10 54 h40"/><path d="M24 22 c-3 -4 3 -6 0 -11 M32 22 c-3 -4 3 -6 0 -11" strokeOpacity="0.6"/></g></svg>
  )
}

// 肩書: ハンガー
export function TitleIcon() {
  return (
    <svg className="h-14 w-14" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#e3b071" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M32 12 a4 4 0 1 1 4 4 c-2 0 -4 1 -4 4 v2"/><path d="M32 22 L8 40 h48 z"/><path d="M40 40 v8 h12 v-8" strokeOpacity="0.7"/><path d="M44 44 h4" strokeOpacity="0.7"/></g></svg>
  )
}
