import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/primitives'

/** Live viewfinder (rear camera) with a framing guide. Without a camera, or if permission is
 *  refused, the button opens the phone's own camera (capture="environment") or the file picker. */
export default function CameraCapture({ onCapture, busy, hint, done }: {
  onCapture: (f: File) => void; busy?: boolean; hint: string; done?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [denied, setDenied] = useState(false)

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setDenied(true); fileRef.current?.click(); return }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false }))
    } catch {
      setDenied(true); fileRef.current?.click()
    }
  }

  useEffect(() => { if (video.current && stream) video.current.srcObject = stream }, [stream])
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])
  useEffect(() => { if (done) stream?.getTracks().forEach((t) => t.stop()) }, [done, stream])
  const live = done ? null : stream

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob((b) => b && onCapture(new File([b], `panel-${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  return (
    <div className="camera">
      {live && (
        <div className="viewfinder">
          <video ref={video} autoPlay playsInline muted aria-label="Camera preview" />
          <span className="frame" aria-hidden="true" />
          <p className="vf-hint">{hint}</p>
        </div>
      )}
      {denied && <p className="field-hint">Live camera unavailable, so your phone's camera or a photo will be used.</p>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); e.target.value = '' }} />
      {!done && (live
        ? <Button icon="camera" onClick={snap} disabled={busy}>{busy ? 'Checking…' : 'Take photo'}</Button>
        : <Button variant="secondary" icon="camera" onClick={start} disabled={busy}>Open camera</Button>)}
    </div>
  )
}
