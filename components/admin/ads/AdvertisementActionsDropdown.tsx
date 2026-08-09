'use client'

import { useState } from 'react'
import { MoreHorizontal, Eye, Pencil, Copy, CheckCircle, XCircle, Archive, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Advertisement } from '@/lib/advertisements/types'

interface AdvertisementActionsDropdownProps {
  ad: Advertisement
  onView?: (ad: Advertisement) => void
  onEdit?: (ad: Advertisement) => void
  onDuplicate?: (ad: Advertisement) => void
  onPublish?: (ad: Advertisement) => void
  onDisable?: (ad: Advertisement) => void
  onArchive?: (ad: Advertisement) => void
  onRestore?: (ad: Advertisement) => void
  onDelete?: (ad: Advertisement) => void
  className?: string
}

export function AdvertisementActionsDropdown({
  ad,
  onView,
  onEdit,
  onDuplicate,
  onPublish,
  onDisable,
  onArchive,
  onRestore,
  onDelete,
  className,
}: AdvertisementActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleAction = (callback?: (ad: Advertisement) => void) => {
    if (callback) {
      callback(ad)
    }
    setIsOpen(false)
  }

  const isPublished = ad.isEnabled && !ad.isArchived
  const isArchived = ad.isArchived

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={cn('h-8 w-8', className)}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleAction(onView)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction(onEdit)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction(onDuplicate)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isPublished && !isArchived && (
          <DropdownMenuItem onClick={() => handleAction(onPublish)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Publish
          </DropdownMenuItem>
        )}
        {isPublished && (
          <DropdownMenuItem onClick={() => handleAction(onDisable)}>
            <XCircle className="mr-2 h-4 w-4" />
            Disable
          </DropdownMenuItem>
        )}
        {!isArchived && (
          <DropdownMenuItem onClick={() => handleAction(onArchive)}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
        {isArchived && (
          <DropdownMenuItem onClick={() => handleAction(onRestore)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleAction(onDelete)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
