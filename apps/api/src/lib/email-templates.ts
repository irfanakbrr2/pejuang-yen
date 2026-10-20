const APP_URL = 'https://app.pejuangyen.com';
const MAIN_URL = 'https://pejuangyen.com/';
const LOGO_URL = 'https://app.pejuangyen.com/icon-512.png';
const COMMUNITY_WHATSAPP_URL = 'https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP';

function baseLayout(content: string, previewText?: string): string {
  const preview = previewText
    ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;">
  <tr><td style="padding:0 0 24px;">
    <img src="${LOGO_URL}" alt="PejuangYen" width="48" height="48" style="display:block;border:0;outline:none;text-decoration:none;border-radius:12px;margin-bottom:12px;" />
    <p style="margin:0;font-size:13px;line-height:18px;color:#6B7280;font-family:Arial,Helvetica,sans-serif;">PejuangYen</p>
  </td></tr>
  <tr><td style="border-top:1px solid #E5E7EB;padding-top:28px;"></td></tr>
  <tr><td style="padding:8px 0 32px;">
${content}
  </td></tr>
  <tr><td style="border-top:1px solid #E5E7EB;padding:20px 0 0;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      PejuangYen - Lembaga Pelatihan Bahasa Jepang & Persiapan Kerja ke Jepang<br>
      Kamu menerima email ini karena terdaftar di pejuangyen.com.&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#9CA3AF;text-decoration:underline;">Berhenti berlangganan</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`.trim();
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:20px;padding:12px 20px;border-radius:10px;margin:20px 0;font-family:Arial,Helvetica,sans-serif;">${label}</a>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEventDate(date: string, timezone = 'Asia/Jakarta'): string {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

export function appendUtm(url: string, utm: UtmParams): string {
  try {
    const u = new URL(url);
    if (utm.source) u.searchParams.set('utm_source', utm.source);
    if (utm.medium) u.searchParams.set('utm_medium', utm.medium);
    if (utm.campaign) u.searchParams.set('utm_campaign', utm.campaign);
    if (utm.content) u.searchParams.set('utm_content', utm.content);
    return u.toString();
  } catch {
    return url;
  }
}

export interface TransactionalParams {
  greeting: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  detail?: string;
  supportNote?: string;
  previewText?: string;
}

export function transactionalTemplate(p: TransactionalParams): string {
  return baseLayout(`
<h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;font-family:Arial,Helvetica,sans-serif;font-weight:700;">${p.greeting}</h2>
<div style="margin:0 0 16px;color:#4B5563;line-height:1.7;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${p.body}</div>
${ctaButton(p.ctaUrl, p.ctaLabel)}
${p.detail ? `<p style="margin:16px 0 0;font-size:14px;color:#6B7280;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${p.detail}</p>` : ''}
${p.supportNote ? `<p style="margin:12px 0 0;font-size:13px;color:#9CA3AF;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${p.supportNote}</p>` : ''}
  `, p.previewText);
}

export interface PersonalPlainParams {
  opening: string;
  context: string;
  insight: string;
  ctaUrl: string;
  ctaLabel: string;
  closing?: string;
  previewText?: string;
}

export function personalPlainTemplate(p: PersonalPlainParams): string {
  return paragraphEmailTemplate({
    paragraphs: [p.opening, p.context, p.insight],
    ctaUrl: p.ctaUrl,
    ctaLabel: p.ctaLabel,
    closing: p.closing,
    previewText: p.previewText,
  });
}

export interface ParagraphEmailParams {
  paragraphs: string[];
  ctaUrl: string;
  ctaLabel: string;
  closing?: string;
  previewText?: string;
}

export function paragraphEmailTemplate(p: ParagraphEmailParams): string {
  const paragraphs = p.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;color:#374151;line-height:1.75;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${paragraph}</p>`)
    .join('\n');

  return baseLayout(`
${paragraphs}
${ctaButton(p.ctaUrl, p.ctaLabel)}
${p.closing ? `<p style="margin:24px 0 0;color:#6B7280;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${p.closing}</p>` : ''}
  `, p.previewText);
}

export interface NewsletterParams {
  insight: string;
  workflow: string;
  ctaUrl: string;
  ctaLabel: string;
  previewText?: string;
}

export function newsletterTemplate(p: NewsletterParams): string {
  return paragraphEmailTemplate({
    paragraphs: [p.insight, p.workflow],
    ctaUrl: p.ctaUrl,
    ctaLabel: p.ctaLabel,
    previewText: p.previewText,
  });
}

export interface PromoLaunchParams {
  problem: string;
  product: string;
  benefits: string[];
  whoIsItFor: string;
  ctaUrl: string;
  ctaLabel: string;
  bonusNote?: string;
  previewText?: string;
}

export function promoLaunchTemplate(p: PromoLaunchParams): string {
  const benefitList = p.benefits.map((benefit) => `<li style="margin:6px 0;color:#374151;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${benefit}</li>`).join('');
  return baseLayout(`
<p style="margin:0 0 16px;color:#374151;line-height:1.75;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${p.problem}</p>
<h3 style="margin:0 0 8px;color:#111827;font-size:18px;font-family:Arial,Helvetica,sans-serif;">${p.product}</h3>
<ul style="margin:8px 0 16px;padding-left:20px;">${benefitList}</ul>
<p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${p.whoIsItFor}</p>
${p.bonusNote ? `<p style="margin:0 0 16px;padding:12px 16px;background:#F9FAFB;border:1px solid #E5E7EB;font-size:14px;color:#374151;font-family:Arial,Helvetica,sans-serif;">${p.bonusNote}</p>` : ''}
${ctaButton(p.ctaUrl, p.ctaLabel)}
  `, p.previewText);
}

export function emailVerificationTemplate(otp: string): string {
  return transactionalTemplate({
    greeting: `Kode Verifikasi Email: ${otp}`,
    body: `Gunakan kode OTP 6-digit di atas untuk memverifikasi email kamu di PejuangYen.<br><br><strong style="font-size:24px;letter-spacing:4px;display:block;margin:16px 0;">${otp}</strong><br>Kode ini berlaku selama 24 jam. Jangan bagikan kode ini kepada siapa pun.`,
    ctaUrl: `${APP_URL}/verify-email`,
    ctaLabel: 'Verifikasi Sekarang',
    previewText: `Kode verifikasi kamu adalah ${otp}.`,
  });
}

export function welcomeRegistrationEmailHtml(userName: string): string {
  return transactionalTemplate({
    greeting: `Selamat datang, ${userName}!`,
    body: 'Akun PejuangYen kamu sudah aktif. Mulai dari dashboard untuk melihat kelas yang tersedia, memilih topik yang paling relevan, dan menyimpan progres belajar kamu.<br><br>Saran kami: jangan mulai dari semua materi sekaligus. Pilih satu kelas yang paling dekat dengan kebutuhan kamu minggu ini, lalu selesaikan satu modul pertama sampai benar-benar dipraktikkan.',
    ctaUrl: `${APP_URL}/dashboard`,
    ctaLabel: 'Buka Dashboard',
    detail: `Kalau ada pertanyaan atau kendala akses, tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: 'Akun kamu sudah aktif. Mulai dari satu kelas yang paling relevan.',
  });
}

export interface ProgressReminderParams {
  progressContext: string;
  encouragement: string;
  nextStep: string;
  ctaUrl: string;
  ctaLabel: string;
  previewText?: string;
}

export function progressReminderTemplate(p: ProgressReminderParams): string {
  return baseLayout(`
<p style="margin:0 0 16px;color:#374151;line-height:1.75;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${p.progressContext}</p>
<p style="margin:0 0 16px;color:#374151;line-height:1.75;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${p.encouragement}</p>
<p style="margin:0 0 16px;color:#374151;line-height:1.75;font-size:15px;font-family:Arial,Helvetica,sans-serif;"><strong>Langkah selanjutnya:</strong> ${p.nextStep}</p>
${ctaButton(p.ctaUrl, p.ctaLabel)}
  `, p.previewText);
}

export interface SurveyParams {
  userName?: string;
  ctaUrl: string;
  ctaLabel: string;
  previewText?: string;
}

export function surveyTemplate(p: SurveyParams): string {
  const name = p.userName ? ` ${p.userName}` : '';
  return paragraphEmailTemplate({
    paragraphs: [
      `Halo${name}, terima kasih sudah belajar di PejuangYen.`,
      'Kami ingin tahu bagian mana yang paling membantu, bagian mana yang masih membingungkan, dan topik apa yang sebaiknya kami rapikan berikutnya.',
      'Feedback singkat dari kamu akan dipakai untuk memperbaiki kelas, contoh praktik, dan urutan materi agar lebih relevan untuk member berikutnya.',
    ],
    ctaUrl: p.ctaUrl,
    ctaLabel: p.ctaLabel,
    previewText: p.previewText,
  });
}

export function renderPlainText(paragraphs: string[], ctaLabel: string, ctaUrl: string): string {
  return [
    ...paragraphs,
    `${ctaLabel}: ${ctaUrl}`,
    '',
    '---',
    `PejuangYen | Grup WhatsApp komunitas: ${COMMUNITY_WHATSAPP_URL}`,
    'Berhenti berlangganan: {{unsubscribe_url}}',
  ].join('\n\n');
}

export type SequenceEmailKey =
  | 'welcome_free_1' | 'welcome_free_2' | 'welcome_free_3' | 'welcome_free_4' | 'welcome_free_5'
  | 'abandoned_checkout_1' | 'abandoned_checkout_2' | 'abandoned_checkout_3' | 'abandoned_checkout_4'
  | 'post_purchase_1' | 'post_purchase_2' | 'post_purchase_3' | 'post_purchase_4' | 'post_purchase_5'
  | 'inactive_reactivation_1' | 'inactive_reactivation_2' | 'inactive_reactivation_3'
  | 'membership_expiry_7d' | 'membership_expiry_3d' | 'membership_expiry_1d' | 'membership_expired'
  | 'course_reminder_1' | 'course_reminder_2' | 'course_reminder_3'
  | 'webinar_registration_1' | 'webinar_registration_2' | 'webinar_registration_3'
  | 'segment_nurture_1' | 'segment_nurture_2' | 'segment_nurture_3';

export const DEFAULT_SEQUENCE_EMAIL_KEYS: SequenceEmailKey[] = [
  'welcome_free_1', 'welcome_free_2', 'welcome_free_3', 'welcome_free_4', 'welcome_free_5',
  'abandoned_checkout_1', 'abandoned_checkout_2', 'abandoned_checkout_3', 'abandoned_checkout_4',
  'post_purchase_1', 'post_purchase_2', 'post_purchase_3', 'post_purchase_4', 'post_purchase_5',
  'inactive_reactivation_1', 'inactive_reactivation_2', 'inactive_reactivation_3',
  'membership_expiry_7d', 'membership_expiry_3d', 'membership_expiry_1d', 'membership_expired',
  'course_reminder_1', 'course_reminder_2', 'course_reminder_3',
  'webinar_registration_1', 'webinar_registration_2', 'webinar_registration_3',
  'segment_nurture_1', 'segment_nurture_2', 'segment_nurture_3',
];

export interface SequenceEmailContext {
  userName?: string;
  courseName?: string;
  checkoutUrl?: string;
  productName?: string;
  membershipExpiry?: string;
  webinarTitle?: string;
  webinarStartsAt?: string;
  webinarTimezone?: string;
  webinarDetailUrl?: string;
  webinarJoinUrl?: string | null;
  previewText?: string;
  sequenceName?: string;
  stepOrder?: number;
}

export function renderSequenceEmail(
  templateKey: string,
  ctaUrl: string,
  ctx: SequenceEmailContext = {}
): string {
  const firstName = ctx.userName ? ctx.userName.split(' ')[0] : '';
  const greeting = firstName ? `Halo ${firstName},` : 'Halo,';
  const utm = (campaign: string, content: string) =>
    appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign, content });
  const preview = (fallback: string) => ctx.previewText || fallback;
  const product = ctx.productName || ctx.courseName || 'kelas PejuangYen';
  const course = ctx.courseName || 'kelas yang sedang kamu ikuti';
  const checkoutCtaUrl = ctx.checkoutUrl || ctaUrl;
  const webinarTitle = ctx.webinarTitle || 'webinar PejuangYen';
  const webinarDate = ctx.webinarStartsAt ? formatEventDate(ctx.webinarStartsAt, ctx.webinarTimezone || 'Asia/Jakarta') : 'jadwal yang tertera di halaman webinar';
  const webinarCtaUrl = ctx.webinarDetailUrl || ctaUrl;

  const templates: Record<SequenceEmailKey, string> = {
    welcome_free_1: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} selamat datang di PejuangYen.`,
        'Akun kamu sudah aktif. Di sini kamu tidak perlu belajar semuanya sekaligus; kamu bisa mulai dari satu hal yang paling dekat dengan tujuanmu sekarang — belajar bahasa Jepang atau persiapan kerja ke Jepang.',
        'Cara terbaik untuk mulai adalah membuka dashboard, melihat kelas yang tersedia, lalu memilih satu topik yang terasa paling berguna minggu ini.',
        'Setelah itu, selesaikan satu modul pendek dan langsung praktikkan. Progress kecil yang dipakai di situasi nyata biasanya lebih kuat daripada menonton banyak materi tanpa dicoba.',
      ],
      ctaUrl: utm('welcome_free_user', 'email_1'),
      ctaLabel: 'Buka Dashboard',
      closing: 'Tim PejuangYen',
      previewText: preview('Akun kamu sudah aktif. Mulai dari satu kelas yang paling relevan.'),
    }),
    welcome_free_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} banyak orang mulai belajar bahasa Jepang dengan menghafal banyak kosakata sekaligus. Itu tidak salah, tapi sering bikin cepat lelah.`,
        'Yang lebih penting adalah kebiasaan: sedikit tapi rutin. Mulai dari mengenal huruf, lalu pola kalimat dasar, sambil membiasakan telinga dengan percakapan sehari-hari.',
        'Contohnya sederhana. Mulai dari Hiragana & Katakana, lanjut ke tata bahasa dan kosakata N5, lalu latih mendengar dan berbicara sedikit demi sedikit setiap hari.',
        'Di PejuangYen, materi disusun bertahap: dari dasar sampai persiapan ujian (JLPT, JFT-Basic, SSW) dan pembekalan budaya kerja Jepang.',
      ],
      ctaUrl: utm('welcome_free_user', 'email_2'),
      ctaLabel: 'Lihat Materi Belajar',
      closing: 'Tim PejuangYen',
      previewText: preview('Mulai dari kebiasaan rutin, bukan menghafal semuanya sekaligus.'),
    }),
    welcome_free_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} sebelum memilih kelas berikutnya, coba jawab satu pertanyaan: apa tujuan utamamu belajar bahasa Jepang?`,
        'Ada yang fokus lolos ujian (JLPT/JFT-Basic), ada yang menyiapkan ujian SSW untuk bekerja di Jepang, ada juga yang ingin lancar percakapan sehari-hari lebih dulu.',
        'Tidak semua orang perlu jalur belajar yang sama. Kalau jalurnya terlalu umum, kamu bisa menghabiskan waktu untuk hal yang belum tentu kamu butuhkan.',
        'Pilih kelas yang paling dekat dengan tujuan kamu sekarang. Setelah satu tahap terasa dikuasai, baru lanjut ke topik berikutnya.',
      ],
      ctaUrl: utm('welcome_free_user', 'email_3'),
      ctaLabel: 'Pilih Kelas yang Cocok',
      closing: 'Tim PejuangYen',
      previewText: preview('Setiap orang punya tujuan berbeda. Pilih jalur yang paling dekat.'),
    }),
    welcome_free_4: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} ini beberapa contoh cara memakai PejuangYen sesuai kebutuhan nyata.`,
        '<strong>Pemula total</strong>: mulai dari Hiragana & Katakana, lalu kosakata dan tata bahasa dasar N5.',
        '<strong>Persiapan ujian</strong>: fokus latihan soal dan simulasi JLPT N5, JFT-Basic, atau ujian SSW.',
        '<strong>Calon pekerja ke Jepang</strong>: pelajari budaya kerja Jepang, etika, dan persiapan wawancara & CV.',
        'Pilih contoh yang paling mirip dengan kondisi kamu. Dari situ, materi akan terasa lebih mudah diterapkan.',
      ],
      ctaUrl: utm('welcome_free_user', 'email_4'),
      ctaLabel: 'Lihat Kelas yang Cocok',
      closing: 'Tim PejuangYen',
      previewText: preview('Contoh konkret sesuai tujuanmu: dari dasar sampai persiapan kerja ke Jepang.'),
    }),
    welcome_free_5: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} ini email terakhir dari seri welcome PejuangYen.`,
        'Selama beberapa email ini, intinya sederhana: mulai dari kebutuhan nyata, pilih satu workflow, lalu praktikkan sampai terasa manfaatnya.',
        'Kamu tidak perlu menunggu waktu kosong yang panjang. Cukup mulai dari satu modul, satu contoh, atau satu tugas yang memang sedang kamu kerjakan.',
        'Kalau kamu sudah membuka dashboard tapi belum mulai, jadikan hari ini sebagai langkah pertama. Satu sesi belajar yang selesai lebih baik daripada rencana belajar yang terus ditunda.',
      ],
      ctaUrl: utm('welcome_free_user', 'email_5'),
      ctaLabel: 'Mulai Kelas Pertama',
      closing: 'Tim PejuangYen',
      previewText: preview('Seri welcome selesai. Sekarang mulai dari satu modul yang paling relevan.'),
    }),
    abandoned_checkout_1: transactionalTemplate({
      greeting: 'Pembayaran kamu belum selesai',
      body: `Kami melihat kamu sudah memulai pembayaran untuk <strong>${product}</strong>, tapi transaksinya belum selesai.<br><br>Link pembayaran kamu masih bisa digunakan selama payment gateway mengizinkan. Kalau kamu memang masih ingin melanjutkan, gunakan tombol di bawah agar tidak perlu mengulang dari awal.<br><br>Kalau kamu berubah pikiran atau butuh waktu dulu, tidak masalah. Email ini hanya pengingat agar akses yang sudah kamu pilih tidak hilang begitu saja.`,
      ctaUrl: checkoutCtaUrl,
      ctaLabel: 'Lanjutkan Pembayaran',
      supportNote: `Kalau pembayaran sudah dilakukan tetapi akses belum aktif, tanyakan di grup WhatsApp komunitas dan sertakan email akun kamu: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#9CA3AF;text-decoration:underline;">Join grup komunitas</a>.`,
      previewText: preview('Pembayaran kamu belum selesai. Lanjutkan dari link yang sama.'),
    }),
    abandoned_checkout_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} sebelum kamu memutuskan lanjut atau tidak, ada satu hal yang perlu dipastikan.`,
        `Tujuan membeli <strong>${product}</strong> bukan sekadar menambah koleksi kelas. Yang paling penting adalah apakah materi ini bisa membantu satu kebutuhan kamu sekarang.`,
        'Kalau kamu sedang ingin mulai belajar bahasa Jepang dengan terarah — dari dasar sampai persiapan ujian (JLPT/JFT-Basic/SSW) atau kerja ke Jepang — kelas ini bisa jadi titik mulai yang jelas.',
        `Kalau alasan kamu berhenti karena masih ragu, kamu bisa lanjutkan pembayaran lalu mulai dari modul pertama. Kalau ternyata ada kendala teknis, tanyakan di grup WhatsApp komunitas agar tim kami bisa bantu cek: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
      ],
      ctaUrl: checkoutCtaUrl,
      ctaLabel: 'Lanjutkan Pembayaran',
      closing: 'Tim PejuangYen',
      previewText: preview('Pastikan kelas ini cocok dengan kebutuhan kamu sebelum lanjut.'),
    }),
    abandoned_checkout_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} ragu sebelum menyelesaikan pembayaran itu wajar.`,
        'Biasanya keraguannya bukan karena tidak tertarik, tapi karena belum yakin kapan materi itu akan dipakai. Karena itu, pendekatan terbaik setelah membeli adalah langsung memilih satu use case kecil.',
        `Misalnya setelah akses <strong>${product}</strong> aktif, kamu bisa mulai dari modul yang paling dekat dengan pekerjaan minggu ini. Jangan tunggu selesai semua materi untuk praktik.`,
        'Kalau kamu masih ingin melanjutkan, link pembayaran ada di tombol berikut. Setelah pembayaran berhasil, akses akan diproses dari dashboard akun kamu.',
      ],
      ctaUrl: checkoutCtaUrl,
      ctaLabel: 'Selesaikan Pembayaran',
      closing: 'Tim PejuangYen',
      previewText: preview('Mulai dari satu use case kecil setelah akses aktif.'),
    }),
    abandoned_checkout_4: transactionalTemplate({
      greeting: 'Pengingat terakhir untuk pembayaran ini',
      body: `Ini pengingat terakhir terkait pembayaran <strong>${product}</strong> yang belum selesai.<br><br>Kalau kamu belum siap, kamu bisa abaikan email ini. Kami tidak akan terus mengingatkan untuk transaksi yang sama.<br><br>Kalau kamu masih ingin melanjutkan, gunakan tombol di bawah selama link pembayaran masih aktif. Setelah berhasil, akses akan mengikuti data order di akun PejuangYen kamu.`,
      ctaUrl: checkoutCtaUrl,
      ctaLabel: 'Lanjutkan Pembayaran',
      previewText: preview('Pengingat terakhir untuk pembayaran kelas ini.'),
    }),
    post_purchase_1: transactionalTemplate({
      greeting: `Akses kamu sudah aktif${firstName ? `, ${firstName}!` : '!'}`,
      body: `Pembayaran berhasil dan akses untuk <strong>${product}</strong> sudah aktif di akun PejuangYen kamu.<br><br>Mulai dari dashboard, buka kelasnya, lalu cek urutan modul pertama. Kamu tidak perlu menyelesaikan semuanya hari ini; cukup pastikan kamu tahu di mana harus mulai.<br><br>Saran kami: sisihkan 20-30 menit untuk modul awal, catat satu hal yang bisa langsung dipakai, lalu praktikkan di pekerjaan atau aktivitas nyata.`,
      ctaUrl: utm('post_purchase_onboarding', 'email_1'),
      ctaLabel: 'Buka Dashboard',
      detail: 'Akses kelas tersimpan di akun kamu selama status pembelian atau membership masih sesuai.',
      supportNote: `Ada masalah akses? Tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#9CA3AF;text-decoration:underline;">Join grup komunitas</a>.`,
      previewText: preview('Pembayaran berhasil. Akses kamu sudah aktif di dashboard.'),
    }),
    post_purchase_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} sekarang akses sudah aktif. Bagian penting berikutnya adalah membuat ritme belajar yang sederhana.`,
        'Mulai dari modul pertama dan selesaikan sesuai urutan. Kalau ada bagian yang terasa sudah kamu pahami, tetap lihat sebentar untuk memastikan konteksnya nyambung dengan modul berikutnya.',
        'Jangan membuka terlalu banyak kelas sekaligus. Pilih satu, selesaikan satu modul, lalu tulis satu hasil konkret: prompt yang bisa dipakai, workflow yang bisa dicoba, atau ide yang bisa langsung diterapkan.',
        'Dengan cara ini, kamu tidak cuma merasa sudah belajar, tapi benar-benar punya output kecil dari sesi belajar pertama.',
      ],
      ctaUrl: utm('post_purchase_onboarding', 'email_2'),
      ctaLabel: 'Buka Kelas Saya',
      closing: 'Tim PejuangYen',
      previewText: preview('Buat ritme belajar sederhana dari modul pertama.'),
    }),
    post_purchase_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} setelah beberapa hari, coba cek lagi: sudah ada satu hal dari kelas yang kamu praktikkan?`,
        'Menonton materi memang penting, tapi manfaatnya muncul saat kamu mencoba di dokumen, konten, pekerjaan, riset, atau proses yang benar-benar kamu hadapi.',
        'Ambil satu prompt atau workflow dari kelas, lalu pakai untuk tugas nyata hari ini. Hasilnya tidak harus sempurna. Yang penting kamu mulai melihat bagian mana yang membantu dan bagian mana yang perlu disesuaikan.',
        'Kalau belum lanjut sama sekali, mulai dari satu modul pendek. Sepuluh menit yang dipakai praktik lebih berarti daripada menunggu jadwal belajar yang ideal.',
      ],
      ctaUrl: utm('post_purchase_onboarding', 'email_3'),
      ctaLabel: 'Lanjutkan Belajar',
      closing: 'Tim PejuangYen',
      previewText: preview('Ambil satu workflow dari kelas dan praktikkan hari ini.'),
    }),
    post_purchase_4: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} kalau kamu sudah mulai menjalankan materi, langkah berikutnya adalah menghubungkannya dengan kebutuhan yang lebih spesifik.`,
        'Misalnya kamu baru selesai belajar Hiragana, lanjutkan dengan Katakana lalu kosakata dasar. Kalau kamu belajar tata bahasa N5, latih dengan membuat beberapa kalimat sederhana sendiri.',
        'PejuangYen dirancang supaya materi tidak berhenti di teori. Kamu bisa kembali ke dashboard kapan pun untuk mengulang modul, menyalin contoh, atau mencari kelas lain yang melengkapi kebutuhan kamu.',
        'Kalau kamu ingin melihat materi lain, buka halaman utama PejuangYen dan pilih kelas yang paling dekat dengan target berikutnya.',
      ],
      ctaUrl: utm('post_purchase_onboarding', 'email_4'),
      ctaLabel: 'Lihat Materi Lain',
      closing: 'Tim PejuangYen',
      previewText: preview('Hubungkan materi dengan kebutuhan yang lebih spesifik.'),
    }),
    post_purchase_5: surveyTemplate({
      userName: firstName,
      ctaUrl: utm('post_purchase_onboarding', 'email_5'),
      ctaLabel: 'Kirim Feedback',
      previewText: preview('Bantu kami memperbaiki kelas dengan feedback singkat.'),
    }),
    inactive_reactivation_1: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} akun kamu belum terlihat aktif belajar lagi dalam beberapa waktu.`,
        'Kami tidak tahu persis alasannya. Bisa jadi sedang sibuk, belum menemukan kelas yang cocok, atau memang belum ada kebutuhan yang mendesak.',
        'Kalau kamu ingin mulai lagi, tidak perlu mengulang dari awal. Buka PejuangYen, pilih satu topik yang paling relevan dengan kondisi kamu sekarang, lalu mulai dari modul yang paling ringan.',
        'Targetnya cukup kecil: satu modul, satu prompt, atau satu workflow yang bisa kamu pakai minggu ini.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'inactive_user_reactivation', content: 'email_1' }),
      ctaLabel: 'Mulai Lagi dari Sini',
      closing: 'Tim PejuangYen',
      previewText: preview('Akun kamu belum aktif belajar lagi. Mulai ulang dari langkah kecil.'),
    }),
    inactive_reactivation_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} kalau kamu ingin belajar lagi, pilih topik yang paling dekat dengan kebutuhan sekarang.`,
        'Untuk produktivitas kerja, mulai dari materi yang membantu menulis, merangkum, dan menyusun dokumen. Untuk konten, cari contoh workflow ide sampai draft. Untuk bisnis, mulai dari proses operasional atau marketing yang sering berulang.',
        'Tidak perlu memilih jalur yang terdengar paling keren. Pilih yang paling mungkin kamu pakai dalam 7 hari ke depan.',
        'Setelah menemukan topiknya, gunakan satu contoh dari materi sebagai template pribadi. Dengan begitu, sesi belajar berikutnya terasa lebih praktis.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'inactive_user_reactivation', content: 'email_2' }),
      ctaLabel: 'Lihat Topik Belajar',
      closing: 'Tim PejuangYen',
      previewText: preview('Pilih satu topik bahasa Jepang untuk kamu pelajari minggu ini.'),
    }),
    inactive_reactivation_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} ini pengingat terakhir dari seri reaktivasi ini.`,
        'Kalau PejuangYen belum jadi prioritas sekarang, tidak apa-apa. Kamu tetap bisa kembali saat ada kebutuhan yang lebih jelas.',
        'Kalau kamu masih ingin belajar bahasa Jepang dengan cara yang praktis, mulai dari halaman utama atau dashboard. Cari satu kelas yang paling dekat dengan target kamu, lalu lanjutkan dari modul pertama yang relevan.',
        'Kami akan menjaga email berikutnya tetap seperlunya, agar kamu hanya menerima pengingat yang membantu.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'inactive_user_reactivation', content: 'email_3' }),
      ctaLabel: 'Buka PejuangYen',
      closing: 'Tim PejuangYen',
      previewText: preview('Pengingat terakhir untuk mulai lagi saat kamu siap.'),
    }),
    membership_expiry_7d: transactionalTemplate({
      greeting: `Membership kamu hampir berakhir${firstName ? `, ${firstName}` : ''}`,
      body: `Membership PejuangYen kamu akan berakhir sekitar <strong>7 hari lagi</strong>${ctx.membershipExpiry ? `, pada <strong>${ctx.membershipExpiry}</strong>` : ''}.<br><br>Selama membership aktif, kamu tetap bisa mengakses benefit premium sesuai paket yang kamu miliki. Jika ingin belajar tanpa jeda, kamu bisa memperpanjang sebelum tanggal tersebut.<br><br>Progress belajar kamu tetap tersimpan di akun. Email ini hanya membantu kamu menghindari akses yang terputus tiba-tiba.`,
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'membership_expiry', content: '7d_before' }),
      ctaLabel: 'Perpanjang Membership',
      previewText: preview('Membership kamu hampir berakhir. Perpanjang agar akses tidak terputus.'),
    }),
    membership_expiry_3d: transactionalTemplate({
      greeting: '3 hari lagi membership kamu berakhir',
      body: `${greeting} membership PejuangYen kamu akan berakhir dalam sekitar <strong>3 hari</strong>${ctx.membershipExpiry ? `, pada <strong>${ctx.membershipExpiry}</strong>` : ''}.<br><br>Jika kamu masih memakai kelas premium, bonus, atau materi member, ini waktu yang aman untuk memperpanjang agar akses tetap lancar.<br><br>Kalau kamu belum ingin memperpanjang, progress dan akun kamu tetap ada. Kamu bisa kembali saat siap.`,
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'membership_expiry', content: '3d_before' }),
      ctaLabel: 'Perpanjang Sekarang',
      previewText: preview('Tiga hari lagi membership kamu berakhir.'),
    }),
    membership_expiry_1d: transactionalTemplate({
      greeting: 'Besok adalah hari terakhir membership aktif',
      body: `${greeting} berdasarkan data membership, besok adalah perkiraan hari terakhir akses premium kamu${ctx.membershipExpiry ? ` (<strong>${ctx.membershipExpiry}</strong>)` : ''}.<br><br>Perpanjang hari ini jika kamu ingin tetap membuka kelas dan benefit premium tanpa jeda.<br><br>Setelah membership berakhir, akses ke benefit premium dapat berubah sesuai status akun dan produk yang pernah kamu beli.`,
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'membership_expiry', content: '1d_before' }),
      ctaLabel: 'Perpanjang Hari Ini',
      previewText: preview('Besok adalah hari terakhir membership aktif.'),
    }),
    membership_expired: transactionalTemplate({
      greeting: 'Membership kamu sudah berakhir',
      body: `${greeting} membership PejuangYen kamu sudah berakhir.<br><br>Kamu tetap bisa login dan melihat akun kamu. Akses ke konten premium mengikuti status membership atau produk yang sudah kamu miliki secara terpisah.<br><br>Kalau ingin kembali mendapatkan benefit premium, kamu bisa mengaktifkan membership lagi dari halaman PejuangYen.`,
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'membership_expiry', content: 'after_expiry' }),
      ctaLabel: 'Aktifkan Membership Lagi',
      previewText: preview('Membership kamu sudah berakhir. Kamu bisa mengaktifkannya lagi kapan saja.'),
    }),
    course_reminder_1: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} kamu sudah mulai belajar di <strong>${course}</strong>, tapi progresnya belum selesai.`,
        'Ini normal. Banyak orang berhenti sebentar karena jadwal padat atau karena belum menemukan waktu praktik.',
        'Supaya tidak terasa berat, lanjutkan dari satu modul saja. Setelah selesai, ambil satu contoh dari materi dan coba pakai untuk tugas nyata.',
        'Kamu tidak perlu mengejar selesai cepat. Yang penting ritmenya hidup lagi.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'course_progress_reminder', content: 'email_1' }),
      ctaLabel: 'Lanjutkan Belajar',
      closing: 'Tim PejuangYen',
      previewText: preview('Kamu sudah mulai. Lanjutkan dari satu modul kecil.'),
    }),
    course_reminder_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} kalau kamu belum lanjut karena waktu terasa sempit, coba ubah targetnya.`,
        'Jangan targetkan menyelesaikan banyak modul. Targetkan 10-15 menit untuk membuka materi, melihat satu contoh, dan menandai bagian yang ingin dicoba.',
        'Kalau materinya terasa kurang sesuai dengan kebutuhan kamu sekarang, pilih modul yang paling dekat dengan tujuanmu. Belajar bahasa Jepang akan lebih mudah saat langsung dipraktikkan sedikit demi sedikit.',
        'Mulai lagi dari titik terakhir. Progress kecil tetap progress.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'course_progress_reminder', content: 'email_2' }),
      ctaLabel: 'Buka Kelas Sekarang',
      closing: 'Tim PejuangYen',
      previewText: preview('Cukup 10-15 menit untuk menghidupkan progres belajar lagi.'),
    }),
    course_reminder_3: progressReminderTemplate({
      progressContext: `${greeting} ini pengingat terakhir untuk <strong>${course}</strong> yang belum selesai.`,
      encouragement: 'Kamu sudah menginvestasikan waktu untuk mulai. Agar tidak berhenti di tengah jalan, ambil satu bagian yang paling relevan dan jadikan output kecil: prompt, checklist, draft, atau workflow.',
      nextStep: 'Buka kelas, pilih modul yang paling dekat dengan kebutuhan minggu ini, lalu praktikkan satu contoh saja.',
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'course_progress_reminder', content: 'email_3' }),
      ctaLabel: 'Selesaikan Satu Modul',
      previewText: preview('Ambil satu output kecil dari kelas yang belum selesai.'),
    }),
    webinar_registration_1: transactionalTemplate({
      greeting: `Kursi webinar kamu sudah aman${firstName ? `, ${firstName}` : ''}`,
      body: `Kamu sudah terdaftar untuk <strong>${escapeHtml(webinarTitle)}</strong>.<br><br><strong>Jadwal:</strong> ${escapeHtml(webinarDate)}<br><br>Agar sesi ini lebih berguna, coba tulis satu pertanyaan atau satu workflow AI yang ingin kamu perbaiki. Dengan begitu, saat webinar berlangsung kamu bisa langsung mengaitkan materinya dengan kebutuhan nyata.`,
      ctaUrl: appendUtm(webinarCtaUrl, { source: 'email', medium: 'lifecycle', campaign: 'webinar_registration_followup', content: 'email_1' }),
      ctaLabel: 'Lihat Detail Webinar',
      detail: ctx.webinarJoinUrl ? 'Link join sudah tersedia di halaman detail webinar.' : 'Link join akan tersedia dari halaman detail webinar saat waktunya mendekati sesi.',
      previewText: preview('Siapkan satu pertanyaan supaya sesi webinar lebih relevan untuk kamu.'),
    }),
    webinar_registration_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} sebelum mengikuti <strong>${escapeHtml(webinarTitle)}</strong>, pilih satu konteks yang ingin kamu bawa ke sesi.`,
        'Contohnya: membuat konten lebih cepat, merapikan riset, menyusun penawaran, membalas customer, atau membuat workflow kerja yang lebih ringan.',
        'Webinar akan terasa lebih bernilai kalau kamu tidak datang dengan pertanyaan terlalu umum. Datanglah dengan satu masalah spesifik, lalu lihat bagian mana dari materi yang bisa langsung kamu pakai.',
        `Jadwal webinar: <strong>${escapeHtml(webinarDate)}</strong>.`,
      ],
      ctaUrl: appendUtm(webinarCtaUrl, { source: 'email', medium: 'lifecycle', campaign: 'webinar_registration_followup', content: 'email_2' }),
      ctaLabel: 'Cek Detail Webinar',
      closing: 'Tim PejuangYen',
      previewText: preview('Tulis satu workflow AI yang ingin kamu perbaiki saat webinar.'),
    }),
    webinar_registration_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} satu cara sederhana supaya webinar tidak berhenti jadi catatan adalah menyiapkan use case sebelum sesi dimulai.`,
        'Ambil satu pekerjaan atau aktivitas yang sedang kamu hadapi minggu ini. Tulis kondisi awalnya, hasil yang kamu mau, dan bagian yang paling memakan waktu.',
        'Saat webinar berlangsung, cocokkan materi dengan use case itu. Setelah selesai, kamu punya langkah pertama yang bisa langsung dicoba, bukan hanya daftar ide.',
        `Kalau perlu, buka lagi halaman <strong>${escapeHtml(webinarTitle)}</strong> untuk melihat jadwal dan informasi akses terbaru.`,
      ],
      ctaUrl: appendUtm(webinarCtaUrl, { source: 'email', medium: 'lifecycle', campaign: 'webinar_registration_followup', content: 'email_3' }),
      ctaLabel: 'Buka Halaman Webinar',
      closing: 'Tim PejuangYen',
      previewText: preview('Datang dengan satu masalah spesifik agar insight webinar langsung bisa dipakai.'),
    }),
    segment_nurture_1: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} berdasarkan informasi profil atau minat yang kamu pilih, kami ingin membantu kamu mulai dari materi yang lebih relevan.`,
        'Kalau tujuanmu bekerja di Jepang, fokuslah pada kosakata kerja, percakapan, dan budaya kerja. Kalau untuk lolos ujian, fokuslah pada latihan soal dan simulasi (JLPT/JFT-Basic/SSW).',
        'PejuangYen tidak perlu dipakai dengan satu jalur yang kaku. Pilih topik yang paling dekat dengan kebutuhan kamu sekarang, lalu gunakan contoh di kelas sebagai template awal.',
        'Setelah satu workflow terasa membantu, kamu bisa memperluas ke area lain.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'segment_based_nurturing', content: 'email_1' }),
      ctaLabel: 'Lihat Kelas Relevan',
      closing: 'Tim PejuangYen',
      previewText: preview('Mulai dari materi yang paling relevan dengan profil kamu.'),
    }),
    segment_nurture_2: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} coba satu latihan bahasa Jepang ringan hari ini.`,
        'Ambil 5 kosakata atau 1 pola kalimat yang baru kamu pelajari, lalu buat kalimat sederhana sendiri dan ucapkan dengan suara. Kalau bisa, rekam dan dengarkan lagi pelafalanmu.',
        'Contoh prompt: "Bantu saya merapikan bahan ini menjadi draft yang lebih jelas. Pertahankan poin penting, hilangkan pengulangan, dan beri struktur heading."',
        'Perhatikan mana yang masih terasa ragu, lalu ulangi. Tujuannya bukan langsung sempurna, tapi membuat belajar jadi kebiasaan kecil setiap hari.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'segment_based_nurturing', content: 'email_2' }),
      ctaLabel: 'Pelajari Workflow Lain',
      closing: 'Tim PejuangYen',
      previewText: preview('Coba latihan ringan dari materi bahasa Jepang yang baru kamu pelajari.'),
    }),
    segment_nurture_3: paragraphEmailTemplate({
      paragraphs: [
        `${greeting} ini email terakhir dari seri rekomendasi awal ini.`,
        'Kalau kamu sudah mencoba satu workflow, simpan bagian yang berhasil sebagai template. Kalau belum, pilih satu materi yang paling dekat dengan kebutuhan minggu ini dan mulai dari contoh paling sederhana.',
        'Belajar bahasa Jepang yang efektif biasanya tidak terasa seperti mengejar semua hal baru. Rasanya lebih seperti memperbaiki satu bagian kecil, lalu mengulangnya sampai menjadi kebiasaan.',
        'Buka PejuangYen kapan pun kamu siap melanjutkan. Mulai dari satu kelas, satu modul, dan satu output nyata.',
      ],
      ctaUrl: appendUtm(ctaUrl, { source: 'email', medium: 'lifecycle', campaign: 'segment_based_nurturing', content: 'email_3' }),
      ctaLabel: 'Buka Rekomendasi Kelas',
      closing: 'Tim PejuangYen',
      previewText: preview('Simpan satu workflow yang berhasil, lalu lanjutkan dari sana.'),
    }),
  };

  const html = templates[templateKey as SequenceEmailKey];
  return html || paragraphEmailTemplate({
    paragraphs: [
      'Halo,',
      'Ini pesan dari PejuangYen terkait aktivitas belajar atau akun kamu.',
      'Buka PejuangYen untuk melanjutkan dari halaman yang paling relevan.',
    ],
    ctaUrl,
    ctaLabel: 'Buka PejuangYen',
  });
}

