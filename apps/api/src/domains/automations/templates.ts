// Definisi template built-in untuk AI Content Automation.
// Tiap template = rangkaian step bertipe + spesifikasi credential & field config
// yang dipakai untuk render form (template-driven, tanpa visual editor).

export interface CredentialField {
  name: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

export interface CredentialRoleSpec {
  role: string;   // kunci logis dipakai engine (mis. 'repliz', 'telegram')
  type: string;   // tipe credential (mengelompokkan di vault)
  label: string;
  fields: CredentialField[];
}

export interface ConfigFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  credits_per_use: number;
  steps: string[];
  requiredCredentials: CredentialRoleSpec[];
  configFields: ConfigFieldSpec[];
  defaultSystemPrompt?: string;
  /** Apakah template pakai pool topik manual (false utk yang sumbernya otomatis spt RSS). */
  usesTopics?: boolean;
}

// ─── Spesifikasi bersama (dipakai lintas template) ───────────────────────────
const REPLIZ_CRED: CredentialRoleSpec = {
  role: 'repliz',
  type: 'repliz',
  label: 'Repliz API',
  fields: [
    { name: 'accessKey', label: 'Repliz Access Key', secret: true, placeholder: '856127844...' },
    { name: 'secretKey', label: 'Repliz Secret Key', secret: true, placeholder: 'Kp5T0Xfvtd...' },
  ],
};

const TELEGRAM_CRED: CredentialRoleSpec = {
  role: 'telegram',
  type: 'telegram',
  label: 'Telegram Bot',
  fields: [{ name: 'botToken', label: 'Telegram Bot Token', secret: true, placeholder: '8718709143:AAF...' }],
};

const PERSONA_FIELDS: ConfigFieldSpec[] = [
  { name: 'personaHandle', label: 'Handle akun kamu (mis. @username)', type: 'text', required: true, placeholder: '@username' },
  {
    name: 'personaBio', label: 'Tentang kamu (1-2 kalimat: siapa kamu & fokusmu)', type: 'textarea', required: true,
    placeholder: 'Mis. Builder muda yang lagi bangun bisnis sambil ngulik AI. Jujur soal proses & kegagalan.',
    help: 'Ini yang membentuk persona/suara thread. Pakai sudut pandang orang pertama.',
  },
  { name: 'personaAudience', label: 'Audiens target (opsional)', type: 'text', required: false, placeholder: 'Mis. anak muda 20-35 yang mau mulai usaha' },
  { name: 'personaTone', label: 'Gaya / tone (opsional)', type: 'text', required: false, placeholder: 'Mis. santai, gue/lo, jujur, sedikit kontroversial' },
];

const REPLIZ_CONFIG_FIELDS: ConfigFieldSpec[] = [
  { name: 'replizAccountId', label: 'Repliz Account ID', type: 'text', required: true },
  { name: 'replizUserId', label: 'Repliz User ID', type: 'text', required: true },
  { name: 'telegramChatId', label: 'Telegram Chat ID (tujuan notifikasi)', type: 'text', required: true },
];

const OVERRIDE_FIELD: ConfigFieldSpec = {
  name: 'systemPromptOverride',
  label: 'Override System Prompt penuh (opsional, advanced)',
  type: 'textarea',
  required: false,
  help: 'Kosongkan untuk pakai framework + persona di atas. Isi hanya kalau mau mengganti SELURUH prompt.',
};

// Framework viral GENERIK (dipakai semua user). Persona TIDAK di-hardcode —
// diinjeksi per-automation dari field config (lihat buildThreadSystemPrompt).
export const THREAD_FRAMEWORK_PROMPT = `You are an elite viral Threads/Twitter thread writer operating under the Director mindset.

Output ditulis dalam Bahasa Indonesia (kecuali PERSONA meminta bahasa lain).

INSTRUKSI MUTLAK:
Topik thread SELALU dari user message. Tulis tentang TOPIK SPESIFIK yang diberikan. JANGAN ganti topik.

KONTEKS WAKTU: Tahun sekarang adalah 2026. Gunakan konteks 2026 untuk apapun yang relevan dengan "zaman sekarang".

BATAS KARAKTER: SETIAP tweet MAKSIMAL 500 karakter. Target ideal 250-450. Jika melebihi, pecah jadi 2 tweet.

TONE POSITIF: Konstruktif dan membangun meski topiknya negatif. Pembaca menutup thread merasa lebih berdaya, bukan lebih takut.

HOOK (80% penentu viral):
Hook BUKAN satu kalimat — ini SELURUH SETUP EMOSIONAL sebelum masuk isi.
Habiskan MINIMAL tweet 1 + tweet 2 (boleh sampai tweet 3). Tiap tweet hook 250-450 karakter.
Buka minimal 2 loop yang tidak ditutup di tweet pertama.
Gunakan: cerita orang dalam (insider) yang membocorkan info yang merugikan pembaca, detail spesifik (waktu, tempat, angka, dialog), reaksi fisik, dan cliffhanger berlapis.

ISI: Setiap tweet memberi value baru (satu insight / langkah / data / momen). Tidak ada filler. Payoff dari hook HARUS datang.

TWEET KEDUA TERAKHIR (N-1) = CTA personal 4-5 kalimat berdasarkan PERSONA: perkenalkan diri sesuai persona, value spesifik ke topik, ajakan follow, undangan DM. JANGAN generic. JANGAN sebut diri "pakar/expert".

TWEET TERAKHIR (N) = penutup yang memicu diskusi: refleksi personal + pertanyaan yang mengundang cerita. JANGAN format "Lo mau X atau Y?".

ATURAN PENULISAN:
- Bahasa conversational sesuai gaya PERSONA.
- TIDAK ADA emoji (kecuali checkmark/X kontekstual).
- TIDAK ADA asterisk, bold, italic, markdown. Plain text only.
- SPACING: setiap kalimat/pikiran pendek diikuti baris kosong (kritis untuk readability mobile).
- Setiap klaim ada angka/contoh konkret.

PANJANG THREAD: dinamis 8-15 tweet sesuai kedalaman topik. Lebih baik padat daripada padding.

OUTPUT FORMAT:
1.

(teks tweet 1)

2.

(teks tweet 2)

(lanjut sampai tweet terakhir, 8-15 tweet)

ATURAN OUTPUT:
- Output HANYA tweet bernomor (1. 2. 3. ...), 8-15 tweet.
- Setiap tweet maksimal 500 karakter.
- Tidak ada teks sebelum tweet 1 atau setelah tweet terakhir.
- Tidak ada label "Hook:", "CTA:", dll. Tidak ada pemisah --- antar tweet.
- Baris kosong antar paragraf WAJIB.`;

