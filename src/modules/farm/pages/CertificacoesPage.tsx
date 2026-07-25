import { getCertifications } from "@/modules/farm/actions/certification";
import { CertificationSheet } from "@/modules/farm/components/CertificationSheet";
import { CertificationList } from "@/modules/farm/components/CertificationList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Certificações",
    subtitle: "Certificações e validade — orgânico, GLOBALG.A.P e outras",
  },
  es: {
    title: "Certificaciones",
    subtitle: "Certificaciones y vencimiento — orgánico, GLOBALG.A.P y otras",
  },
} as const;

export default async function CertificacoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const locale = await getLocale();
  const t = HEADER[locale];

  const certifications = await getCertifications();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <CertificationSheet />
        </div>
      </div>

      <CertificationList certifications={certifications} />
    </div>
  );
}
