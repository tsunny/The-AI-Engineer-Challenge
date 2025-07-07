"use client";
import styles from "./page.module.css";
import { useState } from "react";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey || !userMessage) {
      alert("Please provide both OpenAI API Key and your question");
      return;
    }

    setIsLoading(true);
    setResponse("");

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
    } catch (error) {
      console.error("Error:", error);
      setResponse("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.header}>Ask Jarvis</h1>

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
            <label className={styles.label} htmlFor="userMessage">Your Question</label>
            <input
              id="userMessage"
              type="text"
              className={styles.input}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="What would you like to ask?"
            />
          </div>

          <button 
            type="submit" 
            className={styles.button}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Submit"}
          </button>
        </form>

        {(response || isLoading) && (
          <div className={styles.responseArea}>
            {isLoading && !response ? "Waiting for response..." : response}
          </div>
        )}
      </main>
      <footer className={styles.footer}>
      </footer>
    </div>
  );
}
