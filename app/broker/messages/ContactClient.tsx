// app/broker/contacts/ContactsClient.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Search,
  Filter,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Clock,
  ChevronRight,
  Users,
  CheckCircle,
  XCircle,
  MessageSquare,
  Star,
  MoreVertical,
  Download,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { fetchBrokerContacts, fetchMyLeads } from '@/lib/fetchClient'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface ContactClientProps {
  initialContacts: any[]
  initialCounts: {
    total: number
    new: number
    contacted: number
    hot: number
    converted: number
    lost: number
  }
  userId: string
}

export default function ContactsClient({ initialContacts, initialCounts, userId }: ContactClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
const user = useCurrentUser();
  // Use SWR for real-time updates
  const { leads, total, totalPages, isLoading } = fetchBrokerContacts(user?.brokerProfile?.id as string ,page , statusFilter === 'all' ? undefined : statusFilter)

  const contacts = leads || initialContacts
  const counts = initialCounts

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">New</Badge>
      case 'contacted':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Contacted</Badge>
      case 'hot':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Hot Lead</Badge>
      case 'converted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Converted</Badge>
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleExport = () => {
    // Implement CSV export
    console.log('Exporting contacts...')
  }

  const handleBulkAction = (action: string) => {
    if (selectedContacts.length === 0) return
    
    switch (action) {
      case 'delete':
        console.log('Delete selected:', selectedContacts)
        break
      case 'mark_contacted':
        console.log('Mark as contacted:', selectedContacts)
        break
      case 'mark_hot':
        console.log('Mark as hot:', selectedContacts)
        break
    }
    
    setSelectedContacts([])
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leads & Contacts</h1>
            <p className="text-muted-foreground">Manage your leads and client communications</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{counts.total}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Badge className="bg-blue-100 text-blue-700 mr-2">{counts.new}</Badge>
                <div>
                  <div className="font-bold">New</div>
                  <div className="text-xs text-muted-foreground">Needs contact</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Badge className="bg-yellow-100 text-yellow-700 mr-2">{counts.contacted}</Badge>
                <div>
                  <div className="font-bold">Contacted</div>
                  <div className="text-xs text-muted-foreground">In progress</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Badge className="bg-red-100 text-red-700 mr-2">{counts.hot}</Badge>
                <div>
                  <div className="font-bold">Hot Leads</div>
                  <div className="text-xs text-muted-foreground">High priority</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Badge className="bg-green-100 text-green-700 mr-2">{counts.converted}</Badge>
                <div>
                  <div className="font-bold">Converted</div>
                  <div className="text-xs text-muted-foreground">Became clients</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Badge className="bg-muted text-foreground mr-2">{counts.lost}</Badge>
                <div>
                  <div className="font-bold">Lost</div>
                  <div className="text-xs text-muted-foreground">No longer active</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contact List</CardTitle>
              <CardDescription>Manage and communicate with your leads</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Bulk Actions */}
              {selectedContacts.length > 0 && (
                <Select onValueChange={handleBulkAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Bulk Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mark_contacted">Mark as Contacted</SelectItem>
                    <SelectItem value="mark_hot">Mark as Hot Lead</SelectItem>
                    <SelectItem value="delete">Delete Selected</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="hot">Hot Lead</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-32">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Contacts ({counts.total})</TabsTrigger>
              <TabsTrigger value="new">New ({counts.new})</TabsTrigger>
              <TabsTrigger value="contacted">Contacted ({counts.contacted})</TabsTrigger>
              <TabsTrigger value="hot">Hot Leads ({counts.hot})</TabsTrigger>
              <TabsTrigger value="converted">Converted ({counts.converted})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedContacts.length === contacts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                               setSelectedContacts(contacts.map((c: any) => c.id))
                            } else {
                              setSelectedContacts([])
                            }
                          }}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Loan Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {contacts.map((contact: any) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContacts([...selectedContacts, contact.id])
                              } else {
                                setSelectedContacts(selectedContacts.filter(id => id !== contact.id))
                              }
                            }}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {contact.name?.charAt(0) || 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{contact.name}</div>
                              <div className="text-sm text-muted-foreground">
                                From: {contact.source}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.city}, {contact.state}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.loanAmount ? (
                            <div className="space-y-1">
                              <div className="font-medium">
                                 ${contact.loanAmount.toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {contact.propertyType || 'Not specified'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {contact.timeline || 'Timeline not specified'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No loan details</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(contact.status)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {contact.followUpDate ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {format(new Date(contact.followUpDate), 'MMM d, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Follow-up scheduled
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                No follow-up
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Empty State */}
              {contacts.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                   <h3 className="text-lg font-medium text-foreground mb-2">No leads yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Your leads and contacts will appear here once they submit contact forms.
                  </p>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Contact
                  </Button>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {contacts.length} of {total} contacts
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Other tabs would show filtered views */}
            <TabsContent value="new">
              {/* Similar table filtered for new leads */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-info" />
              </div>
              <div>
                <h3 className="font-medium">Quick Message</h3>
                <p className="text-sm text-muted-foreground">Send a message to selected contacts</p>
              </div>
            </div>
            <Button disabled={selectedContacts.length === 0} className="w-full">
              Send Message
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium">Schedule Follow-up</h3>
                <p className="text-sm text-muted-foreground">Schedule calls for selected leads</p>
              </div>
            </div>
            <Button variant="outline" disabled={selectedContacts.length === 0} className="w-full">
              Schedule Calls
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">Mark as Hot</h3>
                <p className="text-sm text-muted-foreground">Flag important leads for priority</p>
              </div>
            </div>
            <Button variant="outline" disabled={selectedContacts.length === 0} className="w-full">
              Mark as Hot Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}