export function affiliateWelcomeEmailHtml(name: string, publicLink: string): string {
  return transactionalTemplate({
    greeting: `Selamat, ${name}! Kamu resmi menjadi Affiliate PejuangYen.`,
    body: `Link affiliate kamu sudah aktif:<br><strong style="font-family:monospace;font-size:14px;line-height:1.7;word-break:break-all;">${publicLink}</strong><br><br>Mulai sekarang kamu bisa membagikan link ini ke audience yang relevan. Setiap pembelian valid melalui link kamu akan tercatat di dashboard affiliate.<br><br>Gunakan dashboard untuk memantau referral, status komisi, dan performa promosi. Pastikan promosi tetap jujur: jelaskan manfaat PejuangYen sesuai pengalaman dan kebutuhan audience kamu.`,
    ctaUrl: `${APP_URL}/affiliate`,
    ctaLabel: 'Buka Dashboard Affiliate',
    detail: 'Komisi mengikuti aturan program affiliate yang berlaku di PejuangYen.',
    previewText: 'Link affiliate kamu sudah aktif. Mulai bagikan ke audience yang relevan.',
  });
}

export function commissionEarnedEmailHtml(name: string, commissionAmount: number, commissionRate: number): string {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(commissionAmount);
  return transactionalTemplate({
    greeting: `${name}, kamu baru mendapatkan komisi.`,
    body: `Ada pembelian yang tercatat menggunakan referral kamu. Estimasi komisi yang masuk adalah <strong>${formatted}</strong> (${commissionRate}% dari nilai transaksi).<br><br>Detail transaksi dan status komisi bisa kamu cek dari dashboard affiliate. Jika statusnya masih menunggu proses, artinya sistem sedang mengikuti alur validasi dan jadwal pembayaran yang berlaku.<br><br>Terima kasih sudah membantu memperkenalkan PejuangYen ke orang yang tepat.`,
    ctaUrl: `${APP_URL}/affiliate`,
    ctaLabel: 'Cek Dashboard Affiliate',
    detail: 'Komisi diproses sesuai jadwal dan kebijakan affiliate PejuangYen.',
    previewText: `Komisi ${formatted} tercatat dari referral kamu.`,
  });
}

