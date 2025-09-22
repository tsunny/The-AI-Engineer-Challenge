import os
import sys
import asyncio
from typing import Dict, List, Optional
from pathlib import Path

# Add current directory to Python path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt
from aimakerspace.text_utils import CharacterTextSplitter, PDFLoader


# RAG Prompt Templates
RAG_SYSTEM_PROMPT = SystemRolePrompt("""
You are a helpful AI assistant that answers questions based solely on the provided context from uploaded documents. 

Instructions:
- Only use information from the provided context to answer questions
- If the context doesn't contain enough information to answer the question, say "I don't have enough information in the provided context to answer that question."
- Be concise but thorough in your responses
- Cite specific parts of the context when relevant
- Do not use your general knowledge beyond what's in the context

Response style: {response_style}
Response length: {response_length}
""")

RAG_USER_PROMPT = UserRolePrompt("""
Context from uploaded document(s):
{context}

Number of relevant sources: {context_count}
{similarity_scores}

Question: {user_query}

Please answer the question based solely on the context provided above.
""")


class RetrievalAugmentedQAPipeline:
    """RAG pipeline for document-based question answering."""
    
    def __init__(self, llm: ChatOpenAI, vector_db_retriever: VectorDatabase,
                 response_style: str = "detailed", include_scores: bool = False) -> None:
        self.llm = llm
        self.vector_db_retriever = vector_db_retriever
        self.response_style = response_style
        self.include_scores = include_scores

    def run_pipeline(self, user_query: str, k: int = 4, **system_kwargs) -> dict:
        # Retrieve relevant contexts
        context_list = self.vector_db_retriever.search_by_text(user_query, k=k)

        context_prompt = ""
        similarity_scores = []

        for i, (context, score) in enumerate(context_list, 1):
            context_prompt += f"[Source {i}]: {context}\n\n"
            similarity_scores.append(f"Source {i}: {score:.3f}")

        # Create system message with parameters
        system_params = {
            "response_style": self.response_style,
            "response_length": system_kwargs.get("response_length", "detailed")
        }

        formatted_system_prompt = RAG_SYSTEM_PROMPT.create_message(**system_params)

        user_params = {
            "user_query": user_query,
            "context": context_prompt.strip(),
            "context_count": len(context_list),
            "similarity_scores": f"Relevance scores: {', '.join(similarity_scores)}" if self.include_scores else ""
        }

        formatted_user_prompt = RAG_USER_PROMPT.create_message(**user_params)

        return {
            "response": self.llm.run([formatted_system_prompt, formatted_user_prompt]),
            "context": context_list,
            "context_count": len(context_list),
            "similarity_scores": similarity_scores if self.include_scores else None,
            "prompts_used": {
                "system": formatted_system_prompt,
                "user": formatted_user_prompt
            }
        }


class PDFRAGProcessor:
    """Handles PDF processing and RAG setup."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.llm = ChatOpenAI(model_name="gpt-4o-mini")
        # Override the API key since we're passing it from the request
        self.llm._client.api_key = api_key
        self.llm._async_client.api_key = api_key
        
        self.vector_db: Optional[VectorDatabase] = None
        self.rag_pipeline: Optional[RetrievalAugmentedQAPipeline] = None
        self.text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    async def process_pdf(self, pdf_path: str) -> bool:
        """Process PDF and create vector database."""
        try:
            # Load PDF using the aimakerspace PDFLoader
            pdf_loader = PDFLoader(pdf_path)
            pdf_loader.load_file()
            
            if not pdf_loader.documents:
                return False
            
            # Split documents into chunks
            chunks = self.text_splitter.split_texts(pdf_loader.documents)
            
            # Create vector database
            self.vector_db = VectorDatabase()
            self.vector_db = await self.vector_db.abuild_from_list(chunks)
            
            # Create RAG pipeline
            self.rag_pipeline = RetrievalAugmentedQAPipeline(
                vector_db_retriever=self.vector_db,
                llm=self.llm,
                response_style="detailed",
                include_scores=True
            )
            
            return True
            
        except Exception as e:
            print(f"Error processing PDF: {e}")
            return False
    
    def query(self, user_query: str, k: int = 3) -> str:
        """Query the RAG pipeline."""
        if not self.rag_pipeline:
            return "No PDF has been processed yet. Please upload a PDF first."
        
        try:
            result = self.rag_pipeline.run_pipeline(
                user_query,
                k=k,
                response_length="comprehensive"
            )
            return result['response']
        except Exception as e:
            return f"Error processing query: {str(e)}"


# Global storage for RAG processors (in production, use proper session management)
rag_processors: Dict[str, PDFRAGProcessor] = {}


def get_or_create_rag_processor(session_id: str, api_key: str) -> PDFRAGProcessor:
    """Get or create a RAG processor for a session."""
    if session_id not in rag_processors:
        rag_processors[session_id] = PDFRAGProcessor(api_key)
    return rag_processors[session_id]