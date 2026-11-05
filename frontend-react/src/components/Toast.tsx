import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastProps = {
  message: string;
  tone?: "success" | "error" | "info";
  onClose: () => void;
};

export function Toast({ message, tone = "info", onClose }: ToastProps) {
  if (!message) return null;
  const ToneIcon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
  return (
    <div className={`toast toast--${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <ToneIcon className="toast-icon" size={20} />
      <span>{message}</span>
      <button type="button" aria-label="通知を閉じる" onClick={onClose}><X size={17} /></button>
    </div>
  );
}
