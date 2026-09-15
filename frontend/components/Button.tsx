import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-royal-purple hover:bg-royal-purple-hover text-ivory",
  secondary: "bg-charcoal hover:bg-charcoal/80 text-ivory border border-soft-gray/30",
  danger: "bg-error hover:bg-error/90 text-ivory",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
