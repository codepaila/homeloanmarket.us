import prisma from "@/lib/prisma"
import type { MediaAsset, MediaFolderWithCount } from "./types"

export class MediaRepository {
  static async findFolders(): Promise<MediaFolderWithCount[]> {
    return prisma.mediaFolder.findMany({
      where: { isDeleted: false },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    })
  }

  static async findFolderTree(): Promise<MediaFolderWithCount[]> {
    const folders = await this.findFolders()
    const folderMap = new Map<string, MediaFolderWithCount & { children: MediaFolderWithCount[] }>()

    for (const folder of folders) {
      folderMap.set(folder.id, { ...folder, children: [] })
    }

    const roots: MediaFolderWithCount[] = []
    for (const folder of folders) {
      const enhanced = folderMap.get(folder.id)
      if (!enhanced) continue

      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId)
        if (parent) {
          parent.children.push(folder)
        } else {
          roots.push(folder)
        }
      } else {
        roots.push(folder)
      }
    }

    return roots
  }

  static async findAssets(params: {
    page: number
    limit: number
    search?: string
    folderId?: string
  }): Promise<{ assets: MediaAsset[]; total: number }> {
    const { page, limit, search, folderId } = params
    const skip = (page - 1) * limit

    const where: any = { isDeleted: false }

    if (folderId) {
      where.folderId = folderId
    }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ]
    }

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.mediaAsset.count({ where }),
    ])

    return {
      assets: assets as MediaAsset[],
      total,
    }
  }

  static async findAsset(id: string): Promise<MediaAsset | null> {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id, isDeleted: false },
      include: { folder: true, uploader: { select: { id: true, name: true, email: true } } },
    })
    if (!asset) return null
    return asset as unknown as MediaAsset
  }

  static async findAssetByUrl(fileUrl: string): Promise<MediaAsset | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { fileUrl, isDeleted: false },
    })
    if (!asset) return null
    return asset as unknown as MediaAsset
  }

  static async findDeletedAssets(params: {
    page: number
    limit: number
    search?: string
  }): Promise<{ assets: MediaAsset[]; total: number }> {
    const { page, limit, search } = params
    const skip = (page - 1) * limit

    const where: any = { isDeleted: true }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
      ]
    }

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.mediaAsset.count({ where }),
    ])

    return { assets: assets as MediaAsset[], total }
  }

  static async createFolder(data: {
    name: string
    parentId?: string | null
  }): Promise<MediaFolderWithCount> {
    let path: string
    if (data.parentId) {
      const parent = await prisma.mediaFolder.findUnique({
        where: { id: data.parentId, isDeleted: false },
      })
      if (!parent) throw new Error("Parent folder not found")
      path = `${parent.path}${data.name.toLowerCase().replace(/\s+/g, "-")}/`
    } else {
      path = `/${data.name.toLowerCase().replace(/\s+/g, "-")}/`
    }

    const folder = await prisma.mediaFolder.create({
      data: {
        name: data.name,
        path,
        parentId: data.parentId ?? undefined,
      },
    })

    return folder as unknown as MediaFolderWithCount
  }

  static async updateFolder(id: string, data: { name: string }): Promise<MediaFolderWithCount> {
    return prisma.mediaFolder.update({
      where: { id },
      data: { name: data.name },
    }) as unknown as MediaFolderWithCount
  }

  static async deleteFolder(id: string): Promise<void> {
    await prisma.mediaAsset.updateMany({
      where: { folderId: id, isDeleted: false },
      data: { isDeleted: true },
    })

    await prisma.mediaFolder.update({
      where: { id },
      data: { isDeleted: true },
    })
  }

  static async renameAsset(id: string, data: { title?: string; altText?: string }): Promise<MediaAsset> {
    const asset = await prisma.mediaAsset.update({
      where: { id, isDeleted: false },
      data: {
        title: data.title ?? undefined,
        altText: data.altText ?? undefined,
      },
    })
    return asset as unknown as MediaAsset
  }

  static async moveAsset(id: string, folderId: string | null): Promise<MediaAsset> {
    if (folderId) {
      const folder = await prisma.mediaFolder.findUnique({
        where: { id: folderId, isDeleted: false },
      })
      if (!folder) throw new Error("Folder not found")
    }

    const asset = await prisma.mediaAsset.update({
      where: { id, isDeleted: false },
      data: {
        folderId: folderId ?? undefined,
      },
    })
    return asset as unknown as MediaAsset
  }

  static async softDeleteAsset(id: string): Promise<void> {
    await prisma.mediaAsset.update({
      where: { id, isDeleted: false },
      data: { isDeleted: true },
    })
  }

  static async restoreAsset(id: string): Promise<MediaAsset> {
    const asset = await prisma.mediaAsset.update({
      where: { id, isDeleted: true },
      data: { isDeleted: false },
    })
    return asset as unknown as MediaAsset
  }

  static async hardDeleteAsset(id: string): Promise<void> {
    await prisma.mediaAsset.delete({
      where: { id },
    })
  }
}
