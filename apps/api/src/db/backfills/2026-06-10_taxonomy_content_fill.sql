-- One-off content backfill (2026-06-10)
-- Mengisi field kosong pasca migrasi taxonomy: deskripsi bonus, short_description
-- kelas, subtitle rekaman, skill assignment, dan tag untuk seluruh konten published.
-- Idempotent: aman dijalankan ulang (INSERT OR IGNORE + UPDATE deterministik).

-- ═══════════════════════════════════════════════
-- 1. DESKRIPSI BONUS (45 bundle tanpa description)
-- ═══════════════════════════════════════════════
UPDATE bonuses SET description = 'Blueprint langkah demi langkah membangun dan menskalakan agency: positioning, paket layanan, akuisisi klien, dan sistem delivery.' WHERE title = 'Agency Growth Blueprint' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Cara praktis UMKM memakai AI untuk menaikkan profit: efisiensi operasional, marketing, dan layanan pelanggan.' WHERE title = 'Ai Profit Mastery for Small Business' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Ebook dasar prompt engineering: struktur prompt, teknik iterasi, dan contoh siap pakai untuk pekerjaan harian.' WHERE title = 'Ai Prompt Engineering Ebook' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Playbook memimpin adopsi AI di tim: komunikasi perubahan, pelatihan, dan mengatasi resistensi karyawan.' WHERE title = 'Ai Ready Change Management Playbook' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Panduan A/B testing untuk pemula: merancang eksperimen, membaca hasil, dan mengambil keputusan berbasis data.' WHERE title = 'Beginners Guide to Ab Testing' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Pengantar blockchain tanpa jargon: cara kerja, use case nyata, dan hal yang perlu diwaspadai sebelum terjun.' WHERE title = 'Blockchain Basics' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Cara menyusun budget harian yang realistis: melacak pengeluaran, menabung otomatis, dan menghindari bocor halus.' WHERE title = 'Budgeting in Everyday Life' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Strategi membangun channel konten faceless yang menghasilkan: pemilihan niche, produksi konten dengan AI, dan monetisasi.' WHERE title = 'Building a Faceless Empire' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Kerangka membeli kembali waktumu: delegasi, eliminasi tugas rendah nilai, dan fokus ke pekerjaan berdampak tinggi.' WHERE title = 'Buy Back Your Time' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Membangun rasa percaya diri yang terlihat: bahasa tubuh, persiapan mental, dan first impression yang kuat.' WHERE title = 'Confidence That Shows Before You Speak' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Strategi content marketing untuk bisnis kecil: rencana konten sederhana yang konsisten mendatangkan pelanggan.' WHERE title = 'Content Marketing for Small Businesses' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Mempercepat hasil content marketing dengan AI: produksi konten berkualitas dalam skala besar, distribusi, dan daur ulang.' WHERE title = 'Content Marketing on Steroids' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Satu konten jadi sepuluh: sistem repurposing lintas platform agar jangkauan naik tanpa kerja ekstra.' WHERE title = 'Content Repurposing Mastery' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menyusun funnel konten yang mengubah pembaca jadi pembeli: tahapan funnel dan CTA yang tepat di tiap tahap.' WHERE title = 'Converting Content Funnel' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Cara membuat produk digital mikro yang cepat diluncurkan: ide, validasi, pricing, dan penjualan pertama.' WHERE title = 'Create Micro Products' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Panduan founder lepas dari distraksi digital: batasan sehat, deep work, dan energi yang lebih stabil.' WHERE title = 'Digital Detox for Founders' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Roadmap dari nol jadi kreator konten: menemukan angle, konsistensi posting, dan membangun audiens pertama.' WHERE title = 'From Zero to Content Hero' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Memanfaatkan social proof untuk pertumbuhan: testimoni, studi kasus, dan UGC yang menaikkan konversi.' WHERE title = 'Growth with Social Proof' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Langkah menyiapkan bisnis untuk difranchisekan: standarisasi operasional, aspek legal, dan model kemitraan.' WHERE title = 'How to Franchise Your Business' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Teknik mengedit tulisan AI agar terdengar manusiawi: tone of voice, ritme kalimat, dan sentuhan personal.' WHERE title = 'Humanize Your Ai Copy' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menjalankan LinkedIn Ads untuk leads B2B: targeting, format iklan, dan optimasi biaya per lead.' WHERE title = 'Lead Generation with Linkedin Ads' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Memahami metrik iklan berbayar: ROAS, CAC, LTV, dan cara membaca dashboard iklan tanpa tersesat.' WHERE title = 'Mastering Paid Marketing Metrics' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Monetisasi audiens kecil tapi loyal: produk digital, membership, dan penawaran yang tepat sasaran.' WHERE title = 'Monetize Your Micro Audience' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Cara menghasilkan dari konten tanpa mengorbankan integritas: model monetisasi yang sehat dan berkelanjutan.' WHERE title = 'Monetizing Attention without Selling Your Soul' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Praktik keamanan untuk bisnis online: proteksi akun, data pelanggan, dan mencegah penipuan umum.' WHERE title = 'Online Business Security Best Practices' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Sistem prioritas hidup dan kerja: memilah yang penting, berani berkata tidak, dan menjaga energi harian.' WHERE title = 'Prioritize Your Life' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Storytelling untuk product launch: narasi pre-launch, membangun momentum, dan pesan yang bikin orang menunggu.' WHERE title = 'Product Launch Storytelling Secrets' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Teknik self coaching untuk berkembang mandiri: refleksi terstruktur, goal setting, dan akuntabilitas diri.' WHERE title = 'Self Coaching Mastery' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Mengatasi takut jualan: mindset penjualan sehat, menghadapi penolakan, dan percakapan closing yang natural.' WHERE title = 'Selling without Fear' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menggabungkan SEO dan storytelling: konten yang ranking di Google sekaligus enak dibaca manusia.' WHERE title = 'Seo Driven Storytelling Advantage' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'SWOT tanpa ribet: template analisis kekuatan, kelemahan, peluang, dan ancaman untuk keputusan bisnis.' WHERE title = 'Swot Analysis Simplified' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Belajar lebih cepat dengan AI: teknik merangkum, menguji pemahaman, dan membangun kebiasaan belajar.' WHERE title = 'The Ai Advantage in Learning' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Seni negosiasi praktis: persiapan, membaca lawan bicara, dan mencapai kesepakatan menang-menang.' WHERE title = 'The Art of Negotiation' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Sistem evolusi brand untuk kreator: positioning, identitas visual, dan konsistensi pesan lintas platform.' WHERE title = 'The Brand Evolution System for Modern Creators' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Merancang model bisnis yang masuk akal: value proposition, sumber pendapatan, dan struktur biaya.' WHERE title = 'The Business Model Blueprint' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Panduan memulai bisnis pertama: validasi ide, langkah legal dasar, dan 90 hari pertama yang terarah.' WHERE title = 'The First Time Entrepreneur Launchpad' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Prinsip neuromarketing untuk konversi: psikologi pengambilan keputusan, trigger emosi, dan desain penawaran.' WHERE title = 'The Neuromarketing Edge' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Sains di balik produktivitas puncak: ritme fokus, istirahat strategis, dan kebiasaan berbasis riset otak.' WHERE title = 'The Neuroscience of Peak Productivity' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Psikologi closing penjualan: membaca sinyal beli, mengatasi keberatan, dan teknik penutup yang etis.' WHERE title = 'The Psychology of Closing' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Playbook UGC: mendapatkan konten dari pengguna, kurasi, dan memakainya untuk menaikkan konversi iklan.' WHERE title = 'The Ugc Conversion Playbook' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Panduan kesiapsiagaan praktis: perencanaan darurat, kebutuhan dasar, dan ketenangan menghadapi krisis.' WHERE title = 'The Ultimate Survival Prepper' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menjual lewat visual: prinsip desain penawaran, presentasi produk, dan materi sales yang meyakinkan.' WHERE title = 'Visual Selling' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menjaga keseimbangan untuk orang ambisius: batasan kerja, ritual pemulihan, dan karier yang berkelanjutan.' WHERE title = 'Work Life Balance for Ambitious Minds' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Bekerja cerdas dengan virtual assistant: rekrut, delegasi lewat SOP, dan otomasi tugas repetitif bersama VA.' WHERE title = 'Working Smarter with Virtual Assistants' AND (description IS NULL OR description = '');
UPDATE bonuses SET description = 'Menulis konten yang menjual tanpa terkesan jualan: copywriting halus, struktur soft-sell, dan CTA natural.' WHERE title = 'Writing Content That Sells without Sounding Salesy' AND (description IS NULL OR description = '');

