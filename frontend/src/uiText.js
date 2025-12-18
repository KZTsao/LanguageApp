// frontend/src/uiText.js
// -----------------------------------------------------------
// 多國語言文字（完整覆蓋版）
// 注意：這個檔案只能放「純資料 / 字串」，不能放 JSX / React Component
// -----------------------------------------------------------

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
        nonSentenceOnly: "目前只支援「單字 / 片語 / 慣用語」（非句子）。\n\n⚠️ 請勿輸入標點符號（.,!?、，。；：… 等）",
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

    // ★ Layout（新增）
    layout: {
      mutterspracheLabel: "Native language:",
    },

    // ★ Auth（新增）
    auth: {
      logout: "Sign out",
    },

    // ★ 使用量顯示（新增）
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

      // ★ Noun card: control buttons
      btnPlural: "Plural",
      btnClear: "Clear",

      // ★ Noun card: Active / Reference headers (tab types)
      headerNegation: "Negation (kein)",
      headerQuestionWord: "Question word",
      headerDemonstrative: "Demonstrative",

      // ★ Noun card: collapsed header line
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

      // ★ WordCard badge 需要（新增：不刪減，只補齊）
      phraseLabel: "Phrase",
      irregularPrefix: "Irregular:",
      irregularStrong: "strong",
      irregularMixed: "mixed",
      irregularSuppletive: "suppletive",

      // ✅ WordPosInfoVerb 需要（新增：不刪減，只補齊）
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
        backendUnavailable: "Backend service is currently unavailable. Please try again later.",
        nonSentenceOnly: "Only single words / phrases / idioms are supported (not full sentences).\n\n⚠️ Please remove punctuation (.,!? etc.) and try again.",
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

    // ★ Layout（新增）
    layout: {
      mutterspracheLabel: "母语：",
    },

    // ★ Auth（新增）
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

      // ★ 名词卡：控制按钮
      btnPlural: "复数",
      btnClear: "清除",

      // ★ 名词卡：Active / Reference 标题（tabs 类型）
      headerNegation: "否定冠词",
      headerQuestionWord: "疑问词",
      headerDemonstrative: "指示冠词",

      // ★ 名词卡：折叠列标题用
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

      // ★ WordCard badge 需要（新增：不刪減，只補齊）
      phraseLabel: "短语",
      irregularPrefix: "不规则：",
      irregularStrong: "强变化",
      irregularMixed: "混合变化",
      irregularSuppletive: "完全不规则",

      // ✅ WordPosInfoVerb 需要（新增：不刪減，只補齊）
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
        nonSentenceOnly: "目前只支持「单词 / 短语 / 习惯用语」（非句子）。\n\n⚠️ 请勿输入标点符号（.,!?、，。；：… 等）",
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

    // ★ Layout（新增）
    layout: {
      mutterspracheLabel: "Muttersprache:",
    },

    // ★ Auth（新增）
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

      // ★ Nomen-Karte: Steuerknöpfe
      btnPlural: "Plural",
      btnClear: "Zurück",

      // ★ Nomen-Karte: Active / Reference Überschriften (Tab-Typen)
      headerNegation: "Negation (kein)",
      headerQuestionWord: "Fragewort",
      headerDemonstrative: "Demonstrativ",

      // ★ Nomen-Karte: Kopfzeile im eingeklappten Zustand
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

      // ★ WordCard badge 需要（新增：不刪減，只補齊）
      phraseLabel: "Phrase",
      irregularPrefix: "Unregelmäßig:",
      irregularStrong: "stark",
      irregularMixed: "gemischt",
      irregularSuppletive: "suppletiv",

      // ✅ WordPosInfoVerb 需要（新增：不刪減，只補齊）
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
        backendUnavailable: "Der Backend-Dienst ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
        nonSentenceOnly: "Aktuell werden nur Wörter / Phrasen / Redewendungen unterstützt (keine Sätze).\n\n⚠️ Bitte ohne Satzzeichen eingeben (.,!? usw.).",
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

    // ★ Layout（新增）
    layout: {
      mutterspracheLabel: "اللغة الأم:",
    },

    // ★ Auth（新增）
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

      // ★ بطاقة الاسم: أزرار التحكم
      btnPlural: "جمع",
      btnClear: "مسح",

      // ★ بطاقة الاسم: عناوين Active / Reference (أنواع التبويبات)
      headerNegation: "نفي (kein)",
      headerQuestionWord: "أداة استفهام",
      headerDemonstrative: "اسم إشارة",

      // ★ بطاقة الاسم: سطر العنوان عند الطي
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

      // ★ WordCard badge 需要（新增：不刪減，只補齊）
      phraseLabel: "عبارة",
      irregularPrefix: "غير منتظم:",
      irregularStrong: "قوي",
      irregularMixed: "مختلط",
      irregularSuppletive: "تعويضي",

      // ✅ WordPosInfoVerb 需要（新增：不刪減，只補齊）
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
        backendUnavailable: "الخدمة الخلفية غير متوفرة حالياً، يرجى المحاولة لاحقاً",
        nonSentenceOnly: "حالياً ندعم الكلمات / العبارات / التعابير فقط (ليست جُملاً).\n\n⚠️ الرجاء إزالة علامات الترقيم (.,!? إلخ) ثم المحاولة مرة أخرى.",
      },
    },    
  },
};

export default uiText;
// frontend/src/uiText.js
