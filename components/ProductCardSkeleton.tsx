interface Props {
  count?: number;
}

function SingleSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03]"
      aria-hidden
    >
      <div className="skeleton-block w-full aspect-square" />
      <div className="p-3 space-y-2.5">
        <div className="skeleton-block h-3.5 w-full rounded-md" />
        <div className="skeleton-block h-3.5 w-[80%] rounded-md" />
        <div className="flex gap-2">
          <div className="skeleton-block h-2.5 w-16 rounded-md" />
          <div className="skeleton-block h-2.5 w-12 rounded-md" />
        </div>
        <div className="skeleton-block h-2.5 w-20 rounded-md" />
        <div className="skeleton-block h-3 w-24 rounded-md mt-1" />
      </div>
    </div>
  );
}

export default function ProductCardSkeleton({ count = 8 }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </>
  );
}
