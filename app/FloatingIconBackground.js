import Image from "next/image";

const icons = [
  { src: "/utensil.png", size: 112, x: "7%", y: "14%", delay: "-2s", duration: "15s", rotate: "-14deg" },
  { src: "/tree.png", size: 150, x: "72%", y: "8%", delay: "-7s", duration: "18s", rotate: "9deg" },
  { src: "/hibiscus.png", size: 104, x: "48%", y: "61%", delay: "-11s", duration: "16s", rotate: "-6deg" },
  { src: "/tree.png", size: 92, x: "12%", y: "72%", delay: "-5s", duration: "17s", rotate: "12deg" },
  { src: "/utensil.png", size: 80, x: "82%", y: "69%", delay: "-9s", duration: "14s", rotate: "18deg" },
  { src: "/soup-pot.png", size: 72, x: "38%", y: "18%", delay: "-13s", duration: "19s", rotate: "8deg" },
];

export default function FloatingIconBackground({ className = "", opacity = 0.15 }) {
  return (
    <div className={`floating-icon-background ${className}`.trim()} aria-hidden="true" style={{ opacity }}>
      {icons.map((icon, index) => (
        <span
          className="floating-icon"
          key={`${icon.src}-${index}`}
          style={{
            "--icon-delay": icon.delay,
            "--icon-duration": icon.duration,
            "--icon-rotate": icon.rotate,
            "--icon-x": icon.x,
            "--icon-y": icon.y
          }}
        >
          <Image src={icon.src} alt="" width={icon.size} height={icon.size} />
        </span>
      ))}
    </div>
  );
}
