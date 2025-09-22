# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import sys
import uuid
import asyncio
import tempfile
from typing import Optional, List
from pathlib import Path

# Add current directory to Python path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from request_helper import classify_query_and_get_developer_prompt
from rag_utils import get_or_create_rag_processor

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)


# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str  # Message from the user
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default
    api_key: str  # OpenAI API key for authentication
    session_id: Optional[str] = None  # Session ID for RAG context
    use_rag: Optional[bool] = False  # Whether to use RAG for this request


# PDF upload endpoint - supports multiple files
@app.post("/api/upload-pdf")
async def upload_pdf(
    files: List[UploadFile] = File(...),
    api_key: str = Form(...),
    session_id: str = Form(...)
):
    temp_files = []
    try:
        processed_files = []
        
        # Validate and process each file
        for file in files:
            # Validate file type
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail=f"Only PDF files are allowed. '{file.filename}' is not a PDF.")
            
            # Create temporary file with PDF suffix for proper handling
            temp_file = tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=f"_{session_id}_{file.filename}",
                prefix="pdf_upload_"
            )
            temp_files.append(temp_file.name)
            
            try:
                # Read file content
                content = await file.read()
                
                # Write to temporary file
                temp_file.write(content)
                temp_file.flush()
                
                processed_files.append({
                    "original_name": file.filename,
                    "temp_path": temp_file.name,
                    "size": len(content)
                })
                
            finally:
                # Close temporary file handle
                temp_file.close()
                # Always close the uploaded file to prevent multipart warnings
                await file.close()
        
        # Process all PDFs with RAG
        rag_processor = get_or_create_rag_processor(session_id, api_key)
        success = await rag_processor.process_multiple_pdfs([f["temp_path"] for f in processed_files])
        
        if success:
            file_names = [f["original_name"] for f in processed_files]
            total_size = sum(f["size"] for f in processed_files)
            return {
                "message": f"Successfully uploaded and processed {len(processed_files)} PDF(s)",
                "session_id": session_id,
                "files": file_names,
                "total_files": len(processed_files),
                "total_size_bytes": total_size
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to process one or more PDF files")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up all temporary files
        for temp_file_path in temp_files:
            try:
                Path(temp_file_path).unlink(missing_ok=True)
            except Exception:
                pass  # Ignore cleanup errors


# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Check if we should use RAG
        if request.use_rag and request.session_id:
            # Use RAG for response
            rag_processor = get_or_create_rag_processor(request.session_id, request.api_key)
            response_text = rag_processor.query(request.user_message)
            
            # Create an async generator for streaming the RAG response
            async def generate_rag():
                # Simulate streaming by yielding the response in chunks
                chunk_size = 50
                for i in range(0, len(response_text), chunk_size):
                    yield response_text[i:i + chunk_size]
                    await asyncio.sleep(0.01)  # Small delay to simulate streaming
            
            return StreamingResponse(generate_rag(), media_type="text/plain")
        
        else:
            # Use regular OpenAI chat completion
            client = OpenAI(api_key=request.api_key)
            developer_prompt = classify_query_and_get_developer_prompt(request.user_message)

            # Create an async generator function for streaming responses
            async def generate():
                # Create a streaming chat completion request
                stream = client.chat.completions.create(
                    model=request.model,
                    messages=[
                        {"role": "system", "content": developer_prompt},
                        {"role": "user", "content": request.user_message}
                    ],
                    stream=True  # Enable streaming response
                )

                # Yield each chunk of the response as it becomes available
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content

            # Return a streaming response to the client
            return StreamingResponse(generate(), media_type="text/plain")

    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))


# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn

    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
