"use client";
import styles from "./page.module.css";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeyExpanded, setApiKeyExpanded] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  
  // RAG and PDF upload state
  const [sessionId, setSessionId] = useState("");
  const [uploadedPdf, setUploadedPdf] = useState(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [useRag, setUseRag] = useState(false);
  const [pdfExpanded, setPdfExpanded] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success"); // "success" or "error"

  // Generate session ID on component mount
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Collapse API key section after it's set
  useEffect(() => {
    if (apiKey) {
      setApiKeyExpanded(false);
    }
  }, [apiKey]);

  // Handle PDF upload
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!apiKey) {
      setModalMessage("Please provide your OpenAI API Key first");
      setModalType("error");
      setShowModal(true);
      return;
    }

    setIsUploadingPdf(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('session_id', sessionId);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setUploadedPdf(file.name);
        setUseRag(true);
        setModalMessage('PDF uploaded and processed successfully! You can now ask questions about the document.');
        setModalType("success");
        setShowModal(true);
      } else {
        const error = await response.text();
        setModalMessage(`Failed to upload PDF: ${error}`);
        setModalType("error");
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setModalMessage('Error uploading PDF. Please try again.');
      setModalType("error");
      setShowModal(true);
    } finally {
      setIsUploadingPdf(false);
    }
  };

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
          developer_message: "",
          session_id: sessionId,
          use_rag: useRag
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

  // Group chat history into conversations (pairs of user and assistant messages)
  const conversations = [];
  for (let i = 0; i < chatHistory.length; i += 2) {
    if (i + 1 < chatHistory.length) {
      conversations.push({
        user: chatHistory[i],
        assistant: chatHistory[i + 1]
      });
    } else {
      conversations.push({
        user: chatHistory[i],
        assistant: null
      });
    }
  }

  // Handle selecting a conversation from the sidebar
  const handleConversationSelect = (index) => {
    setSelectedConversation(index);
  };

  // Modal component
  const Modal = ({ show, message, type, onClose }) => {
    if (!show) return null;

    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={`${styles.modalHeader} ${type === 'success' ? styles.modalSuccess : styles.modalError}`}>
            <div className={styles.modalIcon}>
              {type === 'success' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </div>
            <h3>{type === 'success' ? 'Success!' : 'Error'}</h3>
          </div>
          <div className={styles.modalBody}>
            <p>{message}</p>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.modalButton} onClick={onClose}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Sidebar toggle button - positioned outside sidebar so it's always accessible */}
      <button 
        className={`${styles.sidebarToggle} ${sidebarOpen ? styles.sidebarToggleOpen : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d={sidebarOpen ? "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" : "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"} 
            fill="currentColor" />
        </svg>
      </button>

      {/* Sidebar for previous questions */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarTopBar}>
          <h2 className={styles.sidebarHeader}>Previous Chats</h2>
        </div>
        {conversations.length > 0 ? (
          <ul className={styles.conversationList}>
            {conversations.map((conv, index) => (
              <li 
                key={index} 
                className={`${styles.conversationItem} ${selectedConversation === index ? styles.selected : ''}`}
                onClick={() => handleConversationSelect(index)}
              >
                {conv.user.content.substring(0, 50)}{conv.user.content.length > 50 ? '...' : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noConversations}>No previous chats</p>
        )}
      </aside>

      <div className={`${styles.contentWrapper} ${sidebarOpen ? styles.contentWithSidebar : ''}`}>
        <main className={styles.main}>
          <h1 className={styles.header}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.headerIcon}>
              <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" />
              <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Jarvis AI Chat
          </h1>

          {/* Collapsible API Key section */}
          <div className={styles.collapsibleSection}>
            <button 
              className={styles.collapsibleHeader}
              onClick={() => setApiKeyExpanded(!apiKeyExpanded)}
              aria-expanded={apiKeyExpanded}
            >
              <span>OpenAI API Key</span>
              <svg 
                className={`${styles.chevron} ${apiKeyExpanded ? styles.chevronDown : styles.chevronRight}`} 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className={`${styles.collapsibleContent} ${apiKeyExpanded ? styles.collapsibleContentExpanded : ''}`}>
              <input
                id="apiKey"
                type="password"
                className={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenAI API Key"
              />
            </div>
          </div>

          {/* PDF Upload section */}
          <div className={styles.collapsibleSection}>
            <button 
              className={styles.collapsibleHeader}
              onClick={() => setPdfExpanded(!pdfExpanded)}
              aria-expanded={pdfExpanded}
            >
              <span>Upload PDF for RAG Chat</span>
              <svg 
                className={`${styles.chevron} ${pdfExpanded ? styles.chevronDown : styles.chevronRight}`} 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className={`${styles.collapsibleContent} ${pdfExpanded ? styles.collapsibleContentExpanded : ''}`}>
              {uploadedPdf ? (
                <div className={styles.uploadedFile}>
                  <div className={styles.fileInfo}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span>{uploadedPdf}</span>
                  </div>
                  <div className={styles.ragStatus}>
                    <span className={styles.ragIndicator}>RAG Mode: Active</span>
                    <button 
                      className={styles.clearPdf}
                      onClick={() => {
                        setUploadedPdf(null);
                        setUseRag(false);
                      }}
                    >
                      Clear PDF
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.uploadArea}>
                  <input
                    id="pdfUpload"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className={styles.fileInput}
                    disabled={isUploadingPdf}
                  />
                  <label htmlFor="pdfUpload" className={styles.uploadLabel}>
                    {isUploadingPdf ? (
                      <div className={styles.uploadingState}>
                        <div className={styles.loadingDot}></div>
                        <div className={styles.loadingDot}></div>
                        <div className={styles.loadingDot}></div>
                        <span>Processing PDF...</span>
                      </div>
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                          <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span>Choose PDF file or drag and drop</span>
                        <small>Upload a PDF to enable document-based chat</small>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Message input form */}
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="userMessage">Your Question</label>
              <div className={styles.inputWithButton}>
                <textarea
                  id="userMessage"
                  className={`${styles.input} ${styles.textarea}`}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Type your question here..."
                  rows="3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  className={styles.sendButton}
                  disabled={isLoading}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <>
                      <span className={styles.loadingDot}></span>
                      <span className={styles.loadingDot}></span>
                      <span className={styles.loadingDot}></span>
                    </>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              <div className={styles.inputHint}>Press Enter to send, Shift+Enter for new line</div>
            </div>
          </form>

          {/* Answer window - only show if there's content to display */}
          {(selectedConversation !== null || chatHistory.length > 0 || isLoading) && (
            <div className={styles.answerWindow}>
              {selectedConversation !== null ? (
                <div className={styles.selectedConversation}>
                  <div className={`${styles.messageContainer} ${styles.userMessage}`}>
                    <div className={styles.messageContent}>
                      {conversations[selectedConversation].user.content}
                    </div>
                  </div>
                  {conversations[selectedConversation].assistant && (
                    <div className={`${styles.messageContainer} ${styles.assistantMessage}`}>
                      <div className={styles.messageContent}>
                        <ReactMarkdown>{conversations[selectedConversation].assistant.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Display chat history */}
                  {chatHistory.length > 0 && (
                    <div className={styles.chatHistory}>
                      {chatHistory.map((message, index) => (
                        <div 
                          key={index} 
                          className={`${styles.messageContainer} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                        >
                          <div className={styles.messageContent}>
                            {message.role === 'assistant' ? (
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            ) : (
                              message.content
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show loading indicator or current response being streamed */}
                  {isLoading && !chatHistory.some(msg => msg.content === response) && (
                    <div className={`${styles.messageContainer} ${styles.assistantMessage}`}>
                      <div className={styles.messageContent}>
                        {response ? (
                          <ReactMarkdown>{response}</ReactMarkdown>
                        ) : (
                          <div className={styles.typingIndicator}>
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
        <footer className={styles.footer}>
          <p>Powered by OpenAI • Built with Next.js</p>
        </footer>
      </div>

      {/* Modal */}
      <Modal 
        show={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
