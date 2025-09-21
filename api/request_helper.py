import os
import sys

# Add current directory to Python path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from prompt_templates import EDUCATIONAL_PROMPT, SUMMARIZATION_PROMPT, MATH_PROBLEM_PROMPT, CREATIVE_WRITING_PROMPT, \
    DEFAULT_PROMPT


def classify_query_and_get_developer_prompt(user_message: str):
    keywords = user_message.lower()

    if any(word in keywords for word in ['explain', 'what is', 'how does', 'eli5']):
        return EDUCATIONAL_PROMPT
    elif any(word in keywords for word in ['summary', 'summarize', 'key points']):
        return SUMMARIZATION_PROMPT
    elif 'story' in keywords or 'creative' in keywords:
        return CREATIVE_WRITING_PROMPT
    elif any(word in keywords for word in ['calculate', 'math', 'solve']):
        return MATH_PROBLEM_PROMPT
    else:
        return DEFAULT_PROMPT
