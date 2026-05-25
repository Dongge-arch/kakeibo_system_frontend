import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

type IconButtonProps = {
  label: string;
  icon: ComponentType<LucideProps>;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "plain" | "solid" | "danger";
  type?: "button" | "submit";
};

export function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "plain",
  type = "button"
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-button icon-button--${variant}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={18} strokeWidth={2.1} />
    </button>
  );
}
