import Image from "next/image";

const LOGO_ASSETS = {
  primary: "/assets/logo-primary.png",
  inverse: "/assets/logo-inverse.png",
} as const;

const PLACEMENT_CLASSES = {
  header: "h-8 w-auto sm:h-9",
  footer: "h-10 w-auto",
} as const;

export type SiteLogoProps = {
  className?: string;
  eager?: boolean;
  placement?: keyof typeof PLACEMENT_CLASSES;
  variant?: keyof typeof LOGO_ASSETS;
};

export function SiteLogo({
  className = "",
  eager = false,
  placement = "header",
  variant = "primary",
}: SiteLogoProps) {
  const classes = `${PLACEMENT_CLASSES[placement]} shrink-0 object-contain ${className}`.trim();

  return (
    <Image
      alt="Niobium Studio"
      className={classes}
      height={80}
      loading={eager ? "eager" : "lazy"}
      sizes={placement === "footer" ? "48px" : "(min-width: 640px) 43px, 38px"}
      src={LOGO_ASSETS[variant]}
      unoptimized
      width={95}
    />
  );
}