export function commissionPaidEmailHtml(params: {
  name: string;
  commissionAmount: number;
  productName?: string | null;
  orderNumber?: string | null;
  paidAt: string;
}): string {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(params.commissionAmount);
  const paidDate = new Date(params.paidAt).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const detailRows = [
    params.productName ? `Produk: <strong>${escapeHtml(params.productName)}</strong>` : '',
    params.orderNumber ? `Order: <strong>${escapeHtml(params.orderNumber)}</strong>` : '',
    `Tanggal dibayar: <strong>${paidDate}</strong>`,
  ].filter(Boolean).join('<br>');

  return transactionalTemplate({
    greeting: `${escapeHtml(params.name)}, komisi kamu sudah dibayar.`,
    body: `Pembayaran komisi affiliate sebesar <strong>${formatted}</strong> sudah ditandai selesai oleh admin PejuangYen.<br><br>${detailRows}<br><br>Terima kasih sudah bantu mempromosikan PejuangYen ke audience yang tepat.`,
    ctaUrl: `${APP_URL}/affiliate`,
    ctaLabel: 'Cek Dashboard Affiliate',
    detail: 'Jika ada perbedaan data payout, hubungi admin PejuangYen dengan menyertakan nomor order terkait.',
    previewText: `Komisi ${formatted} sudah ditandai dibayar.`,
  });
}

