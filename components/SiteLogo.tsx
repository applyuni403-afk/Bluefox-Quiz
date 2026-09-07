import Image from 'next/image';

interface SiteLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withGlow?: boolean;
}

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-xl', px: 32 },
  md: { box: 'w-10 h-10 rounded-2xl', px: 40 },
  lg: { box: 'w-14 h-14 rounded-2xl', px: 56 },
  xl: { box: 'w-20 h-20 rounded-3xl', px: 80 },
};

export function SiteLogo({ size = 'md', className = '', withGlow = true }: SiteLogoProps) {
  const config = SIZES[size] || SIZES.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-[#0a0d14] border border-white/10 ${config.box} ${
        withGlow ? 'shadow-[0_0_25px_rgba(59,130,246,0.3)]' : ''
      } ${className}`}
    >
      <Image
        src="/logo.webp"
        alt="Bluefox Logo"
        width={config.px}
        height={config.px}
        priority
        className="w-full h-full object-cover select-none pointer-events-none"
      />
    </div>
  );
}