-- ═══════════════════════════════════════════════
-- 2. KELAS: short_description kosong + RECORDING: subtitle kosong
-- ═══════════════════════════════════════════════
UPDATE courses SET short_description = 'Kuasai teknik prompting tingkat lanjut agar output AI konsisten, akurat, dan siap pakai untuk kerja harian.' WHERE title = 'Premium Prompting Mastery' AND (short_description IS NULL OR short_description = '');
UPDATE courses SET short_description = 'Belajar vibe coding dari nol: bangun website dan aplikasi dengan bantuan AI tanpa latar belakang teknis.' WHERE title = 'Vibecoding For Beginner' AND (short_description IS NULL OR short_description = '');
UPDATE webinar_recordings SET subtitle = 'Sesi santai komunitas Pejuang Yen: ngobrol tren AI terbaru, tanya jawab, dan sharing praktik antar member.' WHERE title = 'Nongkrong GWA 07/06/26' AND (subtitle IS NULL OR subtitle = '');

-- ═══════════════════════════════════════════════
-- 3. TAG VOCABULARY
-- ═══════════════════════════════════════════════
INSERT OR IGNORE INTO tags (id, slug, name) VALUES
  ('tag_prompting',    'prompting',    'Prompting'),
  ('tag_copywriting',  'copywriting',  'Copywriting'),
  ('tag_funnel',       'funnel',       'Funnel'),
  ('tag_ads',          'ads',          'Ads'),
  ('tag_linkedin',     'linkedin',     'LinkedIn'),
  ('tag_seo',          'seo',          'SEO'),
  ('tag_storytelling', 'storytelling', 'Storytelling'),
  ('tag_branding',     'branding',     'Branding'),
  ('tag_ugc',          'ugc',          'UGC'),
  ('tag_negosiasi',    'negosiasi',    'Negosiasi'),
  ('tag_ai_tools',     'ai-tools',     'AI Tools'),
  ('tag_vibe_coding',  'vibe-coding',  'Vibe Coding'),
  ('tag_blockchain',   'blockchain',   'Blockchain'),
  ('tag_komunitas',    'komunitas',    'Komunitas');

