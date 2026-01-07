// frontend/src/uiText.js
// -----------------------------------------------------------
// 多國語言文字（完整覆蓋版）
// 注意：這個檔案只能放「純資料 / 字串」，不能放 JSX / React Component
// -----------------------------------------------------------
//
// 異動紀錄（僅追加，不可刪除）：
// - 2025-12-25：補齊 WordLibraryPanel 多國字串：title / glossEmpty / headwordButtonTitle
// - 2026-01-04：補齊 WordLibraryPanel hover tooltip 多國字串：senseLikeTitle / senseDislikeTitle / senseStatusDisabledTitle
// - 2026-01-04：新增 Adjektiv 多國字串 adjektivCard（嚴格多國模式；提供 nounPlaceholder；避免元件內寫死 Mann / 特定語言 fallback）
// - 2026-01-05：新增 AI 免責聲明多國字串 aiDisclaimerLines（ResultPanel Raw JSON 上方提示）
// - 2026-01-06：補齊 WordExampleBlock 多國字串：wordCard.exampleBlock（multi-ref / refs UI）
// -----------------------------------------------------------

// =====================================================
// 功能初始化狀態（Production 排查）
// -----------------------------------------------------
// - 本檔案為「純資料」；初始化狀態僅提供 metadata 供需要時印 log
// - 不會影響既有 default export（uiText）用法
// =====================================================
export const UI_TEXT_INIT_STATE = {
  file: "frontend/src/uiText.js",
  module: "uiText",
  ts: "2026-01-06",
  notes:
    "Added wordCard.exampleBlock keys for WordExampleBlock strict i18n (multi-ref / refs UI). Kept existing i18n data unchanged; appended only.",
};

