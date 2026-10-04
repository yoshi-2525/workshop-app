import { Link, Outlet } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { ScrollToTop } from '@/components/layout/ScrollToTop'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-night">
      <ScrollToTop />
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-4 px-4 py-8 text-sm text-fg-muted">
          <p className="font-brand tracking-widest">違和感を、ひとりで抱えないために。</p>
          <Link to="/help" className="hover:text-fg-secondary">
            ヘルプ・規約
          </Link>
        </div>
      </footer>
    </div>
  )
}
