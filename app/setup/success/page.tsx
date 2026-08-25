// app/setup/success/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  Mail, 
  Clock, 
  Shield, 
  ArrowRight
} from 'lucide-react'

export default function SetupSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect if user hasn't completed setup
    // You might want to check this from API or localStorage
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="border-none shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Application Submitted Successfully!
              </h1>
              
              <p className="text-muted-foreground text-lg mb-2">
                Thank you for applying to become a mortgage broker
              </p>
              <p className="text-muted-foreground">
                Your application is now under review
              </p>
            </div>

            {/* Next Steps */}
            <div className="space-y-6 mb-8">
              <h2 className="text-xl font-semibold text-foreground text-center">
                What Happens Next?
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Email Confirmation</h3>
                    <p className="text-muted-foreground text-sm">
                      You&apos;ll receive an email confirmation with your application details
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Verification Process</h3>
                    <p className="text-muted-foreground text-sm">
                      Our team will review your application within 2-3 business days
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Verification Status</h3>
                    <p className="text-muted-foreground text-sm">
                      You&apos;ll be notified via email once your profile is verified
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <Button asChild className="w-full gap-2 py-6 text-lg">
                <Link href="/broker/dashboard">
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Questions?{' '}
                  <Link href="/support" className="text-primary hover:underline">
                    Contact Support
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}