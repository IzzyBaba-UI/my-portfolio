import { useCallback, useEffect, useRef, useState } from 'react'

// The ribbons are a static site file, so they live in /public with the favicons and the
// social preview instead of being bundled: swap the PNG on disk and the page picks it up
// with no code change. BASE_URL keeps the path valid if the site is ever served from a
// sub-path rather than the domain root.
const bandArt = `${import.meta.env.BASE_URL}bottom-image.png`

// Shipped screens stand in for the CSS-drawn phone mock-up in the "Things I've Made" stage: the
// Acktors app and the Obana landing page. Same deal as the band art, they sit in /public so a
// fresh export can be dropped on disk without touching code. The export's own pixel size travels
// with the file, because the stage hands it to the <img> as that render's intrinsic box and lets
// object-fit: contain letterbox it against the frame — a size that disagrees with the PNG reserves
// the wrong shape before the file decodes. Projects with no `art` keep the drawn mock-up.
const artFrame = (file, width, height) => ({ src: `${import.meta.env.BASE_URL}${file}`, width, height })
// Acktors shows three phone exports in the carousel: the feed in the middle, the other two beside it.
// Biosimulant shows three website captures as framed cards rising from the bottom: the home page in the
// middle, the intro and the hub beside it. Cards crop each tall capture to its top.
const biosimulantShots = [artFrame('biosimulant/intro.webp', 1606, 2000), artFrame('biosimulant/home.webp', 392, 2000), artFrame('biosimulant/hub.webp', 1109, 2000)]
const acktorsFeed = artFrame('acktors/feed.webp', 929, 1999)
const acktorsPhones = [artFrame('acktors/explore.webp', 964, 1999), acktorsFeed, artFrame('acktors/monologue.webp', 964, 1999)]
const obanaArt = artFrame('obana.png', 1304, 1254)

// Brand tiles are static site files too: one PNG per Tools card and one per Visual Experiment.
// They sit in /public alongside the favicons, so a fresh export replaces a card's artwork on
// disk with no code change. The nav pulls its two marks — profile-photo.png for the avatar and
// svg's/mail.svg for the mail button — the same way.
// The CV is a Google Doc. The /export?format=pdf form makes Google render the current version of the doc as a
// PDF on every click, so edits in the doc reach visitors immediately with no change here. The doc must be
// shared as "Anyone with the link" (Viewer) for the download to work for visitors.
const CV_DOC_ID = '1-o0uSSdiGESZlgvot2zlmBNfXjJolZCIVT8UqwZbBuY'
const cvUrl = `https://docs.google.com/document/d/${CV_DOC_ID}/export?format=pdf`
const publicArt = (file) => `${import.meta.env.BASE_URL}${file}`

// The pointer, ported from jingjinghan.com: a white dot that trails the mouse through a
// short ease and inverts whatever it crosses (mix-blend-mode: difference), growing into a
// ring over anything interactive and a "View Project" disc over a [data-cursor="view"] card.
// The reference drives it with GSAP's quickTo(0.32s, power3); that motion is a few lines of
// exponential follow here, which keeps GSAP out of the bundle. The 0.32s itself is not copied: a
// fixed-duration retarget keeps travelling long after the pointer has already stopped, and while
// the hand is still moving it parks the dot a visible distance behind it — that distance is
// speed × time constant, and a third of a second of it is exactly what reads as the dot being
// dragged on a string. Closing 45% of the remaining gap per frame is a ~28ms time constant
// instead: the dot parks only ~14-15px behind a deliberate 450px/s hand (the old tween measured
// 70-104px median on the same pointer trace) and lands within 1px of a 200px flick in ~180ms,
// while still smoothing the 17px steps a fast hand arrives in. Everything visual lives in
// src/cursor.css — this only aims the element and toggles its two states. The class it puts on
// <html> is also the only thing that hides the native cursor, so a device that never gets the
// class (touch, reduced motion, the phone layout) keeps its own pointer.
const CURSOR_FOLLOW = 0.45 // share of the remaining gap the dot closes per 16.7ms frame
const CURSOR_REST = 0.05 // px — inside this the dot is parked on the pointer and the loop stops

