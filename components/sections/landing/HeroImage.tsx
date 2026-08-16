'use client'


import Image from 'next/image'

// Beautiful Unsplash background image - modern home exterior
const heroBackground = '/assets/images/home-cover.png'

export default function HeroImageSection() {
 



  return (
    <section
    //  className="relative isolate  overflow-hidden bg-secondary"
     className="relative isolate min-h-[35vh] sm:min-h-[50vh] md:min-h-screen overflow-hidden bg-secondary"
     >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroBackground}
          alt="Modern dream home exterior"
          // width={1200}
          // height={400}
          fill
          sizes="100vw"
          priority
          className="object-fit"
          aria-hidden="true"
        />

      </div>

      {/*  */}
    </section>
  )
}