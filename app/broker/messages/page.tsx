/* eslint-disable @typescript-eslint/no-explicit-any */
// app/broker/contacts/page.tsx - Contact Messages Dashboard
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  // Whatsapp, 
  Eye, 
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMyContactMessages, useContactMessageActions } from '@/hooks/useClient'
import { Skeleton } from '@/components/ui/skeleton'

export default function ContactMessagesPage() {
  const user = useCurrentUser()
  const brokerId = user?.brokerProfile?.id
  
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'unread' | 'read' | 'responded',
    contactType: 'all' as 'all' | 'email' | 'phone' | 'whatsapp' | 'sms',
    search: '',
    page: 1,
    pageSize: 10
  })

  const { 
    contacts, 
    stats, 
    total, 
    totalPages, 
    isLoading, 
    error, 
    mutate 
  } = useMyContactMessages(filters)

  const { markAsRead, markAsResponded } = useContactMessageActions()

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await markAsRead(messageId)
      // toast({
      //   title: 'Marked as read',
      //   description: 'Message has been marked as read',
      // })
      mutate() // Refresh the data
    } catch (error) {
      // toast({
      //   title: 'Error',
      //   description: 'Failed to mark message as read',
      //   variant: 'destructive',
      // })
    }
  }

  const handleMarkAsResponded = async (messageId: string) => {
    try {
      await markAsResponded(messageId)
      // toast({
      //   title: 'Marked as responded',
      //   description: 'Message has been marked as responded',
      // })
      mutate() // Refresh the data
    } catch (error) {
      // toast({
      //   title: 'Error',
      //   description: 'Failed to mark message as responded',
      //   variant: 'destructive',
      // })
    }
  }

  const handleRefresh = () => {
    mutate()
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please sign in to access this page</p>
        </div>
      </div>
    )
  }

  if (!brokerId) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Loading Messages</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contact Messages</h1>
          <p className="text-muted-foreground">
            All inquiries from potential clients
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unread || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Require attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responded</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.responded || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Already responded</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.thisMonth || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Current month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, or phone..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
                className="max-w-sm"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({...filters, status: value as any, page: 1})}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.contactType}
                onValueChange={(value) => setFilters({...filters, contactType: value as any, page: 1})}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Contact Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Contact Messages</CardTitle>
              <CardDescription>
                Showing {contacts?.length || 0} of {total || 0} messages
              </CardDescription>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[200px]">Contact</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                         <p className="text-muted-foreground">Loading messages</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contacts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Mail className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <h3 className="text-lg font-semibold">No messages found</h3>
                          <p className="text-muted-foreground">
                            {filters.status !== 'all' || filters.contactType !== 'all' || filters.search
                              ? 'Try changing your filters'
                              : 'You\'ll see messages here when clients contact you'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts?.map((message: any) => (
                    <TableRow 
                      key={message.id} 
                      className={!message.isRead ? 'bg-blue-50 hover:bg-blue-100' : ''}
                    >
                      <TableCell>
                        <div className="font-medium">{message.name}</div>
                        {message.user?.name && (
                          <div className="text-xs text-muted-foreground">
                            Registered user
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{message.email || 'No email'}</span>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{message.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={message.contactType === 'email' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {message.contactType === 'whatsapp' ? (
                            <>
                              {/* <Whatsapp className="h-3 w-3 mr-1" /> */}
                              WhatsApp
                            </>
                          ) : message.contactType === 'phone' ? (
                            <>
                              <Phone className="h-3 w-3 mr-1" />
                              Phone
                            </>
                          ) : message.contactType === 'sms' ? (
                            <>
                              <MessageSquare className="h-3 w-3 mr-1" />
                              SMS
                            </>
                          ) : (
                            <>
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium text-sm mb-1">
                            {message.subject || 'No subject'}
                          </div>
                          <p className="text-sm line-clamp-2">{message.message}</p>
                          {(message.loanAmount || message.loanType) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {message.loanAmount && (
                                <Badge variant="outline" className="text-xs">
                                   ${message.loanAmount.toLocaleString()}
                                </Badge>
                              )}
                              {message.loanType && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {message.loanType.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {format(new Date(message.createdAt), 'MMM d')}
                          </div>
                          <div className="text-muted-foreground">
                            {format(new Date(message.createdAt), 'h:mm a')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {!message.isRead ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              New
                            </Badge>
                          ) : (
                            <Badge variant="outline">Read</Badge>
                          )}
                          {message.isResponded ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                              Responded
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending Response</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsRead(message.id)}
                            disabled={message.isRead}
                            className="flex-1"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {message.isRead ? 'Read' : 'Mark Read'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsResponded(message.id)}
                            disabled={message.isResponded}
                            className="flex-1"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {message.isResponded ? 'Responded' : 'Mark Responded'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && contacts?.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(filters.page - 1) * filters.pageSize + 1} to{' '}
                {Math.min(filters.page * filters.pageSize, total)} of {total} messages
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (filters.page <= 3) {
                      pageNum = i + 1
                    } else if (filters.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = filters.page - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={filters.page === pageNum ? "default" : "outline"}
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}