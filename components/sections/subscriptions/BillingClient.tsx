// app/broker/subscription/billing/BillingHistoryClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download,
  FileText,
  CreditCard,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  Calendar,
  DollarSign,
  RefreshCw,
  Printer,
  Mail,
  Eye,
  MoreVertical,
  ExternalLink,
  Zap,
  TrendingUp,
  Users,
  Building,
  Award
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface Invoice {
  id: string
  number: string
  date: string
  description: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed' | 'void' | 'draft' | 'open'
  type: 'subscription' | 'one_time' | 'refund'
  stripeInvoiceId: string
  stripeChargeId?: string
  paymentMethod: string
  pdfUrl?: string
  hostedInvoiceUrl?: string
  subscription?: {
    id: string
    plan?: string
  }
  createdAt: Date
  updatedAt: Date
}

interface Subscription {
  id: string
  status: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  plan: string
  amount: number
  currency: string
}

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

interface BillingData {
  invoices: Invoice[]
  subscriptions: Subscription[]
  paymentMethods: PaymentMethod[]
  totalInvoices: number
  totalAmount: number
  paidAmount: number
}

export default function BillingHistoryClient() {
  const { data: session } = useSession()
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('invoices')

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/subscription/invoices')
      const data = await response.json()
      
      if (data.success) {
        setBillingData(data.data)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load billing data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    paid: { label: 'Paid', color: 'success', icon: CheckCircle },
    pending: { label: 'Pending', color: 'warning', icon: Clock },
    draft: { label: 'Draft', color: 'secondary', icon: Clock },
    open: { label: 'Open', color: 'warning', icon: Clock },
    failed: { label: 'Failed', color: 'destructive', icon: XCircle },
    void: { label: 'Void', color: 'secondary', icon: XCircle },
  }

  const typeConfig = {
    subscription: { label: 'Subscription', color: 'blue' },
    one_time: { label: 'One-time', color: 'green' },
    refund: { label: 'Refund', color: 'orange' },
  }

  // Filter invoices
  const filteredInvoices = billingData?.invoices.filter(invoice => {
    if (filter !== 'all' && invoice.status !== filter) return false
    if (typeFilter !== 'all' && invoice.type !== typeFilter) return false
    if (search && !invoice.description.toLowerCase().includes(search.toLowerCase())) return false
    
    // Date range filtering
    const invoiceDate = new Date(invoice.date)
    const now = new Date()
    if (dateRange === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return invoiceDate >= monthAgo
    } else if (dateRange === 'quarter') {
      const quarterAgo = new Date()
      quarterAgo.setMonth(quarterAgo.getMonth() - 3)
      return invoiceDate >= quarterAgo
    } else if (dateRange === 'year') {
      const yearAgo = new Date()
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      return invoiceDate >= yearAgo
    }
    
    return true
  }) || []

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const invoice = billingData?.invoices.find(i => i.id === invoiceId)
      if (invoice?.pdfUrl) {
        window.open(invoice.pdfUrl, '_blank')
      } else {
        toast.error('No invoice file available')
      }
    } catch (error) {
      toast.error('Failed to download invoice')
      console.error(error)
    }
  }

  const handleViewOnStripe = async (invoiceId: string) => {
    try {
      const invoice = billingData?.invoices.find(i => i.id === invoiceId)
      if (invoice?.hostedInvoiceUrl) {
        window.open(invoice.hostedInvoiceUrl, '_blank')
      } else {
        toast.error('No Stripe invoice URL available')
      }
    } catch (error) {
      toast.error('Failed to open invoice on Stripe')
      console.error(error)
    }
  }

  const handleSyncStripe = async () => {
    setSyncLoading(true)
    try {
      await fetchBillingData()
      toast.success('Billing data refreshed from Stripe')
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync with Stripe')
    } finally {
      setSyncLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <Badge variant={config.color as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return 'VISA'
      case 'mastercard': return 'MC'
      case 'amex': return 'AMEX'
      case 'discover': return 'DISC'
      case 'jcb': return 'JCB'
      case 'diners': return 'DINERS'
      case 'unionpay': return 'UNION'
      default: return brand.toUpperCase()
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Billing History</h1>
            <p className="text-muted-foreground">
              View, download, and manage your invoices and receipts from Stripe
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSyncStripe}
            disabled={syncLoading}
            className="gap-2"
          >
            {syncLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync with Stripe
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold mt-1">{billingData?.totalInvoices || 0}</p>
                </div>
                <FileText className="h-10 w-10 text-primary/20 p-2 rounded-lg" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold mt-1">
                    ${billingData?.totalAmount.toFixed(2) || '0.00'}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-green-500/20 p-2 rounded-lg" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid Amount</p>
                  <p className="text-2xl font-bold mt-1">
                    ${billingData?.paidAmount.toFixed(2) || '0.00'}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-blue-500/20 p-2 rounded-lg" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                  <p className="text-2xl font-bold mt-1">
                    {billingData?.subscriptions.filter(s => s.status === 'active').length || 0}
                  </p>
                </div>
                <Zap className="h-10 w-10 text-yellow-500/20 p-2 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <TrendingUp className="h-4 w-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="payment-methods">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Methods
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full md:w-64"
                />
              </div>

              {/* Status Filter */}
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Filter */}
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export All
            </Button>
          </div>

          {filteredInvoices.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const type = typeConfig[invoice.type]
                      
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="line-clamp-2">{invoice.description}</div>
                            {invoice.subscription?.plan && (
                              <div className="text-xs text-muted-foreground">
                                Plan: {invoice.subscription.plan}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">
                              ${invoice.amount.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">{invoice.currency.toUpperCase()}</div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {invoice.pdfUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadInvoice(invoice.id)}
                                  className="h-8 w-8 p-0"
                                  title="Download PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {invoice.hostedInvoiceUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewOnStripe(invoice.id)}
                                  className="h-8 w-8 p-0"
                                  title="View on Stripe"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedInvoice(invoice)}
                                className="h-8 w-8 p-0"
                                title="More"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No invoices found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {search || filter !== 'all' || dateRange !== 'all' 
                    ? 'No invoices match your filters. Try adjusting your search criteria.'
                    : 'You don\'t have any invoices yet.'}
                </p>
                {(search || filter !== 'all' || dateRange !== 'all') && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSearch('')
                      setFilter('all')
                      setDateRange('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          {billingData?.subscriptions && billingData.subscriptions.length > 0 ? (
            <div className="space-y-4">
              {billingData.subscriptions.map((subscription) => (
                <Card key={subscription.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold">{subscription.plan}</h3>
                            <Badge 
                              variant="outline"
                              className={subscription.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            >
                              {subscription.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-2">
                            ${subscription.amount.toFixed(2)}/{subscription.currency.toUpperCase()} per month
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>
                              Current period: {format(subscription.currentPeriodStart, 'MMM dd')} - {format(subscription.currentPeriodEnd, 'MMM dd, yyyy')}
                            </span>
                            {subscription.cancelAtPeriodEnd && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Cancels at period end</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-red-700">
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No subscriptions</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You don't have any active subscriptions.
                </p>
                <Button className="mt-4" onClick={() => setActiveTab('invoices')}>
                  View Invoices
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods">
          {billingData?.paymentMethods && billingData.paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {billingData.paymentMethods.map((method) => (
                <Card key={method.id}>
                  <CardContent className="p-6">
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
                            {method.expMonth && method.expYear 
                              ? `Expires ${method.expMonth}/${method.expYear}` 
                              : 'Card'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add New Payment Method
              </Button>
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No payment methods</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You haven't added any payment methods yet.
                </p>
                <Button className="mt-4" onClick={() => setActiveTab('invoices')}>
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Export & Help Section */}
      <div className="grid gap-6 mt-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
            <CardDescription>
              Export your billing data for accounting or record keeping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Export as CSV
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Export as Excel
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Export as PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>
              Get assistance with billing and invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Mail className="h-4 w-4" />
                Email Support
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <ExternalLink className="h-4 w-4" />
                Stripe Dashboard
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Request Duplicate Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invoice Details</CardTitle>
                  <CardDescription>
                    Invoice #{selectedInvoice.number}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium mb-2">Bill From</h4>
                  <div className="text-sm">
                    <p className="font-semibold">Mortgage Broker Platform</p>
                    <p>Powered by Stripe</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Bill To</h4>
                  <div className="text-sm">
                    <p className="font-semibold">{session?.user?.name}</p>
                    <p>{session?.user?.email}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Invoice Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Date</p>
                    <p className="font-medium">
                      {format(new Date(selectedInvoice.date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">
                      {selectedInvoice.paymentMethod || 'Credit Card'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-2xl font-bold">
                      ${selectedInvoice.amount.toFixed(2)} {selectedInvoice.currency.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedInvoice.description}</p>
                </div>

                {selectedInvoice.subscription && (
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription</p>
                    <p className="font-medium">{selectedInvoice.subscription.plan || selectedInvoice.subscription.id}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Stripe Invoice ID</p>
                  <p className="font-mono text-sm break-all">{selectedInvoice.stripeInvoiceId}</p>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {selectedInvoice.pdfUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedInvoice.pdfUrl, '_blank')}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                )}
                
                {selectedInvoice.hostedInvoiceUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedInvoice.hostedInvoiceUrl, '_blank')}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Stripe
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Add missing import
import { Plus } from 'lucide-react'