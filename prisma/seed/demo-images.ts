const U = (id: string, w = 1200, h = 800, params = 'auto=format&fit=crop&q=80') => `https://images.unsplash.com/${id}?${params}&w=${w}&h=${h}`

export const DEMO_IMAGES = {
  brokers: [
    { key: 'broker-michael', url: U('photo-1500648767791-00dcc994a43e', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-sarah', url: U('photo-1573496359142-b8d87734a5a2', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-david', url: U('photo-1507003211169-0a1dd7228f2d', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-jessica', url: U('photo-1580489944761-15a19d654956', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-james', url: U('photo-1560250097-0b93528c311a', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-emily', url: U('photo-1573497019940-1c28c88b4f3e', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-robert', url: U('photo-1472099645785-5658abf4ff4e', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
    { key: 'broker-amanda', url: U('photo-1438761681033-6461ffad8d80', 800, 800), alt: 'Professional mortgage advisor portrait', width: 800, height: 800 },
  ],
  brokerCovers: [
    { key: 'cover-san-diego', url: U('photo-1449824913935-59a10b8d2000', 1600, 900), alt: 'Southern California skyline', width: 1600, height: 900 },
    { key: 'cover-austin', url: U('photo-1501594907352-04cda38ebc29', 1600, 900), alt: 'City skyline', width: 1600, height: 900 },
    { key: 'cover-seattle', url: U('photo-1518391846015-55a9cc003b25', 1600, 900), alt: 'Seattle skyline', width: 1600, height: 900 },
    { key: 'cover-new-york', url: U('photo-1477959858617-67f85cf4f1df', 1600, 900), alt: 'New York City skyline', width: 1600, height: 900 },
    { key: 'cover-denver', url: U('photo-1444723121867-7a241cacace9', 1600, 900), alt: 'Mountain city skyline', width: 1600, height: 900 },
  ],
  advertisements: {
    hero: [
      { key: 'ad-hero-1', url: U('photo-1512917774080-9991f1c4c750', 1600, 300), alt: 'Bright modern family home exterior', width: 1600, height: 300 },
      { key: 'ad-hero-2', url: U('photo-1564013799919-ab600027ffc6', 1600, 300), alt: 'Welcoming suburban home exterior', width: 1600, height: 300 },
      { key: 'ad-hero-3', url: U('photo-1600585154340-be6161a56a0c', 1600, 300), alt: 'Modern home with landscaped yard', width: 1600, height: 300 },
      { key: 'ad-hero-4', url: U('photo-1600596542815-ffad4c1539a9', 1600, 300), alt: 'Contemporary home in a residential neighborhood', width: 1600, height: 300 },
    ],
    sidebar: [
      { key: 'ad-sidebar-1', url: U('photo-1600607687939-ce8a6c25118c', 800, 1200), alt: 'Modern home exterior for a mortgage planning campaign', width: 800, height: 1200 },
      { key: 'ad-sidebar-2', url: U('photo-1522708323590-d24dbb6b0267', 800, 1200), alt: 'Modern apartment living space', width: 800, height: 1200 },
      { key: 'ad-sidebar-3', url: U('photo-1600566753086-00f18fb6b3ea', 800, 1200), alt: 'Bright residential interior', width: 800, height: 1200 },
    ],
    inline: [
      { key: 'ad-inline-1', url: U('photo-1551836022-d5d88e9218df', 1200, 800), alt: 'Mortgage advisor meeting with a home buyer', width: 1200, height: 800 },
      { key: 'ad-inline-2', url: U('photo-1600607687920-4e2a09cf159d', 1200, 800), alt: 'Sunlit modern home interior', width: 1200, height: 800 },
      { key: 'ad-inline-3', url: U('photo-1580587771525-78b9dba3b914', 1200, 800), alt: 'Beautiful family home exterior', width: 1200, height: 800 },
    ],
    footer: [
      { key: 'ad-footer-1', url: U('photo-1600047509807-ba8f99d2cdde', 1600, 300), alt: 'Inviting home exterior for a home financing campaign', width: 1600, height: 300 },
      { key: 'ad-footer-2', url: U('photo-1494526585095-c41746248156', 1600, 300), alt: 'Classic American home exterior', width: 1600, height: 300 },
    ],
    announcement: [
      { key: 'ad-announcement-1', url: U('photo-1560518883-ce09059eeffa', 1600, 300), alt: 'Home buying announcement with a welcoming home', width: 1600, height: 300 },
      { key: 'ad-announcement-2', url: U('photo-1556761175-b413da4baf72', 1600, 300), alt: 'Mortgage consultation announcement', width: 1600, height: 300 },
    ],
    popup: [
      { key: 'ad-popup-1', url: U('photo-1600607688969-a5bfcd646154', 1200, 900), alt: 'Bright home interior for a mortgage consultation offer', width: 1200, height: 900 },
    ],
    mobile: [
      { key: 'ad-mobile-1', url: U('photo-1600566753086-00f18fb6b3ea', 750, 320), alt: 'Bright home interior mobile banner', width: 750, height: 320 },
      { key: 'ad-mobile-2', url: U('photo-1512917774080-9991f1c4c750', 750, 320), alt: 'Modern home mobile banner', width: 750, height: 320 },
    ],
    square: [
      { key: 'ad-square-1', url: U('photo-1505691938895-1758d7feb511', 800, 800), alt: 'Home buying square promotion', width: 800, height: 800 },
      { key: 'ad-square-2', url: U('photo-1494526585095-c41746248156', 800, 800), alt: 'Mortgage advisor square promotion', width: 800, height: 800 },
    ],
    button: [
      { key: 'ad-button-1', url: U('photo-1551836022-d5d88e9218df', 600, 300), alt: 'Mortgage advisor consultation button creative', width: 600, height: 300 },
    ],
  },
  blogs: [
    { key: 'blog-preapproval', url: U('photo-1560518883-ce09059eeffa', 1200, 630), alt: 'Mortgage pre-approval imagery', width: 1200, height: 630 },
    { key: 'blog-fha', url: U('photo-1600585154340-be6161a56a0c', 1200, 630), alt: 'FHA loan guide imagery', width: 1200, height: 630 },
    { key: 'blog-va', url: U('photo-1600047509807-ba8f99d2cdde', 1200, 630), alt: 'VA home loan imagery', width: 1200, height: 630 },
    { key: 'blog-fixed-vs-adjustable', url: U('photo-1600596542815-ffad4c1539a9', 1200, 630), alt: 'Mortgage rate comparison imagery', width: 1200, height: 630 },
    { key: 'blog-affordability', url: U('photo-1560518883-ce09059eeffa', 1200, 630), alt: 'Home affordability imagery', width: 1200, height: 630 },
    { key: 'blog-closing-costs', url: U('photo-1580587771525-78b9dba3b914', 1200, 630), alt: 'Closing costs imagery', width: 1200, height: 630 },
    { key: 'blog-refinance', url: U('photo-1600585154340-be6161a56a0c', 1200, 630), alt: 'Refinancing imagery', width: 1200, height: 630 },
    { key: 'blog-credit', url: U('photo-1600047509807-ba8f99d2cdde', 1200, 630), alt: 'Credit score imagery', width: 1200, height: 630 },
  ],
  properties: [
    { key: 'property-suburban', url: U('photo-1560518883-ce09059eeffa', 1200, 800), alt: 'Modern suburban home', width: 1200, height: 800 },
    { key: 'property-california', url: U('photo-1600596542815-ffad4c1539a9', 1200, 800), alt: 'California-style home', width: 1200, height: 800 },
    { key: 'property-texas', url: U('photo-1600585154340-be6161a56a0c', 1200, 800), alt: 'Texas suburban home', width: 1200, height: 800 },
    { key: 'property-florida', url: U('photo-1600047509807-ba8f99d2cdde', 1200, 800), alt: 'Florida home', width: 1200, height: 800 },
    { key: 'property-urban', url: U('photo-1522708323590-d24dbb6b0267', 1200, 800), alt: 'Urban apartment building', width: 1200, height: 800 },
    { key: 'property-luxury', url: U('photo-1600607687939-ce8a6c25118c', 1200, 800), alt: 'Luxury home', width: 1200, height: 800 },
  ],
  testimonials: [
    { key: 'testimonial-1', url: U('photo-1544005313-94ddf0286df2', 400, 400), alt: 'Happy customer portrait', width: 400, height: 400 },
    { key: 'testimonial-2', url: U('photo-1506794778202-cad84cf45f1d', 400, 400), alt: 'Happy customer portrait', width: 400, height: 400 },
    { key: 'testimonial-3', url: U('photo-1494790108377-be9c29b29330', 400, 400), alt: 'Happy customer portrait', width: 400, height: 400 },
  ],
  homepage: [
    { key: 'homepage-hero', url: U('photo-1560518883-ce09059eeffa', 1920, 1080), alt: 'Home buying hero imagery', width: 1920, height: 1080 },
    { key: 'homepage-search', url: U('photo-1600585154340-be6161a56a0c', 1920, 1080), alt: 'Broker search background', width: 1920, height: 1080 },
    { key: 'homepage-promotion', url: U('photo-1600047509807-ba8f99d2cdde', 1920, 1080), alt: 'Mortgage promotion imagery', width: 1920, height: 1080 },
    { key: 'homepage-featured', url: U('photo-1600596542815-ffad4c1539a9', 1920, 1080), alt: 'Featured broker imagery', width: 1920, height: 1080 },
    { key: 'homepage-articles', url: U('photo-1580587771525-78b9dba3b914', 1920, 1080), alt: 'Article section imagery', width: 1920, height: 1080 },
  ],
} as const

export type DemoImageCatalog = typeof DEMO_IMAGES
