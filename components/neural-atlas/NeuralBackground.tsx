export function NeuralBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Base dark background */}
      <div className="fixed inset-0 bg-[#020306]" />

      {/* SVG dendrite overlay - spread across entire page */}
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Top-left dendrite cluster */}
          <polyline points="0,120 45,135 78,128 120,145 168,138 210,152" stroke="rgba(180,200,195,0.10)" strokeWidth="1" />
          <polyline points="120,145 135,178 148,212 142,258" stroke="rgba(160,185,190,0.07)" strokeWidth="0.7" />
          <polyline points="168,138 195,125 232,138 268,128 310,142" stroke="rgba(170,190,195,0.06)" strokeWidth="0.6" />
          <circle cx="120" cy="145" r="1.2" fill="rgba(180,200,195,0.12)" />
          <circle cx="168" cy="138" r="1" fill="rgba(170,190,195,0.10)" />

          {/* Top-center dendrite */}
          <polyline points="450,80 490,95 535,85 582,98 630,88 678,102" stroke="rgba(102,227,255,0.08)" strokeWidth="0.8" />
          <polyline points="535,85 548,118 538,155 552,188" stroke="rgba(102,227,255,0.05)" strokeWidth="0.5" />
          <circle cx="535" cy="85" r="1" fill="rgba(102,227,255,0.12)" />

          {/* Top-right dendrite cluster */}
          <polyline points="1200,80 1155,92 1108,82 1058,98 1008,88 958,105" stroke="rgba(175,195,200,0.09)" strokeWidth="0.9" />
          <polyline points="1058,98 1045,135 1062,172 1048,210" stroke="rgba(160,180,190,0.06)" strokeWidth="0.6" />
          <circle cx="1058" cy="98" r="1.1" fill="rgba(175,195,200,0.11)" />

          {/* Left-side mid dendrite */}
          <polyline points="0,380 48,392 98,378 148,395 198,382 248,398" stroke="rgba(167,139,250,0.08)" strokeWidth="0.8" />
          <polyline points="148,395 162,432 148,470 165,508" stroke="rgba(167,139,250,0.05)" strokeWidth="0.5" />
          <circle cx="148" cy="395" r="1" fill="rgba(167,139,250,0.12)" />

          {/* Center-left dendrite */}
          <polyline points="280,480 325,492 372,478 420,495 468,482" stroke="rgba(180,200,195,0.07)" strokeWidth="0.7" />
          <polyline points="372,478 385,515 368,555" stroke="rgba(160,185,190,0.05)" strokeWidth="0.5" />
          <circle cx="372" cy="478" r="0.9" fill="rgba(180,200,195,0.10)" />

          {/* Center dendrite */}
          <polyline points="520,350 568,365 618,352 668,370 718,355 768,372" stroke="rgba(102,227,255,0.06)" strokeWidth="0.7" />
          <polyline points="618,352 632,388 615,428 635,465" stroke="rgba(102,227,255,0.04)" strokeWidth="0.5" />
          <circle cx="618" cy="352" r="0.8" fill="rgba(102,227,255,0.10)" />

          {/* Right-side mid dendrite cluster */}
          <polyline points="1200,380 1152,395 1102,382 1052,398 1002,385 952,402" stroke="rgba(175,195,200,0.08)" strokeWidth="0.8" />
          <polyline points="1052,398 1038,438 1055,478 1038,518" stroke="rgba(160,180,190,0.05)" strokeWidth="0.5" />
          <circle cx="1052" cy="398" r="1" fill="rgba(175,195,200,0.10)" />

          {/* Center-right dendrite */}
          <polyline points="850,520 898,535 948,522 998,538 1048,525" stroke="rgba(167,139,250,0.06)" strokeWidth="0.6" />
          <polyline points="948,522 962,558 945,598" stroke="rgba(167,139,250,0.04)" strokeWidth="0.4" />
          <circle cx="948" cy="522" r="0.8" fill="rgba(167,139,250,0.10)" />

          {/* Bottom-left dendrite cluster */}
          <polyline points="0,680 52,695 105,682 158,698 212,685 265,702" stroke="rgba(170,190,200,0.08)" strokeWidth="0.85" />
          <polyline points="158,698 172,738 155,778 175,818" stroke="rgba(155,180,190,0.05)" strokeWidth="0.6" />
          <circle cx="158" cy="698" r="1" fill="rgba(170,190,200,0.10)" />

          {/* Bottom-center dendrite */}
          <polyline points="420,750 468,765 518,752 568,768 618,755 668,772" stroke="rgba(102,227,255,0.07)" strokeWidth="0.7" />
          <polyline points="518,752 532,788 515,828 535,865" stroke="rgba(102,227,255,0.04)" strokeWidth="0.5" />
          <circle cx="518" cy="752" r="0.9" fill="rgba(102,227,255,0.11)" />

          {/* Lower-right sparse dendrite */}
          <polyline points="1200,620 1148,635 1098,622 1048,638 998,625 948,642" stroke="rgba(170,185,195,0.07)" strokeWidth="0.7" />
          <polyline points="1048,638 1062,678 1045,718 1065,758" stroke="rgba(155,175,185,0.05)" strokeWidth="0.5" />
          <circle cx="1048" cy="638" r="0.9" fill="rgba(170,185,195,0.09)" />

          {/* Bottom-right dendrite */}
          <polyline points="1200,820 1152,835 1102,822 1052,838 1002,825" stroke="rgba(175,195,200,0.08)" strokeWidth="0.8" />
          <polyline points="1052,838 1038,875 1058,900" stroke="rgba(160,180,190,0.05)" strokeWidth="0.5" />
          <circle cx="1052" cy="838" r="0.9" fill="rgba(175,195,200,0.10)" />

          {/* Extra scattered nodes for depth */}
          <circle cx="350" cy="220" r="0.6" fill="rgba(102,227,255,0.08)" />
          <circle cx="780" cy="180" r="0.7" fill="rgba(167,139,250,0.08)" />
          <circle cx="920" cy="280" r="0.5" fill="rgba(180,200,195,0.08)" />
          <circle cx="180" cy="550" r="0.6" fill="rgba(102,227,255,0.07)" />
          <circle cx="680" cy="620" r="0.7" fill="rgba(175,195,200,0.08)" />
          <circle cx="320" cy="780" r="0.5" fill="rgba(167,139,250,0.07)" />
          <circle cx="850" cy="750" r="0.6" fill="rgba(180,200,195,0.08)" />
        </g>
      </svg>

      {/* Bottom fade gradient */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-bg-deep via-bg-deep/80 to-transparent" />

      {/* Top fade gradient for content readability */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg-deep/60 to-transparent" />
    </div>
  );
}
