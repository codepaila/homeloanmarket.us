/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { motion } from 'motion/react'
import { FileImage } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MediaListProps {
  assets: any[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAsset: (asset: any) => void
  folders: any[]
}

export function MediaList({ assets, selectedIds, onToggleSelect, onSelectAsset, folders }: MediaListProps) {
  const folderMap = new Map(folders.map(f => [f.id, f.name]))

  if (assets.length === 0) {
    return (
      <div className="text-center py-16">
        <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No media assets found</p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground w-10">
                <input type="checkbox" className="rounded" onChange={(e) => {
                  if (e.target.checked) assets.forEach(a => onToggleSelect(a.id))
                  else assets.forEach(a => selectedIds.has(a.id) && onToggleSelect(a.id))
                }} />
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Preview</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Filename</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Folder</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Dimensions</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Size</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Format</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Created</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset, index) => (
              <motion.tr
                key={asset.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className={cn('hover:bg-muted/30 transition-colors cursor-pointer', selectedIds.has(asset.id) && 'bg-primary/5')}
                onDoubleClick={() => onSelectAsset(asset)}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(asset.id)}
                    onChange={() => onToggleSelect(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                </td>
                <td className="p-3">
                  <div className="h-10 w-10 rounded-md bg-muted overflow-hidden">
                    <img src={asset.thumbnailUrl || asset.fileUrl} alt={asset.fileName} className="h-full w-full object-cover" />
                  </div>
                </td>
                <td className="p-3">
                  <p className="text-sm font-medium truncate max-w-[200px]">{asset.originalName}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{asset.title || asset.fileName}</p>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{asset.folderId ? folderMap.get(asset.folderId) || '—' : 'Root'}</td>
                <td className="p-3 text-sm text-muted-foreground">{asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{formatFileSize(asset.fileSize)}</td>
                <td className="p-3">
                  <Badge variant="secondary" className="text-xs">{asset.extension.toUpperCase()}</Badge>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <Button variant="ghost" size="sm" onClick={() => onSelectAsset(asset)}>View</Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

