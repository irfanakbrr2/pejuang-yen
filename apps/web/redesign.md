# 🎨 GrowWithAI Dashboard — Redesign v2

> **Tujuan**: Transformasi dari "clean but plain" → "modern & premium" seperti Linear / Vercel Dashboard
> **Status**: Planning phase — implement SETELAH plan ini disetujui
> **Context**: Glassmorphism sudah dihapus di v1. v2 ini fokus pada MENAMBAH elemen desain yang kuat, bukan sekadar membersihkan.

---

## 🔍 Diagnosa Masalah (dari screenshot live)

Setelah deploy v1, hasilnya:
- ✅ Glass morphism hilang
- ✅ Background #F7F7F8 clean
- ✅ Sidebar putih
- ❌ Terasa **terlalu plain** — white boxes on gray, tidak ada visual hierarchy
- ❌ **Typography tidak dramatis** — angka metric tidak "memukul"
- ❌ **Stat cards** terasa flat — 2px bar terlalu subtle
- ❌ **Sidebar section labels** tidak memiliki karakter
- ❌ **Page header** tidak impactful
- ❌ **Density** terlalu padat tanpa ritme yang jelas

---

## 📐 Design System Baru

### Warna

```
Brand:
  --brand-primary: #0F6E56        ← hijau utama (tetap)
  --brand-dark:    #0C4A38        ← hover/dark state

Surface:
  --bg-page:       #F7F7F8        ← halaman background
  --bg-card:       #FFFFFF        ← card background  
  --bg-subtle:     #F4F4F5        ← muted section bg
  --bg-hover:      rgba(0,0,0,0.03) ← hover state

Border:
  --border-default: rgba(0,0,0,0.08)
  --border-strong:  rgba(0,0,0,0.12)

Text:
  --text-primary:   #09090B       ← paling gelap, untuk heading besar
  --text-secondary: #3F3F46       ← body text
  --text-muted:     #71717A       ← subtitle, caption
  --text-faint:     #A1A1AA       ← placeholder, label tiny

Semantic:
  --teal:   #0F6E56  / bg: #ECFDF5
  --blue:   #2563EB  / bg: #EFF6FF
  --amber:  #D97706  / bg: #FFFBEB
  --rose:   #E11D48  / bg: #FFF1F2
  --purple: #7C3AED  / bg: #F5F3FF
```

### Typography Scale

```
--type-giant:   3rem    / weight 800  / tracking -0.04em  ← metric numbers
--type-display: 1.875rem/ weight 700  / tracking -0.03em  ← page title
--type-title:   1.25rem / weight 600  / tracking -0.02em  ← section title
--type-heading: 1rem    / weight 600  / tracking -0.01em  ← card title
--type-body:    0.875rem/ weight 400  / tracking 0
--type-small:   0.8125rem/weight 400  / tracking 0
--type-tiny:    0.6875rem/weight 500  / tracking 0.06em  uppercase ← label
```

### Radius & Shadow

```
--radius-sm:  6px
--radius-md:  8px
--radius-lg:  12px
--radius-xl:  16px

--shadow-xs:    0 1px 2px rgba(0,0,0,0.05)
--shadow-sm:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-card:  0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05)
--shadow-popover: 0 0 0 1px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.12)
```

---

## 🧩 Komponen: BentoStatCard — Total Rethink

**Masalah sekarang**: Angka besar, bar 2px di atas, icon kecil di pojok kiri. Terasa template-ish.

**Redesign**: Layout dua-baris yang lebih impactful.

```tsx
// Layout baru:
//  ┌─────────────────────────────────┐
//  │  [icon 14px]  TITLE (tiny caps) │
//  │                                 │
//  │  42              ↑ 12%          │  ← NUMBER (giant) + trend
//  │  subtitle text                  │
//  └─────────────────────────────────┘
//
//  TIDAK ada accent bar di top.
//  Accent ditunjukkan via icon color + subtle left-border (3px)

<div className={cn(
  "relative flex flex-col justify-between",
  "bg-white rounded-[var(--radius-lg)] p-5 min-h-[120px]",
  "border-l-[3px] border border-[rgba(0,0,0,0.06)]",
  // border-l warna sesuai accent: border-l-[#0F6E56], border-l-blue-500, dll
  "shadow-[var(--shadow-card)]",
  href && "cursor-pointer hover:-translate-y-[2px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)] transition-all duration-200",
)}>
  {/* Top row: icon + title */}
  <div className="flex items-center gap-1.5">
    <Icon className="h-3.5 w-3.5 text-[--accent-color]" strokeWidth={2.5} />
    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#71717A]">
      {title}
    </span>
  </div>

  {/* Bottom: value + trend */}
  <div className="mt-3">
    <div className="flex items-end justify-between gap-2">
      <span className={cn(
        "font-black leading-none tracking-[-0.04em]",
        typeof value === 'number' || /^\d/.test(String(value))
          ? "text-4xl text-[#09090B]"
          : "text-3xl text-[#09090B]"
      )}>
        {value}
      </span>
      {trend && (
        <span className={cn(
          "mb-1 text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
          trend.value >= 0 ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
        )}>
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
        </span>
      )}
    </div>
    {subtitle && (
      <p className="mt-1 text-[12px] text-[#71717A]">{subtitle}</p>
    )}
  </div>
</div>
```

