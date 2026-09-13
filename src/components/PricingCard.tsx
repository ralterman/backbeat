"use client";

import React from "react";
import Link from "next/link";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  name: string;
  price: number | null;
  priceSuffix?: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
  priceNote?: string;
}

export function PricingCard({
  name,
  price,
  priceSuffix = "/mo",
  description,
  features,
  cta,
  ctaHref,
  highlighted = false,
  badge,
  priceNote,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 sm:p-8 transition-all duration-300 ${
        highlighted
          ? "border border-[#C8A96E]/40 bg-[#0d0d1a]/60 shadow-[0_0_30px_rgba(200,169,110,0.15)] sm:scale-105"
          : "border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm hover:border-white/[0.12] hover:shadow-[0_0_20px_rgba(200,169,110,0.06)]"
      }`}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-[#C8A96E] text-[#0a0a0f] text-[10px] font-bold px-4 py-1.5 rounded-full tracking-widest uppercase">
            {badge}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-white text-xl font-bold mb-2 tracking-tight">{name}</h3>
        <p className="text-[#a0a0b8] text-sm leading-relaxed">{description}</p>
      </div>

      <div className="mb-8">
        {price === null ? (
          <p className="text-4xl font-bold text-white tracking-tight">Custom</p>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white tracking-tight">${price}</span>
              <span className="text-[#a0a0b8] text-sm mb-1.5">{priceSuffix}</span>
            </div>
            {priceNote && (
              <p className="text-[#C8A96E] text-xs mt-2 font-medium">{priceNote}</p>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            {feature.included ? (
              <svg className="w-5 h-5 text-[#C8A96E] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[#252535] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className={feature.included ? "text-[#e0e0e8] text-sm" : "text-[#353545] text-sm line-through"}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
          highlighted
            ? "bg-white hover:bg-[#f0f0f0] hover:-translate-y-0.5 text-[#0a0a0f] font-bold shadow-md"
            : "bg-white/[0.06] hover:bg-white/[0.1] hover:-translate-y-0.5 text-white border border-white/10"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
