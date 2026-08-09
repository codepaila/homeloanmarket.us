/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'


export default function ResourceCard({resource}: {resource: any}) {
    // console.log(resource,"test")
  return (
   <div className="card">
            <div className="flex items-center flex-col  text-center ">
              <div 
              className='mb-2'
              // className="flex-shrink-0 bg-primary/10 p-3 rounded-lg"
              >
                {resource?.icon}
              </div>
              <div>
                <h4 className="font-bold text-text-main mb-2">{resource?.title}</h4>
                <p className="text-text-muted text-sm mb-4">{resource?.description}</p>
              </div>
                <Link 
                  href={resource?.link as string}
                  className="btn btn-primary  flex items-center"
                >
                  {resource?.linkText}
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
            </div>
          </div>
  )
}