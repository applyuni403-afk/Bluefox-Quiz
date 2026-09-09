'use client';

import Image from 'next/image';
import { ExternalLink, Sparkles } from 'lucide-react';

interface PartnerBannerProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export const KAROBAR_PARTNER_URL = 'https://open.karobarapp.com/?c=RdZXWp';
export const KAROBAR_PROMO_CODE = 'BLUEFOX';

export function PartnerBanner({
  className = '',
  showLabel = false,
  compact = false,
}: PartnerBannerProps) {
  return (
    <div className={`w-full ${className}`}>
      <a
        href={KAROBAR_PARTNER_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Official Partner: Karobar App - Use promo code BLUEFOX for up to 30% discount!"
        className="group relative block w-full overflow-hidden rounded-2xl border border-emerald-200/90 bg-white/90 shadow-[0_4px_20px_rgba(16,185,129,0.08)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.2)] hover:border-emerald-400 transition-all duration-300 hover:scale-[1.01]"
      >
        {showLabel && (
          <div className="flex items-center justify-between px-3 py-1 bg-gradient-to-r from-emerald-800 to-teal-800 text-white text-[10px] sm:text-[11px] font-bold">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                Official Partner &bull; Use Promo Code{' '}
                <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.2 rounded text-[10px]">
                  {KAROBAR_PROMO_CODE}
                </span>{' '}
                for up to 30% Off
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-200 uppercase tracking-wider font-bold shrink-0 ml-2">
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        )}

        <div className={`relative w-full ${compact ? 'aspect-[1024/290]' : 'aspect-[1024/315]'} overflow-hidden bg-slate-100`}>
          <Image
            src="/karobar-banner.jpg"
            alt="Karobar App - Official Partner, Use promo code BLUEFOX for up to 30% discount on plans"
            width={1024}
            height={315}
            priority={false}
            unoptimized
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />

          {/* Floating Call-to-action on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-2 sm:p-2.5 pointer-events-none">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold bg-white/95 text-emerald-900 px-2.5 py-1 rounded-xl shadow-md backdrop-blur-xs">
              <span>Claim Discount (Code: {KAROBAR_PROMO_CODE})</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}
