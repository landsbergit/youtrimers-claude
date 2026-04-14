/**
 * BarcodeScanOverlay
 *
 * Desktop: shows a QR code of the current URL so the user can continue on their phone.
 * Mobile:  opens live camera feed and scans for barcodes using ZXing.
 *
 * Calls onResult(barcode) on success, onClose() on dismiss.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Smartphone, AlertCircle, ScanLine } from "lucide-react";

// ── Device detection ──────────────────────────────────────────────────────────

function isMobileDevice(): boolean {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    // also treat touch-only devices with narrow viewport as mobile
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
  );
}

// ── QR code generator (desktop only, lazy-loaded) ────────────────────────────

async function buildQrDataUrl(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.default.toDataURL(text, {
    width: 220,
    margin: 2,
    color: { dark: "#11192A", light: "#F9F7F4" },
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BarcodeScanOverlayProps {
  onResult: (barcode: string) => void;
  onClose: () => void;
}

// ── Desktop panel (QR code) ───────────────────────────────────────────────────

function DesktopQrPanel({ onClose }: { onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    buildQrDataUrl(window.location.href)
      .then(setQrUrl)
      .catch(() => setQrError(true));
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="flex items-center gap-2.5 text-foreground">
        <Smartphone size={18} className="text-primary flex-shrink-0" />
        <p className="text-sm font-semibold">Scan from your phone</p>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-[220px] leading-relaxed">
        Open this page on your phone to use the live barcode scanner.
      </p>

      {/* QR code */}
      <div className="rounded-xl border border-border p-3 bg-background shadow-sm">
        {qrError ? (
          <p className="text-xs text-destructive">Could not generate QR code.</p>
        ) : qrUrl ? (
          <img src={qrUrl} alt="QR code to open on mobile" width={220} height={220} />
        ) : (
          <div className="w-[220px] h-[220px] bg-muted animate-pulse rounded-lg" />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-[220px]">
        Or type a UPC code (8–14 digits) directly in the search bar.
      </p>
    </div>
  );
}

// ── Mobile scanner ────────────────────────────────────────────────────────────

type ScanStatus = "starting" | "scanning" | "found" | "error";

function MobileCameraScanner({
  onResult,
}: {
  onResult: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [errorMsg, setErrorMsg] = useState("");

  const handleBarcode = useCallback(
    (value: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      controlsRef.current?.stop();
      setStatus("found");
      setTimeout(() => onResult(value), 350);
    },
    [onResult],
  );

  useEffect(() => {
    if (!videoRef.current) return;
    let mounted = true;

    (async () => {
      try {
        // Dynamic import — keeps ZXing out of the initial bundle
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!mounted) return;

        const reader = new BrowserMultiFormatReader();

        reader
          .decodeFromVideoDevice(
            undefined,           // use default (rear) camera
            videoRef.current!,
            (result, _error, controls) => {
              // Cache controls object so we can stop scanning
              if (controls && !controlsRef.current) {
                controlsRef.current = controls;
                if (mounted) setStatus("scanning");
              }
              if (result) {
                handleBarcode(result.getText());
              }
              // NotFoundException fires on every empty frame — safe to ignore
            },
          )
          .catch((err: Error) => {
            if (!mounted) return;
            setStatus("error");
            const msg =
              err?.name === "NotAllowedError"
                ? "Camera access denied. Allow camera access in your browser settings."
                : err?.name === "NotFoundError"
                ? "No camera found on this device."
                : `Camera error: ${err?.message ?? "Unknown error"}`;
            setErrorMsg(msg);
          });
      } catch {
        if (mounted) {
          setStatus("error");
          setErrorMsg("Barcode scanner could not be loaded.");
        }
      }
    })();

    return () => {
      mounted = false;
      controlsRef.current?.stop();
    };
  }, [handleBarcode]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Video feed */}
      <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-black border border-border shadow-inner">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Scanner reticle */}
        {status === "scanning" && (
          <>
            {/* Corner frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-40">
                {/* top-left */}
                <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-primary rounded-tl-sm" />
                {/* top-right */}
                <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-primary rounded-tr-sm" />
                {/* bottom-left */}
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-primary rounded-bl-sm" />
                {/* bottom-right */}
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-primary rounded-br-sm" />
                {/* sweep line */}
                <ScanLine
                  size={224}
                  className="absolute top-1/2 -translate-y-1/2 left-0 text-primary/60 animate-pulse"
                />
              </div>
            </div>
          </>
        )}

        {/* Starting overlay */}
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-white text-sm animate-pulse">Starting camera…</p>
          </div>
        )}

        {/* Found flash */}
        {status === "found" && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
            <p className="text-primary font-semibold text-base">✓ Barcode found!</p>
          </div>
        )}
      </div>

      {/* Status / error */}
      {status === "scanning" && (
        <p className="text-xs text-muted-foreground text-center">
          Point your camera at a product barcode
        </p>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 max-w-sm">
          <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function BarcodeScanOverlay({ onResult, onClose }: BarcodeScanOverlayProps) {
  const mobile = isMobileDevice();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full sm:max-w-sm mx-auto bg-popover rounded-t-2xl sm:rounded-2xl border border-border shadow-xl p-5 pb-8 sm:pb-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading text-foreground text-lg font-semibold">
            {mobile ? "Scan barcode" : "Scan with your phone"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {mobile ? (
          <MobileCameraScanner onResult={onResult} />
        ) : (
          <DesktopQrPanel onClose={onClose} />
        )}
      </div>
    </div>
  );
}
