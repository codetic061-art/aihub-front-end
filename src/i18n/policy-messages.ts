/**
 * Standing pages: About, Contact, Privacy Policy, Terms of Use.
 *
 * WHY THIS IS NOT IN messages.ts
 *
 * messages.ts is deliberately small — nav labels, buttons, states. Its own
 * header says it should not accumulate article prose, because page text already
 * has a source (the content tree). These four pages are the one exception:
 * they are template prose with no content file behind them, and they are long
 * in both languages. Keeping them here leaves messages.ts reviewable and puts
 * the policy text in one obvious place.
 *
 * STRING STYLE: double-quoted throughout, so apostrophes in English prose
 * ("a page's text", "Google's My Activity") need no escaping and cannot break
 * the object literal.
 *
 * WHAT THESE PAGES MAY SAY
 *
 * Every factual claim is verifiable from this repository:
 *
 *   - the corpus counts in the About page are passed in as ICU values from
 *     `corpusCounts()`, read from the live snapshot, so the text cannot drift
 *     from what the site serves;
 *   - the three third-party tools named here are the ones genuinely installed
 *     (see src/components/analytics-tags.tsx): Google Analytics 4, Microsoft
 *     Clarity, Google AdSense.
 *
 * There is deliberately NO company name, founder, address, registration number,
 * legal entity or jurisdiction in this file. None of that exists to state, and
 * inventing it inside a privacy policy would be the worst thing on the site: a
 * false data controller is a legal claim, not a missing nicety.
 *
 * The Contact page states plainly that no address is published, and why: the
 * project has no mailto, no contact endpoint and no form backend. A form that
 * submits nowhere would collect nothing while appearing to offer a channel.
 */
