import React from 'react'

function TrustedParthnerSection() {
    return (
        <section className="section-spacing">
            <div className="container-custom text-center " style={{ animationDelay: '0.3s' }}>
                <h3 className="text-2xl font-bold text-text-main mb-4">
                    Your trusted partner in finding the right mortgage broker
                </h3>
                <p className="text-text-muted mb-8 max-w-2xl mx-auto">
                    We connect you with experienced professionals who care about your mortgage journey.
                </p>
                <a href="/contact" className="btn btn-secondary btn-lg">
                    Contact
                </a>
            </div>
        </section>
    )
}

export default TrustedParthnerSection