"use client"

import { useState, useRef, useEffect } from "react"
import { Home, Search, Camera, Heart, Send, Mic, Paperclip, X, MicOff } from "lucide-react"
import "./AiChat.css"

const ChatbotAI = () => {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [uploadedImages, setUploadedImages] = useState([])
  const [showImagePreview, setShowImagePreview] = useState(false)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const messagesEndRef = useRef(null)

  // Gemini API Configuration - Using Vite environment variables
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const callGeminiAPI = async (userMessage, images = []) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file")
      }

      const fashionDesignerPrompt = `You are a professional fashion designer and style consultant. Give concise, direct fashion advice in maximum 1 paragraph. Be specific with outfit recommendations, colors, and styling tips. Get straight to the point without lengthy explanations. Focus on actionable advice that's easy to follow.

      User message: ${userMessage}`

      const parts = [{ text: fashionDesignerPrompt }]

      // Add images to the request if any
      images.forEach((img) => {
        parts.push({
          inline_data: {
            mime_type: img.type,
            data: img.data,
          },
        })
      })

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Gemini API error: ${errorData.error?.message || "Unknown error"}`)
      }

      const data = await response.json()
      return data.candidates[0]?.content?.parts[0]?.text || "Sorry, I couldn't generate a response. Please try again."
    } catch (error) {
      console.error("Gemini API Error:", error)
      return `Sorry, I encountered an error: ${error.message}. Please make sure your Gemini API key is properly configured and try again.`
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim() && uploadedImages.length === 0) return

    const newMessage = {
      type: "user",
      content: message,
      images: uploadedImages.map((img) => ({ url: img.preview, name: img.name })),
    }

    setMessages((prev) => [...prev, newMessage])
    const currentMessage = message
    const currentImages = uploadedImages

    setMessage("")
    setUploadedImages([])
    setIsTyping(true)

    // Call Gemini API
    const aiResponse = await callGeminiAPI(currentMessage, currentImages)

    setMessages((prev) => [
      ...prev,
      {
        type: "ai",
        content: aiResponse,
      },
    ])
    setIsTyping(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files)
    
    if (files.length === 0) return

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const imageData = {
            name: file.name,
            type: file.type,
            data: e.target.result.split(",")[1], // Remove data:image/jpeg;base64, prefix
            preview: e.target.result,
            file,
          }
          setUploadedImages((prev) => [...prev, imageData])
        }
        reader.onerror = (error) => {
          console.error('Error reading file:', error)
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      // Reset the input value to allow selecting the same file again
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const removeImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      // Audio level detection
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      microphone.connect(analyser)
      analyser.fftSize = 256

      const updateAudioLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel((average / 255) * 100)
          requestAnimationFrame(updateAudioLevel)
        }
      }

      const audioChunks = []
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" })
        // Here you would typically convert speech to text
        // For now, we'll just add a placeholder
        setMessage("Voice message recorded (Speech-to-text would go here)")

        stream.getTracks().forEach((track) => track.stop())
        setAudioLevel(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      updateAudioLevel()
    } catch (error) {
      console.error("Error starting recording:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const suggestions = [
    "What colors work best with my skin tone?",
    "Suggest an outfit for a casual date",
    "How to style a white shirt differently?",
    "Best accessories for winter outfits",
  ]

  return (
    <div className="fitsense-container">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header className="fitsense-header">
        <div className="header-left">
          <div className="app-logo">
            <span>F</span>
          </div>
          <h1 className="app-title">FitSense</h1>
        </div>
        <nav className="header-nav">
          <button className="nav-button">
            <Home className="nav-icon" />
          </button>
          <button className="nav-button">
            <Search className="nav-icon" />
          </button>
          <button className="nav-button">
            <Camera className="nav-icon" />
          </button>
          <button className="nav-button">
            <Heart className="nav-icon" />
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="fitsense-main">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="welcome-screen">
            {/* Centered Greeting */}
            <div className="welcome-greeting">
              <h2 className="greeting-title">Hello, Fashion Enthusiast!</h2>
              <p className="greeting-subtitle">I'm your AI fashion designer. How can I style you today?</p>
            </div>

            {/* Suggestion Chips */}
            <div className="suggestion-chips">
              {suggestions.map((suggestion, index) => (
                <button key={index} onClick={() => setMessage(suggestion)} className="suggestion-chip">
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Input Box */}
            <div className="welcome-input-container">
              <div className="input-wrapper">
                {/* Image Previews */}
                {uploadedImages.length > 0 && (
                  <div className="image-previews">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={img.preview || "/placeholder.svg"} alt={img.name} className="preview-image" />
                        <button onClick={() => removeImage(index)} className="remove-image-btn">
                          <X className="remove-icon" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="input-box">
                  <div className="input-field-wrapper">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me about fashion, upload clothing images..."
                      className="input-field"
                      disabled={isTyping}
                    />
                  </div>
                  <div className="input-actions">
                    <button
                      onClick={handleFileButtonClick}
                      className="action-button"
                      title="Upload images"
                      disabled={isTyping}
                    >
                      <Paperclip className="action-icon" />
                    </button>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`action-button ${isRecording ? "recording" : ""}`}
                      title={isRecording ? "Stop recording" : "Start recording"}
                      disabled={isTyping}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="action-icon" />
                          <div className="recording-pulse" style={{ opacity: audioLevel / 100 }} />
                        </>
                      ) : (
                        <Mic className="action-icon" />
                      )}
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={!message.trim() && uploadedImages.length === 0}
                      className="send-button"
                      title="Send message"
                    >
                      <Send className="send-icon" />
                    </button>
                  </div>
                </div>

                {/* Recording Indicator */}
                {isRecording && (
                  <div className="recording-indicator">
                    <div className="recording-dot"></div>
                    <span>Recording...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="chat-container">
            <div className="messages-container">
              <div className="messages-list">
                {messages.map((msg, index) => (
                  <div key={index} className="message-wrapper">
                    {msg.type === "user" ? (
                      <div className="user-message-container">
                        <div className="user-message-content">
                          {msg.images && msg.images.length > 0 && (
                            <div className="message-images">
                              {msg.images.map((img, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={img.url || "/placeholder.svg"}
                                  alt={img.name}
                                  className="message-image"
                                />
                              ))}
                            </div>
                          )}
                          <div className="user-message">
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ai-message-container">
                        <div className="ai-message-content">
                          <div className="ai-avatar">
                            <span>F</span>
                          </div>
                          <div className="ai-message">
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="message-wrapper">
                    <div className="ai-message-container">
                      <div className="ai-message-content">
                        <div className="ai-avatar">
                          <span>F</span>
                        </div>
                        <div className="ai-message typing-message">
                          <div className="typing-dots">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                {/* Image Previews */}
                {uploadedImages.length > 0 && (
                  <div className="image-previews">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={img.preview || "/placeholder.svg"} alt={img.name} className="preview-image" />
                        <button onClick={() => removeImage(index)} className="remove-image-btn">
                          <X className="remove-icon" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="chat-input-box">
                  <div className="input-field-wrapper">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me about fashion, upload clothing images..."
                      className="chat-input-field"
                      disabled={isTyping}
                    />
                  </div>
                  <div className="input-actions">
                    <button
                      onClick={handleFileButtonClick}
                      className="chat-action-button"
                      disabled={isTyping}
                      title="Upload images"
                    >
                      <Paperclip className="action-icon" />
                    </button>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`chat-action-button ${isRecording ? "recording" : ""}`}
                      disabled={isTyping}
                      title={isRecording ? "Stop recording" : "Start recording"}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="action-icon" />
                          <div className="recording-pulse" style={{ opacity: audioLevel / 100 }} />
                        </>
                      ) : (
                        <Mic className="action-icon" />
                      )}
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={(!message.trim() && uploadedImages.length === 0) || isTyping}
                      className="chat-send-button"
                      title="Send message"
                    >
                      <Send className="send-icon" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ChatbotAI