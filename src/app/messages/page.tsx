import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";

export default async function MessagesPage() {
  const locale = await getRequestLocale();

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
      {t(locale, "messages.noConversationSelected")}
    </div>
  );
}