-- ═══════════════════════════════════════════════
-- 4. SKILL ASSIGNMENT (join via judul di registry)
-- ═══════════════════════════════════════════════
-- Kelas
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_start_here', 1 FROM content_items ci WHERE ci.content_type='course' AND ci.title='Premium Prompting Mastery';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_webdev', 1 FROM content_items ci WHERE ci.content_type='course' AND ci.title='Vibecoding For Beginner';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_business', 1 FROM content_items ci WHERE ci.content_type='course' AND ci.title='Ai For Solo Preneur';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_productivity', 0 FROM content_items ci WHERE ci.content_type='course' AND ci.title='Ai For Solo Preneur';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_business', 1 FROM content_items ci WHERE ci.content_type='course' AND ci.title='Ai For Bussines';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_marketing', 0 FROM content_items ci WHERE ci.content_type='course' AND ci.title='AI untuk Bisnis & Marketing';
-- Rekaman & Tool
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_start_here', 1 FROM content_items ci WHERE ci.content_type='recording' AND ci.title='Nongkrong GWA 07/06/26';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_webdev', 1 FROM content_items ci WHERE ci.content_type='tool' AND ci.ref_id='web_prompt_generator';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_productivity', 0 FROM content_items ci WHERE ci.content_type='tool' AND ci.ref_id='web_prompt_generator';
-- Bonus published lama
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_start_here', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='100+ Prompt Templates';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_start_here', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Panduan AI Tools 2026';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_productivity', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Panduan AI Tools 2026';
-- Bundle: Bisnis & UMKM
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_business', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Agency Growth Blueprint','Ai Profit Mastery for Small Business','Create Micro Products','How to Franchise Your Business','Online Business Security Best Practices','Swot Analysis Simplified','The Business Model Blueprint','The First Time Entrepreneur Launchpad');
-- Bundle: Marketing
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_marketing', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Beginners Guide to Ab Testing','Content Marketing for Small Businesses','Content Marketing on Steroids','Converting Content Funnel','Growth with Social Proof','Lead Generation with Linkedin Ads','Mastering Paid Marketing Metrics','Product Launch Storytelling Secrets','Seo Driven Storytelling Advantage','The Neuromarketing Edge','The Ugc Conversion Playbook');
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_content', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Content Marketing for Small Businesses','Content Marketing on Steroids','The Ugc Conversion Playbook');
-- Bundle: Konten & Copywriting
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_content', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Building a Faceless Empire','Content Repurposing Mastery','From Zero to Content Hero','Humanize Your Ai Copy','Monetize Your Micro Audience','Monetizing Attention without Selling Your Soul','The Brand Evolution System for Modern Creators','Writing Content That Sells without Sounding Salesy');
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_business', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Monetize Your Micro Audience';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_sales', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Writing Content That Sells without Sounding Salesy';
-- Bundle: Penjualan
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_sales', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Selling without Fear','The Art of Negotiation','The Psychology of Closing','Visual Selling');
-- Bundle: Produktivitas
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_productivity', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Buy Back Your Time','Digital Detox for Founders','Prioritize Your Life','The Neuroscience of Peak Productivity','The Ultimate Survival Prepper','Work Life Balance for Ambitious Minds','Working Smarter with Virtual Assistants');
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_automation', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Working Smarter with Virtual Assistants';
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_career', 0 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Work Life Balance for Ambitious Minds';
-- Bundle: Keuangan
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_finance', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Blockchain Basics','Budgeting in Everyday Life');
-- Bundle: Karier & Personal Brand
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_career', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Confidence That Shows Before You Speak','Self Coaching Mastery');
-- Bundle: HR
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_hr', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title='Ai Ready Change Management Playbook';
-- Bundle: Mulai dari Nol
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary) SELECT ci.id, 'skill_start_here', 1 FROM content_items ci WHERE ci.content_type='bonus' AND ci.title IN ('Ai Prompt Engineering Ebook','The Ai Advantage in Learning');

