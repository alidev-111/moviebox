import './globals.css';
import Link from 'next/link';
import { Film, Shield, PlayCircle } from 'lucide-react';

export const metadata = {
  title: 'WatchBox - Stream HD Movies',
  description: 'Stream HD movies with multi-language subtitle tracks. Fast playback and instant link recovery.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <header className="navbar">
          <div className="nav-container">
            <Link href="/" className="logo-group" id="nav-logo">
              <div className="logo-icon">
                <Film size={22} />
              </div>
              <div>
                <span className="logo-text">WatchBox</span>
              </div>
            </Link>

            {/* <nav className="nav-links">
              <Link href="/" className="nav-btn nav-btn-ghost" id="nav-home">
                <PlayCircle size={17} />
                <span>Browse</span>
              </Link>
            </nav> */}
          </div>
        </header>

        <main>{children}</main>

        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          marginTop: '60px',
          background: 'rgba(7, 9, 14, 0.95)'
        }}>
          {/* <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>
              <Film size={18} color="#6366f1" /> WatchBox
            </div>
            <p>
              Free HD movie streaming with synchronised multi-language subtitles.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#475569' }}>
              &copy; {new Date().getFullYear()} WatchBox. All rights reserved.
            </p>
          </div> */}
        </footer>
      </body>
    </html>
  );
}
