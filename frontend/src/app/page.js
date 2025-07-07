"use client";
import styles from "./page.module.css";
import { useState } from "react";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey || !userMessage) {
      alert("Please provide both OpenAI API Key and your question");
      return;
    }

    setIsLoading(true);
    setResponse("");

    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          user_message: userMessage,
          developer_message: "You are a helpful assistant named Jarvis."
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // Handle streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedResponse = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const textChunk = decoder.decode(value);
          accumulatedResponse += textChunk;
          setResponse(accumulatedResponse);
        }
      }

      // Add assistant response to chat history when complete
      if (accumulatedResponse) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: accumulatedResponse }]);
      }

      // Clear the input field after sending
      setUserMessage("");

    } catch (error) {
      console.error("Error:", error);
      setResponse("Error: " + error.message);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Error: " + error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.header}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.headerIcon}>
            <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Jarvis AI Chat
        </h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="apiKey">OpenAI API Key</label>
            <input
              id="apiKey"
              type="password"
              className={styles.input}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API Key"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="userMessage">Your Message</label>
            <textarea
              id="userMessage"
              className={`${styles.input} ${styles.textarea}`}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Type your message here..."
              rows="3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className={styles.inputHint}>Press Enter to send, Shift+Enter for new line</div>
          </div>

          <button 
            type="submit" 
            className={styles.button}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={styles.loadingDot}></span>
                <span className={styles.loadingDot}></span>
                <span className={styles.loadingDot}></span>
              </>
            ) : (
              <>Send</>
            )}
          </button>
        </form>

        {/* Display chat history */}
        {chatHistory.length > 0 && (
          <div className={styles.chatHistory}>
            {chatHistory.map((message, index) => (
              <div 
                key={index} 
                className={`${styles.messageContainer} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
              >
                <div className={styles.messageContent}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show loading indicator or current response being streamed */}
        {isLoading && !chatHistory.some(msg => msg.content === response) && (
          <div className={`${styles.messageContainer} ${styles.assistantMessage}`}>
            <div className={styles.messageContent}>
              {response || (
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className={styles.footer}>
        <p>Powered by OpenAI • Built with Next.js</p>
      </footer>
    </div>
  );
}
