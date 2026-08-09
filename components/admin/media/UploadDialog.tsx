'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Upload, X, FileImage, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { useMediaFolders, useUploadAsset, useCreateFolder } from '@/hooks/useAdminAds'
import { cn, formatFileSize } from '@/lib/utils'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId?: string | null
  onUploaded?: () => void
}

interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  asset?: {
    id: string
    fileName: string
    fileUrl: string
    thumbnailUrl: string | null
    width: number | null
    height: number | null
    fileSize: number
    mimeType: string
  }
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024

export function UploadDialog({ open, onOpenChange, folderId, onUploaded }: UploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [altText, setAltText] = useState('')
  const [targetFolderId, setTargetFolderId] = useState(folderId || '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadAsset, isPending } = useUploadAsset()
  const { folders } = useMediaFolders()
  const { createFolder } = useCreateFolder()
  const [newFolderName, setNewFolderName] = useState('')

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported image format. Please upload JPG, PNG, WebP, or GIF.`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Image is too large. Maximum allowed size is 10 MB.`
    }
    return null
  }

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadFile[] = []
    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file)
      validFiles.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      })
    })
    setFiles((prev) => [...prev, ...validFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.clipboardData?.files?.length) {
      addFiles(e.clipboardData.files)
    }
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files)
    }
  }, [addFiles])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) return

    for (const uploadFile of pendingFiles) {
      setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f))

      try {
        const formData = new FormData()
        formData.append('file', uploadFile.file)
        formData.append('altText', altText || uploadFile.file.name)
        if (targetFolderId) formData.append('folderId', targetFolderId)

        const asset = await uploadAsset(formData)

        setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? {
          ...f,
          status: 'success',
          progress: 100,
          asset: {
            id: asset.id,
            fileName: asset.fileName,
            fileUrl: asset.fileUrl,
            thumbnailUrl: asset.thumbnailUrl,
            width: asset.width,
            height: asset.height,
            fileSize: asset.fileSize,
            mimeType: asset.mimeType,
          },
        } : f))
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, status: 'error', error: message } : f))
      }
    }

    const successCount = files.filter((f) => f.status === 'success').length + pendingFiles.length
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount !== 1 ? 's' : ''} uploaded successfully`)
      onUploaded?.()
    }
  }, [files, altText, targetFolderId, uploadAsset, onUploaded])

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return
    try {
      const folder = await createFolder({ name: newFolderName.trim() })
      setTargetFolderId(folder.id)
      setNewFolderName('')
      toast.success(`Folder "${folder.name}" created`)
    } catch {
      toast.error('Failed to create folder')
    }
  }, [newFolderName, createFolder])

  const handleClose = useCallback(() => {
    setFiles([])
    setAltText('')
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4',
          open ? 'block' : 'hidden'
        )}
        onPaste={open ? handlePaste : undefined}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-background border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Upload Media</h2>
              <p className="text-sm text-text-muted">Drag & drop images or paste from clipboard</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium">Drop images here, click to browse, or paste</p>
              <p className="text-xs text-text-muted mt-1">JPEG, PNG, WebP, GIF, SVG — Max 10 MB</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Alt Text</label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Description for accessibility"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Folder</label>
                <div className="flex gap-2">
                  <select
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    <option value="">Root</option>
                    {folders.map((folder: { id: string; name: string }) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name"
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleCreateFolder}>Create</Button>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-10 w-10 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                      {file.status === 'success' && file.asset ? (
                        <img src={file.asset.thumbnailUrl || file.asset.fileUrl} alt="" className="h-full w-full object-cover" />
                      ) : file.status === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : file.status === 'uploading' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <FileImage className="h-5 w-5 text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <p className="text-xs text-text-muted">{formatFileSize(file.file.size)}</p>
                      {file.status === 'uploading' && <Progress value={file.progress} className="h-1 mt-1" />}
                      {file.status === 'error' && <p className="text-xs text-destructive mt-0.5">{file.error}</p>}
                    </div>
                    <Badge variant={file.status === 'success' ? 'default' : file.status === 'error' ? 'destructive' : 'secondary'}>
                      {file.status}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)} disabled={file.status === 'uploading'}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button onClick={uploadFiles} disabled={files.length === 0 || isPending || files.every((f) => f.status !== 'pending')}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Upload {files.filter((f) => f.status === 'pending').length} file{files.filter((f) => f.status === 'pending').length !== 1 ? 's' : ''}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
