import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../db/supabase";
import { SEO } from "../components/SEO";

type PrivacyLocaleKey = "en" | "fr" | "ar";

type PrivacyLocale = {
  title?: string;
  language_name?: string;
  dir?: "ltr" | "rtl";
  content_markdown?: string;
};

type PrivacyPolicyValue = {
  version?: string;
  effective_date?: string;
  contact_email?: string;
  locales?: Partial<Record<PrivacyLocaleKey, PrivacyLocale>>;
};

const SUPPORTED_LANGUAGES: Array<{ key: PrivacyLocaleKey; label: string }> = [
  { key: "en", label: "English" },
  { key: "fr", label: "Français" },
  { key: "ar", label: "العربية" },
];

const FALLBACK_MESSAGE = "Privacy Policy is temporarily unavailable.";

const getSupportedLanguage = (lang: string | null): PrivacyLocaleKey =>
  SUPPORTED_LANGUAGES.some((item) => item.key === lang) ? (lang as PrivacyLocaleKey) : "en";

const formatEffectiveDate = (value?: string, lang: PrivacyLocaleKey = "en") => {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

export default function PrivacyPolicy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLanguage = getSupportedLanguage(searchParams.get("lang"));
  const [policy, setPolicy] = useState<PrivacyPolicyValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchPolicy = async () => {
      setLoading(true);
      setFailed(false);

      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "legal.privacy_policy")
          .maybeSingle();

        if (error) throw error;
        if (!data?.value) throw new Error("Privacy policy setting is missing.");

        if (active) setPolicy(data.value as PrivacyPolicyValue);
      } catch (error) {
        console.error("[PrivacyPolicy] Failed to fetch privacy policy:", error);
        if (active) {
          setPolicy(null);
          setFailed(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPolicy();

    return () => {
      active = false;
    };
  }, []);

  const locale = useMemo(() => policy?.locales?.[activeLanguage] || policy?.locales?.en, [activeLanguage, policy]);
  const direction = locale?.dir === "rtl" ? "rtl" : "ltr";
  const content = String(locale?.content_markdown || "").trim();
  const title = locale?.title || "Privacy Policy";
  const showUnavailable = failed || (!loading && (!locale || !content));

  return (
    <main className="min-h-screen bg-[#f6f3eb] text-[#151515]" dir={direction}>
      <SEO
        title={title}
        description="Levelspace.ma privacy policy"
        url={`${window.location.origin}/privacy-policy?lang=${activeLanguage}`}
      />

      <header className="border-b border-[#151515]/10 bg-[#fdfbf5]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.22em] text-[#151515]">
            Levelspace.ma
          </Link>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Privacy policy language">
            {SUPPORTED_LANGUAGES.map((item) => {
              const selected = item.key === activeLanguage;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSearchParams({ lang: item.key })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    selected
                      ? "border-[#151515] bg-[#151515] text-white"
                      : "border-[#151515]/15 bg-white/70 text-[#151515]/70 hover:border-[#151515]/40 hover:text-[#151515]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <div className="rounded-[2rem] border border-[#151515]/10 bg-[#fdfbf5] p-6 shadow-[0_24px_80px_rgba(21,21,21,0.08)] md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                <ShieldCheck size={14} />
                {locale?.language_name || SUPPORTED_LANGUAGES.find((item) => item.key === activeLanguage)?.label}
              </div>
              <h1 className="font-display text-4xl font-black tracking-tight text-[#151515] md:text-6xl">
                {title}
              </h1>
            </div>

            <dl className="grid min-w-48 gap-3 rounded-3xl border border-[#151515]/10 bg-white/70 p-4 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#151515]/45">Effective Date</dt>
                <dd className="mt-1 font-semibold text-[#151515]">
                  {formatEffectiveDate(policy?.effective_date, activeLanguage)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#151515]/45">Version</dt>
                <dd className="mt-1 font-semibold text-[#151515]">{policy?.version || "Not specified"}</dd>
              </div>
            </dl>
          </div>

          {loading && (
            <div className="mt-10 rounded-3xl border border-[#151515]/10 bg-white/60 p-8 text-center text-sm font-medium text-[#151515]/60">
              Loading privacy policy...
            </div>
          )}

          {showUnavailable && (
            <div className="mt-10 rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center text-sm font-semibold text-amber-900">
              {FALLBACK_MESSAGE}
            </div>
          )}

          {!loading && !showUnavailable && (
            <article
              className="mt-10 space-y-5 rounded-3xl border border-[#151515]/10 bg-white p-6 leading-relaxed text-[#202020] md:p-9"
              dir={direction}
            >
              <Markdown
                skipHtml
                components={{
                  h1: ({ ...props }) => <h1 className="mt-2 text-3xl font-black tracking-tight" {...props} />,
                  h2: ({ ...props }) => <h2 className="mt-8 text-2xl font-extrabold tracking-tight" {...props} />,
                  h3: ({ ...props }) => <h3 className="mt-6 text-xl font-bold" {...props} />,
                  p: ({ ...props }) => <p className="text-base leading-8 text-[#2f2f2f]" {...props} />,
                  ul: ({ ...props }) => <ul className="list-disc space-y-2 ps-6" {...props} />,
                  ol: ({ ...props }) => <ol className="list-decimal space-y-2 ps-6" {...props} />,
                  li: ({ ...props }) => <li className="leading-8" {...props} />,
                  a: ({ ...props }) => (
                    <a
                      className="font-semibold text-blue-700 underline decoration-blue-700/30 underline-offset-4"
                      target="_blank"
                      rel="noreferrer"
                      {...props}
                    />
                  ),
                  strong: ({ ...props }) => <strong className="font-extrabold text-[#151515]" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote className="border-s-4 border-[#151515]/20 bg-[#f6f3eb] px-4 py-3 italic" {...props} />
                  ),
                }}
              >
                {content}
              </Markdown>
            </article>
          )}

          {policy?.contact_email && !showUnavailable && (
            <p className="mt-6 text-center text-sm text-[#151515]/60">
              Contact:{" "}
              <a className="font-bold text-[#151515] underline underline-offset-4" href={`mailto:${policy.contact_email}`}>
                {policy.contact_email}
              </a>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
