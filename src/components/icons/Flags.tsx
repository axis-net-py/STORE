import React from "react";

export function BrazilFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 504"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Green background */}
      <rect width="720" height="504" fill="#009739" />
      {/* Yellow rhombus */}
      <path d="M360 40L680 252L360 464L40 252Z" fill="#FEDF00" />
      {/* Blue circle */}
      <circle cx="360" cy="252" r="102" fill="#002776" />
      {/* White arc */}
      <path
        d="M258 268C310 236 410 236 462 268"
        stroke="#FFFFFF"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function ParaguayFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 540"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red stripe */}
      <rect width="900" height="180" fill="#D52B1E" />
      {/* White stripe */}
      <rect y="180" width="900" height="180" fill="#FFFFFF" />
      {/* Blue stripe */}
      <rect y="360" width="900" height="180" fill="#0038A8" />
      {/* Coat of arms outer circle */}
      <circle cx="450" cy="270" r="32" fill="#FFFFFF" stroke="#0038A8" strokeWidth="4" />
      {/* Yellow star inside coat of arms */}
      <path
        d="M450 255L453 264H462L455 269.5L457.5 278.5L450 273L442.5 278.5L445 269.5L438 264H447L450 255Z"
        fill="#FEDF00"
      />
      {/* Green ring around star representing branches */}
      <circle cx="450" cy="270" r="20" stroke="#009739" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
    </svg>
  );
}
