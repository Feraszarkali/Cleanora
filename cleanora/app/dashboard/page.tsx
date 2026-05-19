'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
        } else {
          setUser(user)
          setLoading(false)
        }
      } catch {
        window.location.href = '/login'
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
          <h1 className="text-xl font-semibold text-gray-900">Cleanora Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{user?.email}</span>
          <button onClick={() => { supabase.auth.signOut().then(() => window.location.href = '/login') }} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Logout</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-500 mt-1">Manage your cleaning requests, employees, and analytics from here.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Overview</Link>
          <Link href="/company" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Company Portal</Link>
          <Link href="/admin" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Admin</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <p className="text-sm font-medium text-gray-500 mb-2">Active Employees</p>
            <p className="text-2xl font-bold text-gray-900">1,248</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <p className="text-sm font-medium text-gray-500 mb-2">Open Requests</p>
            <p className="text-2xl font-bold text-gray-900">384</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <p className="text-sm font-medium text-gray-500 mb-2">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">€48,290</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <p className="text-sm font-medium text-gray-500 mb-2">AI Responses</p>
            <p className="text-2xl font-bold text-gray-900">89%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono text-gray-500">REQ-00{i}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">Customer {i}</td>
                    <td className="px-6 py-4 text-gray-600">Office Cleaning</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Completed</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">€{140 + i * 20}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}