/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Home,
  Users,
  UserCog,
  User as UserIcon,
  Building,
  FileText,
  CreditCard,
  Settings,
  Bell,
  Calculator,
  TrendingUp,
  BarChart3,
  Shield,
  HelpCircle,
  FileSpreadsheet,
  PhoneCall,
  Star,
  UserPlus,
  Search,
  MessageSquare,
  Banknote,
  ChartBar,
  ShieldCheck,
  Megaphone,
  FileCheck,
  FolderOpen,
  Wallet,
  Building2,
  MapPin,
  Tag,
  MessageCircle,
  Heart,
  Download,
  Upload,
  Zap,
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'

export type SidebarItem = {
  title: string;
  url: string;
  icon?: any;
  items?: SidebarItem[];
  badge?: string | number;
  enabled?: boolean;
  roles?: ("ADMIN" | "BROKER" | "USER")[];
  requiresSubscription?: boolean;
};

export type SidebarSection = {
  label: string;
  items: SidebarItem[];
  enabled?: boolean;
  roles?: ("ADMIN" | "BROKER" | "USER")[];
};

export const appSidebarData = (user: any) => {
  // Helper functions based on your schema
  const isAdmin = user?.role === "ADMIN"
  const isBroker = user?.role === "BROKER"
  const isUser = user?.role === "USER"
  
  // Get broker profile and subscription
  const brokerProfile = user?.brokerProfile
  const subscription = brokerProfile?.subscription
  
  const hasActiveSubscription = Boolean(brokerProfile) && (subscription?.isActive ?? true)
  const isVerifiedBroker = brokerProfile?.verificationStatus === "VERIFIED"
  const subscriptionPlan = subscription?.plan || "FREE"
  const isPremiumBroker = false
  const isFeaturedPlan = subscription?.isActive === true && subscriptionPlan === "FEATURED"
  const isFeaturedBroker = subscription?.isActive === true &&
    subscriptionPlan === "FEATURED"

  // ==================== ADMIN NAVIGATION ====================
  const adminNavItems: SidebarItem[] = isAdmin ? [
    {
      title: "Admin Dashboard",
      url: "/admin/dashboard",
      icon: Home,
      roles: ["ADMIN"]
    },
    {
      title: "Broker Management",
      url: "/admin/brokers",
      icon: Users,
      items: [
        { title: "All Brokers", url: "/admin/brokers" },
        { title: "Create Broker", url: "/admin/brokers/create" },
      ]
    },
    {
      title: "User Management",
      url: "/admin/users",
      icon: UserCog,
      items: [
        { title: "All Users", url: "/admin/users" },
        { title: "Active Users", url: "/admin/users/active" },
        { title: "User Analytics", url: "/admin/users/analytics" },
      ]
    },
    {
      title: "Subscription Management",
      url: "/admin/subscriptions",
      icon: CreditCard,
      items: [
        { title: "All Subscriptions", url: "/admin/subscriptions" },
        { title: "Active Subscriptions", url: "/admin/subscriptions/active" },
        { title: "Expiring Soon", url: "/admin/subscriptions/expiring" },
        { title: "Revenue Analytics", url: "/admin/subscriptions/revenue" },
      ]
    },
    {
      title: "Leads Management",
      url: "/admin/leads",
      icon: MessageSquare,
      items: [
        { title: "All Leads", url: "/admin/leads" },
        { title: "Recent Leads", url: "/admin/leads/recent" },
        { title: "Lead Analytics", url: "/admin/leads/analytics" },
      ]
    },
    {
      title: "Reviews & Ratings",
      url: "/admin/reviews",
      icon: Star,
      items: [
        { title: "All Reviews", url: "/admin/reviews" },
        { title: "Pending Reviews", url: "/admin/reviews/pending" },
        { title: "Reported Reviews", url: "/admin/reviews/reported" },
        { title: "Review Analytics", url: "/admin/reviews/analytics" },
      ]
    },
    {
      title: "Content Management",
      url: "/admin/content",
      icon: FileSpreadsheet,
      items: [
        {
          title: "Bank Management",
          url: "/admin/content/banks",
          items: [
            { title: "All Banks", url: "/admin/content/banks" },
            { title: "Add Bank", url: "/admin/content/banks/create" },
            { title: "Bank Types", url: "/admin/content/banks/types" },
          ]
        },
        {
          title: "Locations",
          url: "/admin/content/locations",
          items: [
            { title: "Cities", url: "/admin/content/locations/cities" },
            { title: "States", url: "/admin/content/locations/states" },
            { title: "Service Areas", url: "/admin/content/locations/areas" },
          ]
        },
        {
          title: "Loan Types",
          url: "/admin/content/loan-types",
          items: [
            { title: "All Loan Types", url: "/admin/content/loan-types" },
            { title: "Add Loan Type", url: "/admin/content/loan-types/create" },
          ]
        },
      ]
    },
    {
      title: "Support System",
      url: "/admin/support",
      icon: HelpCircle,
      items: [
        { title: "All Tickets", url: "/admin/support/tickets" },
        { title: "Open Tickets", url: "/admin/support/open" },
        { title: "Support Analytics", url: "/admin/support/analytics" },
      ]
    },
    {
      title: "System Analytics",
      url: "/admin/analytics",
      icon: TrendingUp,
      items: [
        { title: "Platform Overview", url: "/admin/analytics/overview" },
        { title: "User Growth", url: "/admin/analytics/users" },
        { title: "Revenue Analytics", url: "/admin/analytics/revenue" },
        { title: "Broker Performance", url: "/admin/analytics/brokers" },
      ]
    },
    {
      title: "Advertisements",
      url: "/admin/ads",
      icon: Megaphone,
      items: [
        { title: "Overview", url: "/admin/ads" },
        { title: "Advertisements", url: "/admin/ads/list" },
        { title: "Media Library", url: "/admin/media", enabled: false },
        { title: "Folders", url: "/admin/folders", enabled: false },
      ]
    },
    {
      title: "System Settings",
      url: "/admin/settings",
      icon: Settings,
      items: [
        { title: "General Settings", url: "/admin/settings/general" },
        { title: "Email Templates", url: "/admin/settings/email" },
        { title: "Payment Gateway", url: "/admin/settings/payment" },
        { title: "API Settings", url: "/admin/settings/api" },
      ]
    },
  ] : []

  // ==================== BROKER NAVIGATION ====================
  const brokerNavItems: SidebarItem[] = isBroker ? [
    {
      title: "Broker Dashboard",
      url: "/broker/dashboard",
      icon: Home,
      roles: ["BROKER"]
    },
    {
      title: "My Profile",
      url: "/broker/profile",
      icon: UserIcon,
      // items: [
      //   { title: "Profile Overview", url: "/broker/profile" },
      //   { title: "Edit Profile", url: "/broker/profile/edit" },
      //   // { title: "Verification Status", url: "/broker/profile/verification", 
      //   //   badge: isVerifiedBroker ? "Verified" : "Pending" 
      //   // },
      // ]
    },
     {
      title: "Company Profile",
      url: "/broker/company",
      icon: UserIcon,
      // items: [
      //   { title: "Overview", url: "/broker/company" },
      //   { title: "Edit  ", url: "/broker/company/edit" },
      //   { title: "Preview", url: `/brokers/${brokerProfile?.profileSlug || 'preview'}` }
      // ]
    },
  
    // {
    //   title: "Reviews",
    //   url: "/broker/reviews",
    //   icon: Star,
    //   badge: brokerProfile?.totalReviews || 0,
    //   items: [
    //     { title: "All Reviews", url: "/broker/reviews" },
    //     { title: "Review Insights", url: "/broker/reviews/insights" },
    //     { title: "Respond to Reviews", url: "/broker/reviews/respond" },
    //   ]
    // },
    {
      title: "Subscription",
      url: "/broker/subscription",
      icon: CreditCard,
      // items: [
      //   { title: "Current Plan", url: "/broker/subscription", 
      //     badge: subscriptionPlan === "FREE" ? "Free" : subscriptionPlan 
      //   },
      //   { title: subscriptionPlan === "FREE" ? "Upgrade Plan" : "Change Plan", 
      //     url: "/broker/subscription/upgrade" 
      //   },
      //   { title: "Billing History", url: "/broker/subscription/billing" },
      //   { title: "Subscription Usage", url: "/broker/subscription/usage" },
      // ]
    },
    // user.isFeaturedBroker &&
    // {
    //   title: "Analytics",
    //   url: "/broker/analytics",
    //   icon: ChartBar,
    //   requiresSubscription: true,
    //   items: [
    //     { title: "Dashboard", url: "/broker/analytics" },
    //     { title: "Profile Analytics", url: "/broker/analytics/profile" },
    //     { title: "Performance Report", url: "/broker/analytics/report" },
    //   ]
    // },
    {
      title: "Messages",
      url: "/broker/messages",
      icon: MessageCircle,
      badge: user.unreadContacts, // Unread messages count
      // items: [
      //   { title: "All Conversations", url: "/broker/messages" },
      //   { title: "Unread Messages", url: "/broker/messages?filter=unread" },
      //   { title: "Important", url: "/broker/messages?filter=important" },
      // ]
    },
    {
      title: "Support Tickets",
      url: "/broker/support",
      icon: HelpCircle,
      items: [
        { title: "My Tickets", url: "/broker/support/tickets" },
        { title: "Create Ticket", url: "/broker/support/create" },
        { title: "FAQ", url: "/broker/support/faq" },
        { title: "Priority Support", url: "/broker/support/priority", 
          enabled: isPremiumBroker 
        },
      ]
    },
  ] : []

  // Filter broker items based on subscription requirements
  const filteredBrokerNavItems = brokerNavItems
    .filter(item => {
      if (item.requiresSubscription && !hasActiveSubscription) {
        return false
      }
      if (item.enabled === false) {
        return false
      }
      return true
    })
    .map(item => ({
      ...item,
      items: item.items?.filter(subItem => {
        if (subItem.requiresSubscription && !hasActiveSubscription) {
          return false
        }
        if (subItem.enabled === false) {
          return false
        }
        return true
      })
    }))

  // ==================== USER NAVIGATION ====================
  const userNavItems: SidebarItem[] = isUser ? [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      roles: ["USER"]
    },
    {
      title: "Find Brokers",
      url: "/brokers",
      icon: Search,
      items: [
        { title: "Browse Brokers", url: "/brokers" },
        { title: "Featured Brokers", url: "/brokers?featured=true" },
        { title: "Verified Brokers", url: "/brokers?verified=true" },
        { title: "By City", url: "/brokers/cities" },
        { title: "By Specialization", url: "/brokers/specializations" },
      ]
    },
    {
      title: "My Leads",
      url: "/leads",
      icon: MessageSquare,
      items: [
        { title: "All Leads", url: "/leads" },
        { title: "Send New Lead", url: "/leads/create" },
        { title: "Lead History", url: "/leads/history" },
      ]
    },
    {
      title: "Saved Brokers",
      url: "/saved",
      icon: Heart,
      badge: "12", // Saved brokers count
      items: [
        { title: "All Saved", url: "/saved" },
        { title: "Recent Views", url: "/saved/recent" },
        { title: "Top Picks", url: "/saved/top" },
      ]
    },
    // {
    //   title: "EMI Calculator",
    //   url: "/calculator",
    //   icon: Calculator,
    //   items: [
    //     { title: "Loan Calculator", url: "/calculator/loan" },
    //     { title: "Affordability", url: "/calculator/affordability" },
    //     { title: "Comparison", url: "/calculator/comparison" },
    //   ]
    // },
    // {
    //   title: "Resources",
    //   url: "/resources",
    //   icon: FileText,
    //   items: [
    //     { title: "Loan Guides", url: "/resources/guides" },
    //     { title: "Bank Rates", url: "/resources/rates" },
    //     { title: "FAQ", url: "/resources/faq" },
    //     { title: "Blog", url: "/resources/blog" },
    //   ]
    // },
  ] : []

  // ==================== COMMON NAVIGATION ====================
  const commonNavItems: SidebarItem[] = [
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
      badge: user?.unreadNotifications || 0,
      items: [
        { title: "All Notifications", url: "/notifications" },
        { title: "Unread", url: "/notifications?filter=unread" },
        { title: "Settings", url: "/notifications/settings" },
      ]
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      items: [
        { title: "Account Settings", url: "/settings/account" },
        { title: "Profile", url: "/settings/profile" },
        { title: "Security", url: "/settings/security" },
        { title: "Notifications", url: "/settings/notifications" },
        { title: "Preferences", url: "/settings/preferences" },
      ]
    },
    {
      title: "Help & Support",
      url: "/support",
      icon: HelpCircle,
      items: [
        { title: "Help Center", url: "/support/help" },
        { title: "Contact Us", url: "/support/contact" },
        { title: "Documentation", url: "/support/docs" },
        { title: "Feedback", url: "/support/feedback" },
      ]
    },
  ]

  // ==================== COMBINE ALL NAVIGATION ====================
  const allNavItems = [
    ...adminNavItems,
    ...filteredBrokerNavItems,
    ...userNavItems,
    ...commonNavItems
  ]

  // Filter items based on user role and enabled status
  const filteredNavItems = allNavItems.filter(item => {
    // Filter by role
    if (item.roles && !item.roles.includes(user?.role)) {
      return false
    }
    
    // Filter by enabled flag
    if (item.enabled === false) {
      return false
    }
    
    return true
  })

  // ==================== QUICK ACTIONS ====================
  const quickActions = getQuickActions(user, {
    isAdmin,
    isBroker,
    isUser,
    hasActiveSubscription,
    isVerifiedBroker,
    subscriptionPlan,
  })

  return {
    user: {
      id: user?.id || "",
      name: user?.name || "User",
      email: user?.email || "",
      phone: user?.phone || "",
      image: user?.image || "",
      role: user?.role || "USER",
      isActive: user?.isActive || false,
      
      // Broker specific
      brokerProfile: brokerProfile ? {
        id: brokerProfile.id,
        displayName: brokerProfile.displayName,
        companyName: brokerProfile.companyName,
        verificationStatus: brokerProfile.verificationStatus,
        brokerStatus: brokerProfile.brokerStatus,
        profileSlug: brokerProfile.profileSlug,
        avgRating: brokerProfile.avgRating,
        totalReviews: brokerProfile.totalReviews,
        totalLeads: brokerProfile.totalLeads,
        profileViews: brokerProfile.profileViews,
        subscription: subscription,
      } : null,
      
      // Subscription info
      hasActiveSubscription,
      subscriptionPlan,
      isVerifiedBroker,
      isFeaturedBroker,
      isPremiumBroker,
    },
    navMain: filteredNavItems,
    quickActions,
  }
}

