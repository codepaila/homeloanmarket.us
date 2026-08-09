import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

function BorrowSection() {
    return (
        <div className="section-spacing  " >
            <h3 className="text-2xl font-bold text-center text-text-main mb-8">
                Designed to help borrowers
            </h3>
            <p className="text-center text-text-muted mb-12 max-w-2xl mx-auto">
                Our platform empowers borrowers with comprehensive information and diverse mortgage options tailored to their needs. This ensures that mortgage brokers can easily assist clients in making informed mortgage decisions.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="text-center p-6 text-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 014 0z" />
                        </svg>
                    </div>
                    <h4 className="font-bold text-text-main mb-2">Compare local mortgage professionals</h4>
                    <p className="text-text-muted">Rather than traditional lenders</p>
                </div>

                <div className="text-center p-6 text-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h4 className="text-text-main mb-2">Understand <strong>loan programs and pricing</strong></h4>
                    <p className="text-text-muted">Before making a commitment</p>
                </div>

                <div className="text-center p-6 text-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h4 className="font-bold text-text-main mb-2">Feel supported and informed</h4>
                    <p className="text-text-muted">Throughout the entire home-loan journey</p>
                </div>
            </div>

            <div className="text-center">
                <Link href="/brokers" className="btn btn-primary btn-sm">
                    Find Mortgage Brokers <ArrowRight className='w-5 h-5 ml-2'/>
                </Link>
            </div>
        </div>
    )
}

export default BorrowSection