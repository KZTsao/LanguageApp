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
    appName: "soLang",
    searchPlaceholder: "輸入單字或句子…",
    searchButton: "查詢",
    noResultText: "請輸入上方欄位並按下 Analyze 開始查詢",
    loadingText: "正在分析中，請稍候…",
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
      planLabel: "方案：",
      upgradeMonthly: "月繳升級",
      upgradeYearly: "年繳升級",
      upgradeLoginRequired: "請先登入再升級",
      checkoutUrlFailed: "取得付款連結失敗，請稍後再試",
      checkoutUrlMissing: "取得付款連結失敗（無 URL）",
    },

    // ★ Auth（新增）
    auth: {
      logout: "登出",
    },


    loginPage: {
      titles: { signIn: "Email 登入", signUp: "Email 註冊", forgot: "忘記密碼" },
      tabs: { signIn: "登入", signUp: "註冊", forgot: "忘記密碼" },
      labels: {
        email: "Email",
        password: "密碼",
        passwordConfirm: "確認密碼",
        nicknameOptional: "暱稱（選填）",
        orEmail: "或使用 Email",
        redirect: "回跳：",
        unknownOrigin: "（未知 origin）",
      },
      placeholders: {
        email: "name@example.com",
        passwordSignUp: "至少 6 碼",
        passwordConfirm: "再輸入一次密碼",
        nickname: "顯示在右上角，例如：Barbie",
      },
      buttons: {
        googleSignIn: "使用 Google 登入",
        signIn: "登入",
        signingIn: "登入中…",
        signUp: "註冊並寄驗證信",
        sendReset: "寄重設密碼信",
        submitting: "送出中…",
        backHome: "回首頁",
      },
      info: {
        redirectingGoogle: "正在跳轉至 Google 登入…",
        signInOk: "登入成功，正在回到首頁…",
        signUpSent: "已送出註冊，請到信箱完成驗證（驗證後會回到此站）",
        resetSent: "已寄出重設密碼信，請到信箱點連結回到本站設定新密碼",
      },
      errors: {
        emailRequired: "請輸入 Email",
        emailInvalid: "Email 格式看起來不正確",
        passwordRequired: "請輸入密碼",
        passwordTooShort: "密碼至少 6 碼",
        passwordConfirmRequired: "請再輸入一次密碼",
        passwordMismatch: "兩次密碼不一致",
      },
    },

    // ★ 使用量顯示（新增）
    usage: {
      today: "今日",
      month: "本月",
      query: "查詢",
      voice: "語音",
    },

    alerts: {
      anonDailyLimit: "如果要查詢更多，請註冊會員",
      // ✅ Generic quota/usage limit (covers anon/free/paid/)
      // - Used by App.jsx listener for "langapp:quotaLimit"
      quotaParts: {
        tier: {
          anon: "未登入",
          free: "免費",
          paid: "付費",
          premium: "Premium",
          unknown: "方案",
        },
        window: {
          daily: "今日",
          monthly: "本月",
          unknown: "期間",
        },
        metric: {
          query: "查詢",
          analyze_new: "分析",
          examples: "例句產生",
          conversation: "對話產生",
          asr_seconds: "錄音秒數",
          pron_tips: "發音分析",
          ai_recs: "AI 建議字",
          unknown: "功能",
        },
        // message fragments
        sep: "方案：",
        reached: "已達使用上限。",
        resetAtPrefix: "\n下次補額時間：",
        generic: "已達使用上限。",
      },
    },

    // ✅ Section titles (ResultPanel)
    sections: {
      grammarCardTitle: "文法說明",
    },


    // ★ SentenceCard（新增：SentenceCard hover tooltip / button labels）
    sentenceCard: {
      speakTitle: "播放整句",
      moreLabel: "展開更多",
      wordTitle: "查看字卡",
      // learning mode
      sentenceCoreTitle: "這句最值得學的是",
      extendExampleTitle: "延伸例句",
      // icon tooltips
      conversationPracticeTitle: "對話練習",
      pronunciationPracticeTitle: "發音練習",
      // conversation toggle tooltip (optional)
      conversationToggleTooltipOpen: "隱藏連續對話",
      conversationToggleTooltipClosed: "產生連續對話",
      pronunciationTooltip: "跟讀錄音",
      // conversation nav (SentenceCard inline)
      conversationPrevLabel: "上一句",
      conversationNextLabel: "下一句",
    },


    // ★ Sentence（SentenceCard strict i18n alias；SentenceCard.jsx 僅使用 t.sentence.xxx）
    sentence: {
      speakTitle: "播放整句",
      moreLabel: "展開更多",
      wordTitle: "查看字卡",
      extendExampleTitle: "延伸例句",
      conversationPracticeTitle: "對話練習",
      pronunciationPracticeTitle: "發音練習",
      conversationPrevLabel: "上一句",
      conversationNextLabel: "下一句",
      // recording / analyze messages
      recordNotSupported: "瀏覽器不支援錄音",
      recordBuildFail: "錄音檔建立失敗",
      recordStartFail: "無法啟動錄音（權限或裝置問題）",
      recordFirst: "請先錄音",
      analyzeFail: "分析失敗，請重試",
      // structure label fallback (rare; structure is suppressed in B-mode)
      structureRoleFallback: "主詞",
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


      // ★ 代名詞（NEW）
      posInfoPronoun: {
        title: "代名詞變化",
        personalTitle: "人稱代名詞",
        possessiveTitleTemplate: "所有格（{stem}）",
        dash: "—",
        genderM: "陽（m）",
        genderF: "陰（f）",
        genderN: "中（n）",
        genderPl: "複（pl）",
        caseN: "N",
        caseA: "A",
        caseD: "D",
        caseG: "G",

        // Special UI controls
        pillPersonal: "代名詞",
        pillPossessive: "所有格",
        sieMenuLabel: "Sie",
        siePolite: "尊稱",
        sieShe: "她",
        sieThey: "他們／她們",
      },
      // ★ Artikel（NEW：strict i18n for WordPosInfoArtikel）
      posInfoArtikel: {
        title: "冠詞（Artikel）",
        desc: "標示名詞的「性別 + 格」",
        expandLabel: "展開",
        collapseLabel: "收合",
        typeLabels: { def: "定冠詞", indef: "不定冠詞", generic: "冠詞" },
        genderLabels: { m: "陽性", f: "陰性", n: "中性", p: "複數" },
        caseLabels: {
          N: "主格（主詞）",
          A: "賓格（受詞）",
          D: "與格（間接受詞）",
          G: "屬格（所有/關係）",
        },
        learningPointTemplate: "{typeLabel}：{genderLabel}的{caseLabel}。",
        learningPointGenTemplate: "{typeLabel}：{genderLabel}的{caseLabel}常見搭配「des + 名詞(s/es)」。",
        miniRules: {
          N: ["主格多用在句子的主詞位置", "問句：Wer/Was ...? 常對應 Nominativ", "最常見句型：Der Mann ist hier."],
          A: [
            "很多動詞的直接受詞用 Akkusativ（例：sehen / kaufen / finden）",
            "問句：Wen/Was ...? 常對應 Akkusativ",
            "遇到雙受詞句型：人常 Dativ、物常 Akkusativ（例：Ich gebe dem Mann den Ball）",
          ],
          D: ["常見介系詞：mit / nach / bei / zu / von → Dativ", "問句：Wem ...? 常對應 Dativ", "雙受詞句型：給『誰』通常是 Dativ"],
          G: [
            "Genitiv 常表示『…的』關係",
            "常見介系詞：wegen / trotz / während（口語偶爾用 Dativ）",
            "陽/中性名詞常加 -(e)s（例：des Mannes / des Kindes）",
          ],
        },
        colTitles: { m: "Maskulin", f: "Feminin", n: "Neutrum", p: "Plural" },
      },
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
      // Sentence Type (used by __t("grammar.sentenceType.*.label"))
      grammar: {
    loadingText: "正在分析中，請稍候…",
        sentenceType: {
          default: { label: "一般句（陳述）" },
          question_yesno: { label: "問句（是／否）" },
          question_w: { label: "問句（疑問詞）" },
          imperative: { label: "祈使句" },
          request_polite: { label: "禮貌請求" },
          prohibition: { label: "禁止句" },
          suggestion: { label: "建議句" },
          exclamation: { label: "感嘆句" },
        },
      },

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
        // ✅ 建議字（recommendations）
        recsTitle: "建議字",
        recs: {
          sameWord: "同字",
          synonyms: "同義",
          antonyms: "反義",
          related: "相關",
          wordFamily: "同詞根家族",
          roots: "同詞根",
          collocations: "常用搭配",
        },
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
      
        phrase: "片語",
        grammar: "文法",
        unknown: "未知",
        Phrase: "片語",
        Grammatik: "文法",
        Unbekannt: "未知",},
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

      declTitle: "詞尾變化",
      declWeakLabel: "定冠詞（弱變化）",
      declMixedLabel: "不定冠詞（混合變化）",
      declStrongLabel: "無冠詞（強變化）",

      nounPlaceholder: "___",

      declCaseTitle: "格位",
      declCases: { nom: "主格", acc: "受格", dat: "與格", gen: "屬格" },
      genderM: "M",
      genderF: "F",
      genderN: "N",
      hintText: "形容詞詞尾會跟著「冠詞 / 性別 / 格位」變化",
      degreeNotComparableHint: "此形容詞通常不使用比較級",
      declNotDeclinableHint: "此形容詞在名詞前通常不做詞尾變化",

      recTitle: "推薦",
      recSynLabel: "同義詞",
      recAntLabel: "反義詞",
      recRootLabel: "字根",
      recCollocationLabel: "搭配詞",
      recIdiomsLabel: "慣用語",
      recRelatedLabel: "相關詞",
      recEmptyText: "—",
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
    loadingText: "正在分析中，請稍候…",
        testMode: "測試模式",
        testModeTitle: "進入測試模式",
        // ✅ 2026-02-24：產品用語統一：單字庫 → 學習本
        library: "學習本",
        libraryTitle: "查看學習本",
        back: "返回",
        backTitle: "返回查詢頁",
      },
      history: {
        clearThis: "點擊清除該筆紀錄",
      },
      learning: {
        backToLearning: "返回學習瀏覽",
        continueWithTitle: "繼續學習{title}",
      },
      errors: {
        backendUnavailable: "後端服務目前無法使用，請稍後再試",
        nonSentenceOnly:
          "目前只支援「單字 / 片語 / 慣用語」（非句子）。\n\n⚠️ 請勿輸入標點符號（.,!?、，。；：… 等）",
      },

      // ✅ WordLibraryPanel（新增：集中管理）

      // ✅ 未登入點「學習本 / 我的最愛」提示
      alerts: {
        loginRequiredLibrary: "請先註冊或登入後才能使用學習本（我的最愛）",
        // ✅ Anonymous daily limit (legacy)
        anonDailyLimit: "如果要使用更多次數，請註冊會員。",
        // ✅ Generic quota/usage limit (covers anon/free/paid/premium)
        // - Used by App.jsx listener for "langapp:quotaLimit"
        quotaParts: {
          tier: {
            anon: "未登入",
            free: "免費",
            paid: "付費",
            premium: "Premium",
            unknown: "方案",
          },
          window: {
            daily: "今日",
            monthly: "本月",
            unknown: "期間",
          },
          metric: {
            query: "查詢",
            analyze_new: "分析",
            examples: "例句產生",
            conversation: "對話產生",
            asr_seconds: "錄音秒數",
            pron_tips: "發音分析",
            ai_recs: "AI 建議字",
            unknown: "功能",
          },
          // message fragments
          sep: "方案：",
          reached: "已達使用上限。",
          resetAtPrefix: "\n下次補額時間：",
          generic: "使用量已達上限。",
        },
      },

      // ✅ 未登入點「學習本 / 我的最愛」提示（App.jsx 用 app.library.loginRequiredAlert）
      library: {
        loginRequiredAlert: "請先註冊或登入後才能使用學習本（我的最愛）",
      },
      libraryPanel: {
        // ✅ 新增
        title: "學習本",
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


        // ✅ FavoriteCategoryManager (manage categories modal)
        manageCategoriesLabel: "管理分類",
        addCategoryLabel: "新增分類",
        closeLabel: "關閉",
        renameLabel: "改名",
        moveUpLabel: "上移",
        moveDownLabel: "下移",
        importLabel: "匯入",
        archiveLabel: "封存",
        archiveConfirmText: "確定封存這個分類？",
        archiveFailedError: "封存失敗",
        idInvalidError: "ID 不合法",
        nameEmptyError: "名稱不可為空",
        nameDuplicateError: "名稱不可重複",
        saveFailedError: "儲存失敗",
        createFailedError: "新增失敗",
        reorderFailedError: "排序失敗",
        untitledCategoryLabel: "新分類",
        noCategoriesText: "—",
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

      // ✅ Pronunciation tips (Phase 1: token-level heuristic)
      pronTipsTitle: "發音建議",
      pronTipsPrefix: "發音建議：",
      pronTipsLoading: "建議產生中…",
      pronTipsMissing: "可能有漏念：請對照紅色標記的字再試一次。",
      pronTipsExtra: "可能有多念/插入：請放慢速度，避免多加字。",
      pronTipsLow: "部分字不夠清楚：可加強子音收尾與重音。",
      pronTipsOk: "整體不錯：再注意節奏與連音即可。",
    },
  },

      

  // ----------------------------
  // English
  // ----------------------------
  en: {
    loadingText: "Analyzing, please wait…",
    appName: "soLang",
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
      planLabel: "Plan: ",
      upgradeMonthly: "Upgrade (monthly)",
      upgradeYearly: "Upgrade (yearly)",
      upgradeLoginRequired: "Please sign in to upgrade",
      checkoutUrlFailed: "Failed to get checkout link. Please try again.",
      checkoutUrlMissing: "Failed to get checkout link (no URL).",
    },

    auth: {
      logout: "Sign out",
    },


    loginPage: {
      titles: { signIn: "Sign in with Email", signUp: "Sign up with Email", forgot: "Forgot password" },
      tabs: { signIn: "Sign in", signUp: "Sign up", forgot: "Forgot password" },
      labels: {
        email: "Email",
        password: "Password",
        passwordConfirm: "Confirm password",
        nicknameOptional: "Nickname (optional)",
        orEmail: "or use Email",
        redirect: "Redirect:",
        unknownOrigin: "(unknown origin)",
      },
      placeholders: {
        email: "name@example.com",
        passwordSignUp: "at least 6 chars",
        passwordConfirm: "type the password again",
        nickname: "Shown in the top-right, e.g. Barbie",
      },
      buttons: {
        googleSignIn: "Continue with Google",
        signIn: "Sign in",
        signingIn: "Signing in…",
        signUp: "Sign up & send verification email",
        sendReset: "Send password reset email",
        submitting: "Submitting…",
        backHome: "Back to home",
      },
      info: {
        redirectingGoogle: "Redirecting to Google sign-in…",
        signInOk: "Signed in. Redirecting to home…",
        signUpSent: "Sign-up submitted. Please verify via email (you will be redirected back here).",
        resetSent: "Password reset email sent. Open the link to set a new password.",
      },
      errors: {
        emailRequired: "Please enter your email",
        emailInvalid: "Email format doesn't look right",
        passwordRequired: "Please enter your password",
        passwordTooShort: "Password must be at least 6 characters",
        passwordConfirmRequired: "Please confirm your password",
        passwordMismatch: "Passwords do not match",
      },
    },

    usage: {
      today: "Today",
      month: "This month",
      query: "Lookup",
      voice: "Voice",
    },

    alerts: {
      anonDailyLimit: "To continue using this feature, please sign up.",
      // ✅ Generic quota/usage limit (covers anon/free/paid/premium)
      // - Used by App.jsx listener for "langapp:quotaLimit"
      quotaParts: {
        tier: {
          anon: "Not signed in",
          free: "Free",
          paid: "Paid",
          premium: "Premium",
          unknown: "Plan",
        },
        window: {
          daily: "Today",
          monthly: "This month",
          unknown: "Period",
        },
        metric: {
          query: "Lookup",
          analyze_new: "Analysis",
          examples: "Example generation",
          conversation: "Conversation generation",
          asr_seconds: "Recording seconds",
          pron_tips: "Pronunciation analysis",
          ai_recs: "AI word suggestions",
          unknown: "Feature",
        },
        sep: " plan: ",
        reached: " limit reached.",
        resetAtPrefix: "\nNext reset: ",
        generic: "Usage limit reached.",
      },
    },

    // ✅ Section titles (ResultPanel)
    sections: {
      grammarCardTitle: "Grammar Explanation",
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


      // ★ Pronoun (NEW)
      posInfoPronoun: {
        title: "Pronoun declension",
        personalTitle: "Personal pronouns",
        possessiveTitleTemplate: "Possessive (Possessivartikel: {stem})",
        dash: "—",
        genderM: "m",
        genderF: "f",
        genderN: "n",
        genderPl: "pl",
        caseN: "N",
        caseA: "A",
        caseD: "D",
        caseG: "G",

        // Special UI controls
        pillPersonal: "Personal",
        pillPossessive: "Possessive",
        sieMenuLabel: "Sie",
        siePolite: "Polite",
        sieShe: "She",
        sieThey: "They",
      },
      // ★ Artikel（NEW：strict i18n for WordPosInfoArtikel）
      posInfoArtikel: {
        title: "Article (Artikel)",
        desc: "Marks a noun’s “gender + case”",
        expandLabel: "Expand",
        collapseLabel: "Collapse",
        typeLabels: { def: "Definite article", indef: "Indefinite article", generic: "Article" },
        genderLabels: { m: "masculine", f: "feminine", n: "neuter", p: "plural" },
        caseLabels: {
          N: "Nominative (subject)",
          A: "Accusative (direct object)",
          D: "Dative (indirect object)",
          G: "Genitive (possession/relationship)",
        },
        learningPointTemplate: "{typeLabel}: {genderLabel} {caseLabel}.",
        learningPointGenTemplate: "{typeLabel}: {genderLabel} {caseLabel} often uses “des + noun(s/es)”.",
        miniRules: {
          N: [
            "Nominative is commonly used for the subject position",
            "Question: Wer/Was ...? often maps to Nominative",
            "Common pattern: Der Mann ist hier.",
          ],
          A: [
            "Many verbs take a direct object in Accusative (e.g., sehen / kaufen / finden)",
            "Question: Wen/Was ...? often maps to Accusative",
            "In double-object sentences: person is often Dative, thing is often Accusative (e.g., Ich gebe dem Mann den Ball)",
          ],
          D: [
            "Common prepositions: mit / nach / bei / zu / von → Dative",
            "Question: Wem ...? often maps to Dative",
            "In giving patterns, the receiver is usually Dative",
          ],
          G: [
            "Genitive often expresses an “of / ’s” relationship",
            "Common prepositions: wegen / trotz / während (colloquially sometimes Dative)",
            "Masculine/neuter nouns often add -(e)s (e.g., des Mannes / des Kindes)",
          ],
        },
        colTitles: { m: "Masculine", f: "Feminine", n: "Neuter", p: "Plural" },
      },
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
      // Sentence Type (used by __t("grammar.sentenceType.*.label"))
      grammar: {
    loadingText: "Analyzing, please wait…",
        sentenceType: {
          default: { label: "Statement" },
          question_yesno: { label: "Yes/No question" },
          question_w: { label: "Wh-question" },
          imperative: { label: "Imperative" },
          request_polite: { label: "Polite request" },
          prohibition: { label: "Prohibition" },
          suggestion: { label: "Suggestion" },
          exclamation: { label: "Exclamation" },
        },
      },

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
        addRefValidating: "Validating…",
        confirmBtnLabel: "Confirm",
        confirmBtnTitle: "Confirm",
        confirmBtnAriaLabel: "Confirm",
        refsDirtyHint: "Refs changed — refresh to regenerate",
        multiRefHint: "Use multiple refs for examples",
        refInvalidHint: "Invalid reference (e.g., 'xxx' / '...' / '…').",
        refStatusUsed: "used",
        refStatusMissing: "missing",
        missingRefsHint: "Some references were not used. Please regenerate.",
        // ✅ 建議字（recommendations）
        recsTitle: "Suggestions",
        recs: {
          sameWord: "Same word",
          synonyms: "Synonyms",
          antonyms: "Antonyms",
          related: "Related",
          wordFamily: "Word family",
          roots: "Roots",
          collocations: "Collocations",
        },
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
      
        phrase: "Phrase",
        grammar: "Grammar",
        unknown: "Unknown",
        Phrase: "Phrase",
        Grammatik: "Grammar",
        Unbekannt: "Unknown",},
    },

    sentenceCard: {
      speakTitle: "Play sentence",
      moreLabel: "Show more",
      wordTitle: "Open word card",
      // learning mode
      sentenceCoreTitle: "Key learning point",
      extendExampleTitle: "Extended examples",
      // icon tooltips
      conversationPracticeTitle: "Dialogue practice",
      pronunciationPracticeTitle: "Pronunciation practice",
      // conversation toggle tooltip (optional)
      conversationToggleTooltipOpen: "Hide continuous dialogue",
      conversationToggleTooltipClosed: "Generate continuous dialogue",
      pronunciationTooltip: "Shadowing practice",
      // conversation nav (SentenceCard inline)
      conversationPrevLabel: "Previous",
      conversationNextLabel: "Next",
    }
