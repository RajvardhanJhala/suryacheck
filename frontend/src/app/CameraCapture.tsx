import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/icons'
import { Button } from '../ui/primitives'

/** Live viewfinder (rear camera) with a framing guide; falls back to the file picker when the
 *  browser has no camera or permission is refused. Returns one JPEG per capture. */
export default function CameraCapture({ onCapture, busy }: { onCapture: (f: File) => void; busy?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [denied, setDenied] = useState('')

  const start = async () => {
    setDenied('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      setStream(s)
    } catch {
      setDenied('Camera not available or permission refused — choose a photo instead.')
    }
  }

  useEffect(() => { if (video.current && stream) video.current.srcObject = stream }, [stream])
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob((b) => b && onCapture(new File([b], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  return (
    <div className="camera">
      {stream ? (
        <div className="viewfinder">
          <video ref={video} autoPlay playsInline muted aria-label="Camera preview" />
          <span className="frame" aria-hidden="true" />
          <p className="vf-hint">Fill the frame with the panels, the inverter screen, or the meter</p>
        </div>
      ) : (
        <div className="viewfinder is-off">
          <Icon name="camera" size={40} />
          <p>Point your camera at a <b>panel</b>, the <b>inverter</b> or the <b>meter</b>. SuryaCheck works out which it is.</p>
        </div>
      )}
      {denied && <p className="field-error" role="alert">{denied}</p>}
      <div className="row">
        {stream
          ? <Button icon="camera" onClick={snap} disabled={busy}>{busy ? 'Checking…' : 'Capture'}</Button>
          : <Button icon="camera" onClick={start}>Open live camera</Button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])} />
        <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy}>Upload a photo</Button>
      </div>
    </div>
  )
}