export interface ThreadPersona {
  handle?: string;
  bio?: string;
  audience?: string;
  tone?: string;
}

/** Rakit system prompt final = framework generik + blok PERSONA milik user. */
export function buildThreadSystemPrompt(persona: ThreadPersona): string {
  const lines = [
    'PERSONA & SUARA (WAJIB diikuti — ini identitas penulis thread):',
    persona.handle ? `- Akun: ${persona.handle}` : '',
    persona.bio ? `- Tentang penulis: ${persona.bio}` : '',
    persona.audience ? `- Audiens target: ${persona.audience}` : '',
    persona.tone ? `- Gaya/tone: ${persona.tone}` : '- Gaya/tone: personal, jujur, conversational.',
    'Tulis konsisten sebagai orang pertama sesuai persona di atas. CTA & penutup harus terdengar seperti penulis ini, bukan template generik.',
  ].filter(Boolean).join('\n');

  return `${THREAD_FRAMEWORK_PROMPT}\n\n${lines}`;
}

// Feed RSS default untuk template berita (user bisa override per-automation).
export const DEFAULT_NEWS_FEEDS = [
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://venturebeat.com/category/ai/feed/',
  'https://blog.google/technology/ai/rss/',
  'https://www.theverge.com/rss/index.xml',
];

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: 'auto_ai_thread',
    name: 'Auto AI Thread (Threads/Repliz)',
    description:
      'Generate thread viral 8-15 tweet dari rotasi topik, jadwalkan otomatis ke Threads via Repliz, dan kirim notifikasi Telegram. Replika workflow n8n, tanpa n8n.',
    credits_per_use: 1,
    usesTopics: true,
    steps: ['pickTopic', 'aiGenerate', 'parseThread', 'socialPost', 'notify', 'markUsed'],
    requiredCredentials: [REPLIZ_CRED, TELEGRAM_CRED],
    configFields: [...PERSONA_FIELDS, ...REPLIZ_CONFIG_FIELDS, OVERRIDE_FIELD],
  },
  {
    key: 'daily_ai_news_thread',
    name: 'Daily AI News → Thread',
    description:
      'Tarik berita AI terbaru dari RSS feed, AI rangkai jadi thread viral dengan insight, jadwalkan ke Threads via Repliz + notif Telegram. Anti-duplikat: berita yang sudah dibahas tidak diulang.',
    credits_per_use: 1,
    usesTopics: false,
    steps: ['fetchNews', 'aiThreadFromNews', 'parseThread', 'socialPost', 'notify', 'recordNews'],
    requiredCredentials: [REPLIZ_CRED, TELEGRAM_CRED],
    configFields: [
      ...PERSONA_FIELDS,
      {
        name: 'feeds',
        label: 'RSS feed (satu URL per baris, opsional)',
        type: 'textarea',
        required: false,
        placeholder: 'https://techcrunch.com/category/artificial-intelligence/feed/',
        help: 'Kosongkan untuk pakai feed AI default (TechCrunch, The Verge, VentureBeat, Google AI).',
      },
      { name: 'maxItems', label: 'Maks berita per thread (default 3)', type: 'number', required: false, placeholder: '3' },
      { name: 'lookbackHours', label: 'Ambil berita berapa jam ke belakang (default 48)', type: 'number', required: false, placeholder: '48' },
      ...REPLIZ_CONFIG_FIELDS,
      OVERRIDE_FIELD,
    ],
  },
];

export function getTemplate(key: string): AutomationTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