export function webinarRegistrationEmailHtml(params: {
  name: string;
  webinarTitle: string;
  startsAt: string;
  timezone?: string;
  detailUrl: string;
  couponCode: string;
}): string {
  const title = escapeHtml(params.webinarTitle);
  const dateLabel = formatEventDate(params.startsAt, params.timezone);
  const coupon = escapeHtml(params.couponCode);
  return transactionalTemplate({
    greeting: `${escapeHtml(params.name)}, kamu sudah terdaftar.`,
    body: `Registrasi kamu untuk webinar gratis <strong>${title}</strong> sudah tercatat.<br><br><strong>Jadwal:</strong> ${dateLabel}<br><strong>Kode kupon/referral:</strong> <span style="font-family:monospace;font-weight:700;">${coupon}</span><br><br>Buka halaman detail event untuk melihat status registrasi, informasi event, dan link join saat tersedia.`,
    ctaUrl: params.detailUrl,
    ctaLabel: 'Buka Detail Webinar',
    detail: `Simpan email ini sebagai pengingat event. Kalau ada kendala akses, tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: `Registrasi webinar ${params.webinarTitle} sudah tercatat.`,
  });
}

export function webinarReminderEmailHtml(params: {
  name: string;
  webinarTitle: string;
  startsAt: string;
  timezone?: string;
  detailUrl: string;
  joinUrl?: string | null;
  reminderType: 'day_minus_1' | 'day_of';
}): string {
  const title = escapeHtml(params.webinarTitle);
  const dateLabel = formatEventDate(params.startsAt, params.timezone || 'Asia/Jakarta');
  const isDayOf = params.reminderType === 'day_of';
  const ctaUrl = isDayOf && params.joinUrl ? params.joinUrl : params.detailUrl;

  return transactionalTemplate({
    greeting: isDayOf
      ? `${escapeHtml(params.name)}, webinar berlangsung hari ini.`
      : `${escapeHtml(params.name)}, webinar kamu besok.`,
    body: isDayOf
      ? `Pengingat singkat: webinar gratis <strong>${title}</strong> berlangsung hari ini.<br><br><strong>Jadwal:</strong> ${dateLabel}<br><br>Siapkan catatan, koneksi yang stabil, dan pertanyaan spesifik yang ingin kamu bawa ke sesi. ${params.joinUrl ? 'Gunakan tombol di bawah untuk masuk ke room saat waktunya tiba.' : 'Buka detail webinar untuk melihat informasi terbaru dan link join saat tersedia.'}`
      : `Besok kamu terdaftar di webinar gratis <strong>${title}</strong>.<br><br><strong>Jadwal:</strong> ${dateLabel}<br><br>Saran kecil: luangkan 5 menit hari ini untuk menulis 1 masalah utama yang ingin kamu pecahkan dengan AI, supaya saat webinar kamu bisa langsung menangkap bagian yang paling relevan.`,
    ctaUrl,
    ctaLabel: isDayOf && params.joinUrl ? 'Masuk ke Webinar' : 'Buka Detail Webinar',
    detail: `Kalau ada kendala akses, cek halaman detail webinar atau tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: isDayOf
      ? `Webinar ${params.webinarTitle} berlangsung hari ini.`
      : `Reminder H-1 untuk webinar ${params.webinarTitle}.`,
  });
}

