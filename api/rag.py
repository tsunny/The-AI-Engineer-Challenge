# %%
import PyPDF2
from typing import List


class PDFLoader:
    """
    A simple PDF loader that extracts text from PDF files.
    Similar to TextFileLoader but for PDF documents.
    """

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.documents = []

    def load_documents(self) -> List[str]:
        """
        Load and extract text from a PDF file.
        Returns a list containing the extracted text as a single document.
        """
        try:
            with open(self.file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""

                # Extract text from all pages
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"

                self.documents = [text]
                return self.documents

        except Exception as e:
            print(f"Error loading PDF: {e}")
            return []

    def load_documents_by_page(self) -> List[str]:
        """
        Load and extract text from a PDF file, returning each page as a separate document.
        This can be useful for maintaining page-level granularity.
        """
        try:
            with open(self.file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                documents = []

                # Extract text from each page separately
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text.strip():  # Only add non-empty pages
                        documents.append(f"Page {page_num + 1}:\n{page_text}")

                self.documents = documents
                return self.documents

        except Exception as e:
            print(f"Error loading PDF: {e}")
            return []


print("PDF Loader class created successfully!")

#%%
# Now let's load the PDF document using our PDFLoader
try:
    pdf_loader = PDFLoader(pdf_path)
    pdf_documents = pdf_loader.load_documents()

    print(f"Successfully loaded PDF with {len(pdf_documents)} document(s)")
    print(f"First 300 characters of the PDF content:")
    print(pdf_documents[0][:300] + "..." if len(pdf_documents[0]) > 300 else pdf_documents[0])

except Exception as e:
    print(f"Error loading PDF: {e}")
    print("Please make sure you have a valid PDF file and update the pdf_path variable above.")


# Create a vector database for our PDF documents
if pdf_split_documents:
    try:
        print("Creating vector database from PDF documents...")
        pdf_vector_db = VectorDatabase()
        pdf_vector_db = asyncio.run(pdf_vector_db.abuild_from_list(pdf_split_documents))

        print(f"Successfully created vector database with {len(pdf_vector_db.vectors)} vectors")
        print("PDF documents are now ready for semantic search!")

    except Exception as e:
        print(f"Error creating vector database: {e}")
        pdf_vector_db = None
else:
    print("No PDF documents to process. Please check the PDF loading steps above.")
    pdf_vector_db = None

if pdf_vector_db:
    print("Creating PDF RAG Pipeline...")
    print("=" * 50)

    # Create a RAG pipeline for PDF documents
    pdf_rag_pipeline = RetrievalAugmentedQAPipeline(
        vector_db_retriever=pdf_vector_db,
        llm=chat_openai,
        response_style="detailed",
        include_scores=True
    )

    # Test the complete RAG pipeline
    test_questions = [
        "What is DynamoDB?",
        "What are the core principles that DynamoDB is designed on?",
        "Explain how failure is detected in DynamoDB?"
    ]

    for question in test_questions:
        print(f"\nQuestion: {question}")
        print("-" * 40)

        try:
            result = pdf_rag_pipeline.run_pipeline(
                question,
                k=3,
                response_length="comprehensive"
            )

            print(f"Answer: {result['response']}")
            print(f"Sources used: {result['context_count']}")
            if result['similarity_scores']:
                print(f"Similarity scores: {result['similarity_scores']}")
            print("=" * 50)

        except Exception as e:
            print(f"Error processing question: {e}")
            print("=" * 50)

else:
    print("PDF vector database is not available. Please check the PDF processing steps above.")


# %%
class RetrievalAugmentedQAPipeline:
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

        formatted_system_prompt = rag_system_prompt.create_message(**system_params)

        user_params = {
            "user_query": user_query,
            "context": context_prompt.strip(),
            "context_count": len(context_list),
            "similarity_scores": f"Relevance scores: {', '.join(similarity_scores)}" if self.include_scores else ""
        }

        formatted_user_prompt = rag_user_prompt.create_message(**user_params)

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