import React from 'react'

function TrustedParthnerSection() {
    return (
        <section className="section-spacing">
            <div className="container-custom text-center " style={{ animationDelay: '0.3s' }}>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                    Your trusted partner in finding the right mortgage originator
                </h3>
                <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
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