,

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

      declTitle: "Endings",
      declWeakLabel: "Definite article (weak)",
      declMixedLabel: "Indefinite article (mixed)",
      declStrongLabel: "No article (strong)",

      nounPlaceholder: "noun",
      hintText: "Adjective endings depend on article / gender / case.",
      degreeNotComparableHint: "This adjective is usually not used in comparative forms.",
      declNotDeclinableHint: "This adjective is usually not inflected before nouns.",
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
    loadingText: "Analyzing, please wait…",
        testMode: "Test Mode",
        testModeTitle: "Enter test mode",
        // ✅ 2026-02-24：Product copy: Word Library → Learning Book
        library: "Learning Book",
        libraryTitle: "Open learning book",
        back: "Back",
        backTitle: "Back to search",
      },
      history: {
        clearThis: "Click to clear this record",
      },
      learning: {
        backToLearning: "Back to learning",
        continueWithTitle: "Continue learning {title}",
      },
      errors: {
        backendUnavailable:
          "Backend service is currently unavailable. Please try again later.",
        nonSentenceOnly:
          "Only single words / phrases / idioms are supported (not full sentences).\n\n⚠️ Please remove punctuation (.,!? etc.) and try again.",
      },

      // ✅ Unauthenticated: Library / Favorites requires login
      // (App.jsx uses app.library.loginRequiredAlert)
      alerts: {
        loginRequiredLibrary: "Please sign up or sign in to use the learning set (My Favorites).",
        // ✅ حدّ الاستخدام اليومي للمستخدم غير المسجّل (للتوافق)
        anonDailyLimit: "To continue using this feature, please sign up.",
        // ✅ حدّ الاستخدام العام (يشمل anon/free/paid/premium)
        // - Used by App.jsx listener for "langapp:quotaLimit"
        quotaParts: {
          tier: {
            anon: "Not signed in",
            free: "Free",
            paid: "Paid",
            premium: "Premium",
            unknown: "Plan",
          },
          window: {
            daily: "Today",
            monthly: "This month",
            unknown: "Period",
          },
          metric: {
            query: "Lookup",
            analyze_new: "Analysis",
            examples: "Example generation",
            conversation: "Conversation generation",
            asr_seconds: "Recording seconds",
            pron_tips: "Pronunciation analysis",
            ai_recs: "AI word suggestions",
            unknown: "Feature",
          },
          sep: "Plan: ",
          reached: " limit reached.",
          resetAtPrefix: "\nNext reset: ",
          generic: "Usage limit reached.",
        },
      },
      library: {
        loginRequiredAlert: "Please sign up or sign in to use Learning Sets (My Favorites).",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "Learning Book",
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
        importTypePhrases: "Phrases",
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


        // ✅ FavoriteCategoryManager (manage categories modal)
        manageCategoriesLabel: "Manage categories",
        addCategoryLabel: "Add category",
        closeLabel: "Close",
        renameLabel: "Rename",
        moveUpLabel: "Move up",
        moveDownLabel: "Move down",
        importLabel: "Import",
        archiveLabel: "Archive",
        archiveConfirmText: "Archive this category?",
        archiveFailedError: "Archive failed",
        idInvalidError: "Invalid ID",
        nameEmptyError: "Name cannot be empty",
        nameDuplicateError: "Name already exists",
        saveFailedError: "Save failed",
        createFailedError: "Create failed",
        reorderFailedError: "Reorder failed",
        untitledCategoryLabel: "New category",
        noCategoriesText: "—",
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

      // ✅ Pronunciation tips (Phase 1: token-level heuristic)
      pronTipsTitle: "Pronunciation tips",
      pronTipsPrefix: "Pronunciation tips: ",
      pronTipsLoading: "Generating tips…",
      pronTipsMissing: "You may have missed a word—check the red tokens and try again.",
      pronTipsExtra: "You may have inserted extra words—slow down and avoid adding words.",
      pronTipsLow: "Some words are unclear—focus on final consonants and stress.",
      pronTipsOk: "Nice overall—pay attention to rhythm and linking.",
    },
  },

      

  // ----------------------------
  // 簡體中文 zh-CN
  // ----------------------------
  "zh-CN": {
    appName: "soLang",
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
      planLabel: "方案：",
      upgradeMonthly: "月缴升级",
      upgradeYearly: "年缴升级",
      upgradeLoginRequired: "请先登录再升级",
      checkoutUrlFailed: "获取付款链接失败，请稍后再试",
      checkoutUrlMissing: "获取付款链接失败（无 URL）",
    },

    auth: {
      logout: "登出",
    },


    loginPage: {
      titles: { signIn: "Email 登录", signUp: "Email 注册", forgot: "忘记密码" },
      tabs: { signIn: "登录", signUp: "注册", forgot: "忘记密码" },
      labels: {
        email: "Email",
        password: "密码",
        passwordConfirm: "确认密码",
        nicknameOptional: "昵称（选填）",
        orEmail: "或使用 Email",
        redirect: "跳转：",
        unknownOrigin: "（未知 origin）",
      },
      placeholders: {
        email: "name@example.com",
        passwordSignUp: "至少 6 码",
        passwordConfirm: "再输入一次密码",
        nickname: "显示在右上角，例如：Barbie",
      },
      buttons: {
        googleSignIn: "使用 Google 登录",
        signIn: "登录",
        signingIn: "登录中…",
        signUp: "注册并发送验证邮件",
        sendReset: "发送重置密码邮件",
        submitting: "提交中…",
        backHome: "返回首页",
      },
      info: {
        redirectingGoogle: "正在跳转至 Google 登录…",
        signInOk: "登录成功，正在返回首页…",
        signUpSent: "已提交注册，请到邮箱完成验证（验证后会回到本站）",
        resetSent: "已发送重置邮件，请到邮箱点击链接回本站设置新密码",
      },
      errors: {
        emailRequired: "请输入 Email",
        emailInvalid: "Email 格式似乎不正确",
        passwordRequired: "请输入密码",
        passwordTooShort: "密码至少 6 码",
        passwordConfirmRequired: "请再输入一次密码",
        passwordMismatch: "两次密码不一致",
      },
    },

    usage: {
      today: "今日",
      month: "本月",
      query: "查询",
      voice: "语音",
    },

    alerts: {
      anonDailyLimit: "如果要继续使用此功能，请注册会员",
      // ✅ Generic quota/usage limit (covers anon/free/paid/premium)
      // - Used by App.jsx listener for "langapp:quotaLimit"
      quotaParts: {
        tier: {
          anon: "未登录",
          free: "免费",
          paid: "付费",
          premium: "高级",
          unknown: "方案",
        },
        window: {
          daily: "今日",
          monthly: "本月",
          unknown: "期间",
        },
        metric: {
          query: "查询",
          analyze_new: "分析",
          examples: "例句生成",
          conversation: "对话生成",
          asr_seconds: "录音秒数",
          pron_tips: "发音分析",
          ai_recs: "AI 建议字",
          unknown: "功能",
        },
        sep: "方案：",
        reached: "已达使用上限。",
        resetAtPrefix: "\n下次补额时间：",
        generic: "已达使用上限。",
      },
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


      // ★ 代名词（NEW）
      posInfoPronoun: {
        title: "代名词变格",
        personalTitle: "人称代名词",
        possessiveTitleTemplate: "所有格（{stem}）",
        dash: "—",
        genderM: "阳（m）",
        genderF: "阴（f）",
        genderN: "中（n）",
        genderPl: "复（pl）",
        caseN: "N",
        caseA: "A",
        caseD: "D",
        caseG: "G",

        // Special UI controls
        pillPersonal: "代名词",
        pillPossessive: "所有格",
        sieMenuLabel: "Sie",
        siePolite: "尊称",
        sieShe: "她",
        sieThey: "他们／她们",
      },
      // ★ Artikel（NEW：strict i18n for WordPosInfoArtikel）
      posInfoArtikel: {
        title: "冠词（Artikel）",
        desc: "标示名词的「性别 + 格」",
        expandLabel: "展开",
        collapseLabel: "收起",
        typeLabels: { def: "定冠词", indef: "不定冠词", generic: "冠词" },
        genderLabels: { m: "阳性", f: "阴性", n: "中性", p: "复数" },
        caseLabels: {
          N: "主格（主语）",
          A: "宾格（受词）",
          D: "与格（间接受词）",
          G: "属格（所有/关系）",
        },
        learningPointTemplate: "{typeLabel}：{genderLabel}的{caseLabel}。",
        learningPointGenTemplate: "{typeLabel}：{genderLabel}的{caseLabel}常见搭配「des + 名词(s/es)」。",
        miniRules: {
          N: ["主格多用在句子的主语位置", "问句：Wer/Was ...? 常对应 Nominativ", "常见句型：Der Mann ist hier."],
          A: [
            "很多动词的直接受词用 Akkusativ（例：sehen / kaufen / finden）",
            "问句：Wen/Was ...? 常对应 Akkusativ",
            "双受词句型：人常 Dativ、物常 Akkusativ（例：Ich gebe dem Mann den Ball）",
          ],
          D: ["常见介系词：mit / nach / bei / zu / von → Dativ", "问句：Wem ...? 常对应 Dativ", "双受词句型：给『谁』通常是 Dativ"],
          G: [
            "Genitiv 常表示『…的』关系",
            "常见介系词：wegen / trotz / während（口语偶尔用 Dativ）",
            "阳/中性名词常加 -(e)s（例：des Mannes / des Kindes）",
          ],
        },
        colTitles: { m: "Maskulin", f: "Feminin", n: "Neutrum", p: "Plural" },
      },
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
      // Sentence Type (used by __t("grammar.sentenceType.*.label"))
      grammar: {
    loadingText: "正在分析中，请稍候…",
        sentenceType: {
          default: { label: "一般句（陈述）" },
          question_yesno: { label: "问句（是/否）" },
          question_w: { label: "问句（疑问词）" },
          imperative: { label: "祈使句" },
          request_polite: { label: "礼貌请求" },
          prohibition: { label: "禁止句" },
          suggestion: { label: "建议句" },
          exclamation: { label: "感叹句" },
        },
      },

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
        addRefValidating: "校验中…",
        confirmBtnLabel: "确认",
        confirmBtnTitle: "确认",
        confirmBtnAriaLabel: "确认",
        refsDirtyHint: "参考已变更，按重新生成才会套用",
        multiRefHint: "使用多个参考点生成例句",
        refInvalidHint: "不合理的参考（例如：xxx / ... / …），已阻挡加入",
        refStatusUsed: "已使用",
        refStatusMissing: "缺少",
        missingRefsHint: "有参考未被使用，请再重新生成",
        // ✅ 建議字（recommendations）
        recsTitle: "建議字",
        recs: {
          sameWord: "同字",
          synonyms: "同義",
          antonyms: "反義",
          related: "相關",
          wordFamily: "同詞根家族",
          roots: "同詞根",
          collocations: "常用搭配",
        },
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
      
        phrase: "短语",
        grammar: "语法",
        unknown: "未知",
        Phrase: "短语",
        Grammatik: "语法",
        Unbekannt: "未知",},
    },

    sentenceCard: {
      speakTitle: "播放整句",
      moreLabel: "展开更多",
      wordTitle: "查看词卡",
      // learning mode
      sentenceCoreTitle: "这句最值得学的是",
      extendExampleTitle: "延伸例句",
      // icon tooltips
      conversationPracticeTitle: "对话练习",
      pronunciationPracticeTitle: "发音练习",
      // conversation toggle tooltip (optional)
      conversationToggleTooltipOpen: "隐藏连续对话",
      conversationToggleTooltipClosed: "生成连续对话",
      pronunciationTooltip: "跟读录音",
      // conversation nav (SentenceCard inline)
      conversationPrevLabel: "上一句",
      conversationNextLabel: "下一句",
    }