**File**: `src/components/ui/bento-stat-card.tsx`

---

## 🧭 Komponen: Sidebar — Refinement

**Masalah sekarang**: Section labels terlalu besar, nav item padding terlalu lebar, active state bg terlalu opaque.

**Redesign**:

```tsx
// Section label:
<p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A1A1AA]">
  {section.label}
</p>

// Nav item — pakai left indicator LINE bukan full bg:
// Active:
"relative flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)]
 text-[13px] font-medium text-[#0F6E56] bg-[#0F6E56]/[0.06]
 before:absolute before:left-0 before:top-2 before:bottom-2
 before:w-[2.5px] before:rounded-full before:bg-[#0F6E56]"

// Inactive:
"text-[#3F3F46] hover:bg-black/[0.03] hover:text-[#09090B]"

// Icon active: text-[#0F6E56]
// Icon inactive: text-[#A1A1AA] group-hover:text-[#71717A]

// Header logo area — lebih compact:
<div className="flex items-center gap-2 px-4 py-3.5 border-b border-[rgba(0,0,0,0.06)]">
  <Image src="/logo.webp" width={28} height={28} className="rounded-lg" />
  <div>
    <span className="text-[13px] font-semibold text-[#09090B]">{brand.name}</span>
    <span className="text-[11px] text-[#A1A1AA] block -mt-0.5">{brand.subtitle}</span>
  </div>
</div>

// Sidebar search — lebih compact:
// h-8, rounded-md, tidak ada border saat unfocused (pakai bg-[#F4F4F5])
<input className="w-full bg-[#F4F4F5] rounded-[var(--radius-md)] pl-8 pr-3 py-1.5
  text-[12px] text-[#09090B] placeholder:text-[#A1A1AA]
  outline-none focus:bg-white focus:ring-1 focus:ring-[#0F6E56]/20 transition-all" />
```

**File**: `src/components/ui/modern-side-bar.tsx`

---

## 📄 Page Header — Lebih Impactful

**Masalah**: "SELAMAT DATANG KEMBALI" + "Adm" terlalu sederhana, tidak ada visual weight.

**Redesign** di `dashboard-chrome.tsx`:

```tsx
// PageHeader baru:
<div className="flex items-start justify-between mb-6">
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
      {eyebrow}
    </p>
    <h1 className="text-[1.875rem] font-black text-[#09090B] leading-none tracking-[-0.03em]">
      {title}
    </h1>
    {description && (
      <p className="mt-2 text-[14px] text-[#71717A] leading-relaxed">
        {description}
      </p>
    )}
  </div>
  {actions}
</div>

// DashboardSection title:
<h2 className="text-[15px] font-semibold text-[#09090B] tracking-[-0.01em]">
  {title}
</h2>
```

**File**: `src/components/ui/dashboard-chrome.tsx`

---

## 📊 Dashboard Page — Layout & Component Fixes

**File**: `src/app/(user)/dashboard/page.tsx`

### Community Notice → Lebih Compact (Notification Bar Style)

```tsx
// Sebelum: rounded-xl full-height box
// Sesudah: slim bar, tidak terlalu mendomin layar

<div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-md)]
  bg-[#ECFDF5] border border-[#0F6E56]/15">
  <Users className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
  <p className="text-[13px] font-medium text-[#09090B] flex-1">
    Join komunitas gratis GrowWithAI —{" "}
    <a href={COMMUNITY_WHATSAPP_URL} className="text-[#0F6E56] font-semibold hover:underline">
      Gabung WhatsApp →
    </a>
  </p>
  <button onClick={handleDismissCommunityNotice} className="p-1 rounded text-[#71717A] hover:text-[#09090B]">
    <X className="h-3.5 w-3.5" />
  </button>
</div>
```

### Quick Actions Cards — Less Padding, Cleaner

```tsx
// Section wrapper hapus bg putih card yang double — gunakan layout grid langsung
// Tidak perlu wrapper card dengan padding p-5 untuk section yg sudah memiliki card anak
```

### Upgrade CTA — Lebih Compact & Actionable

