import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(__file__))
dotenv_path = os.path.join(base_dir, '.env')
load_dotenv(dotenv_path)

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is missing in .env")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = 'gemini-2.5-flash'

    def generate_password_suggestion(self, user_prompt, site, username, history, saved_sites, mindvault_email):
        # Organizing the data into strict variables
        sites_str = ", ".join(list(set(saved_sites))) if saved_sites else "None yet"
        target_site = site if site else "Not specified yet"
        target_username = username if username else "Not specified yet"
        
        # Using a very strict, structured format so the AI cannot ignore the context
        system_instruction = (
            "You are the Mind Vault AI Security Assistant. Your job is to generate highly personalized, secure passwords. "
            "You MUST base the password on the following exact user context:\n\n"
            f"- User's Email: {mindvault_email}\n"
            f"- Previously Saved Sites: {sites_str}\n"
            f"- CURRENT Target Site: {target_site}\n"
            f"- CURRENT Target Username: {target_username}\n\n"
            "CRITICAL RULES:\n"
            "1. ALWAYS wrap the generated password in exactly these tags: [PASSWORD]your_password_here[/PASSWORD].\n"
            "2. EXPLAIN your reasoning in exactly ONE SHORT PARAGRAPH. Explicitly name the specific parts of the Email, Saved Sites, Target Site, or Target Username you used to create the password.\n"
            "3. If the user stated preferences in previous messages, apply them strictly."
        )
        
        formatted_history = []
        for msg in history:
            text = msg.get('text', '').strip()
            if not text:
                continue
                
            role = "user" if msg.get('role') == 'user' else "model"
            
            if not formatted_history and role == 'model':
                formatted_history.append(
                    types.Content(role="user", parts=[types.Part.from_text(text="I need a password suggestion.")])
                )
                
            formatted_history.append(
                types.Content(
                    role=role, 
                    parts=[types.Part.from_text(text=text)]
                )
            )
            
        try:
            chat = self.client.chats.create(
                model=self.model_id,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction
                ),
                history=formatted_history
            )
            
            response = chat.send_message(user_prompt)
            return response.text
            
        except Exception as e:
            error_details = str(e)
            print(f"LLM Chat Error Details: {error_details}")
            if "429" in error_details or "RESOURCE_EXHAUSTED" in error_details:
                return "I am receiving too many requests right now, Please wait about a minute and try again."
            return f"Sorry, there was an error communicating with the AI. Details: {error_details}"

llm_service = LLMService()