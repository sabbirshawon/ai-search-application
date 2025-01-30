import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, Clock, Copy, Check, Settings, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID;
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;

// Storage configuration
const CHAT_STORAGE_KEY = 'weyai_chat_history';
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

const detectCodeBlocks = (text) => {
  const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;

  text.replace(codeBlockRegex, (match, lang, code, offset) => {
    if (offset > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, offset)
      });
    }

    parts.push({
      type: 'code',
      language: lang || 'text',
      content: code.trim()
    });

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
};

const CodeBlock = ({ language, content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-gray-300" />
        )}
      </button>
      {copied && (
        <span className="absolute right-12 top-3 text-xs text-green-400">
          Copied!
        </span>
      )}
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        className="rounded-md p-2 my-2 text-sm"
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

const loadMessagesFromStorage = () => {
  try {
    const storedData = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!storedData) return null;

    const { messages, timestamp } = JSON.parse(storedData);
    
    if (Date.now() - timestamp > EXPIRATION_TIME) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }

    return messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error('Error loading messages:', error);
    return null;
  }
};

const saveMessagesToStorage = (messages) => {
  const storageData = {
    messages: messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.getTime()
    })),
    timestamp: Date.now()
  };
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(storageData));
};

const SettingsModal = ({ isOpen, onClose, onClearHistory }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">Settings</h2>
        <button
          onClick={onClearHistory}
          className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          Clear Chat History
        </button>
      </motion.div>
    </motion.div>
  );
};


const SearchChatApp = () => {
  const [messages, setMessages] = useState(() => {
    const storedMessages = loadMessagesFromStorage();
    return storedMessages || [
      { 
        type: 'ai', 
        content: 'Hello! Welcome to <b>WeyAI</b>! Ask me anything and I\'ll search for answers.',
        timestamp: new Date(),
        showTime: false
      }
    ];
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    saveMessagesToStorage(messages);
  }, [messages.length, isLoading]);

  const clearChatHistory = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      { 
        type: 'ai', 
        content: 'Hello! Welcome to <b>WeyAI</b>! Ask me anything and I\'ll search for answers.',
        timestamp: new Date(),
        showTime: false
      }
    ]);
    setIsSettingsOpen(false);
  };

  const searchGoogle = async (query) => {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch search results');
      
      const data = await response.json();
      return {
        directAnswer: data.knowledgeGraph?.description || null,
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

  const askAI = async (query) => {
    const url = 'https://api.cohere.ai/v1/generate';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`
    };
    const body = JSON.stringify({
      prompt: query,
      max_tokens: 150
    });
  
    try {
      const response = await fetch(url, { method: 'POST', headers, body });
      if (!response.ok) throw new Error(`AI response error: ${response.status}`);
      
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
      const aiResponse = await askAI(trimmedInput);
      const aiDirectResponse = {
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        showTime: false
      };
      setMessages(prev => [...prev, aiDirectResponse]);

      if (aiResponse.includes("I don't know") || aiResponse.includes("I can't help")) {
        const { directAnswer, results } = await searchGoogle(trimmedInput);
        
        if (results.length > 0) {
          const aiWebResponse = {
            type: 'ai',
            content: directAnswer || `Here are results for "${trimmedInput}":`,
            searchResults: results,
            timestamp: new Date(),
            showTime: false
          };
          setMessages(prev => [...prev, aiWebResponse]);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'ai',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        showTime: false
      }]);
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
      <div className="flex justify-between items-center mb-4">
        <motion.h1 
          className="text-2xl font-bold text-blue-600"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Welcome to WeyAI
        </motion.h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearHistory={clearChatHistory}
      />
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 rounded-lg bg-white shadow">
        {messages.map((message, index) => (
          <div key={index} className="space-y-1">
            <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3/4 p-3 rounded-lg ${
                message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="break-words">
                  {detectCodeBlocks(message.content).map((part, partIndex) => (
                    part.type === 'code' ? (
                      <CodeBlock
                        key={partIndex}
                        language={part.language}
                        content={part.content}
                      />
                    ) : (
                      <span 
                        key={partIndex}
                        className="inline"
                        dangerouslySetInnerHTML={{ __html: part.content }}
                      />
                    )
                  ))}
                </div>

                {message.searchResults && (
                  <div className="mt-2 space-y-2">
                    {message.searchResults.map((result, idx) => (
                      <div key={idx} className="bg-white p-2 rounded shadow-sm">
                        <h3 className="font-semibold text-sm">{result.title}</h3>
                        <div className="text-sm text-gray-600 mt-1">
                          {detectCodeBlocks(result.snippet).map((part, partIdx) => (
                            part.type === 'code' ? (
                              <CodeBlock
                                key={partIdx}
                                language={part.language}
                                content={part.content}
                              />
                            ) : (
                              <p key={partIdx}>{part.content}</p>
                            )
                          ))}
                        </div>
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
                  : formatTime(message.timestamp)}
              </span>
              {message.showTime ? (
                <ChevronUp className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              )}
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