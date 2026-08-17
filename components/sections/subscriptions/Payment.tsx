// app/broker/subscription/payments/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  CreditCard,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  Shield,
  Lock,
  Smartphone,
  Globe,
  RefreshCw,
  Download,
  History,
  Bell
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PaymentMethod {
  id: string
  type: 'card' | 'bank_account' | 'paypal'
  brand: string
  last4: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
  status: 'active' | 'inactive' | 'expired'
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  status: 'completed' | 'pending' | 'failed'
  paymentMethod: string
}

export default function PaymentMethodsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const [newPaymentMethod, setNewPaymentMethod] = useState({
    type: 'card' as 'card' | 'bank_account' | 'paypal',
    cardNumber: '',
    cardHolder: '',
    expMonth: '',
    expYear: '',
    cvc: '',
    bankAccountNumber: '',
    routingNumber: '',
    accountHolder: '',
    isDefault: false
  })

  const fetchPaymentMethods = async () => {
    try {
      const [methodsRes, transactionsRes] = await Promise.all([
        fetch('/api/subscription/payment-methods'),
        fetch('/api/subscription/transactions')
      ])

      const methodsData = await methodsRes.json()
      const transactionsData = await transactionsRes.json()

      if (methodsData.success) setPaymentMethods(methodsData.data)
      if (transactionsData.success) setTransactions(transactionsData.data)
    } catch (error) {
      toast.error('Failed to load payment methods')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
    } else if (sessionStatus === 'authenticated') {
      fetchPaymentMethods()
    }
  }, [sessionStatus, router])

  const handleAddPaymentMethod = async () => {
    try {
      const response = await fetch('/api/subscription/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPaymentMethod),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Payment method added successfully')
        setShowAddForm(false)
        setNewPaymentMethod({
          type: 'card',
          cardNumber: '',
          cardHolder: '',
          expMonth: '',
          expYear: '',
          cvc: '',
          bankAccountNumber: '',
          routingNumber: '',
          accountHolder: '',
          isDefault: false
        })
        fetchPaymentMethods()
      } else {
        throw new Error(data.error || 'Failed to add payment method')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      console.error(error)
    }
  }

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await fetch(`/api/subscription/payment-methods/${methodId}/default`, {
        method: 'PUT',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Default payment method updated')
        fetchPaymentMethods()
      } else {
        throw new Error(data.error || 'Failed to update default payment method')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      console.error(error)
    }
  }

  const handleDeleteMethod = async (methodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      const response = await fetch(`/api/subscription/payment-methods/${methodId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Payment method deleted')
        fetchPaymentMethods()
      } else {
        throw new Error(data.error || 'Failed to delete payment method')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      console.error(error)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast.error('Failed to access billing portal')
      console.error(error)
    } finally {
      setPortalLoading(false)
    }
  }

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return 'VISA'
      case 'mastercard': return 'MC'
      case 'amex': return 'AMEX'
      case 'discover': return 'DISC'
      case 'jcb': return 'JCB'
      case 'diners': return 'DINERS'
      default: return 'CARD'
    }
  }

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading payment methods...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Payment Methods</h1>
        <p className="text-muted-foreground">
          Manage your payment methods and view transaction history
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  disabled={showAddForm}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </CardTitle>
              <CardDescription>
                Manage your saved payment methods for automatic billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethods.length > 0 ? (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="border rounded-lg p-4 hover:border-border transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {getCardIcon(method.brand)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} 
                                •••• {method.last4}
                              </h4>
                              {method.isDefault && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {method.type === 'card' && method.expMonth && method.expYear 
                                ? `Expires ${method.expMonth}/${method.expYear}` 
                                : method.type === 'bank_account' ? 'Bank Account' : 'PayPal'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!method.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(method.id)}
                              className="h-8 px-3 text-xs"
                            >
                              Set Default
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMethod(method)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          {!method.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMethod(method.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {method.status === 'expired' && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                          <AlertCircle className="h-4 w-4" />
                          This card has expired. Please update your payment method.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No payment methods</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a payment method to enable automatic billing
                  </p>
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add New Payment Method Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Payment Method</CardTitle>
                <CardDescription>
                  Add a new credit card or bank account for payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <RadioGroup 
                    value={newPaymentMethod.type} 
                    onValueChange={(value: string) => setNewPaymentMethod({...newPaymentMethod, type: value as 'card' | 'bank_account' | 'paypal'})}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Credit/Debit Card
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bank_account" id="bank_account" />
                      <Label htmlFor="bank_account" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Bank Account
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="paypal" id="paypal" />
                      <Label htmlFor="paypal" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          PayPal
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {newPaymentMethod.type === 'card' && (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Card Number</Label>
                          <Input
                            placeholder="1234 5678 9012 3456"
                            value={newPaymentMethod.cardNumber}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, cardNumber: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Card Holder Name</Label>
                          <Input
                            placeholder="John Doe"
                            value={newPaymentMethod.cardHolder}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, cardHolder: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Expiry Month</Label>
                          <Input
                            placeholder="MM"
                            value={newPaymentMethod.expMonth}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, expMonth: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiry Year</Label>
                          <Input
                            placeholder="YYYY"
                            value={newPaymentMethod.expYear}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, expYear: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CVC</Label>
                          <Input
                            placeholder="123"
                            value={newPaymentMethod.cvc}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, cvc: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {newPaymentMethod.type === 'bank_account' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Account Holder Name</Label>
                        <Input
                          placeholder="John Doe"
                          value={newPaymentMethod.accountHolder}
                          onChange={(e) => setNewPaymentMethod({...newPaymentMethod, accountHolder: e.target.value})}
                        />
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input
                            placeholder="000123456789"
                            value={newPaymentMethod.bankAccountNumber}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, bankAccountNumber: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Routing Number</Label>
                          <Input
                            placeholder="123456789"
                            value={newPaymentMethod.routingNumber}
                            onChange={(e) => setNewPaymentMethod({...newPaymentMethod, routingNumber: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {newPaymentMethod.type === 'paypal' && (
                    <div className="text-center py-8">
                      <Globe className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        You&apos;ll be redirected to PayPal to complete the payment method setup.
                      </p>
                      <Button variant="outline" className="w-full">
                        Connect PayPal
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="default"
                      checked={newPaymentMethod.isDefault}
                      onChange={(e) => setNewPaymentMethod({...newPaymentMethod, isDefault: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="default" className="text-sm">
                      Set as default payment method
                    </Label>
                  </div>

                  <Separator />

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewPaymentMethod({
                          type: 'card',
                          cardNumber: '',
                          cardHolder: '',
                          expMonth: '',
                          expYear: '',
                          cvc: '',
                          bankAccountNumber: '',
                          routingNumber: '',
                          accountHolder: '',
                          isDefault: false
                        })
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddPaymentMethod}>
                      Add Payment Method
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Lock className="h-5 w-5 text-info mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Security First</p>
                      <p>
                        Your payment information is encrypted and securely stored. 
                        We never store your full card number or CVC.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>
                  Your recent payment activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          <span>{transaction.paymentMethod}</span>
                          <Badge 
                            variant="outline"
                            className={
                              transaction.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 
                              transaction.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">${transaction.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">USD</p>
                      </div>
                    </div>
                  ))}
                  
                  {transactions.length > 5 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push('/broker/subscription/billing')}
                    >
                      View All Transactions
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Billing Portal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Billing Portal
              </CardTitle>
              <CardDescription>
                Manage billing and invoices in Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full gap-2"
              >
                {portalLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Open Billing Portal
              </Button>
              <p className="text-sm text-muted-foreground">
                Access invoices, update billing information, and manage subscriptions in Stripe&apos;s secure portal.
              </p>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">PCI DSS Compliant</p>
                  <p className="text-sm text-muted-foreground">Level 1 security</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="font-medium">256-bit Encryption</p>
                  <p className="text-sm text-muted-foreground">Bank-level security</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Fraud Monitoring</p>
                  <p className="text-sm text-muted-foreground">24/7 protection</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download your payment history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Contact Support
              </Button>
              <Button variant="outline" className="w-full justify-start">
                FAQ & Guides
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Dispute a Charge
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}