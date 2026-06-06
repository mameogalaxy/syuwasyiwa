// 手話の単語データ。
// video … YouTube の参考お手本動画ID（外部）。地域や人によって表現が異なることがあるため、
//         あくまで「参考のお手本」として表示します。null の場合は検索リンクを見本にします。
// steps … 動きのヒント（補助）。正確な動きは必ずお手本動画で確認してください。
// search … 「ほかのお手本を探す」ための YouTube 検索キーワード。

export const signs = [
  // ---- あいさつ ----
  {
    word: "おはよう",
    reading: "ohayō",
    category: "あいさつ",
    steps: "①こめかみに当てた手を、ねむりから起きるように開く（朝）。②両手の人差し指を立てて向かい合わせ、軽くおじぎするように前へたおす（あいさつ）。",
    video: "8lP49aN46wI",
    search: "手話 おはよう やり方",
  },
  {
    word: "こんにちは",
    reading: "konnichiwa",
    category: "あいさつ",
    steps: "①ひたいの前で人差し指を立てる（昼・正午）。②両手の人差し指を立てて向かい合わせ、前へたおす（あいさつ）。",
    video: "OyeseIHz5HI",
    search: "手話 こんにちは やり方",
  },
  {
    word: "こんばんは",
    reading: "konbanwa",
    category: "あいさつ",
    steps: "①両手の甲を上にして重ね、夜・暗くなる様子を表す（夜）。②両手の人差し指を立てて向かい合わせ、前へたおす（あいさつ）。",
    video: "lvwkb-rDJ6A",
    search: "手話 こんばんは やり方",
  },
  {
    word: "ありがとう",
    reading: "arigatō",
    category: "あいさつ",
    steps: "①左手を水平にひらく。②右手を手刀（横向きの手）にして左手の甲にのせ、そのまま上へ持ち上げる（おすもうの所作から）。",
    video: "6QPDHT7AnqE",
    search: "手話 ありがとう やり方",
  },
  {
    word: "ごめんなさい",
    reading: "gomennasai",
    category: "あいさつ",
    steps: "①親指と人差し指でまゆ間（鼻の付け根）を軽くつまむ。②片手を立てて、おわびするように軽く前へ出す。",
    video: "0cFPUtTeHvE",
    search: "手話 ごめんなさい やり方",
  },
  {
    word: "よろしく\nおねがいします",
    reading: "yoroshiku",
    category: "あいさつ",
    steps: "にぎりこぶしを鼻の前あたりにかまえ、そのまま前へ下ろす（よろしく＝おねがい）。",
    video: "mpH-zFoNg30",
    search: "手話 よろしくお願いします やり方",
  },

  // ---- まいにちの どうさ ----
  {
    word: "たべる",
    reading: "taberu",
    category: "まいにちの どうさ",
    steps: "人差し指と中指の2本をはしに見立て、口の前へ前後に動かして食べるしぐさをする。",
    video: "mIX2I9qAbiY",
    search: "手話 食べる やり方",
  },
  {
    word: "のむ",
    reading: "nomu",
    category: "まいにちの どうさ",
    steps: "コップを持つように手をまるめ、口元へかたむけて飲むしぐさをする。",
    video: null,
    search: "手話 飲む やり方",
  },
  {
    word: "いく",
    reading: "iku",
    category: "まいにちの どうさ",
    steps: "人差し指（または親指）を立て、前方へまっすぐ進めるように動かす（行く・向かう）。",
    video: "IEBnsj3Y-5Q",
    search: "手話 行く やり方",
  },
  {
    word: "すき",
    reading: "suki",
    category: "まいにちの どうさ",
    steps: "あごの下あたりを親指と人差し指でつまむようにし、すぼめながら下へ下ろす（好き）。",
    video: "F0RYcGTT8DU",
    search: "手話 好き やり方",
  },

  // ---- じこしょうかい ----
  {
    word: "わたし",
    reading: "watashi",
    category: "じこしょうかい",
    steps: "人差し指で自分の鼻（または胸）を指す。",
    video: null,
    search: "手話 わたし 私 やり方",
  },
  {
    word: "なまえ",
    reading: "namae",
    category: "じこしょうかい",
    steps: "親指を立てて、もう一方の手のひらに印を押すように当てる（名前）。",
    video: "6MHCZzJmoRE",
    search: "手話 名前 やり方",
  },

  // ---- いろ ----
  {
    word: "あか",
    reading: "aka",
    category: "いろ",
    steps: "人差し指でくちびるを軽くなぞる（赤いくちびる＝赤）。",
    video: null,
    search: "手話 赤 色 やり方",
  },
];