export const policyMessages = {
  en: {
    about: {
      title: "About AI Hub",
      lede: "AI Hub is a free reference for understanding and using AI systems. This build holds {total} pages.",
      what: {
        title: "What this site is",
        body: "AI Hub is a discovery and knowledge platform. It explains what AI concepts mean, how tools and models are actually used, and where to find the primary documentation for anything it describes. Every page is written to be read on its own and to link onward to the source it was built from.",
      },
      contents: {
        title: "What is in here",
        body: "The library is organised by what a reader is trying to do. The counts below are read from the live content snapshot, so they match the site exactly.",
        concepts_one: "Concept pages — what things mean and how the systems work ({n} page)",
        concepts_other: "Concept pages — what things mean and how the systems work ({n} pages)",
        sessions_one: "Sessions — a guided walkthrough of a single task ({n} page)",
        sessions_other: "Sessions — a guided walkthrough of a single task ({n} pages)",
        courses_one: "Courses — multi-step learning paths ({n} page)",
        courses_other: "Courses — multi-step learning paths ({n} pages)",
        skills_one: "Skill packs, SDKs and plugin collections ({n} page)",
        skills_other: "Skill packs, SDKs and plugin collections ({n} pages)",
        mcp_one: "Model Context Protocol servers ({n} page)",
        mcp_other: "Model Context Protocol servers ({n} pages)",
        quizzes_one: "Quizzes that check understanding ({n} page)",
        quizzes_other: "Quizzes that check understanding ({n} pages)",
        exams_one: "Full exams ({n} page)",
        exams_other: "Full exams ({n} pages)",
        prompt_one: "Prompt assessments — practise and critique prompts ({n} page)",
        prompt_other: "Prompt assessments — practise and critique prompts ({n} pages)",
        docs_one: "Setup and reference documentation ({n} page)",
        docs_other: "Setup and reference documentation ({n} pages)",
        total_one: "That is {total} page in total, published in English and Arabic.",
        total_other: "That is {total} pages in total, published in English and Arabic.",
      },
      how: {
        title: "How it is put together",
        body: "Content is authored as Markdown with structured metadata, so one source drives the page, the search index, the browse indexes and the assessment players. That is why a page can appear in search, in a category listing and in a course outline without being maintained three times.",
      },
      not: {
        title: "What this site is not",
        body: "AI Hub is not a vendor and does not sell AI software. It does not run models, and it does not host your data. Where a page mentions a paid product or a free credit, that is a reference to something offered elsewhere, and the page says so.",
      },
    },

    contact: {
      title: "Contact",
      lede: "How to reach us, and what to do while no address is published.",
      notPublished: {
        title: "No published address yet",
        body: "This site does not publish an email address or a contact form. Nothing here is a placeholder pointing at an inbox that does not exist: there is no form on this site and no server receiving one, so a form would either fail silently or collect nothing at all.",
      },
      now: {
        title: "Until then",
        body: "For anything about the content itself, the fastest route is the page that raised the question. Each page names the source it was built from, and that source is where an error in the description belongs.",
        broken: "A broken link, a page that will not load, or text that is factually wrong — raise it against the specific page so it can be reproduced.",
        unclear: "A question the page does not answer — start from the linked source documentation, which is authoritative where the two differ.",
      },
      privacy: {
        title: "Privacy",
        body: "This site uses Google Analytics, Microsoft Clarity and Google AdSense. Those tools set cookies and similar identifiers. What that means in detail is set out in the Privacy Policy.",
      },
    },

    privacy: {
      title: "Privacy Policy",
      lede: "What this site collects, which third parties are involved, and what you can do about it.",
      summary: {
        title: "In short",
        body: "This site asks for no account, accepts no registrations and keeps no server-side database of visitors. What is collected is limited to what the analytics, session-recording and advertising tools below record automatically when a page loads.",
      },
      collect: {
        title: "What is collected",
        body: "Three third-party tools are installed. Each records something about your visit, and none of them receives anything you type, because the site has no form that submits anywhere.",
        analytics: "Google Analytics 4 records which pages are viewed, the referring site, approximate location at country level, and device and browser type. It is used to see which pages are actually read.",
        clarity: "Microsoft Clarity records a session replay — clicks, scrolls and page views — so we can see where a page is confusing. The replay is masked: form fields and typed text are not recorded.",
        adsense: "Google AdSense loads its advertising script. The script sets cookies and reads identifiers; it does not display ads on this site unless ads are enabled.",
        ads: "If advertising is shown, Google and its partners may use cookies or device identifiers to serve and measure ads, including personalised ads based on prior activity.",
        local: "The site stores your light or dark theme choice in your browser so the page does not flash on your next visit.",
      },
      cookies: {
        title: "Cookies and similar technologies",
        body: "Cookies are small files a site stores in your browser. The tools above may use cookies and comparable identifiers held by your browser or device. Clearing your browser storage removes them, and so does blocking cookies — the pages keep working either way.",
      },
      vendors: {
        title: "Third parties",
        body: "Three companies are involved in serving this site. Each operates independently and under its own policy.",
        google: "Google — provides Google Analytics 4 and Google AdSense. Google may use data from this site to serve personalised advertising elsewhere, subject to its own policies.",
        clarity: "Microsoft — provides Clarity session recording. Your visit is recorded under Microsoft's privacy terms.",
        thirdparty: "Other sites — pages here link to external documentation and vendor pages. Those sites are governed by their own privacy policies, which this one does not control.",
      },
      choices: {
        title: "Your choices",
        body: "You can limit what any of these tools records without giving up the rest of the site.",
        optout: "Google offers a browser add-on to opt out of personalised advertising across sites, and a privacy section in My Activity to delete the activity it records.",
        browser: "Your browser can block or delete cookies and site data for this domain. Blocking scripts stops the analytics and advertising tools from loading, and will not break the content.",
        limits: "If you are in the EEA, the UK or Switzerland, you have rights to access, correct, delete or restrict processing of personal data, and to object to it. Each tool above can be exercised through its own opt-out and browser controls, which is why those controls are named here rather than handled on this page.",
      },
      children: {
        title: "Children",
        body: "This site is a general-audience technical reference and is not directed at children. No part of it is designed to collect information from anyone below the age of consent in their jurisdiction.",
      },
      changes: {
        title: "Changes to this policy",
        body: "If the set of tools on this site changes, this policy is updated to match. The description above is the current one rather than a dated snapshot that can go out of date.",
      },
      contact: {
        title: "Questions about this policy",
        body: "This site publishes no contact address yet — the Contact page explains why. Until it does, a privacy question can be raised through the page it relates to, and an inaccuracy in the text above is a defect to be fixed here.",
      },
    },

    terms: {
      title: "Terms of Use",
      lede: "The terms this site is offered on.",
      nature: {
        title: "What this site is",
        body: "AI Hub publishes free reference material about AI concepts, tools and practice. It is informational. It does not provide software, does not host or process your data, and does not offer a service you sign up for.",
      },
      use: {
        title: "Acceptable use",
        body: "You may read these pages, link to them, and quote from them with attribution. You may not:",
        lawful: "use the site in breach of any applicable law or regulation.",
        noHarm: "attempt to disrupt the site, probe it for vulnerabilities without permission, or gain unauthorised access to anything behind it.",
        noAbuse: "crawl the site in a way that degrades it for others, or redistribute bulk copies as your own.",
        noCopy: "misrepresent a page as your own work, or strip attribution from something you quote at length.",
      },
      external: {
        title: "External links and third parties",
        body: "Many pages link to vendor documentation, repositories and other external sites. Those links are provided for reference. This site does not control, endorse or take responsibility for the content of an external site, its availability, or how it handles your data. Some pages describe paid products or free credits offered by third parties; those offers, terms and prices belong to the provider, not to this site.",
      },
      accuracy: {
        title: "Accuracy and currency",
        body: "These pages are written from sources that change — libraries release new versions, vendors rename products, prices move. A page names the source it was built from and, where available, when it was last verified. That date records a verification, not a promise of permanent accuracy. Where this site and a primary source disagree, the primary source is correct.",
      },
      ip: {
        title: "Intellectual property",
        body: "The explanatory text on this site is written for it. The names of products, libraries, protocols and trademarks it mentions belong to their respective owners and are used to identify the thing being described. Quoting short passages with attribution is fine. Reusing a page's text verbatim as your own is not.",
      },
      availability: {
        title: "Availability and changes",
        body: "This site is provided as-is and may be changed, reduced or withdrawn at any time without notice. Pages may be reorganised or removed. No commitment is made to the continuity of any particular page, or to the accuracy of anything published here.",
      },
      liability: {
        title: "Limitation of liability",
        body: "The content here is general information, not professional advice. It is provided without warranty of any kind, express or implied, as to accuracy, completeness or fitness for a particular purpose. To the fullest extent permitted by law, no liability is accepted for any loss arising from use of, or reliance on, anything published here. Nothing in these terms excludes liability that cannot lawfully be excluded.",
      },
      changes: {
        title: "Changes to these terms",
        body: "These terms may be updated as the site changes. The version published on this page is the version that applies.",
      },
      contact: {
        title: "Contact",
        body: "No contact address is published yet — see the Contact page. The Privacy Policy describes the third-party tools this site uses and the controls you have over them.",
      },
    },
  },

  ar: {
    about: {
      title: "عن AI Hub",
      lede: "‏AI Hub مرجع مجاني لفهم أنظمة الذكاء الاصطناعي واستخدامها. تضم هذه النسخة {total} صفحة.",
      what: {
        title: "ما هذا الموقع",
        body: "‏AI Hub منصة اكتشاف ومعرفة. تشرح معنى مفاهيم الذكاء الاصطناعي، وكيف تُستخدم الأدوات والنماذج فعليًا، وأين توجد التوثيقات الأصلية لكل ما تصفه. كل صفحة مكتوبة لتُقرأ بذاتها وتحيل إلى المصدر الذي بُنيت منه.",
      },
      contents: {
        title: "ما الموجود هنا",
        body: "المكتبة مرتبة حسب هدف القارئ. الأعداد أدناه مقروءة من لقطة المحتوى، فتطابق الموقع تمامًا.",
        concepts_zero: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — لا صفحات",
        concepts_one: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — صفحة واحدة",
        concepts_two: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — صفحتان",
        concepts_few: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — {n} صفحات",
        concepts_many: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — {n} صفحة",
        concepts_other: "صفحات مفاهيم — معنى الأشياء وطريقة عمل الأنظمة — {n} صفحة",
        sessions_zero: "جلسات — شرح عملي لمهمة واحدة — لا صفحات",
        sessions_one: "جلسات — شرح عملي لمهمة واحدة — صفحة واحدة",
        sessions_two: "جلسات — شرح عملي لمهمة واحدة — صفحتان",
        sessions_few: "جلسات — شرح عملي لمهمة واحدة — {n} صفحات",
        sessions_many: "جلسات — شرح عملي لمهمة واحدة — {n} صفحة",
        sessions_other: "جلسات — شرح عملي لمهمة واحدة — {n} صفحة",
        courses_zero: "دورات — مسارات تعلّم متعددة الخطوات — لا صفحات",
        courses_one: "دورات — مسارات تعلّم متعددة الخطوات — صفحة واحدة",
        courses_two: "دورات — مسارات تعلّم متعددة الخطوات — صفحتان",
        courses_few: "دورات — مسارات تعلّم متعددة الخطوات — {n} صفحات",
        courses_many: "دورات — مسارات تعلّم متعددة الخطوات — {n} صفحة",
        courses_other: "دورات — مسارات تعلّم متعددة الخطوات — {n} صفحة",
        skills_zero: "حزم مهارات ومكتبات SDK وإضافات — لا صفحات",
        skills_one: "حزم مهارات ومكتبات SDK وإضافات — صفحة واحدة",
        skills_two: "حزم مهارات ومكتبات SDK وإضافات — صفحتان",
        skills_few: "حزم مهارات ومكتبات SDK وإضافات — {n} صفحات",
        skills_many: "حزم مهارات ومكتبات SDK وإضافات — {n} صفحة",
        skills_other: "حزم مهارات ومكتبات SDK وإضافات — {n} صفحة",
        mcp_zero: "خوادم بروتوكول سياق النموذج — لا صفحات",
        mcp_one: "خوادم بروتوكول سياق النموذج — صفحة واحدة",
        mcp_two: "خوادم بروتوكول سياق النموذج — صفحتان",
        mcp_few: "خوادم بروتوكول سياق النموذج — {n} صفحات",
        mcp_many: "خوادم بروتوكول سياق النموذج — {n} صفحة",
        mcp_other: "خوادم بروتوكول سياق النموذج — {n} صفحة",
        quizzes_zero: "اختبارات قصيرة تتحقق من الفهم — لا صفحات",
        quizzes_one: "اختبارات قصيرة تتحقق من الفهم — صفحة واحدة",
        quizzes_two: "اختبارات قصيرة تتحقق من الفهم — صفحتان",
        quizzes_few: "اختبارات قصيرة تتحقق من الفهم — {n} صفحات",
        quizzes_many: "اختبارات قصيرة تتحقق من الفهم — {n} صفحة",
        quizzes_other: "اختبارات قصيرة تتحقق من الفهم — {n} صفحة",
        exams_zero: "اختبارات نهائية — لا صفحات",
        exams_one: "اختبارات نهائية — صفحة واحدة",
        exams_two: "اختبارات نهائية — صفحتان",
        exams_few: "اختبارات نهائية — {n} صفحات",
        exams_many: "اختبارات نهائية — {n} صفحة",
        exams_other: "اختبارات نهائية — {n} صفحة",
        prompt_zero: "تقييمات مطالبات — تدريب على الصياغة ونقدها — لا صفحات",
        prompt_one: "تقييمات مطالبات — تدريب على الصياغة ونقدها — صفحة واحدة",
        prompt_two: "تقييمات مطالبات — تدريب على الصياغة ونقدها — صفحتان",
        prompt_few: "تقييمات مطالبات — تدريب على الصياغة ونقدها — {n} صفحات",
        prompt_many: "تقييمات مطالبات — تدريب على الصياغة ونقدها — {n} صفحة",
        prompt_other: "تقييمات مطالبات — تدريب على الصياغة ونقدها — {n} صفحة",
        docs_zero: "أدلة إعداد وتوثيق مرجعي — لا صفحات",
        docs_one: "أدلة إعداد وتوثيق مرجعي — صفحة واحدة",
        docs_two: "أدلة إعداد وتوثيق مرجعي — صفحتان",
        docs_few: "أدلة إعداد وتوثيق مرجعي — {n} صفحات",
        docs_many: "أدلة إعداد وتوثيق مرجعي — {n} صفحة",
        docs_other: "أدلة إعداد وتوثيق مرجعي — {n} صفحة",
        total_zero: "لا صفحات منشورة بعد، بالإنجليزية والعربية.",
        total_one: "هذه هي الصفحة الوحيدة المنشورة، بالإنجليزية والعربية.",
        total_two: "هاتان صفحتان منشورتان، بالإنجليزية والعربية.",
        total_few: "هذه {total} صفحات منشورة، بالإنجليزية والعربية.",
        total_many: "هذا {total} صفحة منشورة، بالإنجليزية والعربية.",
        total_other: "هذا {total} صفحة منشورة، بالإنجليزية والعربية.",
      },
      how: {
        title: "كيف يُبنى",
        body: "يُكتب المحتوى Markdown مع بيانات أمامية منظّمة، فالمصدر نفسه يغذّي الصفحة وفهرس البحث وفهارس التصفية ومشغّلات التقييم. لهذا تظهر الصفحة في البحث وفي التصنيفات وفي مخطط الدورة دون أن تُدار ثلاث مرات.",
      },
      not: {
        title: "ما ليس هذا الموقع",
        body: "‏AI Hub ليس بائعًا ولا يبيع برمجيات ذكاء اصطناعي. لا يشغّل نماذج ولا يستضيف بياناتك. وحين تذكر صفحة منتجًا مدفوعًا أو رصيدًا مجانيًا، فهي إشارة إلى ما يُقدَّم في مكان آخر، وتذكر الصفحة ذلك.",
      },
    },

    contact: {
      title: "اتصل بنا",
      lede: "كيف تصل إلينا، وماذا تفعل بينما لا يوجد عنوان منشور.",
      notPublished: {
        title: "لا يوجد عنوان منشور بعد",
        body: "لا ينشر هذا الموقع بريدًا إلكترونيًا ولا نموذج تواصل. لا شيء هنا عنصر نائب يشير إلى صندوق بريد غير موجود: لا يوجد نموذج في الموقع ولا خادم يستقبله، فالنموذج إما سيفشل بصمت أو لن يجمع شيئًا على الإطلاق.",
      },
      now: {
        title: "حتى ذلك الحين",
        body: "لأي شيء يخص المحتوى نفسه، أسرع طريق هو الصفحة التي أثارت السؤال. كل صفحة تذكر المصدر الذي بُنيت منه، وهذا المصدر هو المكان الصحيح لخطأ في الوصف.",
        broken: "رابط مكسور، أو صفحة لا تُحمَّل، أو نص غير صحيح — اذكره مع الصفحة المحددة ليتمكّن من إعادة إنتاجه.",
        unclear: "سؤال لا تجيب عنه الصفحة — ابدأ من توثيق المصدر المرتبط، فهو المرجع عند اختلافهما.",
      },
      privacy: {
        title: "الخصوصية",
        body: "يستخدم هذا الموقع Google Analytics وMicrosoft Clarity وGoogle AdSense. هذه الأدوات تضع ملفات تعريف ارتباط ومعرّفات مشابهة. والشرح الكامل في سياسة الخصوصية.",
      },
    },

    privacy: {
      title: "سياسة الخصوصية",
      lede: "ما الذي يجمعه هذا الموقع، وأي أطراف ثالثة يشملها، وما خياراتك.",
      summary: {
        title: "باختصار",
        body: "لا يطلب هذا الموقع حسابًا، ولا يقبل تسجيلات، ولا يحتفظ بقاعدة بيانات على الخادم للزوار. ما يُجمع محدود بما تسجّله أدوات التحليل وتسجيل الجلسات والإعلانات أدناه تلقائيًا عند تحميل الصفحة.",
      },
      collect: {
        title: "ما الذي يُجمع",
        body: "ثلاث أدوات خارجية مثبتة. كل واحدة منها تسجّل شيئًا عن زيارتك، ولا يتلقّى أي منها ما تكتبه لأن الموقع لا يملك نموذجًا يُرسَل إلى أي جهة.",
        analytics: "‏Google Analytics 4 يسجّل الصفحات التي تُعرض، والموقع المُحيل، والموقع التقريبي على مستوى الدولة، ونوع الجهاز والمتصفح. يُستخدم لمعرفة الصفحات التي تُقرأ فعلًا.",
        clarity: "‏Microsoft Clarity يسجّل إعادة للجلسة — النقرات والتمرير وعرض الصفحات — لنرى أين تلتبس الصفحة. التسجيل مُقنَّع: حقول النماذج والنص المكتوب لا تُسجَّل.",
        adsense: "‏Google AdSense يحمّل سكربت الإعلانات. يضع السكربت ملفات تعريف ارتباط ويقرأ معرّفات، لكنه لا يعرض إعلانات هنا إلا إذا فُعِّلت.",
        ads: "إذا عُرضت إعلانات، فقد تستخدم Google وشركاؤها ملفات تعريف ارتباط أو معرّفات أجهزة لعرض الإعلانات وقياسها، بما في ذلك إعلانات مخصّصة بناءً على نشاطك السابق.",
        local: "يحفظ الموقع اختيارك للوضع الفاتح أو الداكن في متصفحك حتى لا تومض الصفحة في زيارتك التالية.",
      },
      cookies: {
        title: "ملفات تعريف الارتباط",
        body: "ملفات تعريف الارتباط ملفات صغيرة يخزّنها الموقع في متصفحك. قد تستخدم الأدوات أعلاه ملفات تعريف ارتباط ومعرّفات مشابهة محفوظة في متصفحك أو جهازك. مسح بيانات المتصفح يزيلها، وكذلك حظرها، والصفحات تعمل في الحالتين.",
      },
      vendors: {
        title: "أطراف ثالثة",
        body: "ثلاث شركات تساهم في تقديم هذا الموقع، كل منها تعمل باستقلالية ووفق سياستها الخاصة.",
        google: "‏Google — توفّر Google Analytics 4 وGoogle AdSense. قد تستخدم Google بيانات هذا الموقع لعرض إعلانات مخصّصة في أماكن أخرى وفق سياساتها.",
        clarity: "‏Microsoft — توفّر تسجيل الجلسات عبر Clarity. تُسجَّل زيارتك وفق شروط الخصوصية لدى Microsoft.",
        thirdparty: "مواقع أخرى — تحيل الصفحات هنا إلى توثيقات خارجية وصفحات مزوّدين. تخضع تلك المواقع لسياسات خصوصيتها هي، ولا تتحكم فيها هذه السياسة.",
      },
      choices: {
        title: "خياراتك",
        body: "يمكنك تقييد ما تسجّله أي من هذه الأدوات دون التخلّي عن باقي الموقع.",
        optout: "تقدّم Google إضافة للمتصفح تتيح الانسحاب من الإعلانات المخصّصة على كل المواقع، وقسمًا للخصوصية في \"نشاطي\" لحذف ما سجّلته.",
        browser: "يمكن لمتصفحك حظر ملفات تعريف الارتباط وبيانات الموقع لهذا النطاق أو حذفها. حظر السكربتات يمنع تحميل أدوات التحليل والإعلانات، ولا يعطّل المحتوى.",
        limits: "إذا كنت في المنطقة الاقتصادية الأوروبية أو المملكة المتحدة أو سويسرا، فلديك حقوق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها أو تقييد معالجتها، والاعتراض على ذلك. وكل أداة أعلاه يمكن التحكم فيها عبر خيارات الانسحاب وحماية المتصفح الخاصة بها، ولذلك ذُكرت هنا بدل معالجتها في هذه الصفحة.",
      },
      children: {
        title: "الأطفال",
        body: "هذا الموقع مرجع تقني موجّه للجمهور العام وليس موجّهًا للأطفال. لا يوجَّه أي جزء منه لجمع معلومات من أي شخص دون سن الرضا في نطاقه القضائي.",
      },
      changes: {
        title: "تعديلات هذه السياسة",
        body: "إذا تغيّرت مجموعة الأدوات المستخدمة، تُحدَّث هذه السياسة لتطابقها. الوصف أعلاه هو الوصف الحالي لا لقطة مؤرّخة قد تتقادم.",
      },
      contact: {
        title: "أسئلة حول هذه السياسة",
        body: "لا ينشر هذا الموقع عنوان تواصل بعد — صفحة \"اتصل بنا\" تشرح السبب. حتى ذلك الحين، يمكن طرح سؤال الخصوصية عبر الصفحة المتعلقة به، وأي خطأ في النص أعلاه هو خلل يُصحَّح هنا.",
      },
    },

    terms: {
      title: "شروط الاستخدام",
      lede: "الشروط التي يُقدَّم بها هذا الموقع.",
      nature: {
        title: "ما هذا الموقع",
        body: "ينشر AI Hub مراجع مجانية حول مفاهيم الذكاء الاصطناعي وأدواته وممارسته. هذا الموقع للمعلومات فقط: لا يقدّم برمجيات، ولا يستضيف بياناتك ولا يعالجها، ولا يوفّر خدمة تسجّل فيها.",
      },
      use: {
        title: "الاستخدام المقبول",
        body: "يمكنك قراءة هذه الصفحات والارتباط بها والاقتباس منها مع نسب العمل لصاحبه. ولا يمكنك:",
        lawful: "استخدام الموقع بما يخالف أي قانون أو لائحة سارية.",
        noHarm: "محاولة تعطيل الموقع، أو فحصه بحثًا عن ثغرات دون إذن، أو الوصول غير المصرّح به إلى ما خلفه.",
        noAbuse: "زحف الموقع بطريقة تضرّ بالآخرين، أو إعادة نشر نسخ كبيرة منه باسمك.",
        noCopy: "نسبة صفحة إلى نفسك، أو إزالة نسب العمل من اقتباس طويل.",
      },
      external: {
        title: "الروابط الخارجية والأطراف الثالثة",
        body: "تحيل صفحات كثيرة إلى توثيقات المزوّدين والمستودعات ومواقع خارجية أخرى. هذه الروابط للمرجع. لا يتحكم هذا الموقع ولا يقرّ بمحتوى أي موقع خارجي ولا يسأل عن إتاحةته أو طريقة تعامله مع بياناتك. وتذكر بعض الصفحات منتجات مدفوعة أو أرصدة مجانية يوفّرها طرف ثالث؛ تلك العروض وشروطها وأسعارها تخص المزوّد لا هذا الموقع.",
      },
      accuracy: {
        title: "الدقة والتحديث",
        body: "كُتبت هذه الصفحات من مصادر متغيّرة — تُصدر المكتبات إصدارات جديدة، وتغيّر المزوّدون أسماء المنتجات، وتتحرّك الأسعار. تذكر الصفحة المصدر الذي بُنيت منه وتاريخ آخر تحقّق عند توفّره. ذلك التاريخ يسجّل تحقّقًا لا وعدًا بالدقة الدائمة. وعند اختلاف هذا الموقع بمصدره الأصلي، فالمصدر الأصلي هو الصحيح.",
      },
      ip: {
        title: "الملكية الفكرية",
        body: "النوع التوضيحي في هذا الموقع مكتوب له. أسماء المنتجات والمكتبات والبروتوكولات والعلامات التجارية التي يذكرها تخص أصحابها وتُستخدم لتعريف الشيء الموصوف. الاقتباس القصير مع نسب العمل مقبول، وإعادة نص صفحة حرفيًا باسمك ليست كذلك.",
      },
      availability: {
        title: "الإتاحة والتغييرات",
        body: "يُقدَّم هذا الموقع كما هو، وقد يُعدَّل أو يُقلَّص أو يُسحب في أي وقت دون إشعار. وقد تُنظَّم الصفحات أو تُحذف. ولا يُلتزم باستمرارية أي صفحة بعينها ولا بدقة أي مما يُنشر هنا.",
      },
      liability: {
        title: "حدود المسؤولية",
        body: "المحتوى هنا معلومات عامة وليست استشارة متخصصة. ويُقدَّم دون أي ضمان من أي نوع، صريحًا أو ضمنيًا، بشأن الدقة أو الاكتمال أو الملاءمة لغرض معيّن. وإلى أقصى حد يسمح به القانون، لا تُقبل أي مسؤولية عن أي خسارة ناشئة عن استخدام ما يُنشر هنا أو الاعتماد عليه. ولا يستثني أي شيء في هذه الشروط مسؤولية لا يجوز استثناؤها قانونًا.",
      },
      changes: {
        title: "تعديلات هذه الشروط",
        body: "قد تُحدَّث هذه الشروط مع تغيّر الموقع. والمنشور في هذه الصفحة هو الساري.",
      },
      contact: {
        title: "التواصل",
        body: "لا يوجد عنوان تواصل منشور — انظر صفحة \"اتصل بنا\". وتصف سياسة الخصوصية الأدوات الخارجية المستخدمة في هذا الموقع والخيارات المتاحة لك بشأنها.",
      },
    },
  },
};