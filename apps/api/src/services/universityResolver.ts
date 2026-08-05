import {
  extractDomain,
  findUniversityByDomain,
  isStudentSubdomain,
  looksLikeAcademicDomain,
} from "@kampus/shared";
import { prisma } from "../db";
import { env } from "../env";
import { badRequest } from "../lib/errors";

export interface ResolvedUniversity {
  domain: string;
  isStudentAddress: boolean;
  university: { id: string; name: string; shortName: string; city: string } | null;
}

/**
 * Kayıt sırasında e-postanın bir üniversiteye ait olduğunu doğrular.
 * Uymayan adresler burada reddedilir — platformun tek kapısı burasıdır.
 */
export async function resolveUniversityForEmail(email: string): Promise<ResolvedUniversity> {
  const domain = extractDomain(email);
  if (!domain) throw badRequest("Geçerli bir e-posta adresi girin", { email: "Geçersiz adres" });

  const seed = findUniversityByDomain(domain);

  if (seed) {
    // Listede var — veritabanındaki kaydı bul (seed ile isim eşleşir).
    const university = await prisma.university.findFirst({
      where: { name: seed.name, isActive: true },
      select: { id: true, name: true, shortName: true, city: true },
    });

    if (!university) {
      throw badRequest(
        "Üniversiteniz sistemde henüz tanımlı değil. Lütfen destek ile iletişime geçin.",
        { email: "Üniversite kaydı bulunamadı" },
      );
    }

    return { domain, university, isStudentAddress: isStudentSubdomain(domain) };
  }

  if (env.ALLOWED_DOMAIN_MODE === "edu" && looksLikeAcademicDomain(domain)) {
    // Esnek mod: akademik görünen alan adlarına izin ver, üniversiteyi boş bırak.
    return { domain, university: null, isStudentAddress: isStudentSubdomain(domain) };
  }

  throw badRequest(
    `"${domain}" bir üniversite e-posta adresi değil. Kampus'e yalnızca üniversitenizin size verdiği adresle (@ogr.universite.edu.tr gibi) kayıt olabilirsiniz.`,
    { email: "Üniversite e-postası gerekli" },
  );
}

/** Kayıt formundan önce "bu adres kabul edilir mi?" kontrolü. */
export async function previewUniversityForEmail(email: string) {
  try {
    const resolved = await resolveUniversityForEmail(email);
    return {
      allowed: true as const,
      domain: resolved.domain,
      university: resolved.university,
      isStudentAddress: resolved.isStudentAddress,
    };
  } catch (err) {
    return {
      allowed: false as const,
      domain: extractDomain(email),
      message: (err as Error).message,
    };
  }
}
