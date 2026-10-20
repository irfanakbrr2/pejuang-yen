import React from 'react';

// Shell dua-kolom "glass" untuk SEMUA halaman auth (login, register, forgot, reset, verify).
// Kolom kiri: logo + judul + deskripsi + slot form (children) + footer.
// Kolom kanan: hero image + kartu testimoni. Animasi & gaya konsisten (maroon, font-geist).

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-muted-foreground">{testimonial.handle}</p>
      <p className="mt-1 text-foreground/80">{testimonial.text}</p>
    </div>
  </div>
);

interface AuthShellProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  logoSrc?: string;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  description,
  logoSrc,
  heroImageSrc,
  testimonials = [],
  children,
  footer,
}) => (
  <div className="min-h-[100dvh] flex flex-col md:flex-row font-geist w-full">
    {/* Left column: form */}
    <section className="flex-1 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          {logoSrc && (
            <img src={logoSrc} alt="PejuangYen" className="animate-element animate-delay-100 h-10 w-auto self-start rounded-xl" />
          )}
          {title && (
            <h1 className="animate-element animate-delay-100 text-3xl md:text-4xl font-semibold leading-tight">{title}</h1>
          )}
          {description && (
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>
          )}
          {children}
          {footer && (
            <div className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">{footer}</div>
          )}
        </div>
      </div>
    </section>

    {/* Right column: hero + testimonials */}
    {heroImageSrc && (
      <section className="hidden md:block flex-1 relative p-4">
        <div
          className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImageSrc})` }}
        ></div>
        {testimonials.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
            <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
            {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
            {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
          </div>
        )}
      </section>
    )}
  </div>
);
