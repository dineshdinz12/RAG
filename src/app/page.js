"use client";
import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Send, Loader2, Menu, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([
    { id: 1, title: 'About BIT Sathy', active: true },
    { id: 2, title: 'Admission Process', active: false },
    { id: 3, title: 'Campus Life', active: false },
  ]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversations(prev => [
      { id: Date.now(), title: 'New Chat', active: true },
      ...prev.map(conv => ({ ...conv, active: false }))
    ]);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    const userMessage = { role: 'user', content: input.trim() };
    
    // Add user message to the messages array
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        let assistantMessage = { role: 'assistant', content: '' };
        
        // Add empty assistant message immediately
        setMessages([...updatedMessages, assistantMessage]);
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = new TextDecoder().decode(value);
          assistantMessage.content += text;
          
          // Update only the assistant's message while keeping the user's message
          setMessages(prev => [
            ...prev.slice(0, -1),
            { ...assistantMessage }
          ]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Sorry, there was an error processing your request. Please try again.');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-gray-900 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            <Plus className="h-5 w-5" />
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`flex items-center gap-2 px-4 py-3 cursor-pointer ${
                conv.active ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
            >
              <MessageSquare className="h-5 w-5 text-gray-400" />
              <span className="text-gray-300 truncate">{conv.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Toggle Sidebar Button */}
        <div className="bg-white p-4 border-b">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Start a conversation by asking a question about BIT Sathy
            </div>
          )}
          
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`p-4 rounded-xl max-w-[80%] ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <ReactMarkdown 
                  className="prose prose-sm max-w-none break-words"
                  components={{
                    p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                    code: ({ node, inline, className, children, ...props }) => (
                      inline ? 
                        <code className="bg-gray-700 text-gray-100 px-1 py-0.5 rounded" {...props}>{children}</code> :
                        <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          <code {...props}>{children}</code>
                        </pre>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Input Container */}
        <div className="border-t bg-white p-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about BIT Sathy..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center gap-2 transition-all ${
                isLoading || !input.trim() 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-blue-600 active:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;