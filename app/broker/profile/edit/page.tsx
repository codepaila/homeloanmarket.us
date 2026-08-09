
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import  EditPersonalProfile  from '@/components/sections/broker/EditPersonalProfile'

export default async function PersonalProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'BROKER') {
    redirect('/')
  }

  const profileUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
  }

  return (
    <div className="">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Personal Profile</h1>
        <p className="text-muted-foreground">
          Update your personal information and account settings
        </p>
      </div>
      
      <EditPersonalProfile user={profileUser} />
    </div>
  )
}
