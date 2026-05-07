import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SECTIONS = [
  {
    id: "introduction",
    titleAr: "مقدمة",
    titleFr: "Introduction",
    contentAr: `مرحبًا بك في LevelSpace. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدام منصتنا التعليمية.`,
    contentFr: `Bienvenue sur LevelSpace. Nous respectons votre vie privée et nous nous engageons à protéger vos données personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos informations lorsque vous utilisez notre plateforme éducative.`,
  },
  {
    id: "data-collected",
    titleAr: "البيانات التي نجمعها",
    titleFr: "Données collectées",
    contentAr: `نجمع الأنواع التالية من المعلومات:
• معلومات الحساب: الاسم، عنوان البريد الإلكتروني، وبيانات التسجيل.
• بيانات الاستخدام: الدروس التي تمت مشاهدتها، نتائج الاختبارات، ومسار التقدم الدراسي.
• البيانات التقنية: عنوان IP، نوع المتصفح، والجهاز المستخدم.
• محتوى المستخدم: الملاحظات والإجابات المدخلة داخل المنصة.`,
    contentFr: `Nous collectons les types d'informations suivants :
• Informations de compte : nom, adresse e-mail et données d'inscription.
• Données d'utilisation : leçons consultées, résultats aux quiz et progression académique.
• Données techniques : adresse IP, type de navigateur et appareil utilisé.
• Contenu utilisateur : notes et réponses saisies dans la plateforme.`,
  },
  {
    id: "data-use",
    titleAr: "كيفية استخدام بياناتك",
    titleFr: "Utilisation de vos données",
    contentAr: `نستخدم بياناتك من أجل:
• تقديم وتحسين خدماتنا التعليمية المتوافقة مع المناهج المغربية الرسمية.
• تخصيص تجربة التعلم بناءً على مستواك ومتطلباتك.
• تشغيل نظام الذكاء الاصطناعي لتوليد الدروس والتوصيات.
• إرسال إشعارات تعليمية ذات صلة بمسيرتك الدراسية.`,
    contentFr: `Nous utilisons vos données pour :
• Fournir et améliorer nos services éducatifs alignés sur les programmes officiels marocains.
• Personnaliser l'expérience d'apprentissage en fonction de votre niveau et de vos besoins.
• Alimenter le système d'IA pour la génération de leçons et de recommandations.
• Vous envoyer des notifications éducatives pertinentes à votre parcours scolaire.`,
  },
  {
    id: "data-sharing",
    titleAr: "مشاركة البيانات",
    titleFr: "Partage des données",
    contentAr: `لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك بياناتك فقط في الحالات التالية:
• مزودو الخدمات: شركاء تقنيون موثوقون (مثل Supabase وGoogle) لتشغيل البنية التحتية.
• المتطلبات القانونية: عند الضرورة للامتثال للتشريعات المغربية النافذة.
• المعلمون والإداريون: ضمن الفصل الدراسي المرتبط بحسابك فقط.`,
    contentFr: `Nous ne vendons pas vos données personnelles à des tiers. Nous pouvons partager vos données uniquement dans les cas suivants :
• Fournisseurs de services : partenaires technologiques de confiance (ex. Supabase, Google) pour faire fonctionner l'infrastructure.
• Exigences légales : lorsque la loi marocaine en vigueur l'exige.
• Enseignants et administrateurs : uniquement au sein de la classe liée à votre compte.`,
  },
  {
    id: "cookies",
    titleAr: "ملفات تعريف الارتباط",
    titleFr: "Cookies",
    contentAr: `نستخدم ملفات تعريف الارتباط وتقنيات التخزين المحلي (IndexedDB) لأغراض وظيفية بحتة:
• الحفاظ على جلسة تسجيل الدخول.
• تخزين تفضيلات الواجهة (اللغة، الوضع المظلم).
• تحسين أداء التطبيق محليًا دون إرسال بيانات خارجية.`,
    contentFr: `Nous utilisons des cookies et des technologies de stockage local (IndexedDB) à des fins purement fonctionnelles :
• Maintenir la session de connexion.
• Enregistrer les préférences d'interface (langue, mode sombre).
• Améliorer les performances de l'application localement sans envoi de données externes.`,
  },
  {
    id: "rights",
    titleAr: "حقوقك",
    titleFr: "Vos droits",
    contentAr: `وفقًا للقانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، يحق لك:
• الاطلاع على بياناتك الشخصية المخزنة لدينا.
• طلب تصحيح أي بيانات غير دقيقة.
• طلب حذف حسابك وبياناتك.
• الاعتراض على معالجة معينة لبياناتك.`,
    contentFr: `Conformément à la loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous avez le droit de :
• Accéder à vos données personnelles stockées chez nous.
• Demander la correction de toute donnée inexacte.
• Demander la suppression de votre compte et de vos données.
• Vous opposer à certains traitements de vos données.`,
  },
  {
    id: "security",
    titleAr: "أمان البيانات",
    titleFr: "Sécurité des données",
    contentAr: `نطبق تدابير أمنية صارمة لحماية بياناتك:
• التشفير الكامل للبيانات أثناء النقل (HTTPS/TLS).
• سياسات أمان الصفوف (RLS) في قاعدة البيانات.
• مراجعات أمنية دورية للكود والبنية التحتية.`,
    contentFr: `Nous appliquons des mesures de sécurité strictes pour protéger vos données :
• Chiffrement complet des données en transit (HTTPS/TLS).
• Politiques de sécurité au niveau des lignes (RLS) dans la base de données.
• Audits de sécurité réguliers du code et de l'infrastructure.`,
  },
  {
    id: "contact",
    titleAr: "التواصل معنا",
    titleFr: "Nous contacter",
    contentAr: `لأي استفسار يتعلق بهذه السياسة أو بياناتك الشخصية، يمكنك التواصل معنا على:
البريد الإلكتروني: privacy@levelspace.ma
الموقع الإلكتروني: levelspace.ma`,
    contentFr: `Pour toute question relative à cette politique ou à vos données personnelles, vous pouvez nous contacter à :
E-mail : privacy@levelspace.ma
Site web : levelspace.ma`,
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.title = "سياسة الخصوصية | LevelSpace";
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#f8f9ff)] text-[var(--text-primary,#0a0a1a)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#1246ff]/10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#1246ff] transition-colors group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="rotate-180 group-hover:-translate-x-1 transition-transform"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            رجوع
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "#1246ff" }}
            >
              LS
            </div>
            <span className="font-semibold text-sm" style={{ fontFamily: "Syne, sans-serif" }}>
              LevelSpace
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1246ff 0%, #0a2fa8 60%, #060e3d 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: "white" }}
          />
          <div
            className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full opacity-5"
            style={{ background: "white" }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-16 text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-xs font-medium mb-6 backdrop-blur-sm border border-white/20">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1L7.5 4.5H11L8 7L9 11L6 9L3 11L4 7L1 4.5H4.5L6 1Z"
                fill="white"
                opacity="0.8"
              />
            </svg>
            آخر تحديث: ماي 2026 · Dernière mise à jour : Mai 2026
          </div>

          <h1
            className="text-4xl md:text-5xl font-bold mb-3"
            style={{ fontFamily: "Syne, sans-serif", direction: "rtl" }}
          >
            سياسة الخصوصية
          </h1>
          <h2
            className="text-xl md:text-2xl font-light opacity-80 mb-6"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            Politique de Confidentialité
          </h2>
          <p
            className="text-white/70 max-w-2xl text-sm leading-relaxed"
            style={{ direction: "rtl", fontFamily: "DM Sans, sans-serif" }}
          >
            نلتزم بحماية بياناتك وفقًا للقانون المغربي رقم 09-08 ومعايير حماية البيانات الدولية.
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
          <h3
            className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            المحتويات · Table des matières
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-3 text-sm text-gray-600 hover:text-[#1246ff] transition-colors group py-1"
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: "#1246ff" }}
                >
                  {i + 1}
                </span>
                <span style={{ direction: "rtl" }}>
                  {s.titleAr} <span className="text-gray-400">·</span> {s.titleFr}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
            >
              {/* Section header */}
              <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-50">
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "#1246ff" }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3
                    className="font-bold text-gray-900 text-lg leading-tight"
                    style={{ fontFamily: "Syne, sans-serif", direction: "rtl" }}
                  >
                    {section.titleAr}
                  </h3>
                  <p className="text-sm text-gray-400" style={{ fontFamily: "DM Sans, sans-serif" }}>
                    {section.titleFr}
                  </p>
                </div>
              </div>

              {/* Content — bilingual side by side on md+ */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-50">
                {/* Arabic */}
                <div className="p-6" style={{ direction: "rtl" }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-semibold text-[#1246ff] bg-[#1246ff]/8 rounded-full px-2.5 py-0.5">
                      العربية
                    </span>
                  </div>
                  <p
                    className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"
                    style={{ fontFamily: "DM Sans, sans-serif", lineHeight: "1.9" }}
                  >
                    {section.contentAr}
                  </p>
                </div>

                {/* French */}
                <div className="p-6">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
                      Français
                    </span>
                  </div>
                  <p
                    className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"
                    style={{ fontFamily: "DM Sans, sans-serif", lineHeight: "1.9" }}
                  >
                    {section.contentFr}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-2xl bg-[#1246ff]/5 border border-[#1246ff]/15 p-6 text-center">
          <p className="text-sm text-gray-500" style={{ fontFamily: "DM Sans, sans-serif" }}>
            يمكن تحديث هذه السياسة بشكل دوري. سنقوم بإخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني.
            <br />
            <span className="text-gray-400">
              Cette politique peut être mise à jour périodiquement. Nous vous informerons de tout changement
              important par e-mail.
            </span>
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[#1246ff] text-sm font-medium">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#1246ff" strokeWidth="1.5" />
              <path d="M7 5v4M7 3.5v.5" stroke="#1246ff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            privacy@levelspace.ma
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-8 mb-12" style={{ fontFamily: "DM Sans, sans-serif" }}>
          © {new Date().getFullYear()} LevelSpace · levelspace.ma · جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