export function streakReminderEmailHtml(params: {
  name: string;
  streakDays: number;
}): string {
  const name = escapeHtml(params.name);
  return transactionalTemplate({
    greeting: `${name}, streak ${params.streakDays} harimu hampir putus 🔥`,
    body: `Kamu sudah belajar <strong>${params.streakDays} hari berturut-turut</strong> — itu pencapaian yang tidak semua orang bisa.<br><br>Tapi hari ini kamu belum aktif. Kalau hari ini terlewat, streak-mu kembali ke nol.<br><br>Cukup 5 menit: buka 1 materi, atau lakukan check-in harian. Konsistensi kecil setiap hari mengalahkan belajar maraton sekali seminggu.`,
    ctaUrl: `${APP_URL}/dashboard?utm_source=email&utm_medium=lifecycle&utm_campaign=streak_reminder`,
    ctaLabel: 'Lanjutkan Streak Sekarang',
    detail: `Streak terpanjangmu akan tetap tercatat, tapi momentum harian adalah kunci pertumbuhan skill AI-mu.`,
    previewText: `Jangan biarkan streak ${params.streakDays} harimu putus hari ini.`,
  });
}

export function webinarAffiliateLeadEmailHtml(params: {
  affiliateName: string;
  registrantName: string;
  webinarTitle: string;
  startsAt: string;
  timezone?: string;
  dashboardUrl: string;
}): string {
  const registrant = escapeHtml(params.registrantName);
  const title = escapeHtml(params.webinarTitle);
  const dateLabel = formatEventDate(params.startsAt, params.timezone);
  return transactionalTemplate({
    greeting: `${escapeHtml(params.affiliateName)}, ada lead webinar baru dari link kamu.`,
    body: `<strong>${registrant}</strong> baru mendaftar webinar gratis <strong>${title}</strong> melalui link affiliate kamu.<br><br><strong>Jadwal event:</strong> ${dateLabel}<br><br>Lead ini belum menghasilkan komisi karena webinarnya gratis, tapi attribution-nya tercatat untuk membantu tracking campaign dan event berikutnya.`,
    ctaUrl: params.dashboardUrl,
    ctaLabel: 'Cek Dashboard Affiliate',
    detail: 'Untuk menjaga privasi peserta, email ini hanya menampilkan nama pendaftar, bukan email atau nomor WhatsApp.',
    previewText: `${registrant} mendaftar webinar dari link affiliate kamu.`,
  });
}

