-- Cloudflare R2'ye geçmeden önce yüklenen görseller sunucu diskinde tutuluyordu.
-- Railway her dağıtımda diski sıfırladığı için o dosyalar kalıcı olarak silindi,
-- ancak adresleri veritabanında kaldı ve 404 döndükleri için kullanıcılar kırık
-- resim görüyor.
--
-- Bu göç, `/uploads/` içeren ölü adresleri temizler. Metin alanları NULL yapılır
-- (arayüz o durumda baş harflerden oluşan avatarı gösterir), JSON dizilerinden
-- ise yalnızca ilgili girdiler çıkarılır — gönderinin/notun metni korunur.
--
-- Dosyalar zaten yok; bu göç veri kaybına yol açmaz, sadece ölü referansları siler.

-- ------------------------------------------------------------------ User
UPDATE "User" SET "avatarUrl" = NULL WHERE "avatarUrl" LIKE '%/uploads/%';
UPDATE "User" SET "coverUrl"  = NULL WHERE "coverUrl"  LIKE '%/uploads/%';

-- ------------------------------------------------------------- Community
UPDATE "Community" SET "avatarUrl" = NULL WHERE "avatarUrl" LIKE '%/uploads/%';
UPDATE "Community" SET "coverUrl"  = NULL WHERE "coverUrl"  LIKE '%/uploads/%';

-- ---------------------------------------------------------- Conversation
UPDATE "Conversation" SET "avatarUrl" = NULL WHERE "avatarUrl" LIKE '%/uploads/%';

-- ----------------------------------------------------------------- Event
UPDATE "Event" SET "coverUrl" = NULL WHERE "coverUrl" LIKE '%/uploads/%';

-- ------------------------------------------------------------ Post.media
UPDATE "Post"
SET "media" = COALESCE(
      (SELECT jsonb_agg(oge)
         FROM jsonb_array_elements("media") AS oge
        WHERE oge->>'url' IS NULL OR oge->>'url' NOT LIKE '%/uploads/%'),
      '[]'::jsonb
    )
WHERE "media"::text LIKE '%/uploads/%';

-- --------------------------------------------------- Message.attachments
UPDATE "Message"
SET "attachments" = COALESCE(
      (SELECT jsonb_agg(oge)
         FROM jsonb_array_elements("attachments") AS oge
        WHERE oge->>'url' IS NULL OR oge->>'url' NOT LIKE '%/uploads/%'),
      '[]'::jsonb
    )
WHERE "attachments"::text LIKE '%/uploads/%';

-- ------------------------------------------------------------ Note.files
UPDATE "Note"
SET "files" = COALESCE(
      (SELECT jsonb_agg(oge)
         FROM jsonb_array_elements("files") AS oge
        WHERE oge->>'url' IS NULL OR oge->>'url' NOT LIKE '%/uploads/%'),
      '[]'::jsonb
    )
WHERE "files"::text LIKE '%/uploads/%';
