interface Props {
  count?: number;
}

function SingleSkeleton() {
  return (
    <div
      className="product-card h-full rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03]"
      aria-hidden
    >
      <div className="skeleton-block w-full aspect-square" />
      <div className="p-3 space-y-2.5 flex flex-col flex-1 min-h-0">
        <div className="skeleton-block h-3.5 w-full rounded-md" />
        <div className="skeleton-block h-3.5 w-[80%] rounded-md" />
        <div className="skeleton-block h-2.5 w-20 rounded-md" />
      </div>
      <div className="product-card__footer px-3 pb-3">
        <div className="skeleton-block h-[2.375rem] w-full rounded-lg" />
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
