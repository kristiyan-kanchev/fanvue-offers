import Image from "next/image";

export function BrandMark({ size = 28 }: { size?: number }) {
  return <Image src="/brand/offers-mark.png" alt="" width={size} height={size} priority className="brand-mark shrink-0" />;
}
