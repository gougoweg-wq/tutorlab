import { Skeleton, SkeletonRows } from "@/ui/states";
export default function Loading() { return (<div><Skeleton className="h-9 w-64 mb-3" /><Skeleton className="h-5 w-96 max-w-full mb-10" /><SkeletonRows rows={6} /></div>); }
