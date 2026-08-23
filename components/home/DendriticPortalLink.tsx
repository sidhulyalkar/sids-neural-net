import Link from 'next/link';

type DendriticPortalTone = 'cyan' | 'violet';

type DendriticPortalLinkProps = {
  href: string;
  label: string;
  detail: string;
  ariaLabel: string;
  tone: DendriticPortalTone;
};

const toneClasses: Record<
  DendriticPortalTone,
  {
    branch: string;
    twig: string;
    node: string;
    signal: string;
    label: string;
    detail: string;
  }
> = {
  cyan: {
    branch: 'stroke-white/20 group-hover:stroke-cyan/50',
    twig: 'stroke-cyan/25 group-hover:stroke-cyan/65',
    node: 'fill-[#020306]/90 stroke-cyan/30 group-hover:fill-cyan/[0.08] group-hover:stroke-cyan/75',
    signal: 'fill-cyan/55 group-hover:fill-cyan',
    label: 'text-white/55 group-hover:text-cyan',
    detail: 'text-white/25 group-hover:text-cyan/55',
  },
  violet: {
    branch: 'stroke-white/20 group-hover:stroke-violet/50',
    twig: 'stroke-violet/25 group-hover:stroke-violet/65',
    node: 'fill-[#020306]/90 stroke-violet/30 group-hover:fill-violet/[0.08] group-hover:stroke-violet/75',
    signal: 'fill-violet/55 group-hover:fill-violet',
    label: 'text-white/55 group-hover:text-violet',
    detail: 'text-white/25 group-hover:text-violet/55',
  },
};

export function DendriticPortalLink({
  href,
  label,
  detail,
  ariaLabel,
  tone,
}: DendriticPortalLinkProps) {
  const classes = toneClasses[tone];

  return (
    <Link
      href={href}
      data-gesture-target
      data-home-portal={tone}
      aria-label={ariaLabel}
      className="group relative block h-12 w-40 opacity-85 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020306] motion-reduce:transition-none sm:h-[3.25rem] sm:w-44"
    >
      <span className="absolute left-0 top-1/2 z-10 w-[5.3rem] -translate-y-1/2 text-right sm:w-[5.8rem]">
        <span
          className={`block font-mono text-[9px] font-medium uppercase tracking-[0.18em] transition-colors duration-200 ${classes.label}`}
        >
          {label}
        </span>
        <span
          className={`mt-0.5 block font-mono text-[7px] uppercase tracking-[0.16em] transition-colors duration-200 ${classes.detail}`}
        >
          {detail}
        </span>
      </span>

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 176 52"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M84 26 C90 26 93 26 97 26"
          className={`transition-colors duration-200 ${classes.branch}`}
          strokeWidth="0.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M112 26 C123 26 130 24 138 21 C148 17 155 22 163 22 C168 22 172 20 176 20"
          className={`transition-colors duration-200 ${classes.branch}`}
          strokeWidth="0.9"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M138 21 C142 16 143 11 141 6"
          className={`transition-colors duration-200 ${classes.twig}`}
          strokeWidth="0.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M151 20 C154 27 160 32 168 35"
          className={`transition-colors duration-200 ${classes.twig}`}
          strokeWidth="0.65"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M129 24 C132 30 132 35 129 40"
          className={`transition-colors duration-200 ${classes.twig}`}
          strokeWidth="0.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle cx="141" cy="6" r="1.15" className={`transition-colors duration-200 ${classes.signal}`} />
        <circle cx="168" cy="35" r="1.05" className={`transition-colors duration-200 ${classes.signal}`} />
        <circle cx="129" cy="40" r="0.9" className={`transition-colors duration-200 ${classes.signal}`} />

        <polygon
          points="104 17 112 21.5 112 30.5 104 35 96 30.5 96 21.5"
          className={`transition-colors duration-200 ${classes.node}`}
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="104" cy="26" r="1.35" className={`transition-colors duration-200 ${classes.signal}`} />
      </svg>
    </Link>
  );
}
