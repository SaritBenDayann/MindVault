import React, { useState, useEffect, useRef } from 'react';
import { generateAIPassword } from '../services/api';
import ReactMarkdown from 'react-markdown';
import styles from './AIPasswordAssistant.module.css';

export default function AIPasswordAssistant({ site, username, onSelectPassword }) {
  const [messages, setMessages] = useState(() => {
    const savedChat = sessionStorage.getItem('ai_chat_history');
    return savedChat ? JSON.parse(savedChat) : [];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchInitialOrUpdated = async () => {
      setIsLoading(true);
      try {
        // This prompt is sent to the backend but is NEVER shown to the user in the UI.
        const hiddenPrompt = `The user has opened the assistant. Please generate a NEW secure password specifically tailored to the CURRENT Site and Username provided in your system instructions. Explain your reasoning in ONE short paragraph. Remember past preferences.`;

        // We pass the current visible messages to the API, along with the hidden prompt
        const aiResponseText = await generateAIPassword(hiddenPrompt, site, username, messages);
        
        // We only add the AI's response to the screen, keeping the hidden prompt invisible
        const finalMessages = [...messages, { role: 'ai', text: aiResponseText }];
        setMessages(finalMessages);
        sessionStorage.setItem('ai_chat_history', JSON.stringify(finalMessages));
      } catch (error) {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Error communicating with the AI.' }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialOrUpdated();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = { role: 'user', text: inputValue };
    const currentHistory = [...messages, userMessage]; 
    setMessages(currentHistory);
    sessionStorage.setItem('ai_chat_history', JSON.stringify(currentHistory));
    
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponseText = await generateAIPassword(currentInput, site, username, currentHistory);
      const newMessages = [...currentHistory, { role: 'ai', text: aiResponseText }];
      setMessages(newMessages);
      sessionStorage.setItem('ai_chat_history', JSON.stringify(newMessages));
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Error communicating with the server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessageText = (text, role) => {
    if (!text) return null; 
    
    const parts = text.split(/\[PASSWORD\](.*?)\[\/PASSWORD\]/g);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className={styles.passwordSuggestionCard}>
            <span className={styles.suggestedPasswordText}>{part}</span>
            {role === 'ai' && (
              <button
                type="button"
                className={styles.useThisButton}
                onClick={() => onSelectPassword(part)}
              >
                Use This
              </button>
            )}
          </div>
        );
      }
      
      return (
        <div key={index} className={styles.markdownContent}>
          <ReactMarkdown>{part}</ReactMarkdown>
        </div>
      );
    });
  };

  return (
    <div className={styles.assistantContainer}>
      <div className={styles.chatWindow}>
        {messages.map((msg, index) => (
          <div key={index} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.aiWrapper}`}>
            <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
              {renderMessageText(msg.text, msg.role)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.messageWrapper} ${styles.aiWrapper}`}>
            <div className={`${styles.messageBubble} ${styles.aiBubble} ${styles.loading}`}>
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to modify the password..."
          className={styles.chatInput}
          disabled={isLoading}
        />
        <button 
          type="button" 
          onClick={handleSendMessage} 
          className={styles.sendButton} 
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </div>
      
      {messages.length > 0 && (
        <button 
          type="button" 
          onClick={() => {
            sessionStorage.removeItem('ai_chat_history');
            setMessages([]);
          }} 
          style={{ fontSize: '10px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textAlign: 'right', padding: '4px 12px' }}
        >
          Clear AI Memory
        </button>
      )}
    </div>
  );
}