'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, Edit, X, Save, Ban, Shield, AlertTriangle } from 'lucide-react'
import { showToast } from '@/lib/utils/toast'

interface BlacklistEntry {
  id: string
  channel_id?: string
  channel_url?: string
  channel_handle?: string
  channel_name: string
  reason?: string
  notes?: string
  created_at: string
  updated_at: string
}

interface ChannelBlacklistManagerProps {
  isOpen: boolean
  onClose: () => void
  onBlacklistUpdate?: () => void
}

export const ChannelBlacklistManager: React.FC<ChannelBlacklistManagerProps> = ({
  isOpen,
  onClose,
  onBlacklistUpdate
}) => {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newEntry, setNewEntry] = useState({
    input: '',
    reason: '',
    notes: ''
  })

  // Load blacklist when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBlacklist()
    }
  }, [isOpen])

  const loadBlacklist = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/channel-blacklist')
      const result = await response.json()

      if (result.success) {
        setBlacklist(result.data || [])
      } else {
        showToast.error('Failed to load channel blacklist: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading blacklist:', error)
      showToast.error('Error loading blacklist: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddChannel = async () => {
    if (!newEntry.input.trim()) {
      showToast.error('Please enter channel information')
      return
    }

    try {
      const response = await fetch('/api/channel-blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: newEntry.input.trim(),
          reason: newEntry.reason.trim() || undefined,
          notes: newEntry.notes.trim() || undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast.success('Channel added to blacklist successfully!')
        setNewEntry({ input: '', reason: '', notes: '' })
        setIsAdding(false)
        loadBlacklist()
        onBlacklistUpdate?.()
      } else {
        showToast.error('Failed to add channel: ' + result.error)
      }
    } catch (error) {
      console.error('Error adding channel:', error)
      showToast.error('Error adding channel: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleUpdateChannel = async (entry: BlacklistEntry) => {
    try {
      const response = await fetch('/api/channel-blacklist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: entry.id,
          channel_name: entry.channel_name,
          reason: entry.reason || undefined,
          notes: entry.notes || undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        showToast.success('Channel updated successfully!')
        setEditingEntry(null)
        loadBlacklist()
        onBlacklistUpdate?.()
      } else {
        showToast.error('Failed to update channel: ' + result.error)
      }
    } catch (error) {
      console.error('Error updating channel:', error)
      showToast.error('Error updating channel: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Are you sure you want to remove this channel from the blacklist?')) {
      return
    }

    try {
      const response = await fetch(`/api/channel-blacklist?id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        showToast.success('Channel removed from blacklist!')
        loadBlacklist()
        onBlacklistUpdate?.()
      } else {
        showToast.error('Failed to remove channel: ' + result.error)
      }
    } catch (error) {
      console.error('Error deleting channel:', error)
      showToast.error('Error removing channel: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const getChannelDisplayInfo = (entry: BlacklistEntry) => {
    const identifiers = []
    
    if (entry.channel_handle) {
      identifiers.push(`Handle: ${entry.channel_handle}`)
    }
    if (entry.channel_id) {
      identifiers.push(`ID: ${entry.channel_id}`)
    }
    if (entry.channel_url) {
      identifiers.push(`URL: ${entry.channel_url}`)
    }
    
    return identifiers.join(' • ')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900">Channel Blacklist Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">How Channel Blacklist Works</h3>
                  <p className="text-blue-800 text-sm">
                    Videos from blacklisted channels will be automatically filtered out from your YouTube search results. 
                    You can add channels by URL, handle (@username), channel ID, or channel name.
                  </p>
                </div>
              </div>
            </div>

            {/* Add New Channel */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Add Channel to Blacklist</h3>
                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {isAdding ? 'Cancel' : 'Add Channel'}
                </button>
              </div>

              {isAdding && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Channel Information
                    </label>
                    <input
                      type="text"
                      value={newEntry.input}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, input: e.target.value }))}
                      placeholder="Channel URL, @handle, channel ID, or channel name..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Examples: https://youtube.com/@channel, @channelname, UC1234567890, or "Channel Name"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason (Optional)
                      </label>
                      <input
                        type="text"
                        value={newEntry.reason}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Why blacklist this channel?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={newEntry.notes}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setNewEntry({ input: '', reason: '', notes: '' })
                      }}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddChannel}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Add to Blacklist
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Blacklist Entries */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">
                Blacklisted Channels ({blacklist.length})
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <span className="ml-3 text-gray-600">Loading blacklist...</span>
                </div>
              ) : blacklist.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Ban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">No Blacklisted Channels</h4>
                  <p className="text-gray-500">Add channels to filter them out from your search results.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blacklist.map((entry) => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      {editingEntry?.id === entry.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Channel Name
                            </label>
                            <input
                              type="text"
                              value={editingEntry.channel_name}
                              onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, channel_name: e.target.value }) : null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason
                              </label>
                              <input
                                type="text"
                                value={editingEntry.reason || ''}
                                onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, reason: e.target.value }) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes
                              </label>
                              <input
                                type="text"
                                value={editingEntry.notes || ''}
                                onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingEntry(null)}
                              className="text-gray-600 hover:text-gray-800 p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateChannel(editingEntry)}
                              className="text-green-600 hover:text-green-800 p-1"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">{entry.channel_name}</h4>
                            <div className="text-sm text-gray-600 mb-2">
                              {getChannelDisplayInfo(entry)}
                            </div>
                            {entry.reason && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Reason:</span> {entry.reason}
                              </div>
                            )}
                            {entry.notes && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Notes:</span> {entry.notes}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              Added: {new Date(entry.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => setEditingEntry(entry)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteChannel(entry.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 