const uiText = {
  // ----------------------------
  // 繁體中文 zh-TW
  // ----------------------------
  "zh-TW": {
    appName: "LanguageApp",
    searchPlaceholder: "輸入單字或句子…",
    searchButton: "查詢",
    noResultText: "請輸入上方欄位並按下 Analyze 開始查詢",
    signInWithGoogle: "使用 Google 登入",
    signOut: "登出",
    authTesting: "測試 Auth",

    // ✅ AI 免責聲明（新增：ResultPanel JSON 上方顯示）
    aiDisclaimerLines: [
      "⚠️ 本詞條內容由 AI 自動生成並整理，涵蓋多國語言釋義與用法。",
      "AI 可能依語境調整釋義結構或順序，內容僅供學習參考，非傳統權威辭典。",
    ],

    // ★ Layout（新增）
    layout: {
      mutterspracheLabel: "母語：",
    },

    // ★ Auth（新增）
    auth: {
      logout: "登出",
    },

    // ★ 使用量顯示（新增）
    usage: {
      today: "今日",
      month: "本月",
      query: "查詢",
      voice: "語音",
    },

    wordCard: {
      headerMain: "單字總覽",
      sectionGrammar: "語法資訊",
      sectionMeaning: "語意說明",
      sectionExample: "例句",
      sectionExampleTranslation: "翻譯",
      sectionNotes: "補充說明",

      labelPos: "詞性",
      labelGender: "性別",
      labelPlural: "複數",
      labelBaseForm: "原形",
      labelDefinition: "釋義",
      labelExample: "例句",
      labelNotes: "註解",

      // ★ 名詞格變化標題
      caseTableTitle: "四格變化",

      // ★ 四格名稱
      caseNom: "主格 (Nominativ)",
      caseAkk: "受格 (Akkusativ)",
      caseDat: "與格 (Dativ)",
      caseGen: "屬格 (Genitiv)",

      // ★ 小表格欄位標題（定 / 不定 / 所有格）
      headerDefinite: "定冠詞",
      headerIndefinite: "不定冠詞",
      headerPossessive: "所有格",

      // ★ 名詞卡：控制按鈕
      btnPlural: "複數",
      btnClear: "清除",

      // ★ 名詞卡：Active / Reference 標題（tabs 類型）
      headerNegation: "否定冠詞",
      headerQuestionWord: "疑問詞",
      headerDemonstrative: "指示冠詞",

      // ★ 名詞卡：折疊列標題用
      nounPosLabel: "名詞",
      singularLabel: "單數",
      pluralLabel: "複數",
      refShortDef: "定冠詞",
      refShortIndef: "不定",

      // 例句區 Grammar Options
      grammarOptionsLabel: "句型結構",
      grammarToggleLabel: "調整句型",
      grammarCaseLabel: "格位",

      grammarCaseNomLabel: "主格 (Nominativ)",
      grammarCaseAkkLabel: "受格 (Akkusativ)",
      grammarCaseDatLabel: "與格 (Dativ)",
      grammarCaseGenLabel: "屬格 (Genitiv)",

      grammarArticleLabel: "冠詞",
      grammarArticleDefLabel: "定冠詞",
      grammarArticleIndefLabel: "不定冠詞",
      grammarArticleNoneLabel: "無冠詞",

      refreshExamplesTooltipLabel: "重新產生例句",

      // ✅ WordExampleBlock（新增：refs/multi-ref 共用字串集中）
      exampleBlock: {
        multiRefLabel: "多重參考",
        refPlaceholder: "新增參考（名詞/動詞/文法）...",
        addRefBtn: "加入",
        refsDirtyHint: "參考已變更，按重新產生才會套用",
        multiRefHint: "使用多個參考點產生例句",
        refInvalidHint: "不合理的參考（例如：xxx / ... / …），已阻擋加入",
        refStatusUsed: "已使用",
        refStatusMissing: "缺少",
        missingRefsHint: "有參考未被使用，請再重新產生",
      },

      // 連續對話（Conversation）
      conversationTitle: "連續對話",
      conversationCloseLabel: "關閉",

      posLocalNameMap: {
        Nomen: "名詞",
        Verb: "動詞",
        Adjektiv: "形容詞",
        Adverb: "副詞",
        Artikel: "冠詞",
        Pronomen: "代名詞",
        Präposition: "介系詞",
        Konjunktion: "連接詞",
        Numerale: "數詞",
        Interjektion: "感嘆詞",
        Partikel: "助詞",
        Hilfsverb: "助動詞",
        Modalverb: "情態動詞",
        Reflexivpronomen: "反身代名詞",
        Possessivpronomen: "所有格代名詞",
      },
    },

    // =====================================================
    // ✅ Adjektiv（新增：嚴格多國模式用）
    // -----------------------------------------------------
    // - WordPosInfoAdjektiv 只吃 uiLang 對應語系，不允許 fallback 到特定語言
    // - nounPlaceholder 用來避免示例句寫死 Mann（不應在元件內硬寫）
    // =====================================================
    adjektivCard: {
      posLabel: "Adjektiv",
      title: "形容詞變化",
      colon: "：",

      degreeTitle: "程度",
      positiveLabel: "原級",
      comparativeLabel: "比較級",
      superlativeLabel: "最高級",

      declTitle: "詞尾變化（示例）",
      declWeakLabel: "定冠詞（弱變化）",
      declMixedLabel: "不定冠詞（混合變化）",
      declStrongLabel: "無冠詞（強變化）",

      nounPlaceholder: "名詞",
      hintText: "形容詞詞尾會跟著「冠詞 / 性別 / 格位」變化",
    },

    verbCard: {
      title: "動詞變化",
      subtypeLabel: "動詞類型",
      subtypeFullVerb: "一般動詞",
      subtypeModal: "情態動詞",
      subtypeAux: "助動詞",

      separableLabel: "可分動詞",
      separableTrue: "可分",
      separableFalse: "不可分",

      reflexiveLabel: "反身動詞",
      reflexiveTrue: "反身",
      reflexiveFalse: "非反身",

      auxiliaryLabel: "完成式助動詞",
      valenzLabel: "常見搭配",

      tenseSelectLabel: "時態",
      praesensLabel: "現在式（Präsens）",
      praeteritumLabel: "過去式（Präteritum）",
      perfektLabel: "完成式（Perfekt）",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "（無資料）",

      // ★ WordCard badge 需要（新增：不刪減，只補齊）
      phraseLabel: "片語",
      irregularPrefix: "不規則：",
      irregularStrong: "強變化",
      irregularMixed: "混合變化",
      irregularSuppletive: "完全不規則",

      // ✅ WordPosInfoVerb 需要（新增：不刪減，只補齊）
      posLabel: "Verb",
      colon: "：",

      irregularLabel: "不規則",
      irregularStrongLabel: "強變化",
      irregularMixedLabel: "混合",
      irregularSuppletiveLabel: "完全不規則",

      recTitle: "相關字",
      recSynLabel: "同義字",
      recAntLabel: "反義字",
      recRootLabel: "同字根",

      debugMissingRecs: "（無相關字）",
    },

    tts: {
      play: "播放語音",
      stop: "停止播放",
    },
    app: {
      topbar: {
        testMode: "測試模式",
        testModeTitle: "進入測試模式",
        library: "單字庫",
        libraryTitle: "查看單字庫",
        back: "返回",
        backTitle: "返回查詢頁",
      },
      history: {
        clearThis: "點擊清除該筆紀錄",
      },
      errors: {
        backendUnavailable: "後端服務目前無法使用，請稍後再試",
        nonSentenceOnly:
          "目前只支援「單字 / 片語 / 慣用語」（非句子）。\n\n⚠️ 請勿輸入標點符號（.,!?、，。；：… 等）",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "單字庫",
        subtitle: "只顯示原型（Lemma），不包含變化形",
        countSuffix: "筆",
        emptyLine1: "尚未收藏任何單字",
        emptyLine2: "請到查詢頁點擊星號加入收藏",
        cancelFavoriteTitle: "取消收藏",
        cannotOperateTitle: "未登入時不可操作收藏",
        lemmaLabel: "原型（Lemma）",
        ariaFavorite: "我的最愛",
        reviewTitle: "點選以原型回到查詢頁複習",
        senseStatusTitle: "義項狀態（僅顯示；操作於後續 D 版接入）",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "尚未接入狀態更新（僅顯示）",
        senseLikeTitle: "標記為熟悉",
        senseDislikeTitle: "標記為不熟悉",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "點此回到查詢頁複習",
      },
    },
  },

  // ----------------------------
  // English
  // ----------------------------
  en: {
    appName: "LanguageApp",
    searchPlaceholder: "Enter a word or sentence…",
    searchButton: "Search",
    noResultText: 'Enter a word above and click "Analyze" to start',
    signInWithGoogle: "Sign in with Google",
    signOut: "Sign out",
    authTesting: "Test Auth",

    // ✅ AI disclaimer (NEW: show above Raw JSON in ResultPanel)
    aiDisclaimerLines: [
      "⚠️ This entry is automatically generated and organized by AI, including multilingual meanings and usage.",
      "AI may adjust the structure or order depending on context. For learning reference only, not an authoritative dictionary.",
    ],

    layout: {
      mutterspracheLabel: "Native language:",
    },

    auth: {
      logout: "Sign out",
    },

    usage: {
      today: "Today",
      month: "This month",
      query: "Lookup",
      voice: "Voice",
    },

    wordCard: {
      headerMain: "Word Overview",
      sectionGrammar: "Grammar",
      sectionMeaning: "Meaning",
      sectionExample: "Example",
      sectionExampleTranslation: "Translation",
      sectionNotes: "Notes",

      labelPos: "Part of Speech",
      labelGender: "Gender",
      labelPlural: "Plural",
      labelBaseForm: "Base Form",
      labelDefinition: "Definition",
      labelExample: "Example",
      labelNotes: "Notes",

      caseTableTitle: "Cases – Singular",

      caseNom: "Nominative (Nominativ)",
      caseAkk: "Accusative (Akkusativ)",
      caseDat: "Dative (Dativ)",
      caseGen: "Genitive (Genitiv)",

      headerDefinite: "Definite article",
      headerIndefinite: "Indefinite article",
      headerPossessive: "Possessive",

      btnPlural: "Plural",
      btnClear: "Clear",

      headerNegation: "Negation (kein)",
      headerQuestionWord: "Question word",
      headerDemonstrative: "Demonstrative",

      nounPosLabel: "Noun",
      singularLabel: "Singular",
      pluralLabel: "Plural",
      refShortDef: "Def.",
      refShortIndef: "Indef.",

      grammarOptionsLabel: "Sentence pattern",
      grammarToggleLabel: "Adjust sentence pattern",
      grammarCaseLabel: "Case",

      grammarCaseNomLabel: "Nominative",
      grammarCaseAkkLabel: "Accusative",
      grammarCaseDatLabel: "Dative",
      grammarCaseGenLabel: "Genitive",

      grammarArticleLabel: "Article",
      grammarArticleDefLabel: "Definite article",
      grammarArticleIndefLabel: "Indefinite article",
      grammarArticleNoneLabel: "No article",

      refreshExamplesTooltipLabel: "Regenerate examples",

      // ✅ WordExampleBlock（NEW: shared strings for multi-ref/refs UI）
      exampleBlock: {
        multiRefLabel: "Multi-ref",
        refPlaceholder: "Add reference (noun/verb/grammar)...",
        addRefBtn: "Add",
        refsDirtyHint: "Refs changed — refresh to regenerate",
        multiRefHint: "Use multiple refs for examples",
        refInvalidHint: "Invalid reference (e.g., 'xxx' / '...' / '…').",
        refStatusUsed: "used",
        refStatusMissing: "missing",
        missingRefsHint: "Some references were not used. Please regenerate.",
      },

      conversationTitle: "Conversation",
      conversationCloseLabel: "Close",

      posLocalNameMap: {
        Nomen: "Noun",
        Verb: "Verb",
        Adjektiv: "Adjective",
        Adverb: "Adverb",
        Artikel: "Article",
        Pronomen: "Pronoun",
        Präposition: "Preposition",
        Konjunktion: "Conjunction",
        Numerale: "Numeral",
        Interjektion: "Interjection",
        Partikel: "Particle",
        Hilfsverb: "Auxiliary Verb",
        Modalverb: "Modal Verb",
        Reflexivpronomen: "Reflexive Pronoun",
        Possessivpronomen: "Possessive Pronoun",
      },
    },

    // =====================================================
    // ✅ Adjective（新增：strict i18n for WordPosInfoAdjektiv）
    // =====================================================
    adjectiveCard: {
      posLabel: "Adjective",
      title: "Adjective forms",
      colon: ":",

      degreeTitle: "Degree",
      positiveLabel: "Positive",
      comparativeLabel: "Comparative",
      superlativeLabel: "Superlative",

      declTitle: "Endings (examples)",
      declWeakLabel: "Definite article (weak)",
      declMixedLabel: "Indefinite article (mixed)",
      declStrongLabel: "No article (strong)",

      nounPlaceholder: "noun",
      hintText: "Adjective endings depend on article / gender / case.",
    },

    verbCard: {
      title: "Verb Conjugation",
      subtypeLabel: "Verb Type",
      subtypeFullVerb: "Main Verb",
      subtypeModal: "Modal Verb",
      subtypeAux: "Auxiliary Verb",

      separableLabel: "Separable Verb",
      separableTrue: "Separable",
      separableFalse: "Not separable",

      reflexiveLabel: "Reflexive Verb",
      reflexiveTrue: "Reflexive",
      reflexiveFalse: "Not reflexive",

      auxiliaryLabel: "Auxiliary Verb (Perfekt)",
      valenzLabel: "Valency",

      tenseSelectLabel: "Tense",
      praesensLabel: "Present (Präsens)",
      praeteritumLabel: "Past (Präteritum)",
      perfektLabel: "Perfect (Perfekt)",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "(no data)",

      phraseLabel: "Phrase",
      irregularPrefix: "Irregular:",
      irregularStrong: "strong",
      irregularMixed: "mixed",
      irregularSuppletive: "suppletive",

      posLabel: "Verb",
      colon: ":",

      irregularLabel: "Irregular",
      irregularStrongLabel: "strong",
      irregularMixedLabel: "mixed",
      irregularSuppletiveLabel: "suppletive",

      recTitle: "Related",
      recSynLabel: "Synonyms",
      recAntLabel: "Antonyms",
      recRootLabel: "Word family",

      debugMissingRecs: "(no related words)",
    },

    tts: {
      play: "Play",
      stop: "Stop",
    },
    app: {
      topbar: {
        testMode: "Test Mode",
        testModeTitle: "Enter test mode",
        library: "Word Library",
        libraryTitle: "Open word library",
        back: "Back",
        backTitle: "Back to search",
      },
      history: {
        clearThis: "Click to clear this record",
      },
      errors: {
        backendUnavailable:
          "Backend service is currently unavailable. Please try again later.",
        nonSentenceOnly:
          "Only single words / phrases / idioms are supported (not full sentences).\n\n⚠️ Please remove punctuation (.,!? etc.) and try again.",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "Word Library",
        subtitle: "Only lemmas are shown (no inflections)",
        countSuffix: "items",
        emptyLine1: "No saved words yet",
        emptyLine2: "Tap the star on the search page to save words",
        cancelFavoriteTitle: "Remove from favorites",
        cannotOperateTitle: "Sign in to manage favorites",
        lemmaLabel: "Lemma",
        ariaFavorite: "Favorite",
        reviewTitle: "Click to review this lemma in search",
        senseStatusTitle:
          "Sense status (display only; actions will be added later)",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "Not connected yet (display only)",
        senseLikeTitle: "Mark as familiar",
        senseDislikeTitle: "Mark as unfamiliar",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "Click to review in search",
      },
    },
  },

  // ----------------------------
  // 簡體中文 zh-CN
  // ----------------------------
  "zh-CN": {
    appName: "LanguageApp",
    searchPlaceholder: "输入单字或句子…",
    searchButton: "查询",
    noResultText: "请输入上方栏位并按下 Analyze 开始查询",
    signInWithGoogle: "使用 Google 登录",
    signOut: "登出",
    authTesting: "测试 Auth",

    // ✅ AI 免责声明（新增：ResultPanel JSON 上方显示）
    aiDisclaimerLines: [
      "⚠️ 本词条内容由 AI 自动生成并整理，涵盖多国语言释义与用法。",
      "AI 可能随语境调整释义结构或顺序，内容仅供学习参考，非传统权威词典。",
    ],

    layout: {
      mutterspracheLabel: "母语：",
    },

    auth: {
      logout: "登出",
    },

    usage: {
      today: "今日",
      month: "本月",
      query: "查询",
      voice: "语音",
    },

    wordCard: {
      headerMain: "单字总览",
      sectionGrammar: "语法信息",
      sectionMeaning: "语意说明",
      sectionExample: "例句",
      sectionExampleTranslation: "翻译",
      sectionNotes: "补充说明",

      labelPos: "词性",
      labelGender: "性别",
      labelPlural: "复数",
      labelBaseForm: "原形",
      labelDefinition: "释义",
      labelExample: "例句",
      labelNotes: "注解",

      caseTableTitle: "四格变化",

      caseNom: "主格 (Nominativ)",
      caseAkk: "宾格 (Akkusativ)",
      caseDat: "与格 (Dativ)",
      caseGen: "属格 (Genitiv)",

      headerDefinite: "定冠词",
      headerIndefinite: "不定冠词",
      headerPossessive: "所有格",

      btnPlural: "复数",
      btnClear: "清除",

      headerNegation: "否定冠词",
      headerQuestionWord: "疑问词",
      headerDemonstrative: "指示冠词",

      nounPosLabel: "名词",
      singularLabel: "单数",
      pluralLabel: "复数",
      refShortDef: "定冠词",
      refShortIndef: "不定",

      grammarOptionsLabel: "句型结构",
      grammarToggleLabel: "调整句型",
      grammarCaseLabel: "格位",

      grammarCaseNomLabel: "主格 (Nominativ)",
      grammarCaseAkkLabel: "宾格 (Akkusativ)",
      grammarCaseDatLabel: "与格 (Dativ)",
      grammarCaseGenLabel: "属格 (Genitiv)",

      grammarArticleLabel: "冠词",
      grammarArticleDefLabel: "定冠词",
      grammarArticleIndefLabel: "不定冠词",
      grammarArticleNoneLabel: "无冠词",

      refreshExamplesTooltipLabel: "重新生成例句",

      // ✅ WordExampleBlock（新增：refs/multi-ref 共用字串集中）
      exampleBlock: {
        multiRefLabel: "多重参考",
        refPlaceholder: "新增参考（名词/动词/文法）...",
        addRefBtn: "加入",
        refsDirtyHint: "参考已变更，按重新生成才会套用",
        multiRefHint: "使用多个参考点生成例句",
        refInvalidHint: "不合理的参考（例如：xxx / ... / …），已阻挡加入",
        refStatusUsed: "已使用",
        refStatusMissing: "缺少",
        missingRefsHint: "有参考未被使用，请再重新生成",
      },

      conversationTitle: "对话",
      conversationCloseLabel: "关闭",

      posLocalNameMap: {
        Nomen: "名词",
        Verb: "动词",
        Adjektiv: "形容词",
        Adverb: "副词",
        Artikel: "冠词",
        Pronomen: "代词",
        Präposition: "介词",
        Konjunktion: "连词",
        Numerale: "数词",
        Interjektion: "感叹词",
        Partikel: "小品词",
        Hilfsverb: "助动词",
        Modalverb: "情态动词",
        Reflexivpronomen: "反身代词",
        Possessivpronomen: "所有格代词",
      },
    },

    // =====================================================
    // ✅ Adjektiv（新增：嚴格多國模式用）
    // =====================================================
    adjektivCard: {
      posLabel: "Adjektiv",
      title: "形容词变化",
      colon: "：",

      degreeTitle: "程度",
      positiveLabel: "原级",
      comparativeLabel: "比较级",
      superlativeLabel: "最高级",

      declTitle: "词尾变化（示例）",
      declWeakLabel: "定冠词（弱变化）",
      declMixedLabel: "不定冠词（混合变化）",
      declStrongLabel: "无冠词（强变化）",

      nounPlaceholder: "名词",
      hintText: "形容词词尾会随「冠词 / 性别 / 格位」变化",
    },

    verbCard: {
      title: "动词变化",
      subtypeLabel: "动词类型",
      subtypeFullVerb: "一般动词",
      subtypeModal: "情态动词",
      subtypeAux: "助动词",

      separableLabel: "可分动词",
      separableTrue: "可分",
      separableFalse: "不可分",

      reflexiveLabel: "反身动词",
      reflexiveTrue: "反身",
      reflexiveFalse: "非反身",

      auxiliaryLabel: "完成式助动词",
      valenzLabel: "常见搭配",

      tenseSelectLabel: "时态",
      praesensLabel: "现在式（Präsens）",
      praeteritumLabel: "过去式（Präteritum)",
      perfektLabel: "完成式（Perfekt）",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "（无资料）",

      phraseLabel: "短语",
      irregularPrefix: "不规则：",
      irregularStrong: "强变化",
      irregularMixed: "混合变化",
      irregularSuppletive: "完全不规则",

      posLabel: "Verb",
      colon: "：",

      irregularLabel: "不规则",
      irregularStrongLabel: "强变化",
      irregularMixedLabel: "混合",
      irregularSuppletiveLabel: "完全不规则",

      recTitle: "相关字",
      recSynLabel: "同义字",
      recAntLabel: "反义字",
      recRootLabel: "同字根",

      debugMissingRecs: "（无相关字）",
    },

    tts: {
      play: "播放语音",
      stop: "停止播放",
    },
    app: {
      topbar: {
        testMode: "测试模式",
        testModeTitle: "进入测试模式",
        library: "单字库",
        libraryTitle: "查看单字库",
        back: "返回",
        backTitle: "返回查询页",
      },
      history: {
        clearThis: "点击清除该条记录",
      },
      errors: {
        backendUnavailable: "后端服务暂时无法使用，请稍后再试",
        nonSentenceOnly:
          "目前只支持「单词 / 短语 / 习惯用语」（非句子）。\n\n⚠️ 请勿输入标点符号（.,!?、，。；：… 等）",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "单字库",
        subtitle: "只显示原型（Lemma），不包含变位/变化形",
        countSuffix: "条",
        emptyLine1: "还没有收藏任何单词",
        emptyLine2: "请到查询页点击星号加入收藏",
        cancelFavoriteTitle: "取消收藏",
        cannotOperateTitle: "未登录时不可操作收藏",
        lemmaLabel: "原型（Lemma）",
        ariaFavorite: "收藏",
        reviewTitle: "点击以原型回到查询页复习",
        senseStatusTitle: "义项状态（仅显示；操作将在后续加入）",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "尚未接入状态更新（仅显示）",
        senseLikeTitle: "标记为熟悉",
        senseDislikeTitle: "标记为不熟悉",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "点击返回查询页复习",
      },
    },
  },

  // ----------------------------
  // Deutsch de
  // ----------------------------
  de: {
    appName: "LanguageApp",
    searchPlaceholder: "Wort oder Satz eingeben…",
    searchButton: "Suchen",
    noResultText: 'Oben Text eingeben und auf "Analyze" klicken',
    signInWithGoogle: "Mit Google anmelden",
    signOut: "Abmelden",
    authTesting: "Auth testen",

    // ✅ KI-Hinweis (NEU: oberhalb von Raw JSON im ResultPanel)
    aiDisclaimerLines: [
      "⚠️ Dieser Eintrag wurde automatisch von einer KI erstellt und strukturiert (mehrsprachige Bedeutungen und Gebrauch).",
      "Die KI kann Struktur oder Reihenfolge je nach Kontext anpassen. Nur zum Lernen, kein maßgebliches Wörterbuch.",
    ],

    layout: {
      mutterspracheLabel: "Muttersprache:",
    },

    auth: {
      logout: "Abmelden",
    },

    usage: {
      today: "Heute",
      month: "Diesen Monat",
      query: "Abfrage",
      voice: "Stimme",
    },

    wordCard: {
      headerMain: "Wortübersicht",
      sectionGrammar: "Grammatik",
      sectionMeaning: "Bedeutung",
      sectionExample: "Beispiel",
      sectionExampleTranslation: "Übersetzung",
      sectionNotes: "Notizen",

      labelPos: "Wortart",
      labelGender: "Genus",
      labelPlural: "Plural",
      labelBaseForm: "Grundform",
      labelDefinition: "Definition",
      labelExample: "Beispiel",
      labelNotes: "Notizen",

      caseTableTitle: "Fälle – Singular",

      caseNom: "Nominativ",
      caseAkk: "Akkusativ",
      caseDat: "Dativ",
      caseGen: "Genitiv",

      headerDefinite: "Bestimmter Artikel",
      headerIndefinite: "Unbestimmter Artikel",
      headerPossessive: "Possessiv",

      btnPlural: "Plural",
      btnClear: "Zurück",

      headerNegation: "Negation (kein)",
      headerQuestionWord: "Fragewort",
      headerDemonstrative: "Demonstrativ",

      nounPosLabel: "Nomen",
      singularLabel: "Singular",
      pluralLabel: "Plural",
      refShortDef: "bestimmt",
      refShortIndef: "unbest.",

      grammarOptionsLabel: "Satzmuster",
      grammarToggleLabel: "Satzmuster anpassen",
      grammarCaseLabel: "Kasus",

      grammarCaseNomLabel: "Nominativ",
      grammarCaseAkkLabel: "Akkusativ",
      grammarCaseDatLabel: "Dativ",
      grammarCaseGenLabel: "Genitiv",

      grammarArticleLabel: "Artikel",
      grammarArticleDefLabel: "Bestimmt",
      grammarArticleIndefLabel: "Unbestimmt",
      grammarArticleNoneLabel: "Kein Artikel",

      refreshExamplesTooltipLabel: "Beispiele neu erzeugen",

      // ✅ WordExampleBlock（NEU: gemeinsame Strings für Multi-ref/Refs UI）
      exampleBlock: {
        multiRefLabel: "Multi-ref",
        refPlaceholder: "Referenz hinzufügen (Nomen/Verb/Grammatik)...",
        addRefBtn: "Hinzufügen",
        refsDirtyHint: "Referenzen geändert — bitte neu erzeugen",
        multiRefHint: "Mehrere Referenzen für Beispiele nutzen",
        refInvalidHint: "Ungültige Referenz (z.B. 'xxx' / '...' / '…').",
        refStatusUsed: "verwendet",
        refStatusMissing: "fehlt",
        missingRefsHint: "Einige Referenzen wurden nicht verwendet. Bitte neu erzeugen.",
      },

      conversationTitle: "Konversation",
      conversationCloseLabel: "Schließen",

      posLocalNameMap: {
        Nomen: "Nomen",
        Verb: "Verb",
        Adjektiv: "Adjektiv",
        Adverb: "Adverb",
        Artikel: "Artikel",
        Pronomen: "Pronomen",
        Präposition: "Präposition",
        Konjunktion: "Konjunktion",
        Numerale: "Numerale",
        Interjektion: "Interjektion",
        Partikel: "Partikel",
        Hilfsverb: "Hilfsverb",
        Modalverb: "Modalverb",
        Reflexivpronomen: "Reflexivpronomen",
        Possessivpronomen: "Possessivpronomen",
      },
    },

    // =====================================================
    // ✅ Adjektiv（新增：strict i18n for WordPosInfoAdjektiv）
    // =====================================================
    adjektivCard: {
      posLabel: "Adjektiv",
      title: "Adjektivformen",
      colon: ":",

      degreeTitle: "Steigerung",
      positiveLabel: "Positiv",
      comparativeLabel: "Komparativ",
      superlativeLabel: "Superlativ",

      declTitle: "Endungen (Beispiele)",
      declWeakLabel: "Bestimmter Artikel (schwach)",
      declMixedLabel: "Unbestimmter Artikel (gemischt)",
      declStrongLabel: "Kein Artikel (stark)",

      nounPlaceholder: "Nomen",
      hintText: "Endungen hängen von Artikel / Genus / Kasus ab.",
    },

    verbCard: {
      title: "Verbkonjugation",
      subtypeLabel: "Verbtyp",
      subtypeFullVerb: "Vollverb",
      subtypeModal: "Modalverb",
      subtypeAux: "Hilfsverb",

      separableLabel: "Trennbares Verb",
      separableTrue: "Trennbar",
      separableFalse: "Nicht trennbar",

      reflexiveLabel: "Reflexives Verb",
      reflexiveTrue: "Reflexiv",
      reflexiveFalse: "Nicht reflexiv",

      auxiliaryLabel: "Hilfsverb (Perfekt)",
      valenzLabel: "Valenz",

      tenseSelectLabel: "Zeitform",
      praesensLabel: "Präsens",
      praeteritumLabel: "Präteritum",
      perfektLabel: "Perfekt",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "(keine Daten)",

      phraseLabel: "Phrase",
      irregularPrefix: "Unregelmäßig:",
      irregularStrong: "stark",
      irregularMixed: "gemischt",
      irregularSuppletive: "suppletiv",

      posLabel: "Verb",
      colon: ":",

      irregularLabel: "Unregelmäßig",
      irregularStrongLabel: "stark",
      irregularMixedLabel: "gemischt",
      irregularSuppletiveLabel: "suppletiv",

      recTitle: "Verwandte Wörter",
      recSynLabel: "Synonyme",
      recAntLabel: "Antonyme",
      recRootLabel: "Wortfamilie",

      debugMissingRecs: "(keine verwandten Wörter)",
    },

    tts: {
      play: "Abspielen",
      stop: "Stopp",
    },
    app: {
      topbar: {
        testMode: "Testmodus",
        testModeTitle: "Testmodus starten",
        library: "Wortliste",
        libraryTitle: "Wortliste öffnen",
        back: "Zurück",
        backTitle: "Zur Suche zurückkehren",
      },
      history: {
        clearThis: "Klicken, um diesen Eintrag zu löschen",
      },
      errors: {
        backendUnavailable:
          "Der Backend-Dienst ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
        nonSentenceOnly:
          "Aktuell werden nur Wörter / Phrasen / Redewendungen unterstützt (keine Sätze).\n\n⚠️ Bitte ohne Satzzeichen eingeben (.,!? usw.).",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "Wortliste",
        subtitle: "Nur Grundformen (Lemma), keine Beugungsformen",
        countSuffix: "Einträge",
        emptyLine1: "Noch keine gespeicherten Wörter",
        emptyLine2: "Auf der Suchseite den Stern antippen, um zu speichern",
        cancelFavoriteTitle: "Aus Favoriten entfernen",
        cannotOperateTitle: "Zum Verwalten bitte anmelden",
        lemmaLabel: "Lemma",
        ariaFavorite: "Favorit",
        reviewTitle: "Klicken, um dieses Lemma in der Suche zu wiederholen",
        senseStatusTitle:
          "Bedeutungsstatus (nur Anzeige; Aktionen folgen später)",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "Noch nicht verbunden (nur Anzeige)",
        senseLikeTitle: "Als bekannt markieren",
        senseDislikeTitle: "Als unbekannt markieren",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "Klicken, um im Suchmodus zu üben",
      },
    },
  },

  // ----------------------------
  // العربية ar
  // ----------------------------
  ar: {
    appName: "LanguageApp",
    searchPlaceholder: "أدخل كلمة أو جملة…",
    searchButton: "بحث",
    noResultText: 'أدخل نصًا في الأعلى ثم اضغط على "Analyze" لبدء البحث',
    signInWithGoogle: "تسجيل الدخول عبر Google",
    signOut: "تسجيل الخروج",
    authTesting: "اختبار Auth",

    // ✅ تنبيه الذكاء الاصطناعي (جديد: يظهر أعلى Raw JSON في ResultPanel)
    aiDisclaimerLines: [
      "⚠️ تم إنشاء هذا المُدخل وتنظيمه تلقائيًا بواسطة الذكاء الاصطناعي، ويشمل معاني واستخدامات متعددة اللغات.",
      "قد يغيّر الذكاء الاصطناعي البنية أو الترتيب حسب السياق. للمراجعة التعليمية فقط وليس قاموسًا موثوقًا.",
    ],

    layout: {
      mutterspracheLabel: "اللغة الأم:",
    },

    auth: {
      logout: "تسجيل الخروج",
    },

    usage: {
      today: "اليوم",
      month: "هذا الشهر",
      query: "بحث",
      voice: "صوت",
    },

    wordCard: {
      headerMain: "نظرة عامة على الكلمة",
      sectionGrammar: "المعلومات النحوية",
      sectionMeaning: "المعنى",
      sectionExample: "مثال",
      sectionExampleTranslation: "الترجمة",
      sectionNotes: "ملاحظات إضافية",

      labelPos: "نوع الكلمة",
      labelGender: "الجنس",
      labelPlural: "الجمع",
      labelBaseForm: "الصيغة الأساسية",
      labelDefinition: "التعريف",
      labelExample: "مثال",
      labelNotes: "ملاحظات",

      caseTableTitle: "الحالات – المفرد",

      caseNom: "مرفوع (Nominativ)",
      caseAkk: "منصوب (Akkusativ)",
      caseDat: "مجرور (Dativ)",
      caseGen: "مضاف إليه (Genitiv)",

      headerDefinite: "أداة التعريف",
      headerIndefinite: "نكرة",
      headerPossessive: "ملكيّة",

      btnPlural: "جمع",
      btnClear: "مسح",

      headerNegation: "نفي (kein)",
      headerQuestionWord: "أداة استفهام",
      headerDemonstrative: "اسم إشارة",

      nounPosLabel: "اسم",
      singularLabel: "مفرد",
      pluralLabel: "جمع",
      refShortDef: "معرّف",
      refShortIndef: "نكرة",

      grammarOptionsLabel: "نمط الجملة",
      grammarToggleLabel: "ضبط نمط الجملة",
      grammarCaseLabel: "الحالة",

      grammarCaseNomLabel: "مرفوع",
      grammarCaseAkkLabel: "منصوب",
      grammarCaseDatLabel: "مجرور",
      grammarCaseGenLabel: "مضاف إليه",

      grammarArticleLabel: "أداة",
      grammarArticleDefLabel: "معرّف",
      grammarArticleIndefLabel: "نكرة",
      grammarArticleNoneLabel: "بدون أداة",

      refreshExamplesTooltipLabel: "إعادة توليد الأمثلة",

      // ✅ WordExampleBlock（جديد: نصوص مشتركة لواجهة multi-ref/refs）
      exampleBlock: {
        multiRefLabel: "Multi-ref",
        refPlaceholder: "أضف مرجعًا (اسم/فعل/قواعد)...",
        addRefBtn: "إضافة",
        refsDirtyHint: "تم تغيير المراجع — حدّث لإعادة التوليد",
        multiRefHint: "استخدم عدة مراجع لتوليد الأمثلة",
        refInvalidHint: "مرجع غير صالح (مثل: 'xxx' / '...' / '…').",
        refStatusUsed: "مستخدم",
        refStatusMissing: "ناقص",
        missingRefsHint: "لم تُستخدم بعض المراجع. الرجاء إعادة التوليد.",
      },

      conversationTitle: "محادثة",
      conversationCloseLabel: "إغلاق",

      posLocalNameMap: {
        Nomen: "اسم",
        Verb: "فعل",
        Adjektiv: "صفة",
        Adverb: "حال",
        Artikel: "أداة",
        Pronomen: "ضمير",
        Präposition: "حرف جر",
        Konjunktion: "أداة ربط",
        Numerale: "عدد",
        Interjektion: "تعجب",
        Partikel: "أداة",
        Hilfsverb: "فعل مساعد",
        Modalverb: "فعل مساعد",
        Reflexivpronomen: "ضمير انعكاسي",
        Possessivpronomen: "ضمير ملكية",
      },
    },

    // =====================================================
    // ✅ Adjective / صفة（新增：strict i18n for WordPosInfoAdjektiv）
    // =====================================================
    adjectiveCard: {
      posLabel: "صفة",
      title: "صيغ الصفة",
      colon: ":",

      degreeTitle: "الدرجة",
      positiveLabel: "أساسية",
      comparativeLabel: "تفضيل",
      superlativeLabel: "أعلى",

      declTitle: "النهايات (أمثلة)",
      declWeakLabel: "مع أداة تعريف (ضعيف)",
      declMixedLabel: "مع نكرة (مختلط)",
      declStrongLabel: "بدون أداة (قوي)",

      nounPlaceholder: "اسم",
      hintText: "نهاية الصفة تعتمد على الأداة / الجنس / الحالة.",
    },

    verbCard: {
      title: "تصريف الفعل",
      subtypeLabel: "نوع الفعل",
      subtypeFullVerb: "فعل رئيسي",
      subtypeModal: "فعل مساعد",
      subtypeAux: "فعل مساعد",

      separableLabel: "فعل قابل للفصل",
      separableTrue: "قابل للفصل",
      separableFalse: "غير قابل للفصل",

      reflexiveLabel: "فعل انعكاسي",
      reflexiveTrue: "انعكاسي",
      reflexiveFalse: "غير انعكاسي",

      auxiliaryLabel: "فعل مساعد (Perfekt)",
      valenzLabel: "التعدية",

      tenseSelectLabel: "الزمن",
      praesensLabel: "الحاضر (Präsens)",
      praeteritumLabel: "الماضي (Präteritum)",
      perfektLabel: "الماضي التام (Perfekt)",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "(لا توجد بيانات)",

      phraseLabel: "عبارة",
      irregularPrefix: "غير منتظم:",
      irregularStrong: "قوي",
      irregularMixed: "مختلط",
      irregularSuppletive: "تعويضي",

      posLabel: "فعل",
      colon: ":",

      irregularLabel: "غير منتظم",
      irregularStrongLabel: "قوي",
      irregularMixedLabel: "مختلط",
      irregularSuppletiveLabel: "تعويضي",

      recTitle: "كلمات ذات صلة",
      recSynLabel: "مرادفات",
      recAntLabel: "أضداد",
      recRootLabel: "عائلة الكلمات",

      debugMissingRecs: "(لا توجد كلمات ذات صلة)",
    },

    tts: {
      play: "تشغيل",
      stop: "إيقاف",
    },
    app: {
      topbar: {
        testMode: "وضع الاختبار",
        testModeTitle: "الدخول إلى وضع الاختبار",
        library: "مكتبة الكلمات",
        libraryTitle: "فتح مكتبة الكلمات",
        back: "رجوع",
        backTitle: "العودة إلى البحث",
      },
      history: {
        clearThis: "انقر لمسح هذا السجل",
      },
      errors: {
        backendUnavailable:
          "الخدمة الخلفية غير متوفرة حالياً، يرجى المحاولة لاحقاً",
        nonSentenceOnly:
          "حالياً ندعم الكلمات / العبارات / التعابير فقط (ليست جُملاً).\n\n⚠️ الرجاء إزالة علامات الترقيم (.,!? إلخ) ثم المحاولة مرة أخرى.",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "مكتبة الكلمات",
        subtitle: "عرض الصيغة الأساسية فقط (Lemma) بدون تصريف",
        countSuffix: "عنصر",
        emptyLine1: "لا توجد كلمات محفوظة بعد",
        emptyLine2: "اضغط على النجمة في صفحة البحث للحفظ",
        cancelFavoriteTitle: "إزالة من المفضلة",
        cannotOperateTitle: "سجّل الدخول لإدارة المفضلة",
        lemmaLabel: "Lemma",
        ariaFavorite: "مفضلة",
        reviewTitle: "انقر لمراجعة هذه الصيغة في البحث",
        senseStatusTitle:
          "حالة المعنى (عرض فقط؛ ستُضاف الإجراءات لاحقًا)",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "غير متصل بعد (عرض فقط)",
        senseLikeTitle: "وضع علامة: مألوف",
        senseDislikeTitle: "وضع علامة: غير مألوف",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "انقر للمراجعة في البحث",
      },
    },
  },
};

export default uiText;
// frontend/src/uiText.js
