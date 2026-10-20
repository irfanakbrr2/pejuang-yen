"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, @next/next/no-img-element */

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck, ShieldX, Search, Award, BookOpen, Users, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface VerifyResult {
  certificate_number: string;
  user_name: string;
  course_title: string;
  issued_at: string;
  is_valid: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}

const LOGO = "/icon-512.png";

export default function VerifyClient() {
  const pathname = usePathname();
  const numberFromUrl = pathname.split("/").filter(Boolean)[1]?.toUpperCase() ?? "";

  const [query, setQuery] = useState(numberFromUrl);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const verify = async (number: string) => {
    const cleaned = number.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (numberFromUrl) verify(numberFromUrl);
  }, [numberFromUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(query);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F0", fontFamily: "var(--font-jakarta, system-ui, sans-serif)" }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: "1px solid rgba(12,12,10,0.07)",
        background: "rgba(247,246,240,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="https://pejuangyen.com" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={LOGO} alt="PejuangYen" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0D0D0D", letterSpacing: "-0.01em" }}>PejuangYen</span>
          </a>
          <a
            href="https://pejuangyen.com"
            style={{
              fontSize: 13, fontWeight: 600, color: "#8B1414",
              textDecoration: "none", padding: "7px 16px",
              border: "1.5px solid #8B1414", borderRadius: 8,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#8B1414"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8B1414"; }}
          >
            Lihat Platform →
          </a>
        </div>
      </nav>

      {/* ── Hero / Verifikasi ── */}
      <section style={{ padding: "64px 24px 48px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(139,20,20,0.08)", border: "1px solid rgba(139,20,20,0.2)",
            borderRadius: 20, padding: "5px 14px", marginBottom: 20,
          }}>
            <ShieldCheck size={13} color="#8B1414" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8B1414", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Verifikasi Resmi
            </span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#0D0D0D", margin: "0 0 12px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Verifikasi Sertifikat
          </h1>
          <p style={{ fontSize: 15, color: "rgba(12,12,10,0.5)", margin: "0 0 36px", lineHeight: 1.6 }}>
            Masukkan nomor sertifikat untuk memverifikasi keaslian<br />sertifikat yang diterbitkan oleh PejuangYen.
          </p>

          {/* Search form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 520, margin: "0 auto" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={15} color={focused ? "#8B1414" : "#9CA3AF"} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "color 0.15s" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                placeholder="PY-2026-XXXXX"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  width: "100%", padding: "13px 16px 13px 40px",
                  fontSize: 14, fontFamily: "monospace",
                  border: `1.5px solid ${focused ? "#8B1414" : "rgba(12,12,10,0.12)"}`,
                  borderRadius: 10, background: "white", outline: "none",
                  color: "#0D0D0D", letterSpacing: "0.06em",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                  boxShadow: focused ? "0 0 0 3px rgba(139,20,20,0.08)" : "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "13px 22px", background: loading || !query.trim() ? "#6B7280" : "#0D0D0D",
                color: "white", fontSize: 13, fontWeight: 700,
                borderRadius: 10, border: "none",
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap", transition: "background 0.15s", flexShrink: 0,
              }}
              onMouseEnter={e => { if (!loading && query.trim()) e.currentTarget.style.background = "#1a1a1a"; }}
              onMouseLeave={e => { if (!loading && query.trim()) e.currentTarget.style.background = "#0D0D0D"; }}
            >
              {loading
                ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Mengecek</>
                : <><Search size={13} /> Cek</>
              }
            </button>
          </form>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </section>

      {/* ── Result ── */}
      {(result || notFound) && (
        <section style={{ padding: "0 24px 56px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>

            {/* Valid */}
            {result?.is_valid && (
              <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 48px rgba(139,20,20,0.14)", border: "1.5px solid rgba(139,20,20,0.3)" }}>
                {/* Green header */}
                <div style={{ background: "linear-gradient(135deg, #8B1414 0%, #0a5040 100%)", padding: "28px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      border: "1.5px solid rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <ShieldCheck size={24} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.65)", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 3px" }}>
                        Sertifikat Terverifikasi
                      </p>
                      <p style={{ fontSize: 17, fontWeight: 800, color: "white", margin: 0 }}>
                        Dokumen ini sah dan asli
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ background: "white", padding: "28px 32px" }}>
                  {/* Recipient */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "rgba(139,20,20,0.06)",
                      border: "1px solid rgba(139,20,20,0.14)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Award size={22} color="#8B1414" />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 3px" }}>
                        Diberikan kepada
                      </p>
                      <p style={{ fontSize: 22, fontWeight: 900, color: "#0D0D0D", margin: 0, letterSpacing: "-0.02em" }}>
                        {result.user_name}
                      </p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{ borderTop: "1px solid rgba(12,12,10,0.06)", paddingTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                    <div style={{ background: "#F7F6F0", borderRadius: 10, padding: "14px 16px" }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 5px" }}>
                        Nama Kelas
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0D0D0D", margin: 0, lineHeight: 1.4 }}>
                        {result.course_title}
                      </p>
                    </div>
                    <div style={{ background: "#F7F6F0", borderRadius: 10, padding: "14px 16px" }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 5px" }}>
                        Tanggal Lulus
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0D0D0D", margin: 0 }}>
                        {formatDate(result.issued_at)}
                      </p>
                    </div>
                    <div style={{ gridColumn: "1 / -1", background: "#F7F6F0", borderRadius: 10, padding: "14px 16px" }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 5px" }}>
                        Nomor Sertifikat
                      </p>
                      <p style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 800, color: "#8B1414", margin: 0, letterSpacing: "0.06em" }}>
                        {result.certificate_number}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer strip */}
                <div style={{ background: "rgba(139,20,20,0.04)", borderTop: "1px solid rgba(139,20,20,0.1)", padding: "12px 32px", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={13} color="#8B1414" />
                  <p style={{ fontSize: 11, color: "#8B1414", margin: 0 }}>
                    Diterbitkan resmi oleh PejuangYen · pejuangyen.com
                  </p>
                </div>
              </div>
            )}

            {/* Revoked */}
            {result && !result.is_valid && (
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1.5px solid rgba(239,68,68,0.3)", boxShadow: "0 8px 32px rgba(239,68,68,0.08)" }}>
                <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", padding: "28px 32px", display: "flex", alignItems: "center", gap: 14 }}>
                  <ShieldX size={28} color="white" />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 3px" }}>Sertifikat Dicabut</p>
                    <p style={{ fontSize: 17, fontWeight: 800, color: "white", margin: 0 }}>Dokumen ini tidak berlaku</p>
                  </div>
                </div>
                <div style={{ background: "white", padding: "24px 32px" }}>
                  <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
                    Nomor <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0D0D0D" }}>{result.certificate_number}</span> telah dicabut dan tidak dapat digunakan sebagai bukti kelulusan yang sah.
                  </p>
                </div>
              </div>
            )}

            {/* Not found */}
            {notFound && (
              <div style={{ borderRadius: 20, background: "white", border: "1.5px solid rgba(12,12,10,0.08)", padding: "40px 32px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "#FEF2F2", border: "1px solid rgba(239,68,68,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <ShieldX size={24} color="#ef4444" />
                </div>
                <p style={{ fontSize: 17, fontWeight: 800, color: "#0D0D0D", margin: "0 0 8px" }}>
                  Sertifikat Tidak Ditemukan
                </p>
                <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
                  Nomor <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0D0D0D" }}>{query}</span> tidak terdaftar
                  dalam sistem PejuangYen. Periksa kembali penulisan nomor sertifikat.
                </p>
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── Divider ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ borderTop: "1px solid rgba(12,12,10,0.07)" }} />
      </div>

      {/* ── Promo Section ── */}
      <section style={{ padding: "64px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Heading */}
          <div style={{ maxWidth: 520, marginBottom: 48 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(139,20,20,0.07)", border: "1px solid rgba(139,20,20,0.15)",
              borderRadius: 20, padding: "5px 14px", marginBottom: 18,
            }}>
              <Sparkles size={12} color="#8B1414" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8B1414", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Lembaga Pelatihan Bahasa Jepang
              </span>
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 900, color: "#0D0D0D", margin: "0 0 14px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Dapatkan Sertifikat<br />Kamu Sendiri
            </h2>
            <p style={{ fontSize: 15, color: "rgba(12,12,10,0.5)", margin: 0, lineHeight: 1.7 }}>
              Belajar bahasa Jepang & siapkan kariermu untuk bekerja di Jepang — dari dasar sampai persiapan JLPT, JFT-Basic & SSW. Selesaikan kelas, dapat sertifikat resmi yang bisa kamu bagikan.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 40 }}>
            {[
              {
                icon: BookOpen,
                color: "#8B1414",
                bg: "rgba(139,20,20,0.07)",
                title: "Kelas Berbasis Praktik",
                desc: "Materi dirancang untuk langsung bisa diterapkan — bukan teori doang.",
              },
              {
                icon: Award,
                color: "#7C3AED",
                bg: "rgba(124,58,237,0.07)",
                title: "Sertifikat Terverifikasi",
                desc: "Setiap sertifikat punya nomor unik yang bisa dicek siapa saja di halaman ini.",
              },
              {
                icon: Users,
                color: "#0369a1",
                bg: "rgba(3,105,161,0.07)",
                title: "Komunitas Aktif",
                desc: "Bergabung dengan komunitas sesama PejuangYen yang saling mendukung dan berbagi.",
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div
                key={title}
                style={{
                  background: "white", borderRadius: 16, padding: "24px",
                  border: "1px solid rgba(12,12,10,0.07)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: bg, display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 16,
                }}>
                  <Icon size={20} color={color} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0D0D0D", margin: "0 0 8px" }}>{title}</p>
                <p style={{ fontSize: 13, color: "rgba(12,12,10,0.5)", margin: 0, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            background: "linear-gradient(135deg, #0D0D0D 0%, #1a1a1a 100%)",
            borderRadius: 20, padding: "40px 40px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 24,
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>
                Mulai Sekarang
              </p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "white", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                Siap berkarier ke Jepang dan dapat sertifikat?
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Daftar gratis dan mulai belajar hari ini.
              </p>
            </div>
            <a
              href="https://pejuangyen.com"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px", background: "#8B1414", color: "white",
                fontSize: 14, fontWeight: 700, borderRadius: 12,
                textDecoration: "none", transition: "background 0.15s", flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#0a5040")}
              onMouseLeave={e => (e.currentTarget.style.background = "#8B1414")}
            >
              Lihat Kelas di PejuangYen
              <ArrowRight size={15} />
            </a>
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(12,12,10,0.07)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(12,12,10,0.35)", margin: 0 }}>
          © {new Date().getFullYear()} PejuangYen · Halaman ini bersifat publik dan dapat diakses siapa saja untuk verifikasi sertifikat.
        </p>
      </footer>

    </div>
  );
}
