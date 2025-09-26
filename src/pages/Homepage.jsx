import React, { useState } from "react";
import { Search, MoreHorizontal, Phone, Video, Send } from "lucide-react";

// Avatar Component - you can move this to components/ui/avatar.jsx later
const Avatar = ({ children, className = "" }) => (
  <div className={`relative inline-flex ${className}`}>
    {children}
  </div>
);

const AvatarImage = ({ src, alt, className = "" }) => (
  <img 
    src={src} 
    alt={alt} 
    className={`rounded-full object-cover ${className}`}
  />
);

const AvatarFallback = ({ children, className = "" }) => (
  <div className={`rounded-full flex items-center justify-center ${className}`}>
    {children}
  </div>
);

const conversations = [
  { id: 1, user: { name: "Alex Johnson", username: "alexj", avatar: "/user-avatar-1.png" }, lastMessage: "Hey! How's the project going?", timestamp: "2m", unread: 2, online: true },
  { id: 2, user: { name: "Sarah Chen", username: "sarahc", avatar: "/diverse-user-avatar-set-2.png" }, lastMessage: "Thanks for the help yesterday!", timestamp: "1h", unread: 0, online: true },
  { id: 3, user: { name: "Mike Rodriguez", username: "mikerod", avatar: "/diverse-user-avatars-3.png" }, lastMessage: "Let's catch up soon", timestamp: "3h", unread: 1, online: false },
  { id: 4, user: { name: "Emily Davis", username: "emilyd", avatar: "/user-avatar-4.png" }, lastMessage: "Did you see the latest update?", timestamp: "1d", unread: 0, online: true },
];

const messages = [
  { id: 1, sender: "Alex Johnson", message: "Hey! How's the project going?", timestamp: "2:30 PM", isMe: false },
  { id: 2, sender: "Me", message: "Going well! Just finished the main components", timestamp: "2:32 PM", isMe: true },
  { id: 3, sender: "Alex Johnson", message: "Awesome! Can't wait to see it", timestamp: "2:33 PM", isMe: false },
  { id: 4, sender: "Me", message: "I'll share the demo link later today", timestamp: "2:35 PM", isMe: true },
];

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Handle message sending logic here
      setNewMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-6rem)]">
          
          {/* Conversations List */}
          <div className="lg:col-span-1 bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-sm border border-orange-500/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/50">
              <h2 className="text-2xl font-bold mb-4 text-orange-400">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto h-full">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-4 border-b border-gray-800/30 hover:bg-gray-800/30 transition-all duration-200 text-left ${
                    selectedConversation.id === conversation.id ? 'bg-orange-500/10 border-r-2 border-r-orange-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12 border-2 border-orange-500/40">
                        <AvatarImage 
                          src={conversation.user.avatar || "/placeholder.svg"} 
                          alt={conversation.user.name}
                          className="w-full h-full"
                        />
                        <AvatarFallback className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 text-black font-bold text-sm">
                          {conversation.user.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.online && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-white truncate">{conversation.user.name}</p>
                        <span className="text-xs text-gray-400">{conversation.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{conversation.lastMessage}</p>
                    </div>
                    
                    {conversation.unread > 0 && (
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">{conversation.unread}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-sm border border-orange-500/10 rounded-2xl overflow-hidden flex flex-col">
            
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Avatar className="w-12 h-12 border-2 border-orange-500/40">
                    <AvatarImage 
                      src={selectedConversation.user.avatar || "/placeholder.svg"} 
                      alt={selectedConversation.user.name}
                      className="w-full h-full"
                    />
                    <AvatarFallback className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 text-black font-bold text-sm">
                      {selectedConversation.user.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  {selectedConversation.online && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedConversation.user.name}</h3>
                  <p className="text-sm text-gray-400">
                    {selectedConversation.online ? 'Active now' : `Last seen ${selectedConversation.timestamp} ago`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button className="p-3 hover:bg-gray-800/50 rounded-xl transition-all duration-200 hover:scale-105">
                  <Phone size={20} className="text-gray-400 hover:text-orange-400" />
                </button>
                <button className="p-3 hover:bg-gray-800/50 rounded-xl transition-all duration-200 hover:scale-105">
                  <Video size={20} className="text-gray-400 hover:text-orange-400" />
                </button>
                <button className="p-3 hover:bg-gray-800/50 rounded-xl transition-all duration-200 hover:scale-105">
                  <MoreHorizontal size={20} className="text-gray-400 hover:text-orange-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    message.isMe 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-black font-medium' 
                      : 'bg-gray-800/60 text-white'
                  }`}>
                    <p className="text-sm">{message.message}</p>
                    <p className={`text-xs mt-1 ${message.isMe ? 'text-black/70' : 'text-gray-400'}`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-gray-800/50">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  disabled={!newMessage.trim()}
                >
                  <Send size={20} className="text-black" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}