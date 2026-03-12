import pdfplumber
import chromadb
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os

load_dotenv()

# ChromaDB client: stores vectors locally
chroma_client = chromadb.PersistentClient(path="backend/vectorstore")

# OpenAI Embeddings
embeddings = OpenAIEmbeddings(
    api_key=os.getenv("OPENAI_API_KEY"),
    model="text-embedding-3-small"
)


def extract_text_from_pdf(file_path: str) -> str:
    """Extracts text from a PDF file"""
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def store_document(text: str, doc_type: str, doc_id: str) -> str:
    """Splits text into chunks and stores embeddings in ChromaDB"""

    # Split text into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_text(text)

    # Get or create collection in ChromaDB
    collection = chroma_client.get_or_create_collection(name="interview_docs")

    # Create and store embeddings
    for i, chunk in enumerate(chunks):
        embedding = embeddings.embed_query(chunk)
        collection.add(
            ids=[f"{doc_id}_chunk_{i}"],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{"doc_type": doc_type, "doc_id": doc_id}]
        )

    return doc_id


def retrieve_relevant_chunks(query: str, doc_id: str, n_results: int = 3) -> str:
    """Retrieves the most relevant chunks for a given query"""

    collection = chroma_client.get_or_create_collection(name="interview_docs")
    query_embedding = embeddings.embed_query(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where={"doc_id": doc_id}
    )

    # Join chunks into a single context string
    chunks = results["documents"][0]
    return "\n\n".join(chunks)


def delete_document(doc_id: str) -> None:
    """Deletes all vectors for a document from ChromaDB"""
    try:
        collection = chroma_client.get_or_create_collection(name="interview_docs")
        results = collection.get(where={"doc_id": doc_id})
        if results["ids"]:
            collection.delete(ids=results["ids"])
    except Exception as e:
        print(f"Warning: Could not delete vectors for {doc_id}: {e}")