function CustomCursor() {
  const dotRef = useRef(null)

  useEffect(() => {
    // A fine pointer is the only thing the dot improves on; reduced motion opts out as well,
    // since a trailing dot is motion the reader has asked not to see.
    const finePointer = window.matchMedia('(pointer: fine)')
    const calmPointer = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || calmPointer.matches) return undefined

    const dot = dotRef.current
    const root = document.documentElement
    root.classList.add('has-custom-cursor')

    let currentX = 0
    let currentY = 0
    let targetX = 0
    let targetY = 0
    let lastFrameAt = 0
    let frame = 0

    const settle = (now) => {
      // Scaled by the length of the frame that just passed rather than by a fixed step, so the
      // dot converges at the same speed in milliseconds on a 60Hz panel, a 120Hz one, and one
      // that has just dropped a frame.
      const step = Math.min(now - lastFrameAt, 64)
      lastFrameAt = now
      const follow = 1 - (1 - CURSOR_FOLLOW) ** (step / 16.7)
      currentX += (targetX - currentX) * follow
      currentY += (targetY - currentY) * follow
      const restX = Math.abs(targetX - currentX) < CURSOR_REST
      const restY = Math.abs(targetY - currentY) < CURSOR_REST
      // Landing exactly on the target instead of approaching it forever is what lets the loop
      // stop — a sub-pixel gap would otherwise keep asking for frames while the pointer is idle.
      if (restX) currentX = targetX
      if (restY) currentY = targetY
      dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
      // Only work while the dot is still catching up — at rest the loop stops.
      frame = restX && restY ? 0 : window.requestAnimationFrame(settle)
    }

    const start = () => {
      if (frame) return
      lastFrameAt = performance.now()
      frame = window.requestAnimationFrame(settle)
    }

    const onPointerMove = (event) => {
      // Touch on a hybrid device fires this too, and it would teleport the dot out from
      // under the last real pointer, so fingers are left to the native cursor.
      if (event.pointerType === 'touch') return

      const target = event.target
      // A button wins inside the stage: the chevrons are their own target, and the disc
      // would bury the very control the pointer is sitting on.
      const overProject = !target?.closest?.('button') && !!target?.closest?.('[data-cursor="view"]')
      const overInteractive = !overProject && !!target?.closest?.('a, button, [data-cursor-hover]')
      dot.classList.toggle('is-view', overProject)
      dot.classList.toggle('is-hover', overInteractive)

      targetX = event.clientX
      targetY = event.clientY

      // The very first move places the dot under the pointer instead of sliding it in from the
      // corner it was parked in, so there is nothing to animate yet. Every move after that only
      // moves the target and lets the loop close the gap from wherever the dot actually is —
      // the way quickTo does — so a fast flick glides instead of snapping or overshooting.
      if (dot.classList.contains('is-live')) {
        start()
      } else {
        dot.classList.add('is-live')
        currentX = targetX
        currentY = targetY
        dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      if (frame) window.cancelAnimationFrame(frame)
      root.classList.remove('has-custom-cursor')
    }
  }, [])

  return (
    <div ref={dotRef} className="custom-cursor-dot" aria-hidden="true">
      <span className="cursor-label">View<br />Project</span>
    </div>
  )
}

