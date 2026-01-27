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
// - 2026-01-09：新增 WordCard 問題回報（Report issue）多國字串：wordCard.reportIssue*（UI 入口與小視窗按鈕/標題）
// - 2026-01-12：補齊 WordDefinitionBlock 多國字串：wordCard.definitionDeLabel / definitionDeTtsTitle / senseFallbackPrefix（hover/標題/義項 fallback）
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
  ts: "2026-01-26",
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
      termsOfService: "服務條款",
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

      // ★ 詞性補充（NEW）
      posInfoSupplementTitle: "詞性補充",

      // ✅ Alias key（同義）：給舊/新元件統一取用（不可刪）
      posInfoTitle: "詞性補充",
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
        headwordRefLabel: "參考形式",
        headwordRefHint: "這個參考形式會提高例句出現機率，但不保證一定出現",
        refPlaceholder: "新增參考（名詞/動詞/文法）...",
        addRefBtn: "加入",
        addRefValidating: "檢核中…",
        confirmBtnLabel: "確認",
        confirmBtnTitle: "確認",
        confirmBtnAriaLabel: "確認",
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

      // ✅ 2026-01-09：WordCard 問題回報（NEW）
      reportIssueLabel: "問題回報",
      reportIssueTitle: "問題回報",
      reportIssueCategoryLabel: "分類",
      reportIssueCloseLabel: "關閉",
      reportIssueCancelLabel: "取消",
      reportIssueSubmitLabel: "送出",
      reportIssueHint: "回報此單字資料問題",
      reportIssueCatDefinitionWrong: "釋義不對 / 不自然",
      reportIssueCatPosWrong: "詞性判斷有誤",
      reportIssueCatFormsWrong: "變位 / 性別 / 複數 等屬性有誤",
      reportIssueCatOther: "其他",

      // ✅ 2026-01-12：WordDefinitionBlock（Definition (DE) 行尾端 / hover / fallback）
      definitionDeLabel: "德語釋義",
      definitionDeTtsTitle: "播放德語釋義",
      senseFallbackPrefix: "義項 ",

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

        // ✅ Task 1：匯入（Import）入口
        importButtonLabel: "匯入",
        importButtonTitle: "匯入",
        importButtonAria: "匯入",
        // （本任務 placeholder 用；下一任務會換成 ImportModal）
        importPlaceholderLine1: "（匯入功能下一步接入）",
        importPlaceholderLine2: "",

        // ✅ Task 2：Import Modal（UI-only）
        importModalTitle: "匯入",
        importLevelLabel: "等級",
        importScenarioLabel: "情境",
        importTypeLabel: "類型",
        importTypeGrammar: "文法",
        importTypeVocab: "單字",
        importTypePhrases: "常用語",
        importCountLabel: "數量",
        importTargetLabel: "匯入到學習本",
        importGenerateButton: "生成",
        importCommitButton: "匯入",
        importCancelButton: "取消",
        importSelectAll: "全選",
        importSelectNone: "全不選",
        importEmptyPreviewHint: "尚未生成候選清單",
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

        // ✅ Favorites categories dropdown（新增：收藏分類下拉）
        favoriteCategoryLabel: "分類",
        favoriteCategoryLoading: "分類載入中…",
        favoriteCategoryEmpty: "尚無分類",
        favoriteCategoryAll: "全部",

        // ✅ Alias keys (for backward compatibility with WordLibraryPanel.jsx; do not delete)
        setSelectLabel: "學習本",
        setSelectTitle: "選擇要學習的內容",
        setSelectAria: "學習本選單",
        setFavoritesLabel: "我的收藏",
        setNotReadyLine1: "此學習本內容尚未導入",
        setNotReadyLine2: "目前僅顯示選單，稍後會加入完成度與內容",
        testDisabledTitle: "尚未導入測驗功能",

        // ✅ Learning set titles (NEW)
        setTitleA1Vocab: "A1 單字",
        setTitleA1Grammar: "A1 文法",
        setTitleCommonPhrases: "常用語",
        setTitleTest: "測驗",
      },
    },
    // ✅ Speak Analyze Panel (ASR once)
    speakAnalyzePanel: {
      title: "口說分析",
      targetLabel: "目標",
      resultLabel: "分析結果",
      startRecording: "開始錄音",
      stopRecording: "停止錄音",
      replay: "重播",
      analyze: "分析",
      close: "關閉",
      asrLabel: "系統判定",
      asrProcessing: "系統判定中…",
      asrPrefix: "系統判定：",
      analyzeDone: "分析完成",
      analyzeFailedPrefix: "分析失敗：",
      recording: "錄音中",
      secondsSuffix: "秒",
      perfect: "全對",
      closeAria: "關閉",
      waveformAria: "口說波形",
      translationLabel: "翻譯",
      playTarget: "播放語音",
      showTarget: "顯示",
      hideTarget: "隱藏",
      showTranslation: "顯示",
      hideTranslation: "隱藏",
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
      termsOfService: "Terms of Service",
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

      // ★ POS info supplement（NEW）
      posInfoSupplementTitle: "POS info",

      // ✅ Alias key（同義）：給舊/新元件統一取用（不可刪）
      posInfoTitle: "POS info",
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
        headwordRefLabel: "Reference form",
        headwordRefHint: "This reference form increases the chance it appears in examples, but it\'s not guaranteed",
        refPlaceholder: "Add reference (noun/verb/grammar)...",
        addRefBtn: "Add",
        addRefValidating: "檢核中…",
        confirmBtnLabel: "Confirm",
        confirmBtnTitle: "Confirm",
        confirmBtnAriaLabel: "Confirm",
        refsDirtyHint: "Refs changed — refresh to regenerate",
        multiRefHint: "Use multiple refs for examples",
        refInvalidHint: "Invalid reference (e.g., 'xxx' / '...' / '…').",
        refStatusUsed: "used",
        refStatusMissing: "missing",
        missingRefsHint: "Some references were not used. Please regenerate.",
      },

      conversationTitle: "Conversation",
      conversationCloseLabel: "Close",

      // ✅ 2026-01-09：WordCard issue report (NEW)
      reportIssueLabel: "Report issue",
      reportIssueTitle: "Report an issue",
      reportIssueCategoryLabel: "Category",
      reportIssueCloseLabel: "Close",
      reportIssueCancelLabel: "Cancel",
      reportIssueSubmitLabel: "Submit",
      reportIssueHint: "Report an issue with this entry",
      reportIssueCatDefinitionWrong: "Definition is wrong / unnatural",
      reportIssueCatPosWrong: "Part of speech is wrong",
      reportIssueCatFormsWrong: "Forms / gender / plural etc. are wrong",
      reportIssueCatOther: "Other",

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

        // ✅ Task 1：Import entry
        importButtonLabel: "Import",
        importButtonTitle: "Import",
        importButtonAria: "Import",
        // placeholder (next task will add ImportModal)
        importPlaceholderLine1: "(Import will be implemented in the next task.)",
        importPlaceholderLine2: "",

        // ✅ Task 2：Import Modal（UI-only）
        importModalTitle: "Import",
        importLevelLabel: "Level",
        importScenarioLabel: "Scenario",
        importTypeLabel: "Type",
        importTypeGrammar: "Grammar",
        importTypeVocab: "Vocabulary",
        importTypePhrases: "Common phrases",
        importCountLabel: "Count",
        importTargetLabel: "Import to learning set",
        importGenerateButton: "Generate",
        importCommitButton: "Import",
        importCancelButton: "Cancel",
        importSelectAll: "Select all",
        importSelectNone: "Select none",
        importEmptyPreviewHint: "No preview yet",
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

        // ✅ Favorites categories dropdown（NEW）
        favoriteCategoryLabel: "Category",
        favoriteCategoryLoading: "Loading categories…",
        favoriteCategoryEmpty: "No categories",
        favoriteCategoryAll: "All",

        // ✅ Alias keys (for backward compatibility with WordLibraryPanel.jsx; do not delete)
        setSelectLabel: "Learning set",
        setSelectTitle: "Select what to study",
        setSelectAria: "Learning set menu",
        setFavoritesLabel: "My Favorites",
        setNotReadyLine1: "This learning set isn’t available yet.",
        setNotReadyLine2: "Only the menu is available for now; content and progress will be added later.",
        testDisabledTitle: "Test is not available yet.",

        // ✅ Learning set titles (NEW)
        setTitleA1Vocab: "A1 Vocabulary",
        setTitleA1Grammar: "A1 Grammar",
        setTitleCommonPhrases: "Common Phrases",
        setTitleTest: "Test",
      },
    },

    // ✅ Speak Analyze Panel (ASR once)
    speakAnalyzePanel: {
      title: "Speak Analyze",
      targetLabel: "Target",
      resultLabel: "Result",
      startRecording: "Start recording",
      stopRecording: "Stop recording",
      replay: "Replay",
      analyze: "Analyze",
      close: "Close",
      asrLabel: "System",
      asrProcessing: "System processing…",
      asrPrefix: "System: ",
      analyzeDone: "Analysis complete",
      analyzeFailedPrefix: "Analysis failed: ",
      recording: "Recording",
      secondsSuffix: "s",
      perfect: "Perfect",
      closeAria: "Close",
      waveformAria: "Speech waveform",
      translationLabel: "Translation",
      playTarget: "Play audio",
      showTarget: "Show",
      hideTarget: "Hide",
      showTranslation: "Show",
      hideTranslation: "Hide",
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
      termsOfService: "服务条款",
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
      // ★ 词性补充（NEW）
      posInfoSupplementTitle: "词性补充",
      // ✅ Alias key（同義）：給舊/新元件統一取用（不可刪）
      posInfoTitle: "词性补充",
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
        addRefValidating: "檢核中…",
        confirmBtnLabel: "确认",
        confirmBtnTitle: "确认",
        confirmBtnAriaLabel: "确认",
        refsDirtyHint: "参考已变更，按重新生成才会套用",
        multiRefHint: "使用多个参考点生成例句",
        refInvalidHint: "不合理的参考（例如：xxx / ... / …），已阻挡加入",
        refStatusUsed: "已使用",
        refStatusMissing: "缺少",
        missingRefsHint: "有参考未被使用，请再重新生成",
      },

      conversationTitle: "对话",
      conversationCloseLabel: "关闭",

      // ✅ 2026-01-09：WordCard 问题反馈（NEW）
      reportIssueLabel: "问题反馈",
      reportIssueTitle: "问题反馈",
      reportIssueCategoryLabel: "分类",
      reportIssueCloseLabel: "关闭",
      reportIssueCancelLabel: "取消",
      reportIssueSubmitLabel: "提交",
      reportIssueHint: "反馈此词条数据问题",
      reportIssueCatDefinitionWrong: "释义不对 / 不自然",
      reportIssueCatPosWrong: "词性判断有误",
      reportIssueCatFormsWrong: "变位 / 性别 / 复数 等属性有误",
      reportIssueCatOther: "其他",

      // ✅ 2026-01-12：WordDefinitionBlock（Definition (DE) 行尾端 / hover / fallback）
      definitionDeLabel: "德语释义",
      definitionDeTtsTitle: "播放德语释义",
      senseFallbackPrefix: "义项 ",

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

        // ✅ Task 1：导入（Import）入口
        importButtonLabel: "导入",
        importButtonTitle: "导入",
        importButtonAria: "导入",
        // （本任务 placeholder；下一任务接入 ImportModal）
        importPlaceholderLine1: "（导入功能下一步接入）",
        importPlaceholderLine2: "",

        // ✅ Task 2：导入弹窗（UI-only）
        importModalTitle: "导入",
        importLevelLabel: "等级",
        importScenarioLabel: "情境",
        importTypeLabel: "类型",
        importTypeGrammar: "语法",
        importTypeVocab: "单词",
        importTypePhrases: "常用语",
        importCountLabel: "数量",
        importTargetLabel: "导入到学习本",
        importGenerateButton: "生成",
        importCommitButton: "导入",
        importCancelButton: "取消",
        importSelectAll: "全选",
        importSelectNone: "全不选",
        importEmptyPreviewHint: "尚未生成候选清单",
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

        // ✅ 收藏分类下拉（新增）
        favoriteCategoryLabel: "分类",
        favoriteCategoryLoading: "分类加载中…",
        favoriteCategoryEmpty: "暂无分类",
        favoriteCategoryAll: "全部",

      // ✅ Alias keys (for backward compatibility with WordLibraryPanel.jsx; do not delete)
      setSelectLabel: "学习本",
      setSelectTitle: "选择要学习的内容",
      setSelectAria: "学习本菜单",
      setFavoritesLabel: "我的收藏",
      setNotReadyLine1: "此学习本内容尚未导入",
      setNotReadyLine2: "目前仅显示菜单，稍后会加入完成度与内容",
      testDisabledTitle: "尚未导入测验功能",

        // ✅ 学习本标题（新增）
        setTitleA1Vocab: "A1 单词",
        setTitleA1Grammar: "A1 语法",
        setTitleCommonPhrases: "常用语",
        setTitleTest: "测验",
      },
    },
    // ✅ Speak Analyze Panel (ASR once)
    speakAnalyzePanel: {
      title: "口说分析",
      targetLabel: "目标",
      resultLabel: "分析结果",
      startRecording: "开始录音",
      stopRecording: "停止录音",
      replay: "重播",
      analyze: "分析",
      close: "关闭",
      asrLabel: "系统判定",
      asrProcessing: "系统判定中…",
      asrPrefix: "系统判定：",
      analyzeDone: "分析完成",
      analyzeFailedPrefix: "分析失败：",
      recording: "录音中",
      secondsSuffix: "秒",
      perfect: "全对",
      closeAria: "关闭",
      waveformAria: "口说波形",
      translationLabel: "翻译",
      playTarget: "播放语音",
      showTarget: "显示",
      hideTarget: "隐藏",
      showTranslation: "显示",
      hideTranslation: "隐藏",
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
      termsOfService: "Nutzungsbedingungen",
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

      // ★ Wortart-Zusatzinfo（NEW）
      posInfoSupplementTitle: "Wortart-Info",

      // ✅ Alias key（同義）：給舊/新元件統一取用（不可刪）
      posInfoTitle: "Wortart-Info",
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
        headwordRefLabel: "Referenzform",
        headwordRefHint: "Diese Referenzform erhöht die Chance, dass sie in Beispielsätzen erscheint, ist aber nicht garantiert",
        refPlaceholder: "Referenz hinzufügen (Nomen/Verb/Grammatik)...",
        addRefBtn: "Hinzufügen",
        addRefValidating: "檢核中…",
        confirmBtnLabel: "Bestätigen",
        confirmBtnTitle: "Bestätigen",
        confirmBtnAriaLabel: "Bestätigen",
        refsDirtyHint: "Referenzen geändert — bitte neu erzeugen",
        multiRefHint: "Mehrere Referenzen für Beispiele nutzen",
        refInvalidHint: "Ungültige Referenz (z.B. 'xxx' / '...' / '…').",
        refStatusUsed: "verwendet",
        refStatusMissing: "fehlt",
        missingRefsHint:
          "Einige Referenzen wurden nicht verwendet. Bitte neu erzeugen.",
      },

      conversationTitle: "Konversation",
      conversationCloseLabel: "Schließen",

      // ✅ 2026-01-09：WordCard Problem melden (NEW)
      reportIssueLabel: "Problem melden",
      reportIssueTitle: "Problem melden",
      reportIssueCategoryLabel: "Kategorie",
      reportIssueCloseLabel: "Schließen",
      reportIssueCancelLabel: "Abbrechen",
      reportIssueSubmitLabel: "Senden",
      reportIssueHint: "Problem bei diesem Eintrag melden",
      reportIssueCatDefinitionWrong: "Bedeutung/Übersetzung falsch oder unnatürlich",
      reportIssueCatPosWrong: "Wortart falsch",
      reportIssueCatFormsWrong: "Formen/Genus/Plural usw. falsch",
      reportIssueCatOther: "Sonstiges",

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

        // ✅ Task 1：Import入口
        importButtonLabel: "Importieren",
        importButtonTitle: "Importieren",
        importButtonAria: "Importieren",
        // Platzhalter (naechster Task: ImportModal)
        importPlaceholderLine1: "(Import folgt im naechsten Task.)",
        importPlaceholderLine2: "",

        // ✅ Task 2：Import-Modal（UI-only）
        importModalTitle: "Importieren",
        importLevelLabel: "Niveau",
        importScenarioLabel: "Kontext",
        importTypeLabel: "Typ",
        importTypeGrammar: "Grammatik",
        importTypeVocab: "Wortschatz",
        importTypePhrases: "Redewendungen",
        importCountLabel: "Anzahl",
        importTargetLabel: "In Lernset importieren",
        importGenerateButton: "Generieren",
        importCommitButton: "Importieren",
        importCancelButton: "Abbrechen",
        importSelectAll: "Alle auswählen",
        importSelectNone: "Keine auswählen",
        importEmptyPreviewHint: "Noch keine Vorschau",
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

        // ✅ Favoriten-Kategorien Dropdown（NEU）
        favoriteCategoryLabel: "Kategorie",
        favoriteCategoryLoading: "Kategorien werden geladen…",
        favoriteCategoryEmpty: "Keine Kategorien",
        favoriteCategoryAll: "Alle",

        // ✅ Alias keys (for backward compatibility with WordLibraryPanel.jsx; do not delete)
        setSelectLabel: "Lernset",
        setSelectTitle: "Wähle, was du lernen möchtest",
        setSelectAria: "Lernset-Menü",
        setFavoritesLabel: "Meine Favoriten",
        setNotReadyLine1: "Dieses Lernset ist noch nicht verfügbar.",
        setNotReadyLine2: "Derzeit ist nur das Menü verfügbar; Inhalte und Fortschritt kommen später.",
        testDisabledTitle: "Test ist noch nicht verfügbar.",

        // ✅ Lernset-Titel (NEU)
        setTitleA1Vocab: "A1 Wortschatz",
        setTitleA1Grammar: "A1 Grammatik",
        setTitleCommonPhrases: "Häufige Redewendungen",
        setTitleTest: "Test",
      },
    },

    // ✅ Speak Analyze Panel (ASR once)
    speakAnalyzePanel: {
      title: "Sprech-Analyse",
      targetLabel: "Ziel",
      resultLabel: "Ergebnis",
      startRecording: "Aufnahme starten",
      stopRecording: "Aufnahme stoppen",
      replay: "Wiedergeben",
      analyze: "Analysieren",
      close: "Schließen",
      asrLabel: "System",
      asrProcessing: "System wird ausgewertet…",
      asrPrefix: "System: ",
      analyzeDone: "Analyse abgeschlossen",
      analyzeFailedPrefix: "Analyse fehlgeschlagen: ",
      recording: "Aufnahme läuft",
      secondsSuffix: "s",
      perfect: "Perfekt",
      closeAria: "Schließen",
      waveformAria: "Sprachwellenform",
      translationLabel: "Übersetzung",
      playTarget: "Audio abspielen",
      showTarget: "Anzeigen",
      hideTarget: "Verbergen",
      showTranslation: "Anzeigen",
      hideTranslation: "Verbergen",
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
      termsOfService: "شروط الخدمة",
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

      // ★ معلومات إضافية عن نوع الكلمة（NEW）
      posInfoSupplementTitle: "معلومات نوع الكلمة",

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
        headwordRefLabel: "صيغة مرجعية",
        headwordRefHint: "هذه الصيغة المرجعية تزيد احتمال ظهورها في أمثلة الجمل، لكنها ليست مضمونة",
        refPlaceholder: "أضف مرجعًا (اسم/فعل/قواعد)...",
        addRefBtn: "إضافة",
        addRefValidating: "檢核中…",
        confirmBtnLabel: "تأكيد",
        confirmBtnTitle: "تأكيد",
        confirmBtnAriaLabel: "تأكيد",
        refsDirtyHint: "تم تغيير المراجع — حدّث لإعادة التوليد",
        multiRefHint: "استخدم عدة مراجع لتوليد الأمثلة",
        refInvalidHint: "مرجع غير صالح (مثل: 'xxx' / '...' / '…').",
        refStatusUsed: "مستخدم",
        refStatusMissing: "ناقص",
        missingRefsHint: "لم تُستخدم بعض المراجع. الرجاء إعادة التوليد.",
      },

      conversationTitle: "محادثة",
      conversationCloseLabel: "إغلاق",

      // ✅ 2026-01-09：WordCard الإبلاغ عن مشكلة (NEW)
      reportIssueLabel: "الإبلاغ عن مشكلة",
      reportIssueTitle: "الإبلاغ عن مشكلة",
      reportIssueCategoryLabel: "الفئة",
      reportIssueCloseLabel: "إغلاق",
      reportIssueCancelLabel: "إلغاء",
      reportIssueSubmitLabel: "إرسال",
      reportIssueHint: "أبلِغ عن مشكلة في هذا المُدخل",
      reportIssueCatDefinitionWrong: "التعريف/الترجمة غير صحيحة أو غير طبيعية",
      reportIssueCatPosWrong: "نوع الكلمة غير صحيح",
      reportIssueCatFormsWrong: "التصريف/الجنس/الجمع… غير صحيح",
      reportIssueCatOther: "أخرى",

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

        // ✅ Task 1：استيراد (Import)
        importButtonLabel: "استيراد",
        importButtonTitle: "استيراد",
        importButtonAria: "استيراد",
        // (Placeholder؛ المهمة التالية ستضيف ImportModal)
        importPlaceholderLine1: "(سيتم تنفيذ الاستيراد في المهمة التالية.)",
        importPlaceholderLine2: "",

        // ✅ Task 2：نافذة الاستيراد (UI-only)
        importModalTitle: "استيراد",
        importLevelLabel: "المستوى",
        importScenarioLabel: "السياق",
        importTypeLabel: "النوع",
        importTypeGrammar: "قواعد",
        importTypeVocab: "مفردات",
        importTypePhrases: "عبارات شائعة",
        importCountLabel: "العدد",
        importTargetLabel: "الاستيراد إلى مجموعة التعلّم",
        importGenerateButton: "إنشاء",
        importCommitButton: "استيراد",
        importCancelButton: "إلغاء",
        importSelectAll: "تحديد الكل",
        importSelectNone: "إلغاء تحديد الكل",
        importEmptyPreviewHint: "لا توجد معاينة بعد",
        emptyLine1: "لا توجد كلمات محفوظة بعد",
        emptyLine2: "اضغط على النجمة في صفحة البحث للحفظ",
        cancelFavoriteTitle: "إزالة من المفضلة",
        cannotOperateTitle: "سجّل الدخول لإدارة المفضلة",
        lemmaLabel: "Lemma",
        ariaFavorite: "مفضلة",
        reviewTitle: "انقر لمراجعة هذه الصيغة في البحث",
        senseStatusTitle: "حالة المعنى (عرض فقط؛ ستُضاف الإجراءات لاحقًا)",
        // ✅ 新增（2026-01-04）：hover tooltip 多國字串
        senseStatusDisabledTitle: "غير متصل بعد (عرض فقط)",
        senseLikeTitle: "وضع علامة: مألوف",
        senseDislikeTitle: "وضع علامة: غير مألوف",
        // ✅ 新增
        glossEmpty: "—",
        // ✅ 新增
        headwordButtonTitle: "انقر للمراجعة في البحث",

        // ✅ قائمة فئات المفضلة（جديد）
        favoriteCategoryLabel: "الفئة",
        favoriteCategoryLoading: "جارٍ تحميل الفئات…",
        favoriteCategoryEmpty: "لا توجد فئات",
        favoriteCategoryAll: "الكل",