export function registrationAffiliateLeadEmailHtml(params: {
  affiliateName: string;
  registrantName: string;
  dashboardUrl: string;
}): string {
  const registrant = escapeHtml(params.registrantName);
  return transactionalTemplate({
    greeting: `${escapeHtml(params.affiliateName)}, ada akun baru dari link kamu!`,
    body: `<strong>${registrant}</strong> baru saja membuat akun di PejuangYen melalui link affiliate kamu.<br><br>Mereka sudah masuk ke platform — kalau nanti order membership atau kelas, kamu akan otomatis dapat komisi sesuai program affiliate.`,
    ctaUrl: params.dashboardUrl,
    ctaLabel: 'Cek Dashboard Affiliate',
    detail: 'Untuk menjaga privasi pengguna, email ini hanya menampilkan nama pendaftar.',
    previewText: `${registrant} buat akun dari link affiliate kamu.`,
  });
}

export function membershipActivatedEmailHtml(name: string, planName: string, expiresAt: string | null): string {
  const expiry = expiresAt
    ? `berlaku hingga <strong>${new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>`
    : 'berlaku seumur hidup';
  return transactionalTemplate({
    greeting: `${name}, membership kamu sudah aktif.`,
    body: `Membership <strong>${planName}</strong> kamu sudah aktif dan ${expiry}.<br><br>Kamu sekarang bisa membuka benefit premium sesuai paket membership, termasuk kelas dan materi yang tersedia untuk member PejuangYen.<br><br>Mulai dari dashboard, pilih kelas yang paling relevan, lalu lanjutkan dengan satu modul pertama. Jika ada akses yang belum muncul, tanyakan di grup WhatsApp komunitas agar bisa dicek.`,
    ctaUrl: `${APP_URL}/dashboard`,
    ctaLabel: 'Buka Dashboard',
    detail: `Butuh bantuan? Tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: `Membership ${planName} kamu sudah aktif.`,
  });
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

type OrderEmailAddon = {
  label: string;
  amount: number;
};

function orderDetailsHtml(orderNumber: string, productName: string, productAmount: number, paymentAdminFee: number, totalAmount: number, addons: OrderEmailAddon[] = []): string {
  const addonRows = addons
    .map((addon) => `
  <tr>
    <td style="padding:12px 14px;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;">${escapeHtml(addon.label)}</td>
    <td style="padding:12px 14px;color:#111827;font-size:13px;text-align:right;border-top:1px solid #E5E7EB;">${formatIdr(addon.amount)}</td>
  </tr>`)
    .join('');

  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:12px 14px;background:#F9FAFB;color:#6B7280;font-size:13px;">Nomor Order</td>
    <td style="padding:12px 14px;background:#F9FAFB;color:#111827;font-size:13px;text-align:right;font-weight:700;">${orderNumber}</td>
  </tr>
  <tr>
    <td style="padding:12px 14px;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;">Produk</td>
    <td style="padding:12px 14px;color:#111827;font-size:13px;text-align:right;border-top:1px solid #E5E7EB;">${productName}</td>
  </tr>
  <tr>
    <td style="padding:12px 14px;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;">Harga Produk</td>
    <td style="padding:12px 14px;color:#111827;font-size:13px;text-align:right;border-top:1px solid #E5E7EB;">${formatIdr(productAmount)}</td>
  </tr>
  ${addonRows}
  <tr>
    <td style="padding:12px 14px;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;">Biaya Admin</td>
    <td style="padding:12px 14px;color:#111827;font-size:13px;text-align:right;border-top:1px solid #E5E7EB;">${formatIdr(paymentAdminFee)}</td>
  </tr>
  <tr>
    <td style="padding:12px 14px;background:#F9FAFB;color:#111827;font-size:14px;border-top:1px solid #E5E7EB;font-weight:700;">Total</td>
    <td style="padding:12px 14px;background:#F9FAFB;color:#111827;font-size:14px;text-align:right;border-top:1px solid #E5E7EB;font-weight:700;">${formatIdr(totalAmount)}</td>
  </tr>
</table>`;
}

export function paymentCreatedEmailHtml(params: {
  name: string;
  orderNumber: string;
  productName: string;
  productAmount: number;
  paymentAdminFee: number;
  totalAmount: number;
  paymentUrl: string;
  addons?: OrderEmailAddon[];
}): string {
  const details = orderDetailsHtml(params.orderNumber, params.productName, params.productAmount, params.paymentAdminFee, params.totalAmount, params.addons);
  return transactionalTemplate({
    greeting: `${params.name}, pembayaran kamu sudah dibuat.`,
    body: `Kami sudah membuat invoice pembayaran untuk pesanan kamu. Gunakan tombol di bawah untuk melanjutkan ke halaman pembayaran.<br><br>${details}<br>Kalau kamu sempat menutup halaman checkout, kamu tetap bisa memakai tombol di email ini selama invoice masih aktif. Setelah pembayaran berhasil, sistem akan memproses akses ke akun PejuangYen kamu secara otomatis.`,
    ctaUrl: params.paymentUrl,
    ctaLabel: 'Lanjutkan Pembayaran',
    detail: `Pastikan email akun yang digunakan adalah email PejuangYen kamu. Jika pembayaran sudah berhasil tetapi akses belum muncul, tanyakan di grup WhatsApp komunitas dan sertakan nomor order <strong>${params.orderNumber}</strong>: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: `Invoice ${params.orderNumber} sudah dibuat. Total pembayaran ${formatIdr(params.totalAmount)}.`,
  });
}

export function paymentSucceededEmailHtml(params: {
  name: string;
  orderNumber: string;
  productName: string;
  productAmount: number;
  paymentAdminFee: number;
  totalAmount: number;
  orderType: 'course' | 'membership' | string;
  accessDetail?: string;
  addons?: OrderEmailAddon[];
  hasPrivateConsultation?: boolean;
}): string {
  const details = orderDetailsHtml(params.orderNumber, params.productName, params.productAmount, params.paymentAdminFee, params.totalAmount, params.addons);
  const ctaUrl = params.orderType === 'course' ? `${APP_URL}/my-classes` : `${APP_URL}/dashboard`;
  const ctaLabel = params.orderType === 'course' ? 'Buka Kelas Saya' : 'Buka Dashboard';
  const accessCopy = params.accessDetail || 'Akses kamu sudah diproses ke akun PejuangYen yang melakukan pembayaran.';
  const privateConsultationCopy = params.hasPrivateConsultation
    ? '<br><br>Karena kamu mengambil sesi 1:1 private, tim akan menghubungi WhatsApp kamu untuk konfirmasi topik dan jadwal.'
    : '';
  return transactionalTemplate({
    greeting: `${params.name}, pembayaran kamu berhasil.`,
    body: `Terima kasih. Pembayaran untuk pesanan kamu sudah kami terima dan status order sudah diperbarui menjadi berhasil.<br><br>${details}<br>${accessCopy}${privateConsultationCopy}<br><br>Kamu bisa membuka dashboard PejuangYen untuk mulai mengakses kelas atau benefit yang sesuai dengan pesanan ini.`,
    ctaUrl,
    ctaLabel,
    detail: `Simpan email ini sebagai bukti pembayaran. Jika ada kendala akses, tanyakan di grup WhatsApp komunitas dan sertakan nomor order <strong>${params.orderNumber}</strong>: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup komunitas</a>.`,
    previewText: `Pembayaran ${params.orderNumber} berhasil. Total ${formatIdr(params.totalAmount)}.`,
  });
}

export function paymentFailedEmailHtml(name: string): string {
  return transactionalTemplate({
    greeting: `${name}, pembayaran belum berhasil.`,
    body: 'Pembayaran kamu belum berhasil diproses. Ini bisa terjadi karena transaksi kedaluwarsa, saldo atau limit tidak cukup, koneksi terputus, atau metode pembayaran dibatalkan sebelum selesai.<br><br>Kalau kamu masih ingin melanjutkan, buka kembali halaman pembelian dan buat pembayaran baru. Pastikan data email akun sama agar akses bisa diproses ke akun yang benar.<br><br>Jika kamu merasa sudah membayar tetapi akses belum aktif, tanyakan di grup WhatsApp komunitas dengan email akun dan bukti pembayaran.',
    ctaUrl: MAIN_URL,
    ctaLabel: 'Buka PejuangYen',
    detail: `Untuk kendala pembayaran, kamu juga bisa menghubungi penyedia pembayaran yang digunakan atau bertanya di grup komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#111827;text-decoration:underline;">Join grup WhatsApp</a>.`,
    previewText: 'Pembayaran belum berhasil. Kamu bisa mencoba lagi dari halaman pembelian.',
  });
}

// ─── Tool Credit Emails ───────────────────────────────────────────────────────

export function creditOrderCreatedEmailHtml(params: {
  name: string;
  orderNumber: string;
  packageName: string;
  credits: number;
  productAmount: number;
  adminFee: number;
  totalAmount: number;
  paymentUrl: string;
}): string {
  const details = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #E5E7EB;">
  <tr><td style="padding:10px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;font-family:Arial,Helvetica,sans-serif;">Detail Pesanan</td></tr>
  <tr>
    <td style="padding:12px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:14px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;">Nomor Pesanan</td><td align="right" style="font-size:14px;font-weight:600;color:#111827;font-family:Arial,Helvetica,sans-serif;">${params.orderNumber}</td></tr>
        <tr><td style="font-size:14px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;">Paket</td><td align="right" style="font-size:14px;font-weight:600;color:#111827;font-family:Arial,Helvetica,sans-serif;">${params.packageName} (${params.credits} kredit)</td></tr>
        <tr><td style="font-size:14px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;">Harga</td><td align="right" style="font-size:14px;color:#374151;font-family:Arial,Helvetica,sans-serif;">${formatIdr(params.productAmount)}</td></tr>
        <tr><td style="font-size:14px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;">Biaya Admin</td><td align="right" style="font-size:14px;color:#374151;font-family:Arial,Helvetica,sans-serif;">${formatIdr(params.adminFee)}</td></tr>
        <tr><td style="border-top:1px solid #E5E7EB;padding:8px 0 3px;font-size:14px;font-weight:700;color:#111827;font-family:Arial,Helvetica,sans-serif;">Total</td><td align="right" style="border-top:1px solid #E5E7EB;padding:8px 0 3px;font-size:14px;font-weight:700;color:#111827;font-family:Arial,Helvetica,sans-serif;">${formatIdr(params.totalAmount)}</td></tr>
      </table>
    </td>
  </tr>
</table>`;

  return transactionalTemplate({
    greeting: `${params.name}, pesanan kredit kamu sudah dibuat.`,
    body: `Kamu memesan <strong>${params.packageName} (${params.credits} kredit)</strong> untuk AI Tools PejuangYen. Selesaikan pembayaran sebelum 24 jam agar pesanan tidak kedaluwarsa.<br><br>${details}`,
    ctaUrl: params.paymentUrl,
    ctaLabel: 'Bayar Sekarang',
    detail: `Link pembayaran berlaku <strong>24 jam</strong>. Jika pesanan kedaluwarsa, kamu bisa membuat pesanan baru dari halaman Beli Kredit.`,
    previewText: `Pesanan ${params.credits} kredit tools. Selesaikan pembayaran ${formatIdr(params.totalAmount)}.`,
  });
}

export function creditPurchaseSuccessEmailHtml(params: {
  name: string;
  orderNumber: string;
  packageName: string;
  credits: number;
  totalAmount: number;
  newBalance: number;
}): string {
  return transactionalTemplate({
    greeting: `${params.name}, kredit kamu berhasil ditambahkan!`,
    body: `<strong>${params.credits} kredit</strong> dari paket <strong>${params.packageName}</strong> sudah masuk ke akun kamu. Saldo kredit kamu sekarang: <strong>${params.newBalance} kredit</strong>.<br><br>Gunakan kredit untuk mengakses AI Tools di PejuangYen, termasuk Web Prompt Generator dan tools lainnya yang akan terus bertambah.`,
    ctaUrl: `${APP_URL}/tools`,
    ctaLabel: 'Mulai Gunakan Tools',
    detail: `Nomor pesanan: <strong>${params.orderNumber}</strong> | Total dibayar: <strong>${formatIdr(params.totalAmount)}</strong>. Simpan email ini sebagai bukti pembelian kredit.`,
    previewText: `${params.credits} kredit berhasil masuk. Saldo kamu sekarang ${params.newBalance} kredit.`,
  });
}