-- ═══════════════════════════════════════════════
-- 5. TAG ASSIGNMENT
-- ═══════════════════════════════════════════════
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_prompting' FROM content_items ci WHERE ci.title IN ('Premium Prompting Mastery','100+ Prompt Templates','Ai Prompt Engineering Ebook');
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_vibe_coding' FROM content_items ci WHERE ci.title='Vibecoding For Beginner';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_ai_tools' FROM content_items ci WHERE ci.title='Panduan AI Tools 2026' OR ci.ref_id='web_prompt_generator';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_komunitas' FROM content_items ci WHERE ci.content_type='recording' AND ci.title='Nongkrong GWA 07/06/26';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_copywriting' FROM content_items ci WHERE ci.title IN ('Humanize Your Ai Copy','Writing Content That Sells without Sounding Salesy');
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_funnel' FROM content_items ci WHERE ci.title='Converting Content Funnel';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_ads' FROM content_items ci WHERE ci.title IN ('Lead Generation with Linkedin Ads','Mastering Paid Marketing Metrics');
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_linkedin' FROM content_items ci WHERE ci.title='Lead Generation with Linkedin Ads';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_seo' FROM content_items ci WHERE ci.title='Seo Driven Storytelling Advantage';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_storytelling' FROM content_items ci WHERE ci.title IN ('Seo Driven Storytelling Advantage','Product Launch Storytelling Secrets');
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_branding' FROM content_items ci WHERE ci.title='The Brand Evolution System for Modern Creators';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_ugc' FROM content_items ci WHERE ci.title='The Ugc Conversion Playbook';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_negosiasi' FROM content_items ci WHERE ci.title='The Art of Negotiation';
INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT ci.id, 'tag_blockchain' FROM content_items ci WHERE ci.title='Blockchain Basics';

-- ═══════════════════════════════════════════════
-- 6. REFRESH REGISTRY (deskripsi + search_text)
-- ═══════════════════════════════════════════════
UPDATE content_items SET description = (SELECT COALESCE(NULLIF(c.short_description,''), c.description) FROM courses c WHERE c.id = content_items.ref_id) WHERE content_type = 'course';
UPDATE content_items SET description = (SELECT b.description FROM bonuses b WHERE b.id = content_items.ref_id) WHERE content_type = 'bonus';
UPDATE content_items SET description = (SELECT r.subtitle FROM webinar_recordings r WHERE r.id = content_items.ref_id) WHERE content_type = 'recording';

UPDATE content_items SET search_text = lower(
  title || ' ' || COALESCE(description, '')
  || ' ' || COALESCE((SELECT group_concat(s.name, ' ') FROM content_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.content_id = content_items.id), '')
  || ' ' || COALESCE((SELECT group_concat(t.name, ' ') FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.content_id = content_items.id), '')
);