,

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

      declTitle: "词尾变化",
      declWeakLabel: "定冠词（弱变化）",
      declMixedLabel: "不定冠词（混合变化）",
      declStrongLabel: "无冠词（强变化）",

      nounPlaceholder: "名词",
      hintText: "形容词词尾会随「冠词 / 性别 / 格位」变化",
      degreeNotComparableHint: "该形容词通常不使用比较级",
      declNotDeclinableHint: "该形容词在名词前通常不做词尾变化",

      recTitle: "推荐",
      recSynLabel: "同义词",
      recAntLabel: "反义词",
      recRootLabel: "相关词",
      recCollocationLabel: "搭配词",
      recRelatedLabel: "相关词",
      recEmptyText: "—",
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
    loadingText: "正在分析中，请稍候…",
        testMode: "测试模式",
        testModeTitle: "进入测试模式",
        // ✅ 2026-02-24：产品用语统一：单字库 → 学习本
        library: "学习本",
        libraryTitle: "查看学习本",
        back: "返回",
        backTitle: "返回查询页",
      },
      history: {
        clearThis: "点击清除该条记录",
      },
      learning: {
        backToLearning: "返回学习浏览",
        continueWithTitle: "继续学习{title}",
      },
      errors: {
        backendUnavailable: "后端服务暂时无法使用，请稍后再试",
        nonSentenceOnly:
          "目前只支持「单词 / 短语 / 习惯用语」（非句子）。\n\n⚠️ 请勿输入标点符号（.,!?、，。；：… 等）",
      },

      // ✅ WordLibraryPanel（新增：集中管理）

      // ✅ 未登入点「学习本 / 我的最爱」提示
      alerts: {
        loginRequiredLibrary: "请先注册或登录后才能使用学习本（我的最爱）",
      },

      // ✅ 未登入点「学习本 / 我的最爱」提示（App.jsx 用 app.library.loginRequiredAlert）
      library: {
        loginRequiredAlert: "请先注册或登录后才能使用学习本（我的最爱）",
      },
      libraryPanel: {
        // ✅ 新增
        title: "学习本",
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


        // ✅ FavoriteCategoryManager (管理分类弹窗)
        manageCategoriesLabel: "管理分类",
        addCategoryLabel: "新增分类",
        closeLabel: "关闭",
        renameLabel: "改名",
        moveUpLabel: "上移",
        moveDownLabel: "下移",
        importLabel: "导入",
        archiveLabel: "封存",
        archiveConfirmText: "确定封存这个分类？",
        archiveFailedError: "封存失败",
        idInvalidError: "ID 不合法",
        nameEmptyError: "名称不可为空",
        nameDuplicateError: "名称不可重复",
        saveFailedError: "保存失败",
        createFailedError: "新增失败",
        reorderFailedError: "排序失败",
        untitledCategoryLabel: "新分类",
        noCategoriesText: "—",
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

      // ✅ 发音建议（Phase 1：token-level 判定）
      pronTipsTitle: "发音建议",
      pronTipsPrefix: "发音建议：",
      pronTipsLoading: "建议生成中…",
      pronTipsMissing: "可能有漏念：请对照红色标记的字再试一次。",
      pronTipsExtra: "可能有多念/插入：请放慢速度，避免多加字。",
      pronTipsLow: "部分字不够清楚：可加强子音收尾与重音。",
      pronTipsOk: "整体不错：再注意节奏与连音即可。",
    },
  },

      

  // ----------------------------
  // Deutsch de
  // ----------------------------
  de: {
    loadingText: "Wird analysiert, bitte warten…",
    appName: "soLang",
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
      planLabel: "Plan: ",
      upgradeMonthly: "Upgrade (monatlich)",
      upgradeYearly: "Upgrade (jährlich)",
      upgradeLoginRequired: "Bitte melden Sie sich an, um ein Upgrade durchzuführen",
      checkoutUrlFailed: "Checkout-Link konnte nicht abgerufen werden. Bitte versuchen Sie es später erneut.",
      checkoutUrlMissing: "Checkout-Link konnte nicht abgerufen werden (keine URL).",
    },

    auth: {
      logout: "Abmelden",
    },


    loginPage: {
      titles: { signIn: "Mit E‑Mail anmelden", signUp: "Mit E‑Mail registrieren", forgot: "Passwort vergessen" },
      tabs: { signIn: "Anmelden", signUp: "Registrieren", forgot: "Passwort vergessen" },
      labels: {
        email: "E‑Mail",
        password: "Passwort",
        passwordConfirm: "Passwort bestätigen",
        nicknameOptional: "Nickname (optional)",
        orEmail: "oder E‑Mail nutzen",
        redirect: "Weiterleitung:",
        unknownOrigin: "(unbekannte Origin)",
      },
      placeholders: {
        email: "name@example.com",
        passwordSignUp: "mind. 6 Zeichen",
        passwordConfirm: "Passwort erneut eingeben",
        nickname: "Wird oben rechts angezeigt, z.B. Barbie",
      },
      buttons: {
        googleSignIn: "Mit Google fortfahren",
        signIn: "Anmelden",
        signingIn: "Anmeldung…",
        signUp: "Registrieren & Bestätigungs‑E‑Mail senden",
        sendReset: "Passwort‑Reset senden",
        submitting: "Senden…",
        backHome: "Zur Startseite",
      },
      info: {
        redirectingGoogle: "Weiterleitung zu Google‑Login…",
        signInOk: "Angemeldet. Weiterleitung zur Startseite…",
        signUpSent: "Registrierung gesendet. Bitte per E‑Mail bestätigen (danach zurück zur Seite).",
        resetSent: "Reset‑E‑Mail gesendet. Link öffnen, um ein neues Passwort zu setzen.",
      },
      errors: {
        emailRequired: "Bitte E‑Mail eingeben",
        emailInvalid: "E‑Mail‑Format scheint nicht korrekt zu sein",
        passwordRequired: "Bitte Passwort eingeben",
        passwordTooShort: "Passwort muss mind. 6 Zeichen haben",
        passwordConfirmRequired: "Bitte Passwort bestätigen",
        passwordMismatch: "Passwörter stimmen nicht überein",
      },
    },

    usage: {
      today: "Heute",
      month: "Diesen Monat",
      query: "Abfrage",
      voice: "Stimme",
    },

    // ✅ Section titles (ResultPanel)
    sections: {
      grammarCardTitle: "Grammatik-Erklärung",
    },


    // ★ SentenceCard（新增：SentenceCard hover tooltip / button labels）
    sentenceCard: {
      speakTitle: "Satz abspielen",
      moreLabel: "Mehr anzeigen",
      wordTitle: "Wortkarte anzeigen",
      // learning mode
      sentenceCoreTitle: "Wichtigster Lernpunkt",
      extendExampleTitle: "Zusatzbeispiel",
      // icon tooltips
      conversationPracticeTitle: "Konversationsübung",
      pronunciationPracticeTitle: "Ausspracheübung",
      // conversation toggle tooltip (optional)
      conversationToggleTooltipOpen: "Fortlaufenden Dialog ausblenden",
      conversationToggleTooltipClosed: "Fortlaufenden Dialog erzeugen",
      pronunciationTooltip: "Nachsprechen aufnehmen",
      // conversation nav (SentenceCard inline)
      conversationPrevLabel: "Vorheriger Satz",
      conversationNextLabel: "Nächster Satz",
    },


    // ★ Sentence（SentenceCard strict i18n alias；SentenceCard.jsx uses t.sentence.xxx only）
    sentence: {
      speakTitle: "Satz abspielen",
      moreLabel: "Mehr anzeigen",
      wordTitle: "Wortkarte anzeigen",
      extendExampleTitle: "Zusatzbeispiel",
      conversationPracticeTitle: "Konversationsübung",
      pronunciationPracticeTitle: "Ausspracheübung",
      conversationPrevLabel: "Vorheriger Satz",
      conversationNextLabel: "Nächster Satz",
      // recording / analyze messages
      recordNotSupported: "Browser unterstützt keine Aufnahme",
      recordBuildFail: "Aufnahmedatei konnte nicht erstellt werden",
      recordStartFail: "Aufnahme konnte nicht gestartet werden (Berechtigung oder Gerät)",
      recordFirst: "Bitte zuerst aufnehmen",
      analyzeFail: "Analyse fehlgeschlagen, bitte erneut versuchen",
      // structure label fallback (rare; structure is suppressed in B-mode)
      structureRoleFallback: "Subjekt",
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


      // ★ Pronomen (NEW)
      posInfoPronoun: {
        title: "Pronomen-Deklination",
        personalTitle: "Personalpronomen",
        possessiveTitleTemplate: "Possessivartikel ({stem})",
        dash: "—",
        genderM: "m",
        genderF: "f",
        genderN: "n",
        genderPl: "pl",
        caseN: "N",
        caseA: "A",
        caseD: "D",
        caseG: "G",

        // Special UI controls
        pillPersonal: "Personal",
        pillPossessive: "Possessiv",
        sieMenuLabel: "Sie",
        siePolite: "Höflich",
        sieShe: "sie (sie)",
        sieThey: "sie (Plural)",
      },
      // ★ Artikel（NEW：strict i18n for WordPosInfoArtikel）
      posInfoArtikel: {
        title: "Artikel",
        desc: "Markiert das Nomen nach „Genus + Kasus“",
        expandLabel: "Ausklappen",
        collapseLabel: "Einklappen",
        typeLabels: { def: "Bestimmter Artikel", indef: "Unbestimmter Artikel", generic: "Artikel" },
        genderLabels: { m: "Maskulin", f: "Feminin", n: "Neutrum", p: "Plural" },
        caseLabels: {
          N: "Nominativ (Subjekt)",
          A: "Akkusativ (Objekt)",
          D: "Dativ (indirektes Objekt)",
          G: "Genitiv (Besitz/Bezug)",
        },
        learningPointTemplate: "{typeLabel}: {genderLabel} {caseLabel}.",
        learningPointGenTemplate: "{typeLabel}: {genderLabel} {caseLabel} oft mit „des + Nomen(s/es)“.",
        miniRules: {
          N: [
            "Nominativ steht oft in der Subjektposition",
            "Frage: Wer/Was ...? passt häufig zum Nominativ",
            "Häufiges Muster: Der Mann ist hier.",
          ],
          A: [
            "Viele Verben nehmen ein direktes Objekt im Akkusativ (z.B. sehen / kaufen / finden)",
            "Frage: Wen/Was ...? passt häufig zum Akkusativ",
            "Bei zwei Objekten: Person oft Dativ, Sache oft Akkusativ (z.B. Ich gebe dem Mann den Ball)",
          ],
          D: [
            "Häufige Präpositionen: mit / nach / bei / zu / von → Dativ",
            "Frage: Wem ...? passt häufig zum Dativ",
            "Beim Geben ist der Empfänger meist Dativ",
          ],
          G: [
            "Genitiv drückt oft eine „…-von/…s“ Beziehung aus",
            "Häufige Präpositionen: wegen / trotz / während (umgangssprachlich manchmal Dativ)",
            "Maskuline/Neutra oft mit -(e)s (z.B. des Mannes / des Kindes)",
          ],
        },
        colTitles: { m: "Maskulin", f: "Feminin", n: "Neutrum", p: "Plural" },
      },
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
      // Sentence Type (used by __t("grammar.sentenceType.*.label"))
      grammar: {
    loadingText: "Wird analysiert, bitte warten…",
        sentenceType: {
          default: { label: "Aussagesatz" },
          question_yesno: { label: "Ja/Nein‑Frage" },
          question_w: { label: "W‑Frage" },
          imperative: { label: "Imperativ" },
          request_polite: { label: "Höfliche Bitte" },
          prohibition: { label: "Verbot" },
          suggestion: { label: "Vorschlag" },
          exclamation: { label: "Ausruf" },
        },
      },

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
        addRefValidating: "Wird geprüft…",
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
        // ✅ 建議字（recommendations）
        recsTitle: "Vorschläge",
        recs: {
          sameWord: "Gleiche Schreibweise",
          synonyms: "Synonyme",
          antonyms: "Antonyme",
          related: "Verwandte Wörter",
          wordFamily: "Wortfamilie",
          roots: "Wortstamm",
          collocations: "Kollokationen",
        },
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
      
        phrase: "Phrase",
        grammar: "Grammatik",
        unknown: "Unbekannt",
        Phrase: "Phrase",
        Grammatik: "Grammatik",
        Unbekannt: "Unbekannt",},
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

      declTitle: "Endungen",
      declWeakLabel: "Bestimmter Artikel (schwach)",
      declMixedLabel: "Unbestimmter Artikel (gemischt)",
      declStrongLabel: "Kein Artikel (stark)",

      nounPlaceholder: "Nomen",
      hintText: "Endungen hängen von Artikel / Genus / Kasus ab.",
      degreeNotComparableHint: "Dieses Adjektiv wird normalerweise nicht gesteigert.",
      declNotDeclinableHint: "Dieses Adjektiv wird vor Nomen normalerweise nicht flektiert.",

      recTitle: "Empfehlungen",
      recSynLabel: "Synonyme",
      recAntLabel: "Antonyme",
      recRootLabel: "Verwandte Wörter",
      recCollocationLabel: "Kollokationen",
      recRelatedLabel: "Verwandte Wörter",
      recEmptyText: "—",
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
    loadingText: "Wird analysiert, bitte warten…",
        testMode: "Testmodus",
        testModeTitle: "Testmodus starten",
        // ✅ 2026-02-24：Product copy: Wortliste → Lernbuch
        library: "Lernbuch",
        libraryTitle: "Lernbuch öffnen",
        back: "Zurück",
        backTitle: "Zur Suche zurückkehren",
      },
      history: {
        clearThis: "Klicken, um diesen Eintrag zu löschen",
      },
      learning: {
        backToLearning: "Zurück zum Lernen",
        continueWithTitle: "Weiterlernen {title}",
      },
      errors: {
        backendUnavailable:
          "Der Backend-Dienst ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
        nonSentenceOnly:
          "Aktuell werden nur Wörter / Phrasen / Redewendungen unterstützt (keine Sätze).\n\n⚠️ Bitte ohne Satzzeichen eingeben (.,!? usw.).",
      },

      // ✅ Nicht angemeldet: Lernset / Favoriten erfordert Login
      // (App.jsx nutzt app.library.loginRequiredAlert)
      alerts: {
        loginRequiredLibrary: "Bitte registrieren oder anmelden, um das Lernset (Meine Favoriten) zu verwenden.",
      },
      library: {
        loginRequiredAlert: "Bitte registrieren oder anmelden, um das Lernset (Meine Favoriten) zu verwenden.",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "Lernbuch",
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


        // ✅ FavoriteCategoryManager (管理分类弹窗)
        manageCategoriesLabel: "Kategorien verwalten",
        addCategoryLabel: "Kategorie hinzufügen",
        closeLabel: "Schließen",
        renameLabel: "Umbenennen",
        moveUpLabel: "Nach oben",
        moveDownLabel: "Nach unten",
        importLabel: "Importieren",
        archiveLabel: "Archivieren",
        archiveConfirmText: "Diese Kategorie archivieren?",
        archiveFailedError: "Archivieren fehlgeschlagen",
        idInvalidError: "Ungültige ID",
        nameEmptyError: "Name darf nicht leer sein",
        nameDuplicateError: "Name existiert bereits",
        saveFailedError: "Speichern fehlgeschlagen",
        createFailedError: "Erstellen fehlgeschlagen",
        reorderFailedError: "Sortieren fehlgeschlagen",
        untitledCategoryLabel: "Neue Kategorie",
        noCategoriesText: "—",
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

      // ✅ Aussprache-Tipps (Phase 1: token-level Heuristik)
      pronTipsTitle: "Aussprache-Tipps",
      pronTipsPrefix: "Aussprache-Tipps: ",
      pronTipsLoading: "Tipps werden erstellt…",
      pronTipsMissing: "Möglicherweise fehlt ein Wort – prüfe die roten Tokens und versuche es erneut.",
      pronTipsExtra: "Möglicherweise wurden zusätzliche Wörter eingefügt – langsamer sprechen und nichts hinzufügen.",
      pronTipsLow: "Einige Wörter sind unklar – achte auf Endkonsonanten und Betonung.",
      pronTipsOk: "Insgesamt gut – achte noch auf Rhythmus und Verbindung.",
    },
},

      

  // ----------------------------
  // العربية ar
  // ----------------------------
  ar: {
    loadingText: "جارٍ التحليل، يرجى الانتظار…",
    appName: "soLang",
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
      planLabel: "الخطة: ",
      upgradeMonthly: "ترقية شهرية",
      upgradeYearly: "ترقية سنوية",
      upgradeLoginRequired: "يرجى تسجيل الدخول قبل الترقية",
      checkoutUrlFailed: "تعذر الحصول على رابط الدفع. يرجى المحاولة لاحقًا.",
      checkoutUrlMissing: "تعذر الحصول على رابط الدفع (لا توجد URL).",
    },

    auth: {
      logout: "تسجيل الخروج",
    },


    loginPage: {
      titles: { signIn: "تسجيل الدخول بالبريد", signUp: "إنشاء حساب بالبريد", forgot: "نسيت كلمة المرور" },
      tabs: { signIn: "تسجيل الدخول", signUp: "إنشاء حساب", forgot: "نسيت كلمة المرور" },
      labels: {
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        passwordConfirm: "تأكيد كلمة المرور",
        nicknameOptional: "الاسم المستعار (اختياري)",
        orEmail: "أو استخدم البريد",
        redirect: "إعادة التوجيه:",
        unknownOrigin: "(مصدر غير معروف)",
      },
      placeholders: {
        email: "name@example.com",
        passwordSignUp: "على الأقل 6 أحرف",
        passwordConfirm: "أعد إدخال كلمة المرور",
        nickname: "يظهر أعلى اليمين، مثال: Barbie",
      },
      buttons: {
        googleSignIn: "المتابعة عبر Google",
        signIn: "تسجيل الدخول",
        signingIn: "جارٍ تسجيل الدخول…",
        signUp: "إنشاء حساب وإرسال بريد التحقق",
        sendReset: "إرسال بريد إعادة التعيين",
        submitting: "جارٍ الإرسال…",
        backHome: "العودة للرئيسية",
      },
      info: {
        redirectingGoogle: "جارٍ التحويل إلى Google…",
        signInOk: "تم تسجيل الدخول. جارٍ العودة للرئيسية…",
        signUpSent: "تم إرسال الطلب. يرجى التحقق من البريد لإتمام التسجيل.",
        resetSent: "تم إرسال بريد إعادة التعيين. افتح الرابط لتعيين كلمة مرور جديدة.",
      },
      errors: {
        emailRequired: "يرجى إدخال البريد الإلكتروني",
        emailInvalid: "صيغة البريد الإلكتروني غير صحيحة",
        passwordRequired: "يرجى إدخال كلمة المرور",
        passwordTooShort: "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
        passwordConfirmRequired: "يرجى تأكيد كلمة المرور",
        passwordMismatch: "كلمتا المرور غير متطابقتين",
      },
    },

    usage: {
      today: "اليوم",
      month: "هذا الشهر",
      query: "بحث",
      voice: "صوت",
    },

    // ✅ Section titles (ResultPanel)
    sections: {
      grammarCardTitle: "شرح القواعد",
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
      // Sentence Type (used by __t("grammar.sentenceType.*.label"))
      grammar: {
    loadingText: "جارٍ التحليل، يرجى الانتظار…",
        sentenceType: {
          default: { label: "جملة خبرية" },
          question_yesno: { label: "سؤال نعم/لا" },
          question_w: { label: "سؤال بأداة استفهام" },
          imperative: { label: "صيغة الأمر" },
          request_polite: { label: "طلب مهذب" },
          prohibition: { label: "نهي/منع" },
          suggestion: { label: "اقتراح" },
          exclamation: { label: "تعجب" },
        },
      },

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
        addRefValidating: "جارٍ التحقق…",
        confirmBtnLabel: "تأكيد",
        confirmBtnTitle: "تأكيد",
        confirmBtnAriaLabel: "تأكيد",
        refsDirtyHint: "تم تغيير المراجع — حدّث لإعادة التوليد",
        multiRefHint: "استخدم عدة مراجع لتوليد الأمثلة",
        refInvalidHint: "مرجع غير صالح (مثل: 'xxx' / '...' / '…').",
        refStatusUsed: "مستخدم",
        refStatusMissing: "ناقص",
        missingRefsHint: "لم تُستخدم بعض المراجع. الرجاء إعادة التوليد.",
        // ✅ 建議字（recommendations）
        recsTitle: "اقتراحات",
        recs: {
          sameWord: "نفس الكلمة",
          synonyms: "مرادفات",
          antonyms: "أضداد",
          related: "كلمات ذات صلة",
          wordFamily: "عائلة الكلمات",
          roots: "الجذر",
          collocations: "تراكيب شائعة",
        },
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
      
        phrase: "عبارة",
        grammar: "قواعد",
        unknown: "غير معروف",
        Phrase: "عبارة",
        Grammatik: "قواعد",
        Unbekannt: "غير معروف",},
    },

    sentenceCard: {
      speakTitle: "تشغيل الجملة",
      moreLabel: "عرض المزيد",
      wordTitle: "عرض بطاقة الكلمة",
      // learning mode
      sentenceCoreTitle: "أهم نقطة للتعلّم",
      extendExampleTitle: "أمثلة إضافية",
      // icon tooltips
      conversationPracticeTitle: "تدريب المحادثة",
      pronunciationPracticeTitle: "تدريب النطق",
      // conversation toggle tooltip (optional)
      conversationToggleTooltipOpen: "إخفاء الحوار المتواصل",
      conversationToggleTooltipClosed: "إنشاء حوار متواصل",
      pronunciationTooltip: "تدريب الترديد",
      // conversation nav (SentenceCard inline)
      conversationPrevLabel: "الجملة السابقة",
      conversationNextLabel: "الجملة التالية",
    }
