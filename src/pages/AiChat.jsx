import React, { useEffect, useRef, useState } from "react";
import Header from "../components/header"; // adjust path if needed
import "./AiChat.css";
import { FiImage, FiX } from "react-icons/fi";      
import { FaPaperPlane } from "react-icons/fa"; 

export default function AiChat() {
  const [messages, setMessages] = useState([
    { id: 1, from: "bot", text: "Hi! I'm your personal AI fashion designer. I can help you with outfit recommendations, style advice, color coordination, and fashion tips. Feel free to describe your style preferences, occasion, or upload an image of clothing items you'd like advice on!", image: null },
  ]);
  const [input, setInput] = useState("");
  const [attach, setAttach] = useState(null); // File
  const [attachPreview, setAttachPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    // auto-scroll to bottom when messages change
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttach(f);
    setAttachPreview(URL.createObjectURL(f));
  }

  function removeAttachment() {
    setAttach(null);
    setAttachPreview(null);
    if (fileRef.current) fileRef.current.value = null;
  }

  // Convert file to base64 for Gemini API
  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  }

  async function callGeminiAPI(messageText, imageFile = null) {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!API_KEY) {
      throw new Error("Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const fashionDesignerPrompt = `You are a professional fashion designer and style consultant. Give concise, direct fashion advice in maximum 1 paragraph. Be specific with outfit recommendations, colors, and styling tips. Get straight to the point without lengthy explanations. Focus on actionable advice that's easy to follow.

    User message: ${messageText}`;

    let requestBody;

    if (imageFile) {
      const base64Image = await fileToBase64(imageFile);
      requestBody = {
        contents: [{
          parts: [
            { text: fashionDesignerPrompt },
            {
              inline_data: {
                mime_type: imageFile.type,
                data: base64Image
              }
            }
          ]
        }]
      };
    } else {
      requestBody = {
        contents: [{
          parts: [{ text: fashionDesignerPrompt }]
        }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || "I'm sorry, I couldn't generate a response. Please try again.";
  }

  async function sendMessage() {
    if (!input.trim() && !attach) return;
    
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: input.trim() || null,
      image: attachPreview || null,
    };
    
    setMessages((m) => [...m, newMsg]);
    const userMessage = input.trim();
    const userImage = attach;
    
    // Clear input immediately
    setInput("");
    setAttach(null);
    setAttachPreview(null);
    if (fileRef.current) fileRef.current.value = null;
    
    setIsLoading(true);

    try {
      const botResponse = await callGeminiAPI(userMessage, userImage);
      
      setMessages((m) => [
        ...m,
        { 
          id: Date.now() + 1, 
          from: "bot", 
          text: botResponse,
          image: null 
        }
      ]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setMessages((m) => [
        ...m,
        { 
          id: Date.now() + 1, 
          from: "bot", 
          text: `Sorry, I encountered an error: ${error.message}. Please make sure your Gemini API key is properly configured and try again.`,
          image: null 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="aichat-page">
      <Header />

      <main className="aichat-main">
        <div className="chat-wrapper">
          <div className="chat-panel">
            <div className="chat-header">AI Fashion Designer</div>

            <div className="messages" ref={messagesRef} aria-live="polite">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.from === "me" ? "me" : "bot"}`}>
                  {m.image && (
                    <div className="message-image">
                      <img src={m.image} alt="attachment" />
                    </div>
                  )}
                  {m.text && <div className="message-text">{m.text}</div>}
                </div>
              ))}
              {isLoading && (
                <div className="message bot">
                  <div className="message-text">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    Analyzing your style request...
                  </div>
                </div>
              )}
            </div>

            <div className="input-area">
              {attachPreview && (
                <div className="attach-preview">
                  <img src={attachPreview} alt="preview" />
                  <button className="remove-attach" onClick={removeAttachment} aria-label="Remove attachment">
                    <FiX />
                  </button>
                </div>
              )}

              <div className="input-row">
                <textarea
                  className="chat-input"
                  placeholder="Ask me about fashion, upload clothing images, or describe your style needs... (Shift+Enter for newline)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />

                <div className="controls">
                  <input type="file" ref={fileRef} className="visually-hidden" accept="image/*" onChange={handleFileChange} />
                  <button 
                    type="button" 
                    className="icon-btn" 
                    onClick={() => fileRef.current?.click()} 
                    aria-label="Attach image"
                    disabled={isLoading}
                  >
                    <FiImage />
                  </button>

                  <button 
                    type="button" 
                    className="send-btn" 
                    onClick={sendMessage} 
                    aria-label="Send message"
                    disabled={isLoading || (!input.trim() && !attach)}
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}