// Helper function for quick actions
function getQuickActions(user: any, options: {
  isAdmin: boolean;
  isBroker: boolean;
  isUser: boolean;
  hasActiveSubscription: boolean;
  isVerifiedBroker: boolean;
  subscriptionPlan: string;
}) {
  const {
    isAdmin,
    isBroker,
    isUser,
    hasActiveSubscription,
    isVerifiedBroker,
    subscriptionPlan,
  } = options

  const actions = []

  if (isBroker) {
    actions.push(
      {
        title: "View Profile",
        url: `/brokers/${user?.brokerProfile?.profileSlug || 'preview'}`,
        icon: UserIcon,
        color: "primary"
      },
      {
        title: "New Leads",
        url: "/broker/leads?status=NEW",
        icon: MessageSquare,
        color: "success",
        badge: user?.brokerProfile?.totalLeads || 0
      },
      {
        title: "Upgrade Plan",
        url: "/broker/subscription/upgrade",
        icon: Crown,
        color: "warning",
        enabled: subscriptionPlan === "FREE"
      }
    )

    if (hasActiveSubscription) {
      actions.push(
        {
          title: "Analytics",
          url: "/broker/analytics",
          icon: ChartBar,
          color: "info"
        }
      )
    }
  }

  if (isUser) {
    actions.push(
      {
        title: "Find Brokers",
        url: "/brokers",
        icon: Search,
        color: "primary"
      },
      {
        title: "EMI Calculator",
        url: "/calculator",
        icon: Calculator,
        color: "success"
      },
      {
        title: "Send Lead",
        url: "/leads/create",
        icon: MessageSquare,
        color: "info"
      }
    )
  }

  if (isAdmin) {
    actions.push(
      {
        title: "Broker Management",
        url: "/admin/brokers",
        icon: Users,
        color: "primary"
      },
      {
        title: "Analytics",
        url: "/admin/analytics",
        icon: TrendingUp,
        color: "success"
      },
      {
        title: "Support Tickets",
        url: "/admin/support/tickets",
        icon: HelpCircle,
        color: "info"
      }
    )
  }

  return actions.filter(action => action.enabled !== false)
}
