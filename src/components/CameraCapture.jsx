import { useRef, useState } from 'react'
import './CameraCapture.css'

export default function CameraCapture({ onCapture, disabled }) {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(null)

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function handleRetake() {
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit() {
    if (preview) onCapture(preview)
  }

  return (
    <div className="camera-capture">
      {!preview ? (
        <div className="capture-prompt">
          <div className="capture-icon">📸</div>
          <p className="capture-instruction">
            Take a photo of your whiteboard calendar
          </p>
          <p className="capture-tip">
            Good lighting and a straight-on angle give the best results
          </p>
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Open Camera
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="capture-preview">
          <img src={preview} alt="Whiteboard preview" className="preview-image" />
          <div className="preview-actions">
            <button className="btn-secondary" onClick={handleRetake} disabled={disabled}>
              Retake
            </button>
            <button className="btn-primary" onClick={handleSubmit} disabled={disabled}>
              Parse Calendar →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
