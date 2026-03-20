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
      className={`relative flex flex-col rounded-2xl p-8 border transition-all ${
        highlighted
          ? "border-[#c8b97a] bg-[#0d0d1a]/60 shadow-2xl shadow-[#c8b97a]/10 scale-105"
          : "border-[#2A2A2A] bg-[#141414]"
      }`}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-[#c8b97a] text-[#0a0a0f] text-sm font-bold px-4 py-1 rounded-full">
            {badge}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-white text-xl font-bold mb-2">{name}</h3>
        <p className="text-[#a0a0b8] text-sm">{description}</p>
      </div>

      <div className="mb-8">
        {price === null ? (
          <p className="text-4xl font-bold text-white">Custom</p>
        ) : (
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">${price}</span>
              <span className="text-[#a0a0b8] text-sm mb-1">{priceSuffix}</span>
            </div>
            {priceNote && (
              <p className="text-white text-xs mt-1.5">{priceNote}</p>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            {feature.included ? (
              <svg className="w-5 h-5 text-[#c8b97a] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[#252535] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            )}
            <span className={feature.included ? "text-white text-sm" : "text-[#252535] text-sm line-through"}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
          highlighted
            ? "bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold"
            : "bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white border border-[#2A2A2A]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
