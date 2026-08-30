/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { FolderOpen, Plus, MoreVertical, Edit, Trash2, ChevronRight, ChevronDown, Folder } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMediaFolders, useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useAdminAds'
import { toast } from 'react-hot-toast'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import type { MediaFolderWithCount } from '@/lib/advertisements/types'
import { cn } from '@/lib/utils'

export default function FoldersPage() {
  const { folders, isLoading, mutate } = useMediaFolders()
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

  const rootFolders = folders.filter((f: any) => !f.parentId)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Folders"
        description="Organize your media assets into folders"
        actionLabel="New Folder"
        onAction={() => document.getElementById('new-folder-root')?.focus()}
      />

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : rootFolders.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">No folders yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create a folder to organize your media assets</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootFolders.map((folder: any) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  level={0}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editingName={editingName}
                  setEditingName={setEditingName}
                  handleRename={handleRename}
                  deletingId={deletingId}
                  setDeletingId={setDeletingId}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex gap-2">
              <Input
                id="new-folder-root"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={() => handleCreate()}>
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  )
}

interface FolderTreeItemProps {
  folder: MediaFolderWithCount
  folders: MediaFolderWithCount[]
  level: number
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
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
  folder,
  folders,
  level,
  expandedIds,
  toggleExpand,
  editingId,
  setEditingId,
  editingName,
  setEditingName,
  handleRename,
  deletingId,
  setDeletingId,
  handleDelete,
}: FolderTreeItemProps) {
  const children = folders.filter((f) => f.parentId === folder.id)
  const isExpanded = expandedIds.has(folder.id)

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted transition-colors group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {children.length > 0 && (
          <button onClick={() => toggleExpand(folder.id)} className="p-0.5 hover:bg-muted rounded">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        <Folder className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium flex-1">{folder.name}</span>
        <Badge variant="secondary" className="text-xs">{folder._count?.assets || 0} assets</Badge>
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
        <div className="flex items-center gap-2 py-1 px-2" style={{ paddingLeft: `${(level + 1) * 16 + 24}px` }}>
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="flex-1 h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(folder.id); if (e.key === 'Escape') setEditingId(null); }}
          />
          <Button size="sm" onClick={() => handleRename(folder.id)}>Save</Button>
        </div>
      )}

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              folders={folders}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              editingId={editingId}
              setEditingId={setEditingId}
              editingName={editingName}
              setEditingName={setEditingName}
              handleRename={handleRename}
              deletingId={deletingId}
              setDeletingId={setDeletingId}
              handleDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

