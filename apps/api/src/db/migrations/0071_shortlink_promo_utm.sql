-- Shortlink promo UTM + tag lokasi.
-- Tiap shortlink bisa menyimpan utm_source/medium/campaign dan tag "Lokasi/Channel
-- promo" (dipetakan ke utm_content). Saat di-resolve, nilai non-null di-append ke
-- destination_url TANPA menimpa param yang sudah ada di URL tujuan — sehingga utm
-- ikut ke tujuan dan masuk pipeline atribusi (cookie gwa_utm → user_attribution).
ALTER TABLE shortlinks ADD COLUMN utm_source   TEXT;
ALTER TABLE shortlinks ADD COLUMN utm_medium   TEXT;
ALTER TABLE shortlinks ADD COLUMN utm_campaign TEXT;
ALTER TABLE shortlinks ADD COLUMN utm_content  TEXT;  -- diisi dari field "Lokasi/Channel promo"
