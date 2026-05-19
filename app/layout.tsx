
import { Inter } from 'next/font/google'
import './globals.css'



const inter = Inter({ subsets: ['latin'] })

export const metadata = { title: 'Cleanora | KI-Reinigungs-Vermittlung', description: 'AI-powered cleaning company matching platform' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
  <html lang="de">
    <body className={inter.className}>
      {children}
    </body>
  </html>
)

  }

