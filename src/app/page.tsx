import Link from 'next/link'
import Image from 'next/image'
import DrönarkompanietLogo from '@/components/DrönarkompanietLogo'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Clean Hero Section */}
      <header className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white overflow-hidden">
        {/* Subtle gradient overlays */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-br from-yellow-600/15 to-yellow-500/15 rounded-full blur-lg animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-gradient-to-br from-yellow-500/8 to-yellow-600/8 rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>
        
        {/* Navigation with Logo */}
        <nav className="relative z-20 container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between backdrop-blur-sm bg-white/5 rounded-xl px-4 sm:px-8 py-3 sm:py-4 border border-white/10">
            <div className="flex items-center">
              <DrönarkompanietLogo size="md" className="filter brightness-110" />
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/login" className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black px-3 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-300 font-semibold text-sm sm:text-base">
                Logga in
              </Link>
              <Link href="/admin" className="text-white/70 hover:text-white transition-colors text-xs sm:text-sm font-medium px-2 sm:px-4 py-2 rounded-lg hover:bg-white/5">
                Admin
              </Link>
            </div>
          </div>
        </nav>
        
        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          {/* Main Headline */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-slate-100 to-yellow-400 bg-clip-text text-transparent leading-tight">
              Välkommen till
              <span className="block">Drönarkompaniets</span>
              <span className="block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                leveransportal
              </span>
            </h1>
          </div>
          
          {/* Description */}
          <div className="max-w-3xl mx-auto mb-8 sm:mb-12">
            <p className="text-base sm:text-lg lg:text-xl leading-relaxed text-slate-200 bg-black/20 rounded-xl p-4 sm:p-6 lg:p-8 border border-yellow-500/20">
              <span className="text-yellow-400 font-semibold">
                Logga in för att ladda ner dina beställda drönarbilder och videor.
              </span>
              <br />
              Allt material från ditt uppdrag finns tillgängligt här i högsta kvalitet med professionell förhandsvisning, 
              betygsättning och organisering.
            </p>
          </div>
          
          {/* Call-to-Action Button */}
          <div className="mb-12 sm:mb-16">
            <Link href="/login" 
                  className="inline-flex items-center bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black px-6 sm:px-10 py-4 sm:py-5 rounded-xl font-bold transition-all duration-300 text-base sm:text-lg">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-2 0V4H5v12h10v-2a1 1 0 112 0v3a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" clipRule="evenodd"/>
                <path fillRule="evenodd" d="M6 10a1 1 0 011-1h6l-2-2a1 1 0 112-2l4 4a1 1 0 010 2l-4 4a1 1 0 11-2-2l2-2H7a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
              <span className="hidden sm:inline">Logga in för att komma åt ditt material</span>
              <span className="sm:hidden">Logga in</span>
            </Link>
          </div>
        </div>
        
        {/* Bottom tech accent */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent"></div>
      </header>

      {/* Instructions Section */}
      <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        {/* Subtle tech background */}
        <div className="absolute inset-0 bg-tech-grid opacity-5"></div>
        <div className="absolute top-1/2 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-gradient-to-br from-yellow-100/30 to-yellow-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-40 sm:w-80 h-40 sm:h-80 bg-gradient-to-bl from-yellow-100/40 to-yellow-200/40 rounded-full blur-3xl"></div>
        
        <div className="relative container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-slate-800 via-yellow-800 to-slate-800 bg-clip-text text-transparent">
              Så hämtar du ditt material
            </h2>
            <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 lg:gap-12">
            <div className="text-center group relative">
              {/* Tech frame */}
              <div className="absolute -inset-4 bg-gradient-to-br from-yellow-100/50 to-yellow-200/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"></div>
              
              <div className="relative backdrop-blur-sm bg-white/60 p-6 sm:p-8 rounded-2xl border border-white/40 shadow-glass hover:shadow-tech transition-all duration-300 group-hover:-translate-y-2">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-glow-sm group-hover:shadow-glow-md transition-all duration-300 relative overflow-hidden">
                  <svg className="w-8 sm:w-10 h-8 sm:h-10 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2H7v-2H4a1 1 0 01-1-1v-4c0-5.523 4.477-10 10-10s10 4.477 10 10a4 4 0 01-4 4z" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer bg-[length:200%_100%]"></div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-slate-700 to-yellow-700 bg-clip-text text-transparent">1. Logga in</h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Använd de inloggningsuppgifter vi skickat till dig via e-post efter att ditt uppdrag slutförts.
                </p>
                
                {/* Tech accent */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>

            <div className="text-center group relative">
              {/* Tech frame */}
              <div className="absolute -inset-4 bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"></div>
              
              <div className="relative backdrop-blur-sm bg-white/60 p-8 rounded-2xl border border-white/40 shadow-glass hover:shadow-tech transition-all duration-300 group-hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow-sm group-hover:shadow-glow-md transition-all duration-300 relative overflow-hidden">
                  <svg className="w-10 h-10 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer bg-[length:200%_100%]"></div>
                </div>
                <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-slate-700 to-emerald-700 bg-clip-text text-transparent">2. Bläddra i galleriet</h3>
                <p className="text-slate-600 leading-relaxed">
                  Se alla bilder och videor från ditt uppdrag i vårt lättanvända galleri med förhandsvisning.
                </p>
                
                {/* Tech accent */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>

            <div className="text-center group relative">
              {/* Tech frame */}
              <div className="absolute -inset-4 bg-gradient-to-br from-violet-100/50 to-purple-100/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"></div>
              
              <div className="relative backdrop-blur-sm bg-white/60 p-8 rounded-2xl border border-white/40 shadow-glass hover:shadow-tech transition-all duration-300 group-hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow-sm group-hover:shadow-glow-md transition-all duration-300 relative overflow-hidden">
                  <svg className="w-10 h-10 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer bg-[length:200%_100%]"></div>
                </div>
                <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-slate-700 to-violet-700 bg-clip-text text-transparent">3. Ladda ner</h3>
                <p className="text-slate-600 leading-relaxed">
                  Ladda ner enskilda filer eller allt material som en komprimerad fil i originalupplösning.
                </p>
                
                {/* Tech accent */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-violet-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support section */}
      <section className="py-12 sm:py-16 lg:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 sm:mb-16 lg:mb-20 text-slate-800">
            Behöver du hjälp?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-slate-50 to-white p-6 sm:p-8 lg:p-10 rounded-3xl shadow-xl border border-slate-200 group hover:shadow-2xl transition-all duration-300">
              <div className="w-12 sm:w-14 lg:w-16 h-12 sm:h-14 lg:h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 sm:w-7 lg:w-8 h-6 sm:h-7 lg:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-800">Glömt inloggningsuppgifter?</h3>
              <p className="text-slate-600 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                Kontakta oss så skickar vi nya inloggningsuppgifter till din e-post.
              </p>
              <a href="mailto:info@dronarkompaniet.se" className="inline-flex items-center text-yellow-600 hover:text-yellow-700 font-semibold text-base sm:text-lg transition-colors break-all sm:break-normal">
                info@dronarkompaniet.se
                <svg className="w-4 sm:w-5 h-4 sm:h-5 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            
            <div className="bg-gradient-to-br from-slate-50 to-white p-6 sm:p-8 lg:p-10 rounded-3xl shadow-xl border border-slate-200 group hover:shadow-2xl transition-all duration-300">
              <div className="w-12 sm:w-14 lg:w-16 h-12 sm:h-14 lg:h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 sm:w-7 lg:w-8 h-6 sm:h-7 lg:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-800">Teknisk support</h3>
              <p className="text-slate-600 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                Problem med nedladdning eller visning av material? Ring oss direkt.
              </p>
              <a href="tel:+46709607208" className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-semibold text-base sm:text-lg transition-colors">
                +46 709-607208
                <svg className="w-4 sm:w-5 h-4 sm:h-5 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <DrönarkompanietLogo size="lg" className="text-white mb-8 filter brightness-110" />
              <p className="text-slate-300 leading-relaxed text-lg">
                Professionell leveransportal för dina drönarbilder och filmmaterial från Drönarkompaniet. 
                Säker, snabb och pålitlig service.
              </p>
            </div>
            
            <div>
              <h4 className="text-2xl font-bold mb-8 text-yellow-400">Kontakt & Support</h4>
              <div className="space-y-4 text-slate-300">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:info@dronarkompaniet.se" className="hover:text-white transition-colors">
                    info@dronarkompaniet.se
                  </a>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href="tel:+46709607208" className="hover:text-white transition-colors">
                    +46 709-607208
                  </a>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Måndag-Fredag: 09:00-17:00</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-2xl font-bold mb-8 text-yellow-400">Information</h4>
              <div className="space-y-4 text-slate-300">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Material tillgängligt i 30 dagar</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Originalupplösning levereras</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Säker nedladdning</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-700 mt-12 pt-8 text-center">
            <p className="text-slate-400 text-lg">
              &copy; 2025 Drönarkompaniet Norden AB. Leveransportal för professionell drönarfotografering.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