// Opening sequence: a cream screen with the name coming into focus and a 0–100 counter, then the site
// "opens" as a rounded window that grows from the middle of the screen to fill it. Total run is INTRO_MS;
// the CSS keyframes in styles.css (.page.is-intro and .intro-screen) are timed to the same number.
const INTRO_MS = 3600
function IntroScreen({ onDone }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let frame = 0
    const tick = (now) => {
      const p = Math.min((now - start) / 1700, 1)
      setCount(Math.round(100 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    const done = window.setTimeout(onDone, INTRO_MS)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(done) }
  }, [onDone])
  return (
    <>
    <div className="intro-bg" aria-hidden="true" />
    <div className="intro-screen" aria-hidden="true">
      <div className="intro-name"><span className="w"><i>Omole</i></span> <span className="w"><i>Israel</i></span></div>
      <div className="intro-line"><i style={{ transform: `scaleX(${count / 100})` }} /></div>
      <div className="intro-meta"><span>Portfolio · 2026</span><span className="intro-count">{String(count).padStart(3, '0')}</span><span>Product &amp; Graphic Designer</span></div>
    </div>
    </>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [intro, setIntro] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const finishIntro = useCallback(() => setIntro(false), [])
  const [roleIndex, setRoleIndex] = useState(0)
  const [roleLeaving, setRoleLeaving] = useState(false)
  const [audience, setAudience] = useState('For Everyone')
  const [madeIndex, setMadeIndex] = useState(0)
  const [projectOpen, setProjectOpen] = useState(false)
  const toolsTrackRef = useRef(null)
  const caseRef = useRef(null)
  const roles = ['Product Designer', 'Creative Developer', 'Brand Designer', 'Visual Storyteller']
  const audienceCopy = {
    'For Everyone': 'I’m Israel, a Product & Graphic Designer who loves turning ideas into things that look good, work well, and feel human. I enjoy blending creativity with problem-solving to build digital products, brands, and experiences that people can actually connect with.',
    Brands: 'I help brands find a clear point of view, then translate it into visual systems and digital experiences people remember.',
    'Product Managers': 'I partner with product teams to turn strategic goals into thoughtful, accessible experiences that move work forward.',
    Engineers: 'I work closely with engineers to make strong ideas practical, polished, and ready to ship.'
  }
  // Each project's case study is a Behance-style run of frames. A frame is { layout, title, text, art }:
  // `layout` places the copy ('top', 'left' or 'right' of the screen) and `art` is an artFrame(file, w, h)
  // from /public. A frame with no art keeps its place as an empty slot, so filling one is a single edit.
  const frame = (layout, title, text, art) => ({ layout, title, text, art })
  const made = [
    { title: 'Acktors', url: 'https://acktors.com/', description: 'A creative platform connecting actors and producers, built to make discovering talent, auditioning, and bringing stories to life feel more seamless.', color: 'acktors', phones: acktorsPhones,
      study: { role: 'Product Design', year: '2026', type: 'Mobile app', tools: ['Figma'], overview: 'Acktors helps actors get seen and producers find the right face faster. The product pulls profiles, projects, and auditions into one place so casting stops living in scattered DMs and spreadsheets.',
        frames: [
          frame('top', 'The app', 'Profiles, discovery, and projects designed around how casting actually moves.', acktorsFeed),
          frame('left', 'Onboarding', 'Getting an actor profile set up in a few simple steps.'),
          frame('right', 'Discovery', 'Browsing talent and projects with filters that match how producers search.'),
          frame('top', 'Profiles', 'A profile that shows an actor’s range at a glance.'),
          frame('left', 'Auditions', 'Submitting and reviewing self-tapes in one flow.'),
          frame('right', 'Projects', 'Producers posting roles and tracking applicants.'),
        ] } },
    { title: 'Biosimulant', url: 'https://www.biosimulant.com/', description: 'A small, thoughtful space for collecting ideas, quiet moments, and the work that helps them grow.', color: 'mint', shots: biosimulantShots,
      study: { role: 'Product Design', year: '2026', type: 'Web app', tools: ['Figma'], overview: 'A small, thoughtful space for collecting ideas, quiet moments, and the work that helps them grow.',
        frames: [
          frame('top', 'Overview', 'The product at a glance.'),
          frame('left', 'Key screen', 'What the main experience looks like.'),
          frame('right', 'Detail', 'A closer look at one part of the flow.'),
          frame('top', 'System', 'The visual language behind it.'),
          frame('left', 'Flow', 'How a person moves through the product.'),
        ] } },
    { title: 'Obana.Africa', url: 'https://www.obana.africa/', description: 'A B2B fashion and beauty marketplace helping African retailers source quality products from global brands and grow their businesses with ease.', color: 'sky', art: obanaArt,
      study: { role: 'Product Design', year: '2026', type: 'B2B marketplace', tools: ['Figma', 'Shopify'], overview: 'Obana.Africa is a B2B fashion and beauty marketplace that helps African retailers source quality products from global brands and grow their businesses with ease.',
        frames: [
          frame('top', 'Landing page', 'A clear first impression for retailers deciding whether to buy through the platform.', obanaArt),
          frame('left', 'Marketplace', 'Browsing brands and products by category.'),
          frame('right', 'Product page', 'The details a retailer needs before placing a bulk order.'),
          frame('top', 'Logistics', 'Shipment creation and tracking for wholesale orders.'),
          frame('left', 'Checkout', 'A simple path from cart to confirmed order.'),
          frame('right', 'Dashboard', 'Orders, shipments, and settings in one place.'),
        ] } },
  ]
  const toolCards = [
    { name: 'Figma', art: 'figma.png', description: 'My go-to space for turning ideas into interfaces, prototypes, and products — basically where most of the magic happens.' },
    { name: 'Shopify', art: 'shopify.png', description: 'Where I bring e-commerce ideas to life, creating storefronts that look good, feel simple, and make shopping easier.' },
    { name: 'Canva', art: 'canva.png', description: 'My quick go-to tool for visual details. I keep it useful, creative, and easy to reach when ideas need a fast, polished finish.' },
    { name: 'Pinterest', art: 'pinterest.png', description: 'My endless source of inspiration, moodboards, and visual references that keep creativity moving.' },
    { name: 'Awwwards', art: 'awwwards.png', description: 'Where I go to explore bold websites, fresh ideas, and the kind of design that pushes boundaries.' },
    { name: 'CorelDRAW', art: 'coreldraw.png', description: 'Where I get hands-on with graphics, layouts, and visual ideas — especially when precision really matters.' },
  ]
  // Visual Experiments artwork. Every entry points at a finished export in
  // /public/experiments, all re-encoded to the card's own 1 : .95 ratio at 780x741 — the
  // slideshow masters behind them run to 60MB of PNG, and the marquee never paints one wider
  // than ~360px. `experimentArt` is that one shared export size, so every card declares the
  // same intrinsic ratio and the row reserves its height before a single image decodes.
  // The slide-NN exports are cut from the carousel_NN masters in /public/slideshows, so any
  // of them can be traced back to the file it came from; the three latest cards are named
  // after the work instead, since a carousel number says nothing about what is on it.
  const experimentArt = { width: 780, height: 741 }
  const experiments = [
    { name: 'The Gen Z Mindset', kicker: 'Poster series', art: 'experiments/genz-mindset.jpg' },
    { name: 'Clankoo', kicker: 'Brand visual', art: 'experiments/clankoo.jpg' },
    { name: 'NexBank', kicker: 'Product concept', art: 'experiments/nexbank.jpg' },
    { name: 'Design Tools', kicker: 'Landing page', art: 'experiments/slide-01.jpg' },
    { name: 'BitWise', kicker: 'Out-of-home', art: 'experiments/slide-02.jpg' },
    { name: 'BitWise', kicker: 'Billboards', art: 'experiments/slide-03.jpg' },
    { name: 'BOB.', kicker: 'E-commerce', art: 'experiments/slide-04.jpg' },
    { name: 'Messages', kicker: 'Mobile UI', art: 'experiments/slide-05.jpg' },
    { name: 'Onboarding', kicker: 'Product UI', art: 'experiments/slide-06.jpg' },
    { name: 'Order Tracking', kicker: 'Mobile UI', art: 'experiments/slide-07.jpg' },
    { name: 'Sign In', kicker: 'Web flow', art: 'experiments/slide-08.jpg' },
    { name: 'Peak', kicker: 'Ad campaign', art: 'experiments/slide-09.jpg' },
    { name: 'Maltina', kicker: 'Ad campaign', art: 'experiments/slide-10.jpg' },
    { name: 'Loading State', kicker: 'Interface detail', art: 'experiments/slide-11.jpg' },
    { name: 'Search Field', kicker: 'Micro-interaction', art: 'experiments/slide-12.jpg' },
    { name: 'FoodHow', kicker: 'Mobile app', art: 'experiments/slide-13.jpg' },
    { name: 'Zoe', kicker: 'Sign-up flow', art: 'experiments/slide-14.jpg' },
    { name: 'Notifications', kicker: 'Empty state', art: 'experiments/slide-15.jpg' },
    { name: 'BOPPI', kicker: 'Brand identity', art: 'experiments/boppi.jpg' },
    { name: 'BitWise', kicker: 'Logo & identity', art: 'experiments/bitwise-mark.jpg' },
    { name: 'YVF', kicker: 'Food brand', art: 'experiments/yvf.jpg' },
  ]
  // The marquee renders the set twice and slides the track by exactly one pass, so the loop
  // has no seam and no reset frame. Flattened here rather than with a nested map in the JSX
  // so every card is a sibling in one keyed list. The second pass is marked decorative: it is
  // the same art, so the accessibility tree only ever carries one copy of each card.
  const marqueeCards = [0, 1].flatMap((pass) => experiments.map((item) => ({ pass, item })))
  // Closing call to action. The `tone` doubles as the CSS hook that gives each icon its
  // own hover colour (.phone/.mail/.instagram/.whatsapp/.x) and the glyphs are inline SVG
  // because the project ships no image assets. Placeholder handles — swap the hrefs for
  // the real number, inbox and profiles.
  const contactLinks = [
    {
      label: 'Call Omole Israel',
      tone: 'phone',
      href: 'tel:+2349022153545',
      icon: <svg className="collaborate-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>,
    },
    {
      label: 'Email Omole Israel',
      tone: 'mail',
      href: 'mailto:israelomole2@gmail.com',
      icon: <svg className="collaborate-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="2.2" y="4.5" width="19.6" height="15" rx="2.4" /><path d="m3.4 7.2 8.6 5.4 8.6-5.4" /></svg>,
    },
    {
      label: 'Instagram profile',
      tone: 'instagram',
      href: 'https://www.instagram.com/izzy__ba_ba?xtok=c2FjZHNxOGFoMWl2&utm_source=qr',
      external: true,
      icon: <svg className="collaborate-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.2" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" /></svg>,
    },
    {
      label: 'WhatsApp chat',
      tone: 'whatsapp',
      href: 'https://wa.me/qr/Y7WYDDNFIDPYI1',
      external: true,
      icon: <svg className="collaborate-glyph" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z" /><path d="M11.609 9.587c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.397-.328-.343-.45-.349-.114-.006-.25-.006-.38-.006a.729.729 0 0 0-.53.25c-.181.198-.697.681-.697 1.658 0 .977.712 1.92.811 2.052.099.132 1.398 2.14 3.386 3.001.474.206.842.329 1.13.42.478.152.913.13 1.256.079.383-.057 1.18-.482 1.346-.947.166-.465.166-.864.116-.947-.05-.083-.182-.133-.38-.232z" /></svg>,
    },
    {
      label: 'X profile',
      tone: 'x',
      href: 'https://x.com/dgodowndesgner?s=11',
      external: true,
      icon: <svg className="collaborate-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>,
    },
  ]

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setRoleLeaving(true), 2600)
    const nextRoleTimer = window.setTimeout(() => {
      setRoleIndex((current) => (current + 1) % roles.length)
      setRoleLeaving(false)
    }, 3000)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(nextRoleTimer)
    }
  }, [roleIndex, roles.length])

  // Pinned horizontal scroll: while the tools section is stuck (desktop only), vertical
  // scroll is translated into horizontal carousel travel. The section's scroll runway is
  // exactly (sectionHeight - viewportHeight), which is also the distance the sticky element
  // stays pinned, so the carousel reaches its end at the same moment it unsticks and the
  // page resumes normal vertical scrolling.
  useEffect(() => {
    const section = toolsTrackRef.current
    const track = section?.querySelector('.tools-track')
    if (!track) return undefined

    // Mirrors the `max-width: 800px` breakpoint where the section goes static.
    const pinned = window.matchMedia('(min-width: 801px)')

    const syncCarouselToScroll = () => {
      if (!pinned.matches) return
      const bounds = section.getBoundingClientRect()
      const scrollDistance = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = Math.min(1, Math.max(0, -bounds.top / scrollDistance))
      track.scrollLeft = (track.scrollWidth - track.clientWidth) * progress
    }

    // Throttle to one read/write per frame to keep the pin smooth.
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncCarouselToScroll()
      })
    }

    // Leaving desktop hands the carousel back to its native touch/trackpad scrolling.
    const onBreakpointChange = () => {
      if (pinned.matches) syncCarouselToScroll()
      else track.scrollLeft = 0
    }

    syncCarouselToScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    pinned.addEventListener('change', onBreakpointChange)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      pinned.removeEventListener('change', onBreakpointChange)
    }
  }, [])

  // Polish: a thin scroll-progress bar, and a one-shot fade-up as each block first enters the viewport.
  // Reveal only arms when motion is allowed, so reduced-motion visitors just see the page.
  useEffect(() => {
    const bar = document.querySelector('.scroll-progress')
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    let observer
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const targets = document.querySelectorAll('.intro-side, .intro-panel, .made > *, .experiments-head, .collaborate-head')
      document.documentElement.classList.add('reveal-on')
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target) }
      }), { threshold: 0.12 })
      targets.forEach((el) => { el.classList.add('reveal'); observer.observe(el) })
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      observer?.disconnect()
    }
  }, [])

  // Hold the page at the top and still while the opening sequence plays.
  useEffect(() => {
    if (!intro) return undefined
    window.scrollTo(0, 0)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [intro])

  // The case study is a full-screen layer: lock the page behind it and let Escape close it.
  useEffect(() => {
    if (!projectOpen) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setProjectOpen(false) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [projectOpen])

  return (
    <>
    {intro && <IntroScreen onDone={finishIntro} />}
    <div className={`page${intro ? ' is-intro' : ''}`}>
      <div className="scroll-progress" aria-hidden="true" />
      <div className="aurora aurora-one" /><div className="aurora aurora-two" /><div className="grain" />
      <nav className="nav glass">
        <a className="identity" href="#top" aria-label="Go to home"><img className="avatar" src={publicArt('profile-photo.png')} width="28" height="28" alt="" decoding="async" /><span>Omole Israel<span className="identity-dot">.</span></span></a>
        <div className="nav-links"><a href="#work">Design</a><a href="#about">About</a><a className="cv-link" href={cvUrl} target="_blank" rel="noopener noreferrer">Download CV</a></div>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-menu">Menu <i /></button>
      </nav>
      <div id="mobile-menu" className={`mobile-menu glass ${menuOpen ? 'open' : ''}`}><a onClick={() => setMenuOpen(false)} href="#work">Work</a><a onClick={() => setMenuOpen(false)} href="#about">About</a><a onClick={() => setMenuOpen(false)} href="#contact">Contact</a><a onClick={() => setMenuOpen(false)} href={cvUrl} target="_blank" rel="noopener noreferrer">Download CV</a></div>

      <main id="top">
        <section className="hero section">
          {/* The role is split at its first space so the first word can hold one colour and the rest
              the accent. That split used to drop the space itself — the words then sat on each other
              ("BrandDesigner"), and the h1's accessible name lost the gap too. `{' '}` between the two
              runs is a real space character, so the headline reads as two words however it is styled. */}
          <h1 className={`role-title ${roleLeaving ? 'is-leaving' : ''}`} aria-live="polite"><span className="role-prefix">{roles[roleIndex].split(' ')[0]}</span>{' '}<span className="typewriter" key={roles[roleIndex]}>{roles[roleIndex].substring(roles[roleIndex].indexOf(' ') + 1)}</span></h1>
          <div className="hero-bottom"><p>Nigerian based product designer who loves beautiful things and blends creativity, technology, and a little vibe-coding into every build.</p><a className="circle-link" href="#work" aria-label="Scroll to selected work">↓</a></div>
          <div className="scroll-indicator" aria-hidden="true"><p className="scroll-cue">Scroll</p><span className="scroll-line"><i /></span></div>
        </section>

        <div className="marquee" aria-label="Services: Creative Design, Web Design, Design System, Graphics Design, Vibe Coding"><div>Creative Design <span>✦</span> Web Design <span>✦</span> Design System <span>✦</span> Graphics Design <span>✦</span> Vibe Coding <span>✦</span>&nbsp;</div><div>Creative Design <span>✦</span> Web Design <span>✦</span> Design System <span>✦</span> Graphics Design <span>✦</span> Vibe Coding <span>✦</span>&nbsp;</div></div>

        <section id="about" className="intro section">
          <div className="intro-side"><h2>Intro</h2><div className="audience-tabs">{Object.keys(audienceCopy).map((item) => <button className={audience === item ? 'active' : ''} key={item} onClick={() => setAudience(item)}>{item}</button>)}</div></div>
          <div className="intro-panel glass" onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--cursor-x', `${event.clientX - bounds.left}px`); event.currentTarget.style.setProperty('--cursor-y', `${event.clientY - bounds.top}px`) }}><p className="intro-copy-base" key={audience}>{audienceCopy[audience]}</p><p className="intro-copy-light" aria-hidden="true">{audienceCopy[audience]}</p></div>
        </section>

        <section className="made section"><p className="made-since"><i /> Since 2022</p><h2>Things I’ve Made</h2><p className="made-lede">I blend technology, creativity, and a little curiosity to turn ideas into products and experiences people can connect with.</p><div className={`made-stage ${made[madeIndex].color}`} data-cursor="view" onClick={() => (made[madeIndex].url ? window.open(made[madeIndex].url, '_blank', 'noopener,noreferrer') : setProjectOpen(true))}>
          <button className="stage-arrow previous" onClick={(event) => { event.stopPropagation(); setMadeIndex((madeIndex + made.length - 1) % made.length) }} aria-label="Previous project"><img src={publicArt("svg's/nexxt.svg")} width="11" height="19" alt="" /></button>
          {made[madeIndex].shots
            ? <div className="stage-art stage-shots">{made[madeIndex].shots.map((shot, index) => <div key={shot.src} className={`shot ${index === 1 ? 'is-main' : 'is-side'}`}><img src={shot.src} width={shot.width} height={shot.height} alt={`${made[madeIndex].title} screen ${index + 1}`} loading="lazy" decoding="async" /></div>)}</div>
            : made[madeIndex].phones
            ?<div className="stage-art stage-phones">{made[madeIndex].phones.map((phone, index) => <img key={phone.src} className={index === 1 ? 'is-main' : 'is-side'} src={phone.src} width={phone.width} height={phone.height} alt={`${made[madeIndex].title} screen ${index + 1}`} loading="lazy" decoding="async" />)}</div>
            : made[madeIndex].art
            ?<div className="stage-art"><img src={made[madeIndex].art.src} width={made[madeIndex].art.width} height={made[madeIndex].art.height} alt={`${made[madeIndex].title} screens`} loading="lazy" decoding="async" /></div>
            : <>
              <div className="phone phone-left"><div className="phone-notch" /><div className="phone-screen side-screen"><span /><span /><span /></div></div>
              <div className="phone phone-main"><div className="phone-notch" /><div className="phone-screen main-screen"><p>10:41</p><div className="profile-dot" /><b>{made[madeIndex].title}</b><div className="screen-photo" /><span>Make work that matters.</span></div></div>
              <div className="phone phone-right"><div className="phone-notch" /><div className="phone-screen side-screen"><b>Projects</b><span /><span /><span /></div></div>
            </>}
          <div className="made-caption"><h3>{made[madeIndex].title}</h3><p>{made[madeIndex].description}</p></div>
          <button className="stage-arrow next" onClick={(event) => { event.stopPropagation(); setMadeIndex((madeIndex + 1) % made.length) }} aria-label="Next project"><img src={publicArt("svg's/right-next.svg")} width="11" height="19" alt="" /></button>
        </div><div className="made-tabs">{made.map((project, index) => <button key={project.title} className={madeIndex === index ? 'active' : ''} onClick={() => setMadeIndex(index)}>{project.title}</button>)}</div></section>

        {projectOpen && (() => {
          const project = made[madeIndex]
          const { study } = project
          const go = (step) => { setMadeIndex((madeIndex + step + made.length) % made.length); caseRef.current?.scrollTo({ top: 0 }) }
          const nextProject = made[(madeIndex + 1) % made.length]
          return (
            <div className="case" role="dialog" aria-modal="true" aria-label={`${project.title} case study`} ref={caseRef}>
              <header className="case-bar"><button className="case-close" onClick={() => setProjectOpen(false)}>← Back</button><span className="case-bar-title">{project.title}</span><div className="case-bar-nav"><button onClick={() => go(-1)} aria-label="Previous project">←</button><button onClick={() => go(1)} aria-label="Next project">→</button></div></header>
              <article className="case-body">
                <div className="case-head"><p className="case-kicker"><i /> Case study</p><h2>{project.title}</h2></div>
                <div className={`case-cover ${project.color}`}>{project.art ? <img src={project.art.src} width={project.art.width} height={project.art.height} alt={`${project.title} cover`} decoding="async" /> : <span>Cover coming soon</span>}</div>
                <dl className="case-meta"><div><dt>Role</dt><dd>{study.role}</dd></div><div><dt>Type</dt><dd>{study.type}</dd></div><div><dt>Year</dt><dd>{study.year}</dd></div><div><dt>Tools</dt><dd>{study.tools.join(', ')}</dd></div></dl>
                <section className="case-overview"><h3>Overview</h3><p>{study.overview}</p></section>
                <div className="case-frames">
                  {study.frames.map((item, index) => (
                    <figure className={`case-frame is-${item.layout}`} key={item.title}>
                      <figcaption><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.text}</p></figcaption>
                      <div className={`case-shot ${item.art ? '' : 'is-empty'}`}>{item.art ? <img src={item.art.src} width={item.art.width} height={item.art.height} alt={`${project.title}: ${item.title}`} loading="lazy" decoding="async" /> : <em>Screen coming soon</em>}</div>
                    </figure>
                  ))}
                </div>
              </article>
              <button className="case-next" onClick={() => go(1)}><span>Next project</span><strong>{nextProject.title} →</strong></button>
            </div>
          )
        })()}

        <section className="tools-section" ref={toolsTrackRef}><div className="tools-sticky"><div className="tools-intro"><p className="made-since"><i /> Since 2022</p><h2>My Tools</h2><p>The tools I use to turn ideas into clean interfaces, bold visuals, and experiences that feel as good as they look.</p><span>Scroll →</span></div><div className="tools-track" data-cursor-hover>
          {toolCards.map((tool) => <article className="tool-card" key={tool.name}><div className="tool-visual"><img src={publicArt(tool.art)} width="952" height="678" alt={`${tool.name} brand artwork`} loading="lazy" decoding="async" /></div><h3>{tool.name}</h3><p>{tool.description}</p></article>)}
        </div></div></section>

        <section className="experiments" aria-labelledby="experiments-title">
          <div className="experiments-head section">
            <h2 id="experiments-title">Visual Experiments</h2>
            <p>A mix of creative experiments, visual stories, and designs made just because I could.</p>
            <a className="experiments-view-all" href="https://www.behance.net/omoleisrael" target="_blank" rel="noopener noreferrer">View All<span aria-hidden="true">→</span></a>
          </div>
          {/* The row runs full-bleed and never stops, driven entirely by the CSS keyframe on
              .experiments-track — there is no timer, no index and no re-render behind it. The
              cards are static images rather than buttons: nothing in a continuously moving
              row can be clicked reliably, and the "View All" control above carries the action
              instead. */}
          <div className="experiments-viewport">
            <div className="experiments-track">
              {marqueeCards.map(({ pass, item }) => <div className="experiment-card" key={`${pass}-${item.art}`} aria-hidden={pass === 1 || undefined}><span className="experiment-art"><img src={publicArt(item.art)} width={experimentArt.width} height={experimentArt.height} alt={`${item.name} — ${item.kicker}`} loading="lazy" decoding="async" /></span></div>)}
            </div>
          </div>
        </section>

        <section id="contact" className="collaborate" aria-labelledby="collaborate-title">
          <div className="collaborate-head section">
            <h2 id="collaborate-title" className="collaborate-title"><em>Let’s</em><span>Collaborate!</span></h2>
            <div className="collaborate-actions">
              {contactLinks.map((link) => <a
                key={link.tone}
                className={`collaborate-icon ${link.tone}`}
                href={link.href}
                aria-label={link.label}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer' : undefined}
              >{link.icon}</a>)}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><span>© 2026 Omole Israel</span><span className="footer-dot" aria-hidden="true" /><span>Product &amp; Graphic Designer</span><a href="#top" className="footer-top">Back to top ↑</a></footer>

      {/* Closing band: the ribbons sign the page off, flush with the bottom edge. Purely
          decorative, so it stays out of the accessibility tree — and lazy + async, since
          the base of the page is the last thing anyone scrolls to. */}
      <div className="base-band" aria-hidden="true">
        <img className="base-band-art" src={bandArt} alt="" width="2880" height="960" loading="lazy" decoding="async" fetchPriority="low" />
      </div>

      <CustomCursor />
    </div>
    </>
  )
}

export default App
