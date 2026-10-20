-- PejuangYen — Benefit per paket membership, bisa diedit dari admin.
-- Kolom features_json = JSON array of string. Kosong/null → /premium pakai fallback kurasi.

ALTER TABLE membership_plans ADD COLUMN features_json TEXT;

-- Seed benefit relevan PejuangYen (kerja & bahasa Jepang) untuk paket yang sudah ada.
UPDATE membership_plans SET features_json = json('[
  "Akses semua kelas: Bahasa Jepang, JLPT & JFT-Basic",
  "Kelas online + rekaman bisa diputar ulang",
  "Latihan soal JLPT N5 & JFT-Basic",
  "Grup komunitas PejuangYen",
  "Bebas berhenti kapan saja"
]') WHERE slug = 'monthly';

UPDATE membership_plans SET features_json = json('[
  "Akses semua kelas premium: Bahasa Jepang & persiapan kerja",
  "Kelas online rutin + semua rekaman",
  "Latihan soal JLPT, JFT-Basic & SSW",
  "Bimbingan CV (rirekisho) & simulasi wawancara",
  "Grup komunitas + prioritas tanya-jawab",
  "Lebih hemat dibanding bayar bulanan"
]') WHERE slug = 'yearly';

UPDATE membership_plans SET features_json = json('[
  "Semua benefit paket Tahunan",
  "Akses selamanya, cukup bayar sekali",
  "Semua kelas & materi baru otomatis terbuka",
  "Tanpa biaya perpanjangan"
]') WHERE slug = 'lifetime';
