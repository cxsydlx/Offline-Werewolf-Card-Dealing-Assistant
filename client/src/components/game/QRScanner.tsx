import { useEffect, useRef, useState } from "react";

// @ts-ignore - html5-qrcode 无类型声明
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onResult: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onResult, onClose }: Props) {
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (stoppedRef.current) return;
          const match = decodedText.match(/\/room\/([A-Z0-9]{6})/i);
          const code = match ? match[1] : decodedText.replace(/[^A-Z0-9]/gi, "").slice(0, 6);
          if (code.length === 6) {
            stoppedRef.current = true;
            scanner.stop().catch(() => {});
            onResult(code.toUpperCase());
          }
        },
        () => {}
      )
      .catch((err: any) => {
        setError("无法启动摄像头: " + (err as any)?.message || "未知错误");
      });

    return () => {
      stoppedRef.current = true;
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <button onClick={onClose} className="text-white text-lg px-4 py-2">
          ✕ 关闭
        </button>
        <span className="text-white font-semibold">扫描房间二维码</span>
        <div className="w-16" />
      </div>

      {/* 扫描区域 */}
      <div className="flex-1 relative">
        {error ? (
          <div className="flex items-center justify-center h-full text-white p-8 text-center">
            <div>
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={onClose} className="btn-primary px-6 py-3">返回</button>
            </div>
          </div>
        ) : (
          <>
            <div id="qr-reader" className="w-full h-full" />
            {/* 扫描框 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--accent)] rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--accent)] rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--accent)] rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--accent)] rounded-br-lg" />
              </div>
            </div>
            <p className="absolute bottom-16 left-0 right-0 text-center text-white/70 text-sm">
              将二维码置于框内自动识别
            </p>
          </>
        )}
      </div>
    </div>
  );
}
