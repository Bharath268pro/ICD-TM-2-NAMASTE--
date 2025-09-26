const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());

// --- Configuration (from .env file) ---
const ICD11_API_URL = process.env.ICD11_API_URL;
const ICD11_CLIENT_ID = process.env.ICD11_CLIENT_ID;
const ICD11_CLIENT_SECRET = process.env.ICD11_CLIENT_SECRET;

const NAMASTE_API_URL = process.env.NAMASTE_API_URL;
const NAMASTE_API_KEY = process.env.NAMASTE_API_KEY;

const EMR_API_URL = process.env.EMR_API_URL;
const EMR_API_KEY = process.env.EMR_API_KEY;

// --- Local Mapping Database (Hardcoded for demonstration) ---
// In a production environment, this would be a separate database.
const localMapping = [
  {
    "namaste_code": "AY-A01.0",
    "icd11_code": "MG00.1",
    "confidence": 0.95,
    "display": {
      "namaste": "Amavata",
      "icd11": "Rheumatoid arthritis"
    }
  },
  {
    "namaste_code": "AY-B01.1",
    "icd11_code": "MG10.0",
    "confidence": 0.90,
    "display": {
      "namaste": "Jvara (Fever)",
      "icd11": "Fever of unknown origin"
    }
  }
];

// --- Helper Functions for API Calls ---

/**
 * Conceptual function to search ICD-11 TM2 for codes.
 * You will need to replace this with the actual ICD-11 API call logic,
 * including OAuth 2.0 authentication to get an access token.
 */
const getICD11Codes = async (query) => {
    try {
        // Placeholder for authentication and API request.
        // You would first get an auth token, then make a request with it.
        const headers = {
            'Authorization': 'Bearer your_actual_access_token',
            'Accept-Language': 'en',
            'API-Version': 'v2',
        };
        const params = { q: query, useFlexisearch: 'true' };
        // Placeholder for the actual search endpoint for TM2
        const response = await axios.get(`${ICD11_API_URL}search`, { headers, params });
        return response.data.destinationEntities || [];
    } catch (error) {
        console.error(`Error fetching ICD-11 codes: ${error.message}`);
        return [];
    }
};

/**
 * Conceptual function to search the NAMASTE portal for codes.
 * This is a placeholder as the NAMASTE API is not publicly documented.
 */
const getNAMASTECodes = async (query) => {
    try {
        const headers = { 'X-API-Key': NAMASTE_API_KEY };
        const params = { query };
        // Assuming a search endpoint exists
        const response = await axios.get(`${NAMASTE_API_URL}search`, { headers, params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching NAMASTE codes: ${error.message}`);
        return [];
    }
};

/**
 * Conceptual function to submit a diagnosis to an EMR system.
 * The payload must be formatted to comply with Indian EHR standards.
 */
const submitDiagnosisToEMR = async (patientData) => {
    try {
        const headers = {
            'Authorization': `Bearer ${EMR_API_KEY}`,
            'Content-Type': 'application/json'
        };
        // Assuming an endpoint for submitting patient records exists
        const response = await axios.post(`${EMR_API_URL}diagnosis`, patientData, { headers });

        if (response.status === 201) {
            return { status: 'success', message: 'Diagnosis submitted successfully' };
        } else {
            return { status: 'error', message: 'Failed to submit diagnosis' };
        }
    } catch (error) {
        console.error(`EMR submission failed: ${error.message}`);
        return { status: 'error', message: 'Internal server error' };
    }
};

/**
 * Finds a matching ICD-11 code for a given NAMASTE code from the local mapping database.
 */
const findMatchingCode = (namasteCode) => {
    return localMapping.find(item => item.namaste_code === namasteCode);
};

// --- API Endpoints ---

app.get('/api/search-codes', async (req, res) => {
    /**
     * Endpoint to search for medical codes across both ICD-11 TM2 and NAMASTE.
     */
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const [icd11Results, namasteResults] = await Promise.all([
        getICD11Codes(query),
        getNAMASTECodes(query)
    ]);

    // Perform the matching and consolidation logic here
    const matchedSuggestions = [];
    const namasteMap = new Map(namasteResults.map(item => [item.code, item]));
    const icd11Map = new Map(icd11Results.map(item => [item.code, item]));

    // Iterate through the local mapping to find matches
    localMapping.forEach(mapping => {
      // Check if both NAMASTE and ICD-11 codes from the mapping exist in our search results
      if (namasteMap.has(mapping.namaste_code) && icd11Map.has(mapping.icd11_code)) {
        matchedSuggestions.push({
          suggestion_id: `${mapping.namaste_code}-${mapping.icd11_code}`,
          namaste_diagnosis: namasteMap.get(mapping.namaste_code),
          icd11_diagnosis: icd11Map.get(mapping.icd11_code),
          confidence: mapping.confidence
        });
      }
    });

    res.json({
        matchedSuggestions,
        rawIcd11Results: icd11Results, // Optionally return raw results for unmapped items
        rawNamasteResults: namasteResults
    });
});


app.post('/api/submit-patient-record', async (req, res) => {
    /**
     * Endpoint to submit a new patient record with dual-coded diagnoses.
     */
    const data = req.body;
    if (!data || !data.patientId || !data.namasteDiagnosis || !data.icd11Code) {
        return res.status(400).json({ error: "Missing required patient data" });
    }

    // This payload is conceptual and must be structured according to
    // the target EMR's API and India's EHR standards.
    const patientPayload = {
        patientId: data.patientId,
        encounterDate: data.encounterDate,
        diagnoses: [
            {
                system: "NAMASTE",
                code: data.namasteDiagnosis.code,
                display: data.namasteDiagnosis.display,
            },
            {
                system: "ICD11-TM2",
                code: data.icd11Code.code,
                display: data.icd11Code.display,
            },
        ],
    };

    const result = await submitDiagnosisToEMR(patientPayload);
    if (result.status === 'success') {
        res.status(201).json(result);
    } else {
        res.status(500).json(result);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
