import { notFound, permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (locale === "en") permanentRedirect("/");
  if (locale === "uk" || locale === "ru") permanentRedirect(`/${locale}`);
  notFound();
}
