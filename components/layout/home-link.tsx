import Link from "next/link";

export type HomeLinkProps = {
  className?: string;
  label?: string;
};

export function HomeLink({
  className,
  label = "Back to home",
}: HomeLinkProps) {
  return (
    <Link
      className={className}
      data-home-link="true"
      href="/"
      aria-label={label}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
