import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse motion-reduce:animate-none rounded-md", className)}
      {...props}
    />
  )
}

// Subtle muted loading surface for normal content placeholders (text lines,
// images, controls). Much lighter than the default accent surface so large
// skeletons read as "content loading", not heavy gray blocks.
function SkeletonSubtle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-subtle"
      className={cn("bg-muted animate-pulse motion-reduce:animate-none rounded-md", className)}
      {...props}
    />
  )
}

// Heading/title placeholder — primary at half strength. Reserved for main
// page titles, broker names, and key section headings; used sparingly.
function SkeletonHeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-heading"
      className={cn("bg-primary/30 animate-pulse motion-reduce:animate-none rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton, SkeletonSubtle, SkeletonHeading }
