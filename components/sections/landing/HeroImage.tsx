import Image from 'next/image'

// Beautiful Unsplash background image - modern home exterior
const heroBackground = '/assets/images/cover.PNG'

// Pure static hero banner: server-rendered (no state, events, or animations).
// The two hero images are the homepage LCP candidates and remain <Image
// priority> so they are preloaded by the browser.
export default function HeroImageSection() {
  return (
    <section className="relative isolate min-h-80 sm:min-h-90 md:min-h-130 lg:min-h-150  overflow-hidden bg-secondary">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroBackground}
          alt="Modern dream home exterior"
          fill
          sizes="100vw"
          priority
          className="object-cover object-center"
          aria-hidden="true"
        />

      </div>
      <div className="container-custom relative z-10">
        <div
          className=" py-12 md:pt-16 lg:pt-20 mt-12 md:mt-12"
        >
          <div className="mx-auto max-w-8xl text-left lg:mx-0">

            <div className="mt-0">
              <Image
                src="/assets/images/5-profiles-cover-icon.png"
                alt="Verified mortgage professionals"
                width={750}
                height={400}
                priority
                className="h-auto w-full max-w-187.5 object-contain object-center"
              />
            </div>
            <div className="mt-8 sm:mt-10 md:mt-16 lg:mt-24">

              <h1
                className=" text-lg sm:text-xl  md:text-3xl lg:text-[40px]   font-bold  tracking-tighter md:tracking-wide text-white text-shadow-xs text-shadow-black"
              >
                You Could Save Thousands on Your Home Loan.
              </h1>

              {/* Subtitle - Exact text from image */}
              <p
                className=" text-lg sm:text-2xl  md:text-3xl lg:text-[40px]  font-bold  tracking-tighter sm:tracking-wide text-white text-shadow-xs text-shadow-black"
              >
                Talk To Local Home Loan Experts
              </p>
            </div>

          </div>
        </div>
      </div>
      {/*  */}
    </section>
  )
}