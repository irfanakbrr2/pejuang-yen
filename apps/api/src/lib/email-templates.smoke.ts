import {
  DEFAULT_SEQUENCE_EMAIL_KEYS,
  renderSequenceEmail,
} from './email-templates';

const sampleContext = {
  userName: 'Irfan Akbar',
  courseName: 'Persiapan JLPT N5',
  productName: 'Kelas Persiapan JLPT N5',
  checkoutUrl: 'https://app.pejuangyen.com/checkout/sample',
  membershipExpiry: '31 Desember 2026',
};

for (const key of DEFAULT_SEQUENCE_EMAIL_KEYS) {
  const html = renderSequenceEmail(key, 'https://pejuangyen.com/', sampleContext);

  if (!html.includes('<!DOCTYPE html>')) {
    throw new Error(`${key} did not render a complete HTML email`);
  }

  if (html.includes('Ini pesan dari PejuangYen terkait aktivitas belajar atau akun kamu.')) {
    throw new Error(`${key} fell back to the generic email template`);
  }

  if (/\b(lo|gue|gw|gua)\b/i.test(html)) {
    throw new Error(`${key} still contains informal lo/gue-style copy`);
  }

  if (!html.includes('{{unsubscribe_url}}')) {
    throw new Error(`${key} is missing the unsubscribe placeholder`);
  }
}