```tsx
// Sebelum: full card besar dengan icon dan 2 baris teks
// Sesudah: slim horizontal CTA bar

<div className="flex items-center justify-between gap-4 px-5 py-3.5
  rounded-[var(--radius-lg)] bg-amber-50 border border-amber-200">
  <div className="flex items-center gap-3">
    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
      <Rocket className="h-3.5 w-3.5 text-amber-600" />
    </div>
    <div>
      <p className="text-[13px] font-semibold text-[#09090B]">Unlock Member Premium</p>
      <p className="text-[12px] text-[#71717A]">Akses semua kelas + grup eksklusif</p>
    </div>
  </div>
  <a href="https://growwithai.id/#harga" target="_blank" rel="noopener noreferrer"
    className="shrink-0 px-4 py-2 rounded-[var(--radius-md)] bg-amber-500 text-white
    text-[13px] font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap">
    Upgrade →
  </a>
</div>
```

---

## 🗂️ AdminTable — Zebra Stripe & Tighter

**File**: `src/components/ui/AdminTable.tsx`

```tsx
// Row: tambah zebra stripe subtle
// even row: bg-[#FAFAFA]
// odd row: bg-white
// hover: bg-[#F4F4F5]

// Header text: uppercase + tracking tighter
"text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A1A1AA]"

// Row height: py-2.5 (lebih compact dari py-3)

// Td text: text-[13px] text-[#3F3F46]
```

---

## 🏷️ Badge / Status Pill — Lebih Refined

**File**: `src/components/ui/Badge.tsx` & `AdminTable.tsx` StatusBadge

```tsx
// Hapus ring-1, ganti dengan border langsung
// Ukuran lebih compact: px-2 py-0.5 (bukan px-2.5)
// Font: text-[11px] font-medium (bukan semibold)
// Radius: rounded-md (bukan rounded-full) — lebih Linear style

const variantClasses = {
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warning: "bg-amber-50  text-amber-700  border border-amber-100",
  error:   "bg-red-50    text-red-600    border border-red-100",
  info:    "bg-blue-50   text-blue-700   border border-blue-100",
  primary: "bg-[#ECFDF5] text-[#0F6E56] border border-[#0F6E56]/15",
  gray:    "bg-[#F4F4F5] text-[#71717A] border border-[rgba(0,0,0,0.06)]",
}
```

---

## 🎛️ Button — Micro Polish

**File**: `src/components/ui/Button.tsx`

```tsx
// Primary: tambah sedikit text-shadow untuk kedalaman
// Size sm: h-6 (lebih compact)
// Size md: h-7.5 = h-8 (tetap)
// Size lg: h-9 (tetap)

// Loading spinner: lebih halus, pakai border-based spinner

// Focus ring: lebih subtle
"focus-visible:ring-2 focus-visible:ring-[#0F6E56]/25 focus-visible:ring-offset-1"
```

---

## 🪟 Dialog — More Polished

**File**: `src/components/ui/dialog.tsx`

```tsx
// Overlay: bg-black/20 (lebih ringan dari /30)
// Content: tambah padding top lebih besar utk breathing room
// Close button: absolute position lebih refined

// Title: text-[17px] font-semibold (lebih besar)
// Description: text-[13px] text-[#71717A]

// Footer: gap-2, button sizes sm/md konsisten
```

---

## 📋 File Execution Order (v2)

| # | File | Perubahan | Impact |
|---|------|-----------|--------|
| 1 | `src/app/globals.css` | Update typography tokens, shadow tokens baru | 🔴 Critical |
| 2 | `src/components/ui/bento-stat-card.tsx` | Total rethink layout + left border accent | 🔴 High |
| 3 | `src/components/ui/dashboard-chrome.tsx` | PageHeader lebih impactful, section title | 🔴 High |
| 4 | `src/components/ui/modern-side-bar.tsx` | Left indicator line, search bg-subtle, spacing | 🟡 High |
| 5 | `src/app/(user)/dashboard/page.tsx` | Community notice compact, upgrade CTA slim | 🟡 High |
| 6 | `src/components/ui/AdminTable.tsx` | Zebra stripe, tighter rows, better header | 🟡 Medium |
| 7 | `src/components/ui/Badge.tsx` + StatusBadge | rounded-md, border-based, no ring | 🟡 Medium |
| 8 | `src/components/ui/Button.tsx` | Focus ring offset, micro polish | 🟢 Low |
| 9 | `src/components/ui/dialog.tsx` | Overlay lighter, padding refined | 🟢 Low |
| 10 | `src/app/(admin)/admin/page.tsx` | Admin dashboard stat cards + quick actions | 🟡 Medium |

---

## ✅ Definition of Done

- [ ] Stat cards: angka **terasa besar dan powerful**, bukan flat
- [ ] Sidebar: active item punya **visual indicator yang clear** (left line)
- [ ] Page header: **typography yang impactful**, bukan subtitle kecil
- [ ] Notices: **compact, tidak memakan ruang**
- [ ] Tables: **zebra stripe + tighter** — terasa padat data seperti Linear
- [ ] Badges: **refined pill** dengan border, bukan ring
- [ ] Keseluruhan: terasa seperti **product yang serius**, bukan template admin biasa

---

> Dibuat: 2026-06-09
> Versi: 2.0
> Status: READY TO IMPLEMENT
