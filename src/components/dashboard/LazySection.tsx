import { ReactNode } from "react";
import { useInView } from "@/hooks/useInView";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  children: ReactNode;
  minHeight?: number;
  className?: string;
  fallback?: ReactNode;
}

export function LazySection({ children, minHeight = 240, className, fallback }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={!inView ? { minHeight } : undefined}>
      {inView ? children : (fallback ?? <SectionSkeleton h={minHeight} />)}
    </div>
  );
}
