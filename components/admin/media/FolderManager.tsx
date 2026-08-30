/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { FolderOpen, Folder, ChevronRight, ChevronDown, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { useMediaFolders, useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useAdminAds'
import type { MediaFolderWithCount } from '@/lib/advertisements/types'
import { cn } from '@/lib/utils'

interface FolderManagerProps {
  onSelectFolder?: (folderId: string | null) => void
  selectedFolderId?: string | null
}

export function FolderManager({ onSelectFolder, selectedFolderId }: FolderManagerProps) {
  const { folders, isLoading } = useMediaFolders()
  const { createFolder } = useCreateFolder()
  const { updateFolder } = useUpdateFolder()
  const { deleteFolder } = useDeleteFolder()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [newFolderName, setNewFolderName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async (parentId?: string) => {
    if (!newFolderName.trim()) return
    try {
      await createFolder({ name: newFolderName.trim(), parentId })
      setNewFolderName('')
      toast.success('Folder created')
    } catch {
      toast.error('Failed to create folder')
    }
  }

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return
    try {
      await updateFolder(id, { name: editingName.trim() })
      setEditingId(null)
      toast.success('Folder renamed')
    } catch {
      toast.error('Failed to rename folder')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteFolder(id)
      setDeletingId(null)
      toast.success('Folder deleted')
    } catch {
      toast.error('Failed to delete folder')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md border border-border bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <FolderOpen className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Folders</h3>
        <Badge variant="secondary" className="text-xs">{folders.length}</Badge>
      </div>

      {folders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No folders yet. Create one to organize your media.</p>
      ) : (
        <div className="space-y-1">
          <FolderTreeItem
            folders={folders}
            level={0}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            editingId={editingId}
            setEditingId={setEditingId}
            editingName={editingName}
            setEditingName={setEditingName}
            handleRename={handleRename}
            deletingId={deletingId}
            setDeletingId={setDeletingId}
            handleDelete={handleDelete}
          />
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder name"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button size="sm" onClick={() => handleCreate()}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        </div>
      </div>
    </div>
  )
}

interface FolderTreeItemProps {
  folders: MediaFolderWithCount[]
  level: number
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  selectedFolderId: string | null | undefined
  onSelectFolder?: (folderId: string | null) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  editingName: string
  setEditingName: (name: string) => void
  handleRename: (id: string) => void
  deletingId: string | null
  setDeletingId: (id: string | null) => void
  handleDelete: (id: string) => void
}

function FolderTreeItem({
  folders,
  level,
  expandedIds,
  toggleExpand,
  selectedFolderId,
  onSelectFolder,
  editingId,
  setEditingId,
  editingName,
  setEditingName,
  handleRename,
  deletingId,
  setDeletingId,
  handleDelete,
}: FolderTreeItemProps) {
  const rootFolders = folders.filter((f) => !f.parentId)

  return (
    <>
      {rootFolders.map((folder) => {
        const isExpanded = expandedIds.has(folder.id)
        const isSelected = selectedFolderId === folder.id
        const children = folders.filter((f) => f.parentId === folder.id)

        return (
          <div key={folder.id}>
            <div
              className={cn(
                'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors group',
                isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
              {children.length > 0 && (
                <button onClick={() => toggleExpand(folder.id)} className="p-0.5 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              )}
              <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => onSelectFolder?.(folder.id)}>
                <Folder className={cn('h-4 w-4 shrink-0', isSelected && 'text-primary')} />
                <span className="text-sm truncate">{folder.name}</span>
                <Badge variant="secondary" className="text-xs">{folder._count?.assets || 0}</Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}>
                    <Edit className="h-4 w-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeletingId(folder.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {editingId === folder.id && (
              <div className="flex items-center gap-2 py-1 px-2" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(folder.id); if (e.key === 'Escape') setEditingId(null); }}
                />
                <Button size="sm" onClick={() => handleRename(folder.id)}>Save</Button>
              </div>
            )}

            {isExpanded && children.length > 0 && (
              <FolderTreeItem
                folders={children}
                level={level + 1}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                editingId={editingId}
                setEditingId={setEditingId}
                editingName={editingName}
                setEditingName={setEditingName}
                handleRename={handleRename}
                deletingId={deletingId}
                setDeletingId={setDeletingId}
                handleDelete={handleDelete}
              />
            )}
          </div>
        )
      })}

      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will delete the folder and all its assets. This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingId && handleDelete(deletingId)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

