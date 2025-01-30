import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID;
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY; 

const SearchChatApp = () => {
  const [messages, setMessages] = useState([
    { 
      type: 'ai', 
      content: 'Hello! Ask me anything and I\'ll search for answers.',
      timestamp: new Date(),
      showTime: false
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [messages.length, isLoading]);

  const searchGoogle = async (query) => {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const data = await response.json();
      
      // Extract knowledge graph information if available
      const knowledgeGraph = data.knowledgeGraph || {};
      
      return {
        directAnswer: knowledgeGraph.description || null,
        results: data.items?.slice(0, 3).map(item => ({
          title: item.title,
          snippet: item.snippet,
          link: item.link
        })) || []
      };
    } catch (error) {
      throw new Error('Search failed: ' + error.message);
    }
  };

  const getDirectAnswer = (query) => {
    const lowerCaseQuery = query.toLowerCase();
  
    // Handle time-related queries
    if (lowerCaseQuery.includes('what time is it now') || lowerCaseQuery.includes('current time')) {
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      return `The current time is ${timeString}.`;
    }
  
    // Handle temperature-related queries
    if (lowerCaseQuery.includes('what is the temperature now') || lowerCaseQuery.includes('current temperature')) {
      return `I'm sorry, I cannot provide real-time temperature data. Please check a weather service.`;
    }
  
    // Handle other specific queries
    if (lowerCaseQuery.includes('hello') || lowerCaseQuery.includes('hi')) {
      return 'Hello! How can I assist you today?';
    }
  
    // If no specific query matches, return null
    return null;
  };

  const askAI = async (query) => {
    const url = 'https://api.cohere.ai/v1/generate';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`
    };
    const body = JSON.stringify({
      prompt: query,
      max_tokens: 150
    });
  
    try {
      const response = await fetch(url, { method: 'POST', headers, body });
      if (!response.ok) {
        throw new Error(`Failed to fetch AI response: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
      return data.generations[0].text.trim();
    } catch (error) {
      throw new Error('AI request failed: ' + error.message);
    }
  };

  const toggleTimeVisibility = (index, e) => {
    e.stopPropagation();
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, showTime: !msg.showTime } : msg
    ));
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  const formatDetailedTime = (date) => {
    return new Intl.DateTimeFormat('default', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }).format(date);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedInput = inputValue.trim();
    
    if (!trimmedInput || isLoading) return;

    const userMessage = {
      type: 'user',
      content: trimmedInput,
      timestamp: new Date(),
      showTime: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Ask AI for a direct answer first
      const aiResponse = await askAI(trimmedInput);

      const aiDirectResponse = {
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        showTime: false
      };
      setMessages(prev => [...prev, aiDirectResponse]);

      // If the AI response is insufficient, perform a Google search
      if (aiResponse.includes("I don't know") || aiResponse.includes("I can't help")) {
        const { directAnswer, results } = await searchGoogle(trimmedInput);
        
        if (results.length > 0) {
          const aiWebResponse = {
            type: 'ai',
            content: `Here are the results for "${trimmedInput}":`,
            searchResults: results,
            timestamp: new Date(),
            showTime: false
          };
          
          setMessages(prev => [...prev, aiWebResponse]);
        } else {
          throw new Error('No results found');
        }
      }
    } catch (error) {
      const errorMessage = {
        type: 'ai',
        content: `Error: ${error.message}. Please try again.`,
        timestamp: new Date(),
        showTime: false
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-gray-50">

      <motion.h1 
        className="text-center text-2xl font-bold text-blue-600 mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        Welcome to WeyAI
      </motion.h1>


      <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 rounded-lg bg-white shadow">
        {messages.map((message, index) => (
          <div key={index} className="space-y-1">
            <div
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3/4 p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="break-words">{message.content}</p>
                
                {message.searchResults && (
                  <div className="mt-2 space-y-2">
                    {message.searchResults.map((result, idx) => (
                      <div key={idx} className="bg-white p-2 rounded shadow-sm">
                        <h3 className="font-semibold text-sm">{result.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{result.snippet}</p>
                        <a
                          href={result.link}
                          className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read more →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div 
              className={`flex items-center gap-1 cursor-pointer ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
              onClick={(e) => toggleTimeVisibility(index, e)}
            >
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">
                {message.showTime 
                  ? formatDetailedTime(message.timestamp)
                  : formatTime(message.timestamp)
                }
              </span>
              {message.showTime 
                ? <ChevronUp className="w-3 h-3 text-gray-400" />
                : <ChevronDown className="w-3 h-3 text-gray-400" />
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 bg-white p-2 rounded-lg shadow">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default SearchChatApp;