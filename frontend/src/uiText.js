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
      caseTableTitle: "四格變化（單數・定冠詞）",

      // ★ 四格名稱
      caseNom: "主格 (Nominativ)",
      caseAkk: "受格 (Akkusativ)",
      caseDat: "與格 (Dativ)",
      caseGen: "屬格 (Genitiv)",

      // ★ 小表格欄位標題（定 / 不定 / 所有格）
      headerDefinite: "定冠詞",
      headerIndefinite: "不定冠詞",
      headerPossessive: "所有格",

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
    },

    tts: {
      play: "播放語音",
      stop: "停止播放",
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

      caseTableTitle: "Cases – Singular (with definite article)",

      caseNom: "Nominative (Nominativ)",
      caseAkk: "Accusative (Akkusativ)",
      caseDat: "Dative (Dativ)",
      caseGen: "Genitive (Genitiv)",

      headerDefinite: "Definite article",
      headerIndefinite: "Indefinite article",
      headerPossessive: "Possessive",

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
      separableFalse: "Inseparable",

      reflexiveLabel: "Reflexive Verb",
      reflexiveTrue: "Reflexive",
      reflexiveFalse: "Non-reflexive",

      auxiliaryLabel: "Auxiliary (Perfekt)",
      valenzLabel: "Valency",

      tenseSelectLabel: "Tense",
      praesensLabel: "Present (Präsens)",
      praeteritumLabel: "Preterite (Präteritum)",
      perfektLabel: "Perfect (Perfekt)",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "(no data)",
    },

    tts: {
      play: "Play",
      stop: "Stop",
    },
  },

  // ----------------------------
  // 简体中文 zh-CN
  // ----------------------------
  "zh-CN": {
    appName: "LanguageApp",
    searchPlaceholder: "输入单词或句子…",
    searchButton: "查询",
    noResultText: "请输入上方内容并点击 Analyze 开始查询",
    signInWithGoogle: "使用 Google 登录",
    signOut: "登出",
    authTesting: "测试 Auth",

    wordCard: {
      headerMain: "单词总览",
      sectionGrammar: "语法信息",
      sectionMeaning: "语义说明",
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

      caseTableTitle: "四格变化（单数・定冠词）",

      caseNom: "主格 (Nominativ)",
      caseAkk: "宾格 (Akkusativ)",
      caseDat: "与格 (Dativ)",
      caseGen: "属格 (Genitiv)",

      headerDefinite: "定冠词",
      headerIndefinite: "不定冠词",
      headerPossessive: "所有格",

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
      praeteritumLabel: "过去式（Präteritum）",
      perfektLabel: "完成式（Perfekt）",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "（无资料）",
    },

    tts: {
      play: "播放语音",
      stop: "停止播放",
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

      caseTableTitle: "الحالات – المفرد (مع أداة التعريف)",

      caseNom: "مرفوع (Nominativ)",
      caseAkk: "منصوب (Akkusativ)",
      caseDat: "مجرور (Dativ)",
      caseGen: "مضاف إليه (Genitiv)",

      headerDefinite: "مع أداة التعريف",
      headerIndefinite: "نكرة",
      headerPossessive: "ضمير الملكية",

      grammarOptionsLabel: "بنية الجملة",
      grammarToggleLabel: "تعديل بنية الجملة",
      grammarCaseLabel: "الحالة الإعرابية",

      grammarCaseNomLabel: "مرفوع",
      grammarCaseAkkLabel: "منصوب",
      grammarCaseDatLabel: "مجرور",
      grammarCaseGenLabel: "مضاف إليه",

      grammarArticleLabel: "أداة التعريف",
      grammarArticleDefLabel: "مع أداة التعريف",
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
        Artikel: "أداة تعريف",
        Pronomen: "ضمير",
        Präposition: "حرف جر",
        Konjunktion: "أداة ربط",
        Numerale: "عدد",
        Interjektion: "أداة تعجب",
        Partikel: "أداة",
        Hilfsverb: "فعل مساعد",
        Modalverb: "فعل ناقص",
        Reflexivpronomen: "ضمير انعكاسي",
        Possessivpronomen: "ضمير ملكية",
      },
    },

    verbCard: {
      title: "تصريف الفعل",
      subtypeLabel: "نوع الفعل",
      subtypeFullVerb: "فعل رئيسي",
      subtypeModal: "فعل مودال",
      subtypeAux: "فعل مساعد",

      separableLabel: "فعل منفصل",
      separableTrue: "منفصل",
      separableFalse: "غير منفصل",

      reflexiveLabel: "فعل انعكاسي",
      reflexiveTrue: "انعكاسي",
      reflexiveFalse: "غير انعكاسي",

      auxiliaryLabel: "الفعل المساعد (Perfekt)",
      valenzLabel: "التعدية",

      tenseSelectLabel: "الزمن",
      praesensLabel: "الحاضر (Präsens)",
      praeteritumLabel: "الماضي (Präteritum)",
      perfektLabel: "التام (Perfekt)",

      ichLabel: "ich",
      duLabel: "du",
      erSieEsLabel: "er/sie/es",
      wirLabel: "wir",
      ihrLabel: "ihr",
      sieSieLabel: "sie/Sie",

      noFormText: "(لا توجد بيانات)",
    },

    tts: {
      play: "تشغيل",
      stop: "إيقاف",
    },
  },

  // ----------------------------
  // Deutsch de
  // ----------------------------
  de: {
    appName: "LanguageApp",
    searchPlaceholder: "Wort oder Satz eingeben…",
    searchButton: "Suchen",
    noResultText: 'Bitte oben etwas eingeben und auf "Analyze" klicken, um zu starten',
    signInWithGoogle: "Mit Google anmelden",
    signOut: "Abmelden",
    authTesting: "Auth testen",

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

      caseTableTitle: "Fälle – Singular (mit bestimmtem Artikel)",

      caseNom: "Nominativ",
      caseAkk: "Akkusativ",
      caseDat: "Dativ",
      caseGen: "Genitiv",

      headerDefinite: "Bestimmter Artikel",
      headerIndefinite: "Unbestimmter Artikel",
      headerPossessive: "Possessiv",

      grammarOptionsLabel: "Satzmuster",
      grammarToggleLabel: "Satzmuster anpassen",
      grammarCaseLabel: "Kasus",

      grammarCaseNomLabel: "Nominativ",
      grammarCaseAkkLabel: "Akkusativ",
      grammarCaseDatLabel: "Dativ",
      grammarCaseGenLabel: "Genitiv",

      grammarArticleLabel: "Artikel",
      grammarArticleDefLabel: "Bestimmter Artikel",
      grammarArticleIndefLabel: "Unbestimmter Artikel",
      grammarArticleNoneLabel: "Ohne Artikel",

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
    },

    tts: {
      play: "Abspielen",
      stop: "Stopp",
    },
  },
};

export default uiText;
