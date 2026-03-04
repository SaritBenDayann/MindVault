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
        # Building the context directly from the isolated user data
        context_msg = f"User's Mind Vault Account Email: '{mindvault_email}'.\n"
        
        if site or username:
            context_msg += f"URGENT CONTEXT: The user is CURRENTLY generating a password for the Site: '{site}', with the Username: '{username}'. You MUST tailor the password to this specific site and username.\n"
        else:
            context_msg += f"The user hasn't typed a specific site or username yet. Suggest a general strong password based on their profile.\n"
        
        if saved_sites:
            unique_sites = list(set(saved_sites))
            sites_str = ", ".join(unique_sites)
            context_msg += f"The user already has accounts on these sites: {sites_str}. Use this to understand their digital footprint.\n"

        system_instruction = (
            "You are a smart, personalized security assistant inside the Mind Vault password manager. "
            "Your role is to help the user generate strong, memorable passwords tailored specifically to them. "
            "Here is the context for the current user:\n"
            f"{context_msg}\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Always wrap the actual generated password in exactly these tags: [PASSWORD]P@ssw0rd123![/PASSWORD]. Do not use these tags for anything else.\n"
            "2. Explain your reasoning below the password in a SINGLE, SHORT PARAGRAPH. DO NOT use bullet points, numbered lists, or line breaks. Keep it brief, fluid, and concise. Explain how it connects to the requested Site, Username, or past sites.\n"
            "3. If the user asked for specific preferences in previous messages, you MUST follow those preferences.\n"
            "Keep your explanation friendly and in English."
        )
        
        formatted_history = []
        for msg in history:
            text = msg.get('text', '').strip()
            if not text:
                continue
                
            role = "user" if msg.get('role') == 'user' else "model"
            
            if not formatted_history and role == 'model':
                formatted_history.append(
                    types.Content(role="user", parts=[types.Part.from_text(text="I need a password suggestion based on my profile.")])
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
                return "I am receiving too many requests right now, Please try again later."
            return f"Sorry, there was an error communicating with the AI. Details: {error_details}"

llm_service = LLMService()