,

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

      declTitle: "النهايات ",
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
    loadingText: "جارٍ التحليل، يرجى الانتظار…",
        testMode: "وضع الاختبار",
        testModeTitle: "الدخول إلى وضع الاختبار",
        // ✅ 2026-02-24：Product copy: مكتبة الكلمات → دفتر التعلّم
        library: "دفتر التعلّم",
        libraryTitle: "فتح دفتر التعلّم",
        back: "رجوع",
        backTitle: "العودة إلى البحث",
      },
      history: {
        clearThis: "انقر لمسح هذا السجل",
      },
      learning: {
        backToLearning: "العودة إلى التعلّم",
        continueWithTitle: "متابعة تعلّم {title}",
      },
      errors: {
        backendUnavailable:
          "الخدمة الخلفية غير متوفرة حالياً، يرجى المحاولة لاحقاً",
        nonSentenceOnly:
          "حالياً ندعم الكلمات / العبارات / التعابير فقط (ليست جُملاً).\n\n⚠️ الرجاء إزالة علامات الترقيم (.,!? إلخ) ثم المحاولة مرة أخرى.",
      },

      // ✅ غير مسجّل الدخول: يتطلّب "دفتر التعلّم / المفضّلة" تسجيل الدخول
      // (App.jsx uses app.library.loginRequiredAlert)
      alerts: {
        loginRequiredLibrary: "Please sign up or sign in to use the learning set (My Favorites).",
      },
      library: {
        loginRequiredAlert: "يرجى إنشاء حساب أو تسجيل الدخول لاستخدام دفتر التعلّم (المفضّلة).",
      },

      // ✅ WordLibraryPanel（新增：集中管理）
      libraryPanel: {
        // ✅ 新增
        title: "دفتر التعلّم",
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


        // ✅ FavoriteCategoryManager (管理分类弹窗)
        manageCategoriesLabel: "إدارة الفئات",
        addCategoryLabel: "إضافة فئة",
        closeLabel: "إغلاق",
        renameLabel: "إعادة تسمية",
        moveUpLabel: "تحريك لأعلى",
        moveDownLabel: "تحريك لأسفل",
        importLabel: "استيراد",
        archiveLabel: "أرشفة",
        archiveConfirmText: "هل تريد أرشفة هذه الفئة؟",
        archiveFailedError: "فشل الأرشفة",
        idInvalidError: "معرّف غير صالح",
        nameEmptyError: "لا يمكن أن يكون الاسم فارغًا",
        nameDuplicateError: "الاسم موجود بالفعل",
        saveFailedError: "فشل الحفظ",
        createFailedError: "فشل الإنشاء",
        reorderFailedError: "فشل إعادة الترتيب",
        untitledCategoryLabel: "فئة جديدة",
        noCategoriesText: "—",
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

      // ✅ نصائح النطق (المرحلة 1: اعتماد token-level)
      pronTipsTitle: "نصائح النطق",
      pronTipsPrefix: "نصائح النطق: ",
      pronTipsLoading: "جارٍ إنشاء النصائح…",
      pronTipsMissing: "قد تكون فاتتك كلمة—تحقق من الكلمات المعلَّمة بالأحمر وحاول مجددًا.",
      pronTipsExtra: "قد تكون أضفت كلمات إضافية—تكلّم ببطء وتجنب إضافة كلمات.",
      pronTipsLow: "بعض الكلمات غير واضحة—ركّز على نهايات الحروف الساكنة والنبرة.",
      pronTipsOk: "جيد عمومًا—انتبه للإيقاع والربط بين الكلمات.",
    },
  },
};

export default uiText;

// frontend/src/uiText.js