// ✅ Alias keys (for backward compatibility with WordLibraryPanel.jsx; do not delete)
setSelectLabel: "مجموعة التعلّم",
setSelectTitle: "اختر ما تريد تعلمه",
setSelectAria: "قائمة مجموعة التعلّم",
setFavoritesLabel: "مفضلاتي",
setNotReadyLine1: "هذه المجموعة غير متاحة بعد.",
setNotReadyLine2: "القائمة متاحة فقط حالياً؛ سيتم إضافة المحتوى والتقدم لاحقاً.",
testDisabledTitle: "الاختبار غير متاح بعد.",

        // ✅ عناوين مجموعات التعلّم (جديد)
        setTitleA1Vocab: "مفردات A1",
        setTitleA1Grammar: "قواعد A1",
        setTitleCommonPhrases: "عبارات شائعة",
        setTitleTest: "اختبار",
      },
    },
    // ✅ Speak Analyze Panel (ASR once)
    speakAnalyzePanel: {
      title: "تحليل النطق",
      targetLabel: "النص المستهدف",
      resultLabel: "نتيجة التحليل",
      startRecording: "بدء التسجيل",
      stopRecording: "إيقاف التسجيل",
      replay: "إعادة التشغيل",
      analyze: "تحليل",
      close: "إغلاق",
      asrProcessing: "جارٍ تحليل ASR…",
      asrPrefix: "ASR: ",
      analyzeDone: "تم التحليل",
      analyzeFailedPrefix: "فشل التحليل: ",
      recording: "جارٍ التسجيل",
      secondsSuffix: "ث",
      perfect: "مثالي",
      closeAria: "إغلاق",
      waveformAria: "مخطط موجة النطق",
      translationLabel: "الترجمة",
      playTarget: "تشغيل الصوت",
      showTarget: "إظهار",
      hideTarget: "إخفاء",
      showTranslation: "إظهار",
      hideTranslation: "إخفاء",
    },
  },
};

export default uiText;

// frontend/src/uiText.js
