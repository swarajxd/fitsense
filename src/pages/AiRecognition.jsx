"use client";

import { useState, useRef, useEffect } from "react";
import {
  Home,
  Search,
  Camera,
  Heart,
  Send,
  Mic,
  Paperclip,
  X,
  MicOff,
  History,
  Trash2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { useUser } from '@clerk/clerk-react';
import "./AiRecognition.css";
import Header from "../components/header";

// Create Supabase client as singleton to avoid multiple instances
let supabaseInstance = null;

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
  }
  return supabaseInstance;
};

const ChatbotAI = () => {
  const { user, isLoaded } = useUser();
  const supabase = getSupabaseClient();
  
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [generatingOutfitImage, setGeneratingOutfitImage] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const messagesEndRef = useRef(null);

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  const BACKEND_API_URL = (import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:7000').replace(/\/$/, '');

  const analyzeImageWithModel = async (imageFile) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('run_color', 'true');
      formData.append('run_pattern', 'true');
      formData.append('run_season', 'true');
      formData.append('score_thr', '0.7');
      formData.append('topk', '10');

      const response = await fetch(`${BACKEND_API_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing image with model:', error);
      throw error;
    }
  };

  const generateOutfitImage = async (outfitDescription) => {
    try {
      // Validate description before sending
      if (!outfitDescription || outfitDescription.trim().length < 10) {
        console.log('Skipping image generation - description too short:', outfitDescription);
        return null;
      }
      
      setGeneratingOutfitImage(true);
      
      const response = await fetch(`${BACKEND_API_URL}/api/generate-outfit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outfitDescription: outfitDescription
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error:', errorData);
        throw new Error(errorData.error || 'Failed to generate outfit image');
      }

      const data = await response.json();
      return data.image;
    } catch (error) {
      console.error('Error generating outfit image:', error);
      return null;
    } finally {
      setGeneratingOutfitImage(false);
    }
  };

  // Extract outfit recommendations from AI response
  const extractOutfitRecommendations = (content) => {
    const outfits = [];
    const lines = content.split('\n');
    let currentOutfit = null;
    let inOutfitSection = false;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Look for outfit recommendations sections or "Alternative Outfit Ideas"
      if (trimmed.match(/alternative outfit|outfit \d+|recommendation \d+|outfit idea/i)) {
        if (currentOutfit && currentOutfit.description.length > 0) {
          outfits.push(currentOutfit);
        }
        currentOutfit = { description: [] };
        inOutfitSection = true;
      }
      
      // Collect outfit details when in outfit section
      if (inOutfitSection && trimmed) {
        // Look for clothing item mentions
        if (trimmed.match(/top|bottom|shirt|pants|dress|footwear|shoes|accessories|jacket|coat|blouse|skirt|jeans|sweater|cardigan|blazer/i)) {
          currentOutfit.description.push(trimmed.replace(/^[-*•]\s*/, ''));
        }
        // Stop collecting if we hit another main section
        if (trimmed.match(/^\d+\.\s*\*\*[^A]/i) && !trimmed.match(/outfit/i)) {
          inOutfitSection = false;
        }
      }
    });
    
    // Add the last outfit if it exists
    if (currentOutfit && currentOutfit.description.length > 0) {
      outfits.push(currentOutfit);
    }
    
    // Convert to descriptive strings, filter empty ones
    const descriptions = outfits
      .map(outfit => outfit.description.join(', '))
      .filter(desc => desc.length > 20); // Only keep substantial descriptions
    
    console.log('Extracted outfit descriptions:', descriptions);
    return descriptions;
  };

  // Helper function to parse AI response into structured sections
  const parseAIResponse = (content) => {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = { title: '', content: [] };
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Check for section headers (numbered or with asterisks)
      const headerMatch = trimmed.match(/^(\d+\.\s*)?[\*]{0,2}([^*:]+)[\*]{0,2}:?\s*(.*)$/);
      
      if (headerMatch && (trimmed.startsWith('**') || /^\d+\./.test(trimmed))) {
        // Save previous section if it has content
        if (currentSection.title || currentSection.content.length > 0) {
          sections.push({ ...currentSection });
        }
        // Start new section
        currentSection = {
          title: headerMatch[2].trim(),
          content: headerMatch[3] ? [headerMatch[3].trim()] : []
        };
      } else if (trimmed) {
        // Add to current section content
        currentSection.content.push(trimmed);
      }
    });
    
    // Add the last section
    if (currentSection.title || currentSection.content.length > 0) {
      sections.push(currentSection);
    }
    
    // If no sections detected, return as single block
    if (sections.length === 0) {
      return [{ title: '', content: [content] }];
    }
    
    return sections;
  };

  const promptOptions = [
    "What colors work best with my skin tone?",
    "Suggest an outfit for a casual date",
    "How to style a white shirt differently?",
    "Best accessories for winter outfits",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (supabase && isLoaded && user) {
      loadChatHistoryFromSupabase();
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (messages.length > 0 && currentChatId && supabase && isLoaded && user) {
      const timeoutId = setTimeout(() => {
        saveChatToSupabase();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentChatId, isLoaded, user]);

  const loadChatHistoryFromSupabase = async () => {
    if (!supabase || !isLoaded || !user) return;

    try {
      setIsLoadingHistory(true);
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('Error loading chat history:', error.message, error);
        return;
      }
      setChatHistory(data || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveChatToSupabase = async () => {
    if (!supabase || messages.length === 0 || !currentChatId || !isLoaded || !user) return;

    try {
      const firstUserMessage = messages.find(msg => msg.type === "user")?.content || "New Chat";
      const chatTitle = generateChatTitle(firstUserMessage);
      
      const chatData = {
        id: currentChatId,
        user_id: user.id,
        title: chatTitle,
        messages: messages,
        timestamp: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_history')
        .upsert(chatData, { onConflict: 'id', returning: 'minimal' });

      if (error) {
        console.error('Error saving chat to Supabase:', error.message, error);
      } else {
        setChatHistory(prev => {
          const existingIndex = prev.findIndex(chat => chat.id === currentChatId);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = chatData;
            return updated;
          } else {
            return [chatData, ...prev];
          }
        });
      }
    } catch (error) {
      console.error('Error saving chat to Supabase:', error);
    }
  };

  const deleteChatFromSupabase = async (chatId) => {
    if (!supabase || !isLoaded || !user) return;

    try {
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', chatId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting chat from Supabase:', error.message, error);
      } else {
        setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
        if (currentChatId === chatId) {
          startNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat from Supabase:', error);
    }
  };

  const generateChatId = () => {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateChatTitle = (firstMessage) => {
    const title = firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + "..." 
      : firstMessage;
    return title || "New Chat";
  };

  const startNewChat = () => {
    if (messages.length > 0 && currentChatId && supabase && isLoaded && user) {
      saveChatToSupabase();
    }
    setMessages([]);
    setMessage("");
    setUploadedImages([]);
    setCurrentChatId(generateChatId());
    setShowHistory(false);
  };

  const loadChatFromHistory = (chat) => {
    if (messages.length > 0 && currentChatId && supabase && isLoaded && user) {
      saveChatToSupabase();
    }
    
    const chatMessages = chat.messages || [];
    setMessages(chatMessages);
    setCurrentChatId(chat.id);
    setMessage("");
    setUploadedImages([]);
    setShowHistory(false);
  };

  const deleteChatFromHistory = (chatId, e) => {
    e.stopPropagation();
    deleteChatFromSupabase(chatId);
  };

  const callGeminiAPI = async (userMessage, images = [], analysisData = null) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file");
      }

      let fashionDesignerPrompt = `You are an expert fashion stylist and designer. `;

      if (analysisData && analysisData.length > 0) {
        fashionDesignerPrompt += `The user has uploaded an outfit image. Here's the AI-detected analysis:\n\n`;
        
        analysisData.forEach((result, idx) => {
          if (result.analysis && result.analysis.items) {
            fashionDesignerPrompt += `Image ${idx + 1} contains:\n`;
            result.analysis.items.forEach((item, itemIdx) => {
              fashionDesignerPrompt += `${itemIdx + 1}. ${item.det_label} - ${item.color.label || 'unknown color'} (${item.pattern.label || 'unknown pattern'}) - ${item.season.label || 'unknown season'} season\n`;
            });
            fashionDesignerPrompt += `\n`;
          }
        });

        fashionDesignerPrompt += `Based on this outfit analysis, please provide a comprehensive fashion consultation with the following structure:

1. **Current Outfit Description**: Briefly describe what the user is wearing based on the detected items.

2. **Answer User's Question**: ${userMessage}

3. **Outfit Assessment**: Comment on the current outfit - what works well (color combinations, patterns, seasonal appropriateness).

4. **Improvement Suggestions**: Provide 2-3 specific actionable improvements for the current outfit (e.g., different color choices, better-fitting alternatives, accessory additions).

5. **Alternative Outfit Ideas**: Suggest 2 complete alternative outfits with a similar style/theme that would work well. For each outfit, specify:
   - Top/shirt recommendation
   - Bottom recommendation
   - Footwear suggestion
   - Key accessories
   - Why this combination works

Keep your response conversational, practical, and under 300 words total. Be specific with colors, styles, and brands when relevant.`;
      } else {
        fashionDesignerPrompt += `The user asked: "${userMessage}"

Provide helpful, specific fashion advice in a conversational tone. Include:
- Direct answer to their question
- 2-3 specific actionable tips
- Example outfit combinations if relevant
- Color/style recommendations

Keep it under 200 words and be practical.`;
      }

      const parts = [{ text: fashionDesignerPrompt }];

      images.forEach((img) => {
        parts.push({
          inline_data: {
            mime_type: img.type,
            data: img.data,
          },
        });
      });

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || "Unknown error"}`);
      }

      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || "Sorry, I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return `Sorry, I encountered an error: ${error.message}. Please make sure your Gemini API key is properly configured and try again.`;
    }
  };

  const handleSendMessage = async (messageText = null) => {
    const messageToSend = messageText || message;
    if (!messageToSend.trim() && uploadedImages.length === 0) return;

    if (messages.length === 0 && !currentChatId) {
      setCurrentChatId(generateChatId());
    }

    const newMessage = {
      type: "user",
      content: messageToSend,
      images: uploadedImages.map((img) => ({ url: img.preview, name: img.name })),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMessage]);
    const currentMessage = messageToSend;
    const currentImages = uploadedImages;

    setMessage("");
    setUploadedImages([]);
    setIsTyping(true);

    try {
      let analysisResults = null;
      
      if (currentImages.length > 0) {
        try {
          console.log('Starting image analysis...');
          const analysisPromises = currentImages.map(img => analyzeImageWithModel(img.file));
          const allAnalysis = await Promise.all(analysisPromises);
          
          analysisResults = allAnalysis.map((analysis, idx) => ({
            imageIndex: idx,
            imageName: currentImages[idx].name,
            analysis: analysis
          }));
          
          console.log('Image analysis completed:', analysisResults);
        } catch (error) {
          console.error('Image analysis failed:', error);
        }
      }

      const aiResponse = await callGeminiAPI(currentMessage, currentImages, analysisResults);

      // Extract outfit recommendations and generate images
      const outfitRecommendations = extractOutfitRecommendations(aiResponse);
      let generatedOutfitImages = [];

      if (outfitRecommendations.length > 0) {
        console.log('Found outfit recommendations, generating images...');
        console.log('Descriptions:', outfitRecommendations);
        
        try {
          const imagePromises = outfitRecommendations.slice(0, 2).map(outfit => 
            generateOutfitImage(outfit)
          );
          generatedOutfitImages = await Promise.all(imagePromises);
          generatedOutfitImages = generatedOutfitImages.filter(img => img !== null);
          console.log('Generated images count:', generatedOutfitImages.length);
        } catch (error) {
          console.error('Failed to generate outfit images:', error);
          // Continue without images if generation fails
        }
      } else {
        console.log('No outfit recommendations found in AI response');
      }

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          content: aiResponse,
          analysisData: analysisResults,
          outfitImages: generatedOutfitImages,
          timestamp: new Date().toISOString()
        },
      ]);
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          content: "Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date().toISOString()
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePromptClick = (prompt) => {
    setMessage(prompt);
    handleSendMessage(prompt);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = {
            name: file.name,
            type: file.type,
            data: e.target.result.split(",")[1],
            preview: e.target.result,
            file,
          };
          setUploadedImages((prev) => [...prev, imageData]);
        };
        reader.onerror = (error) => console.error("Error reading file:", error);
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const removeImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;

      const updateAudioLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel((average / 255) * 100);
          requestAnimationFrame(updateAudioLevel);
        }
      };

      const audioChunks = [];
      mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        setMessage("Voice message recorded (Speech-to-text would go here)");
        stream.getTracks().forEach((track) => track.stop());
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      updateAudioLevel();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="fitsense-container">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />
      
      <div className="header-container">
        <Header />
        {supabase && isLoaded && user && (
          <button 
            className="history-button"
            onClick={() => setShowHistory(!showHistory)}
            title="Chat History"
          >
            <History className="history-icon" />
          </button>
        )}
      </div>

      {showHistory && supabase && isLoaded && user && (
        <div className="history-sidebar">
          <div className="history-header">
            <h3>Chat History</h3>
            <button className="new-chat-button" onClick={startNewChat} title="Start New Chat">
              <MessageSquare className="new-chat-icon" />
              New Chat
            </button>
          </div>
          <div className="history-list">
            {isLoadingHistory ? (
              <div className="loading-history"><p>Loading chat history...</p></div>
            ) : chatHistory.length === 0 ? (
              <div className="no-history"><p>No chat history yet</p></div>
            ) : (
              chatHistory.map((chat) => (
                <div 
                  key={chat.id} 
                  className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                  onClick={() => loadChatFromHistory(chat)}
                >
                  <div className="history-item-content">
                    <div className="history-item-title">{chat.title}</div>
                    <div className="history-item-timestamp">{formatTimestamp(chat.timestamp)}</div>
                  </div>
                  <button className="delete-chat-button" onClick={(e) => deleteChatFromHistory(chat.id, e)} title="Delete Chat">
                    <Trash2 className="delete-icon" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="history-overlay" onClick={() => setShowHistory(false)} />
      )}

      <main className="fitsense-main1">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-greeting">
              <h2 className="greeting-title1">
                Hi there, Bhavith<br />What would you like to know?
              </h2>
              <p className="greeting-subtitle1">
                Use one of the most common prompts<br />below or use your own to begin
              </p>
            </div>
            
            <div className="alreadygivenoptions">
              {promptOptions.map((prompt, index) => (
                <div key={index} className="option1 option" onClick={() => handlePromptClick(prompt)}>
                  {prompt}
                </div>
              ))}
            </div>

            <div className="welcome-input-container">
              <div className="input-wrapper">
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
                    <button onClick={handleFileButtonClick} className="action-button" title="Upload images" disabled={isTyping}>
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
                      onClick={() => handleSendMessage()}
                      disabled={!message.trim() && uploadedImages.length === 0}
                      className="send-button"
                      title="Send message"
                    >
                      <Send className="send-icon" />
                    </button>
                  </div>
                </div>

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
                            {parseAIResponse(msg.content).map((section, idx) => (
                              <div key={idx} className="response-section">
                                {section.title && (
                                  <h4 className="section-title">{section.title}</h4>
                                )}
                                <div className="section-content">
                                  {section.content.map((paragraph, pIdx) => (
                                    <p key={pIdx}>{paragraph}</p>
                                  ))}
                                </div>
                              </div>
                            ))}
                            
                            {msg.outfitImages && msg.outfitImages.length > 0 && (
                              <div className="outfit-recommendations">
                                <div className="outfit-header">
                                  <Sparkles className="sparkles-icon" />
                                  <h4>Outfit Visualizations</h4>
                                </div>
                                <div className="outfit-images-grid">
                                  {msg.outfitImages.map((imgSrc, imgIdx) => (
                                    <div key={imgIdx} className="outfit-image-card">
                                      <img 
                                        src={imgSrc} 
                                        alt={`Outfit recommendation ${imgIdx + 1}`} 
                                        className="outfit-generated-image"
                                      />
                                      <p className="outfit-image-label">Outfit {imgIdx + 1}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
                          {generatingOutfitImage && (
                            <p className="generating-text">Generating outfit visualizations...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="chat-input-container">
              <div className="chat-input-wrapper">
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
                    <button onClick={handleFileButtonClick} className="chat-action-button" disabled={isTyping} title="Upload images">
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
                      onClick={() => handleSendMessage()}
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
  );
};

export default ChatbotAI;