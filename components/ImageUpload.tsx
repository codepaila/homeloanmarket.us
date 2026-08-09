
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/ui/ImageUpload.tsx
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CldUploadWidget } from 'next-cloudinary'
import { useCallback } from 'react'
import { cn } from "@/lib/utils"

interface ImageUploadProps {
	onChange: (value: string) => void
	value?: string
	type?: 'logo' | 'cover' | 'avatar'
	className?: string
	aspectRatio?: 'square' | 'video' | 'cover'
}

const ImageUpload = ({ onChange, value, type = 'logo', className = '', aspectRatio = 'square' }: ImageUploadProps) => {

	const handleImageUpload = useCallback((result: any) => {
		onChange(result.info.secure_url)
	}, [onChange])

	const getAspectRatioClass = () => {
		switch (aspectRatio) {
			case 'video': return 'aspect-video'
			case 'cover': return 'aspect-[21/9]'
			default: return 'aspect-square'
		}
	}

	const getDimensions = () => {
		switch (type) {
			case 'logo': return 'w-24 h-24'
			case 'cover': return 'w-full h-48'
			case 'avatar': return 'w-32 h-32'
			default: return 'w-24 h-24'
		}
	}

	const getPlaceholder = () => {
		switch (type) {
			case 'logo': return 'Logo'
			case 'cover': return 'Cover'
			case 'avatar': return 'Avatar'
			default: return 'Image'
		}
	}
	const getUploadPreset = () => {
		switch (type) {

			case 'logo': return process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_LOGO
			case 'cover': return process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_COVER
			case 'avatar': return process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_PROFILE
			default: return process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

		}
	}

	return (
		<CldUploadWidget
			onSuccess={handleImageUpload}
			uploadPreset={getUploadPreset()}
			options={{
				maxFiles: 1,
				sources: ['local', 'url', 'camera'],
				cropping: type !== 'cover',
				croppingAspectRatio: type === 'cover' ? 21 / 9 : type === 'logo' ? 1 : undefined,
				croppingDefaultSelectionRatio: 0.8,
				showSkipCropButton: false,
				resourceType: 'image',
				clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
				maxFileSize: 5000000,
				styles: {
					palette: {
						window: '#FFFFFF',
						sourceBg: '#F4F4F5',
						windowBorder: '#90a0b3',
						tabIcon: '#000000',
						inactiveTabIcon: '#555a5f',
						menuIcons: '#555a5f',
						link: '#2563EB',
						action: '#2563EB',
						inProgress: '#2563EB',
						complete: '#10B981',
						error: '#EF4444',
						textDark: '#000000',
						textLight: '#FFFFFF'
					},
					fonts: {
						default: {
							family: 'system-ui'
						}
					}
				}
			}}
		>
			{({ open }) => {
				return (
					<div
						onClick={() => open?.()}
						className={cn(
							"cursor-pointer border-2 border-dashed border-border rounded-lg overflow-hidden hover:border-primary transition-colors",
							getDimensions(),
							getAspectRatioClass(),
							className,
							type === 'cover' ? 'relative ' : 'relative'
						)}
					>
						{value ? (
							<img
								src={value}
								alt={getPlaceholder()}
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="w-full h-full flex flex-col items-center justify-center bg-muted">
								<div className="text-muted-foreground mb-2">
									{type === 'logo' ? (
										<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
											<span className="text-lg font-semibold">L</span>
										</div>
									) : type === 'cover' ? (
										<div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
											<span className="text-sm font-semibold">COVER</span>
										</div>
									) : (
										<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
											<span className="text-lg">A</span>
										</div>
									)}
								</div>
								{
									type === "cover" && <>
										<span className="text-sm text-muted-foreground">
											Upload {getPlaceholder()}
										</span>
										<span className="text-xs text-muted-foreground mt-1">
											PNG, JPG, WEBP up to 5MB
										</span>
									</>
								}
							</div>
						)}
						{value && type !== 'cover' && (
							<div className="absolute bottom-2 right-2">
								<div className="bg-primary text-white text-xs px-2 py-1 rounded">
									Change
								</div>
							</div>
						)}
						{value && type === 'cover' && (
							<div className="absolute bottom-4 right-4">
								<div className="bg-primary text-white text-xs px-3 py-1.5 rounded-md">
									Change Cover
								</div>
							</div>
						)}
						{/* <p className='fixed  top-1/2 left-1/2 z-50'>preset : {getUploadPreset()} </p> */}
					</div>
				)
			}}
		</CldUploadWidget>
	)
}

export default ImageUpload