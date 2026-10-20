@AGENTS.md

# Cloudflare Pages — Static Export Constraints

## WAJIB: Gunakan `usePathname()` bukan `useParams()` untuk membaca slug dinamis

**Kenapa `useParams()` tidak bisa dipakai di sini:**

Deployment ini menggunakan `output: "export"` (Next.js static export) + Cloudflare Pages dengan `_worker.js`.

Worker dikonfigurasi untuk menyajikan **satu HTML fallback** untuk semua slug dinamis:
- `/webinar/100m` → dilayani oleh `/webinar/_/index.html`
- `/order/lifetime` → dilayani oleh `/order/_/index.html`
- `/learn/kelas-a/lesson-1` → dilayani oleh `/learn/_/_/index.html`

HTML fallback ini punya router context Next.js dengan `slug = "_"`. Ketika `useParams()` dipanggil, dia membaca dari router context tersebut → selalu dapat `"_"`, bukan slug aslinya.

`usePathname()` membaca dari URL browser aktual → dapat slug yang benar.

**Pattern yang BENAR — ikuti ini untuk semua halaman dinamis:**

```ts
// ✅ BENAR
import { usePathname } from "next/navigation";
const pathname = usePathname();
const slug = pathname.split("/").filter(Boolean)[1] ?? "_";
```

```ts
// ❌ SALAH — jangan pakai ini
import { useParams } from "next/navigation";
const params = useParams<{ slug: string }>();
const slug = params.slug; // selalu "_" di production
```

**Index posisi berdasarkan route:**

| Route | Posisi slug | Contoh |
|---|---|---|
| `/webinar/[slug]` | `[1]` | `pathname.split("/").filter(Boolean)[1]` |
| `/order/[productSlug]` | `[1]` | `pathname.split("/").filter(Boolean)[1]` |
| `/webinars/[slug]` | `[1]` | `pathname.split("/").filter(Boolean)[1]` |
| `/learn/[courseSlug]/[lessonSlug]` | `[1]` dan `[2]` | `.filter(Boolean)[1]` dan `[2]` |

**File referensi yang sudah benar:**
- `src/app/order/[productSlug]/page-client.tsx` — pattern `usePathname()` sudah dipakai
- `src/app/webinar/[slug]/page-client.tsx` — sudah difix
- `src/app/(user)/webinars/[slug]/page-client.tsx` — sudah difix
