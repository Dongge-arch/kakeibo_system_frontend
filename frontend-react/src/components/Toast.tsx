type ToastProps = {
  message: string;
  tone?: "success" | "error" | "info";
  onClose: () => void;
};

export function Toast({ message, tone = "info", onClose }: ToastProps) {
  if (!message) return null;
  return (
    <button type="button" className={`toast toast--${tone}`} onClick={onClose}>
      {message}
    </button>
  );
}
