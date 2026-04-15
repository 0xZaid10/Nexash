import { Navbar }         from '@/components/landing/Navbar'
import { Hero }           from '@/components/landing/Hero'
import { ProblemSection } from '@/components/landing/ProblemSection'
import { Footer }         from '@/components/landing/Footer'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <ProblemSection />
      <Footer />
    </main>
  )
}
