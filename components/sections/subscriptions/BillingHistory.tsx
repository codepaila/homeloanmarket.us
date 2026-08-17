'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Download,
  FileText,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Calendar,
  DollarSign,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
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
import { useBillingHistory } from '@/hooks/useSubscription'
import { format } from 'date-fns'

type BadgeVariant = React.ComponentProps<typeof Badge>['variant']

interface BillingInvoice {
  id: string
  number: string
  date: string
  description: string
  amount: number
  currency: string
  status: string
  subscription?: { plan?: string } | null
  pdfUrl?: string | null
  hostedInvoiceUrl?: string | null
}

export default function BillingHistory() {
  const { billing, error, isLoading, mutate } = useBillingHistory()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('all')

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg"></div>
        ))}
      </div>
    )
  }

  if (error || !billing) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Unable to load billing data</h3>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'Failed to load billing information'}
          </p>
          <Button onClick={() => mutate()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { invoices = [], totalInvoices = 0, totalAmount = 0, paidAmount = 0 } = billing

  const statusConfig = {
    paid: { label: 'Paid', color: 'success', icon: CheckCircle },
    pending: { label: 'Pending', color: 'warning', icon: Clock },
    draft: { label: 'Draft', color: 'secondary', icon: Clock },
    open: { label: 'Open', color: 'warning', icon: Clock },
    failed: { label: 'Failed', color: 'destructive', icon: XCircle },
    void: { label: 'Void', color: 'secondary', icon: XCircle },
  }

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice: BillingInvoice) => {
    if (filter !== 'all' && invoice.status !== filter) return false
    if (search && !invoice.description.toLowerCase().includes(search.toLowerCase())) return false
    
    // Date range filtering
    if (dateRange !== 'all') {
      const invoiceDate = new Date(invoice.date)
      const now = new Date()
      let days = 0
      
      if (dateRange === 'month') days = 30
      else if (dateRange === 'quarter') days = 90
      else if (dateRange === 'year') days = 365
      
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      return invoiceDate >= cutoffDate
    }
    
    return true
  })

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <Badge variant={config.color as BadgeVariant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const handleRefresh = async () => {
    await mutate()
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold mt-1">{totalInvoices}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-100 bg-blue-500/20 p-2 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold mt-1">
                  ${totalAmount.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-100 bg-green-500/20 p-2 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="text-2xl font-bold mt-1">
                  ${paidAmount.toFixed(2)}
                </p>
              </div>
              <CheckCircle className="h-10 w-10 text-purple-100 bg-purple-500/20 p-2 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Invoices</p>
                <p className="text-2xl font-bold mt-1">
                  {invoices.filter((i: BillingInvoice) => i.status === 'paid').length}
                </p>
              </div>
              <CreditCard className="h-10 w-10 text-yellow-100 bg-yellow-500/20 p-2 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
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
                {filteredInvoices.map((invoice: BillingInvoice) => (
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
                            onClick={() => window.open(invoice.pdfUrl ?? undefined, '_blank')}
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
                            onClick={() => window.open(invoice.hostedInvoiceUrl ?? undefined, '_blank')}
                            className="h-8 w-8 p-0"
                            title="View on Stripe"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Help Section */}
      <div className="grid gap-6 md:grid-cols-2">
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
                <CreditCard className="h-4 w-4" />
                Contact Support
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <ExternalLink className="h-4 w-4" />
                Visit Help Center
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
            <CardDescription>
              Export your billing data for accounting
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}