import { useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import type L from 'leaflet'
import { supabase } from '../lib/supabase'
import type { Pin } from '../types'

interface PinFormProps {
  latlng: L.LatLng
  userId: string
  onClose: () => void
  onSaved: (pin: Pin) => void
}

export default function PinForm({ latlng, userId, onClose, onSaved }: PinFormProps) {
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('No active session. Please sign in again.')
      setLoading(false)
      return
    }
    const uid = session.user.id

    let photo_url: string | null = null

    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, photo, { contentType: photo.type })

      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
      photo_url = urlData.publicUrl
    }

    const { data, error: insertError } = await supabase
      .from('pins')
      .insert({ user_id: uid, lat: latlng.lat, lng: latlng.lng, title, comment, photo_url })
      .select()
      .single()

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      onSaved(data as Pin)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setPhoto(e.target.files?.[0] ?? null)
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-[#0f0f13] border border-[#1e1e2a] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1e1e2a]">
          <h2 className="text-white text-xs font-medium tracking-widest uppercase">
            Drop Pin
          </h2>
          <span className="font-mono text-[10px] text-[#4b5563]">
            {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <input
            type="text"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full bg-[#1a1a22] border border-[#2a2a3a] text-white text-sm placeholder-[#374151] rounded px-3 py-2 outline-none focus:border-[#7c3aed] transition-colors"
          />

          <textarea
            placeholder="Notes..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full bg-[#1a1a22] border border-[#2a2a3a] text-white text-sm placeholder-[#374151] rounded px-3 py-2 outline-none focus:border-[#7c3aed] transition-colors resize-none"
          />

          <div>
            <p className="text-[#4b5563] text-[10px] uppercase tracking-widest mb-1.5">
              Photo
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-xs text-[#6b7280] cursor-pointer
                file:mr-2 file:py-1 file:px-2 file:rounded file:border-0
                file:bg-[#2a2a3a] file:text-[#a78bfa] file:text-xs file:cursor-pointer
                hover:file:bg-[#3a2a4a] file:transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs text-[#6b7280] border border-[#2a2a3a] rounded hover:border-[#4b5563] hover:text-[#9ca3af] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2 text-xs font-medium text-white bg-[#7c3aed] rounded hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving…' : 'Save Pin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
