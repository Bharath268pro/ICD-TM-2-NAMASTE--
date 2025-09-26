from flask import Flask, jsonify, request
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Load the local mapping database
# In a real app, this would be a more robust database connection,
# but for demonstration, we'll load a JSON file.
with open('mapping.json', 'r') as f:
    local_mapping = json.load(f)

# Mock external API functions (these are placeholders)
def get_icd11_codes(query):
    # This function would call the real ICD-11 API.
    # We are returning mock data for demonstration.
    if "amavata" in query.lower():
        return [{"code": "MG00.1", "display": "Rheumatoid arthritis"}]
    if "fever" in query.lower():
        return [{"code": "MG10.0", "display": "Fever of unknown origin"}]
    return []

def get_namaste_codes(query):
    # This function would call the real NAMASTE API.
    # We are returning mock data for demonstration.
    if "amavata" in query.lower():
        return [{"code": "AY-A01.0", "display": "Amavata"}]
    if "fever" in query.lower():
        return [{"code": "AY-B01.1", "display": "Jvara (Fever)"}]
    return []

@app.route('/api/search-codes', methods=['GET'])
def search_codes():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    # 1. Fetch raw data from both external APIs
    icd11_results = get_icd11_codes(query)
    namaste_results = get_namaste_codes(query)

    # 2. Find similarities using the local mapping
    matched_suggestions = []
    
    # Iterate through the NAMASTE results and find their ICD-11 match
    for namaste_item in namaste_results:
        for mapping in local_mapping:
            if mapping['namaste_code'] == namaste_item['code']:
                # Found a match! Create a combined suggestion.
                matched_suggestions.append({
                    "suggestion_id": f"{namaste_item['code']}-{mapping['icd11_code']}",
                    "namaste_diagnosis": namaste_item,
                    "icd11_diagnosis": {
                        "code": mapping['icd11_code'],
                        "display": mapping['display']['icd11']
                    },
                    "confidence": mapping['confidence']
                })
                break
    
    # 3. Handle cases where there is no pre-defined mapping (for new codes)
    # You would also return the raw, unmatched codes here.
    
    return jsonify(matched_suggestions)

if __name__ == '__main__':
    app.run(debug=True)
