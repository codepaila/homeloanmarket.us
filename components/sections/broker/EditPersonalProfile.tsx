/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sections/broker/PersonalProfile.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    User,
    Mail,
    Phone,
    Camera,
    Save,
    Upload,
    Shield,
    ArrowLeft,
    CheckCircle,
    XCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import ImageUpload from '@/components/ImageUpload'
import { User as TUser } from '@prisma/client'

// Explicit safe subset passed from the server page. Deliberately excludes
// sensitive relations (accounts, contactMessages) that must not reach the client.
type ProfileUser = Pick<
  TUser,
  'id' | 'name' | 'email' | 'phone' | 'image' | 'role' | 'createdAt' | 'emailVerified' | 'isActive'
>

// Personal Profile Schema
const personalProfileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    image: z.string().optional(),
    email: z.string().email('Please enter a valid email'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
    confirmPassword: z.string().optional(),
}).refine((data) => {
    // If new password is provided, current password is required
    if (data.newPassword && !data.currentPassword) {
        return false
    }
    return true
}, {
    message: "Current password is required when changing password",
    path: ["currentPassword"]
}).refine((data) => {
    // If new password is provided, it must match confirm password
    if (data.newPassword && data.newPassword !== data.confirmPassword) {
        return false
    }
    return true
}, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
})

type PersonalProfileFormData = z.infer<typeof personalProfileSchema>



export default function EditPersonalProfile({user}:{user: ProfileUser}) {
    const router = useRouter()


    const [isSubmitting, setIsSubmitting] = useState(false)
    const [avatarPreview, setAvatarPreview] = useState(user?.image || '')
    const [showPasswordFields, setShowPasswordFields] = useState(false)
    const form = useForm({
        resolver: zodResolver(personalProfileSchema) as any,
        defaultValues: {
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            image: user?.image || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        }
    }) as any


    const onSubmit = async (data: PersonalProfileFormData) => {
        try {
            setIsSubmitting(true)

            // Prepare payload
            const payload: any = {
                name: data.name,
                email: data.email,
                phone: data.phone,
                image: data.image,

            }

            // Add password change if provided
            if (data.currentPassword && data.newPassword) {
                payload.currentPassword = data.currentPassword
                payload.newPassword = data.newPassword
            }

            // Add avatar if changed
            if (avatarPreview !== user?.image) {
                payload.image = avatarPreview
            }

            const response = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update profile')
            }

            toast.success('Profile updated successfully!')

            // Clear password fields
            if (data.newPassword) {
                form.setValue('currentPassword', '')
                form.setValue('newPassword', '')
                form.setValue('confirmPassword', '')
                setShowPasswordFields(false)
            }

            // Refresh to get updated data
            router.refresh()

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6 h-screen">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
                {/* <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/broker/profile')}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Button> */}

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                    >
                        <Link href="/broker/company/edit">
                            Edit Mortgage Broker Profile
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Personal Information
                    </CardTitle>
                    <CardDescription>
                        Update your personal details and account information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                           
                            <div className="space-y-4">
                                <FormLabel>Profile Picture</FormLabel>
                                <FormField
                                    control={form.control}
                                    name="image"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex flex-col items-start sm:items-center gap-6">
                                                    <ImageUpload
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        type="avatar"
                                                    />
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-muted-foreground">
                                                            Upload your profile image (Recommended: 400×400px, PNG or JPG)
                                                        </p>
                                                        {field.value && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => field.onChange('')}
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Profile Information</h3>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name *</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center relative">
                                                        <User className="absolute ml-3 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Your full name"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone Number *</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center relative">
                                                        <Phone className="absolute ml-3 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                              placeholder="+1 (555) 123-4560"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address *</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center relative">
                                                    <Mail className="absolute ml-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        className="pl-10"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                This email is used for account notifications and login
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Password Change */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">Password &amp; Security</h3>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                                    >
                                        {showPasswordFields ? 'Cancel' : 'Change Password'}
                                    </Button>
                                </div>

                                {showPasswordFields && (
                                    <div className="space-y-4 p-4 border rounded-lg bg-muted">
                                        <FormField
                                            control={form.control}
                                            name="currentPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Current Password *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Enter current password"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="newPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>New Password</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Enter new password"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Must be at least 8 characters long
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="confirmPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Confirm New Password</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder="Confirm new password"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Account Information */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Account Details</h3>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">User Role</span>
                                        </div>
                                        <Badge variant="outline">
                                            {user?.role?.replace('_', ' ') || 'User'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <span className="text-sm font-medium">Member Since</span>
                                        <span className="text-sm text-muted-foreground">
                                             {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <span className="text-sm font-medium">Email Status</span>
                                        <div className="flex items-center gap-2">
                                            {user?.emailVerified ? (
                                                <>
                                                    <CheckCircle className="h-4 w-4 text-success" />
                                                    <span className="text-sm text-success">Verified</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                    <span className="text-sm text-destructive">Not Verified</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => router.push('/verify-email')}
                                                    >
                                                        Verify Now
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <span className="text-sm font-medium">Profile Status</span>
                                        <Badge variant={user?.isActive ? "outline" : "destructive"} className={user?.isActive ? "bg-green-50 text-green-700 border-green-200" : ""}>
                                            {user?.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 space-x-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push('/broker/profile')}
                                >
                                    Back to Profile
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Saving Changes...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}