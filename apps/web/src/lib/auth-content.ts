import type { Testimonial } from "@/components/ui/auth-shell";

// Konten bersama untuk semua halaman auth (login, register, forgot, reset, verify).
export const AUTH_HERO_IMAGE =
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=2160&q=80";

export const AUTH_TESTIMONIALS: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Rina Pertiwi",
    handle: "@rina_ssw",
    text: "Berkat PejuangYen aku lolos ujian SSW dan sekarang kerja di Osaka. Materinya jelas dan pendampingannya total.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/52.jpg",
    name: "Andi Saputra",
    handle: "@andi_kaigo",
    text: "Belajar bahasa Jepang dari nol sampai JLPT N4 di sini. Simulasi ujiannya benar-benar mirip aslinya.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Maya Lestari",
    handle: "@maya.jp",
    text: "Kelas online-nya fleksibel buat yang sambil kerja. Sekarang aku siap berangkat ke Jepang. Terima kasih PejuangYen!",
  },
];
