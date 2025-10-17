import os
import sys
from openai import OpenAI

# Check for the required environment variables
if "OPENAI_API_KEY" not in os.environ:
    sys.exit("Error: OPENAI_API_KEY environment variable not set.")
if "ISSUE_TITLE" not in os.environ:
    sys.exit("Error: ISSUE_TITLE environment variable not set.")
if "ISSUE_BODY" not in os.environ:
    sys.exit("Error: ISSUE_BODY environment variable not set.")

# Initialize the OpenAI client
try:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
except Exception as e:
    sys.exit(f"Error initializing OpenAI client: {e}")

# Get issue details from environment variables
issue_title = os.environ.get("ISSUE_TITLE")
issue_body = os.environ.get("ISSUE_BODY")
repo_name = os.environ.get("GITHUB_REPOSITORY", "this repository") # Default value if not set

# --- This is the prompt engineering part ---
# You can customize this prompt to define your agent's personality and instructions.
system_prompt = "You are a helpful assistant for the GitHub repository {repo_name}. Your goal is to provide a helpful first response to a newly created issue. Be concise and welcoming. Do not wrap your response in code blocks."

user_content = f"Issue Title: {issue_title}\n\nIssue Body:\n{issue_body}"

# Call the OpenAI API
try:
    response = client.chat.completions.create(
        model="gpt-3.5-turbo", # You can change the model if you wish
        messages=[
            {"role": "system", "content": system_prompt.format(repo_name=repo_name)},
            {"role": "user", "content": user_content}
        ]
    )
    # Extract and print the response content
    ai_response = response.choices[0].message.content
    print(ai_response)

except Exception as e:
    sys.exit(f"Error calling OpenAI API: {e}")

