"use client";
import { useId } from "react";
/** Preserve the approved AEMS artwork; only apply the ATM brand palette. */
export function AemsLogo({className = ""}: {className?: string}) {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="190 130 1830 480" role="img" aria-label="AEMS" className={`aems-logo block h-auto shrink-0 ${className}`}>
    <defs>
      <filter id={`${id}-light`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0" />
        <feComponentTransfer><feFuncR type="discrete" tableValues="0.051 0.922" /><feFuncG type="discrete" tableValues="0.059 0.137" /><feFuncB type="discrete" tableValues="0.047 0.176" /></feComponentTransfer>
      </filter>
      <filter id={`${id}-dark`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0" />
        <feComponentTransfer><feFuncR type="discrete" tableValues="1 0.051" /><feFuncG type="discrete" tableValues="1 0.059" /><feFuncB type="discrete" tableValues="1 0.047" /></feComponentTransfer>
      </filter>
    </defs>
    <image className="aems-logo-light" href="/logo-aems-atm.png" width="2170" height="725" filter={`url(#${id}-light)`} />
    <image className="aems-logo-dark" href="/logo-aems-atm.png" width="2170" height="725" filter={`url(#${id}-dark)`} />
  </svg>;
}
