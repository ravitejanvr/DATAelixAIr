import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleSkeleton() {
  return (
    <div>
      <section className="pt-28 pb-8 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <Skeleton className="h-4 w-48 mb-8" />
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-32 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-10 w-full max-w-3xl mb-2" />
          <Skeleton className="h-10 w-3/4 max-w-2xl mb-4" />
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </section>

      <section className="pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-[1fr_280px] gap-8">
            <div className="space-y-8">
              <div>
                <Skeleton className="h-5 w-28 mb-3" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
              <div>
                <Skeleton className="h-5 w-24 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
              <div>
                <Skeleton className="h-5 w-20 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            </div>
            <div className="hidden lg:block space-y-5">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
