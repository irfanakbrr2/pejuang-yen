"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface CertificateDetail {
  id: string;
  certificate_number: string;
  course_title: string;
  user_name: string;
  issued_at: string;
}

function sanitizeFilename(str: string) {
  return str.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 60);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CertificateDetailClient() {
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean)[1];

  const certRef = useRef<HTMLDivElement>(null);
  const [cert, setCert] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/user/certificates/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCert(d.data);
        else setError(d.error || "Sertifikat tidak ditemukan");
      })
      .catch(() => setError("Gagal memuat sertifikat"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!certRef.current || !cert) return;
    setDownloading(true);
    try {
      await Promise.all([
        document.fonts.load("300 16px 'Cormorant Garamond'"),
        document.fonts.load("400 16px 'Cormorant Garamond'"),
        document.fonts.load("500 16px 'Cormorant Garamond'"),
        document.fonts.load("italic 500 16px 'Cormorant Garamond'"),
        document.fonts.load("400 16px 'DM Sans'"),
        document.fonts.load("500 16px 'DM Sans'"),
        document.fonts.load("400 16px 'Pinyon Script'"),
      ]);
      await document.fonts.ready;

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#FFFFFF",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const A4_W = 297;
      const A4_H = 210;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const ratio = Math.min(A4_W / canvas.width, A4_H / canvas.height);
      const pdfW = canvas.width * ratio;
      const pdfH = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (A4_W - pdfW) / 2, (A4_H - pdfH) / 2, pdfW, pdfH);

      const year = new Date(cert.issued_at).getFullYear();
      pdf.save(`Sertifikat_${sanitizeFilename(cert.user_name)}_${sanitizeFilename(cert.course_title)}_${year}.pdf`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Gagal membuat PDF. Coba lagi atau gunakan Ctrl+P / Cmd+P untuk mencetak.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 0" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 28, height: 28, border: "2px solid rgba(0,0,0,0.08)", borderTopColor: "#0F0D0A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 0", gap: 12 }}>
        <p style={{ fontSize: 14, color: "#ef4444" }}>{error || "Sertifikat tidak ditemukan"}</p>
        <Link href="/certificates" style={{ fontSize: 12, fontWeight: 600, color: "#8B1414", textDecoration: "underline" }}>
          Kembali ke Sertifikat
        </Link>
      </div>
    );
  }

  const verifyUrl = `pejuangyen.com/verify/${cert.certificate_number}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&family=Pinyon+Script&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <Link href="/certificates" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(12,12,10,0.55)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
          <ArrowLeft size={15} /> Kembali
        </Link>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 24px",
            background: downloading ? "rgba(12,12,10,0.3)" : "#0F0D0A",
            color: "#FFFFFF", fontSize: 13, fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.06em",
            borderRadius: 6, border: "none", cursor: downloading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {downloading
            ? <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            : <Download size={14} />}
          {downloading ? "Membuat PDF..." : "Unduh PDF"}
        </button>
      </div>

      {/* Certificate wrapper */}
      <div style={{ width: "100%", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ position: "relative", paddingBottom: "70.71%", boxShadow: "0 4px 40px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)" }}>
          <div
            ref={certRef}
            style={{
              position: "absolute", inset: 0,
              background: "#FFFFFF",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer border */}
            <div style={{ position: "absolute", inset: 20, border: "1px solid #0F0D0A", pointerEvents: "none", zIndex: 1 }} />
            {/* Inner border */}
            <div style={{ position: "absolute", inset: 26, border: "0.5px solid rgba(15,13,10,0.18)", pointerEvents: "none", zIndex: 1 }} />

            {/* Corner marks — minimal ink dots */}
            {[
              { top: 16, left: 16 }, { top: 16, right: 16 },
              { bottom: 16, left: 16 }, { bottom: 16, right: 16 },
            ].map((pos, i) => (
              <div key={i} style={{ position: "absolute", ...pos, width: 6, height: 6, pointerEvents: "none", zIndex: 2 }}>
                <svg viewBox="0 0 6 6" width="6" height="6" fill="none">
                  <circle cx="3" cy="3" r="1.5" fill="#0F0D0A" />
                </svg>
              </div>
            ))}

            {/* Main content */}
            <div style={{
              position: "relative", zIndex: 3,
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
              width: "100%", padding: "48px 80px 44px",
            }}>

              {/* Logo row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <img
                  src="/icon-512.png"
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#0F0D0A" }}>
                  PejuangYen
                </span>
              </div>

              {/* Top rule */}
              <div style={{ width: "100%", maxWidth: 480, height: "1px", background: "#0F0D0A", marginBottom: 18 }} />

              {/* Label */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 500, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(15,13,10,0.45)", margin: "0 0 6px" }}>
                Sertifikat Penyelesaian
              </p>

              {/* Main title */}
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 300, letterSpacing: "0.04em", color: "#0F0D0A", lineHeight: 1.15, margin: "0 0 16px" }}>
                Certificate of Completion
              </h1>

              {/* Presented to */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(15,13,10,0.45)", margin: "0 0 8px" }}>
                Dengan bangga diberikan kepada
              </p>

              {/* Recipient name */}
              <p style={{
                fontFamily: "'Pinyon Script', cursive", fontSize: 54, color: "#0F0D0A",
                lineHeight: 1.1, margin: "0 0 2px",
                borderBottom: "1px solid rgba(15,13,10,0.2)", padding: "0 20px 4px",
              }}>
                {cert.user_name}
              </p>

              {/* For */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(15,13,10,0.45)", margin: "12px 0 6px" }}>
                atas keberhasilan menyelesaikan
              </p>

              {/* Course title */}
              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500,
                fontStyle: "italic", color: "#0F0D0A", letterSpacing: "0.03em",
                margin: "0 0 20px", maxWidth: 480,
                borderBottom: "0.5px solid rgba(15,13,10,0.2)", padding: "0 12px 4px",
              }}>
                {cert.course_title}
              </p>

              {/* Bottom rule */}
              <div style={{ width: "100%", maxWidth: 480, height: "1px", background: "rgba(15,13,10,0.12)", marginBottom: 18 }} />

              {/* Footer: 3 columns */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%", maxWidth: 640 }}>

                {/* Date */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7, fontWeight: 500, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(15,13,10,0.4)" }}>
                    Tanggal
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 500, color: "#0F0D0A" }}>
                    {fmtDate(cert.issued_at)}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ width: "0.5px", height: 36, background: "rgba(15,13,10,0.15)", marginTop: 6 }} />

                {/* Signature */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
                  {/* Signature line */}
                  <div style={{ width: 100, height: "0.5px", background: "#0F0D0A", marginBottom: 4 }} />
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 500, color: "#0F0D0A", margin: 0, letterSpacing: "0.02em" }}>
                    Irfan Akbar Wildani
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(15,13,10,0.45)", margin: 0 }}>
                    Founder &amp; Lead
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(15,13,10,0.45)", margin: 0 }}>
                    PejuangYen
                  </p>
                </div>

                {/* Divider */}
                <div style={{ width: "0.5px", height: 36, background: "rgba(15,13,10,0.15)", marginTop: 6 }} />

                {/* Cert ID */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7, fontWeight: 500, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(15,13,10,0.4)" }}>
                    ID Sertifikat
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 500, color: "#0F0D0A", letterSpacing: "0.04em" }}>
                    {cert.certificate_number}
                  </span>
                </div>

              </div>
            </div>

            {/* Verification URL */}
            <p style={{
              position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
              fontSize: 7, letterSpacing: "0.14em", color: "rgba(15,13,10,0.4)",
              zIndex: 3, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", margin: 0,
            }}>
              Verifikasi di {verifyUrl}
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(12,12,10,0.35)", marginTop: 16, fontFamily: "'DM Sans', sans-serif" }}>
          Klik <strong>Unduh PDF</strong> untuk menyimpan sebagai file PDF landscape A4
        </p>
      </div>
    </>
  );
}
