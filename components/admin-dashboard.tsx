'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Users, 
  Shield, 
  AlertCircle, 
  Crown,
  RefreshCw,
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  created_at: string
  is_admin: boolean
  last_sign_in_at: string | null
}

export function AdminDashboard() {
  const user = useAppSelector(state => state.user)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  useEffect(() => {
    if (user.isAdmin) {
      fetchUsers()
    }
  }, [user.isAdmin])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      showMessage('Error fetching users: ' + (error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleUserAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isAdmin: !currentStatus
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update admin status')
      }

      showMessage(`User admin status updated successfully`, 'success')
      fetchUsers() // Refresh the list
    } catch (error) {
      showMessage('Error updating admin status: ' + (error as Error).message, 'error')
    }
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don't have admin privileges to access this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-yellow-600" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">
            Manage users and system overview
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <Card className={`${
            messageType === 'success' ? 'bg-green-50 border-green-200' :
            messageType === 'error' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <CardContent className="pt-4">
              <p className={`text-sm ${
                messageType === 'success' ? 'text-green-700' :
                messageType === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Users Overview */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users Management
              <Button
                onClick={fetchUsers}
                size="sm"
                variant="outline"
                disabled={loading}
                className="ml-auto"
              >
                {loading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-8 text-gray-500">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No users found
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {users.filter(u => u.is_admin).length} Admins
                    </Badge>
                    <Badge variant="outline">
                      {users.length} Total Users
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-4">
                  {users.map((userProfile) => (
                    <div 
                      key={userProfile.id} 
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {userProfile.is_admin && (
                              <Crown className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="font-medium">{userProfile.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {userProfile.is_admin && (
                              <Badge variant="secondary" className="text-xs">
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {userProfile.id !== user.id && (
                            <Button
                              onClick={() => toggleUserAdminStatus(userProfile.id, userProfile.is_admin)}
                              size="sm"
                              variant={userProfile.is_admin ? "destructive" : "default"}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {userProfile.is_admin ? 'Remove Admin' : 'Make Admin'}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <div>
                          <strong>User ID:</strong> {userProfile.id}
                        </div>
                        <div>
                          <strong>Created:</strong> {new Date(userProfile.created_at).toLocaleDateString()}
                        </div>
                        {userProfile.last_sign_in_at && (
                          <div>
                            <strong>Last Sign In:</strong> {new Date(userProfile.last_sign_in_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 