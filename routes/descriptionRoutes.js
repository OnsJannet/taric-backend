const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Import the correct class
require("dotenv").config(); // Load environment variables
const axios = require("axios");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const router = express.Router();

let goodsData = [];

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load TARIC data from the given URL
const loadGoodsData = async () => {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/OnsJannet/taric-backend/e529cf1b638f3b03a4b32d4716ea7d09d7802a81/taric.json"
    );
    const parsedData = response.data;
    goodsData = parsedData.Sheet1 || [];
  } catch (error) {
    console.error("Error fetching taric.json:", error);
  }
};

// Additional data storage
const additionalData = {
  en: [],
  it: [],
};

// Load additional language-specific data
const loadAdditionalData = async () => {
  try {
    const enResponse = await axios.get(
      "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/scraped_data_en.json"
    );
    const itResponse = await axios.get(
      "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/scraped_data_it.json"
    );

    additionalData.en = enResponse.data || [];
    additionalData.it = itResponse.data || [];
  } catch (error) {
    console.error("Error fetching additional data:", error);
  }
};

// Middleware to load TARIC data
const loadDataMiddleware = async (req, res, next) => {
  await loadGoodsData();
  await loadAdditionalData();
  next();
};

// Initialize Google Generative AI instance
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Helper function to get data by language
const getDataByLanguage = (language) =>
  language === "it" ? additionalData.it : additionalData.en;

// AI function to determine the TARIC code using the generative model
const getTaricCode = async (term) => {
  try {
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );
    const response = await model.generateText({
      prompt: `Find the 4-digit TARIC code for the product: ${term}`,
    });
    return response.data.text.trim();
  } catch (error) {
    console.error("Error fetching TARIC code from the model:", error);
    return null;
  }
};

// Endpoint to handle TARIC code queries
router.post("/get-taric-details", loadDataMiddleware, async (req, res) => {
  const { term, language } = req.body;

  // Input validation
  if (!term || !language) {
    return res
      .status(400)
      .json({ error: "Both term and language are required." });
  }

  try {
    // Step 1: Get the TARIC code based on the provided term
    const taricCode = await getTaricCode(term);

    if (!taricCode) {
      return res
        .status(404)
        .json({ error: "No TARIC code found for the given term." });
    }

    // Step 2: Load language-specific data
    const scrapedData = getDataByLanguage(language);

    // Step 3: Find matching subheadings for the TARIC code
    const relevantSubheadings = scrapedData.filter((item) =>
      item.code.startsWith(taricCode)
    );

    if (relevantSubheadings.length === 0) {
      return res
        .status(404)
        .json({ error: "No matching subheadings found for the TARIC code." });
    }

    // Step 4: Structure response with questions based on relevant subheadings
    const questions = relevantSubheadings.map((sub) => ({
      question: `Does your product fall under "${sub.description}"?`,
      options: [
        {
          code: sub.code,
          description: sub.description,
        },
      ],
    }));

    // Send the final response back with TARIC code and relevant questions
    res.json({
      taricCode,
      chapter: taricCode.substring(0, 2),
      heading: taricCode,
      questions,
    });
  } catch (error) {
    console.error("Error processing TARIC details request:", error);
    res.status(500).json({
      error: "An internal error occurred while processing your request.",
    });
  }
});

// POST route to get word from description
router.post("/get-word", async (req, res) => {
  try {
    const { description, language } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    let textToProcess;
    console.log("description: " + description);

    // Use the description based on the provided language
    if (language === "it") {
      textToProcess = description; // The original description in Italian
    } else if (language === "en") {
      textToProcess = description; // The original description in English
    } else {
      return res.status(400).json({ error: "Unsupported language" });
    }

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Specify the model
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Generate content based on the description
    //const prompt = `Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci le seguenti informazioni in modo dettagliato:\n\n1. Una sola parola che descrive meglio l'oggetto (es. "appendiabiti" o "hanger").\n2. Un elenco di codici di famiglia TARIC (6 cifre) associati ai materiali descritti (legno, plastica, metallo), separati da virgole. Se nella descrizione ci sono materiali specifici, aggiungi i loro codici TARIC. I codici devono essere privi di punti (.) e consistenti di 6 cifre.\n3. Un elenco di suggerimenti abbinati (12 cifre) corrispondenti a quei codici di famiglia, separati da virgole. Anche i suggerimenti devono essere privi di punti (.) e consistenti di 12 cifre.\n\nDescrizione: "${textToProcess}".\n\nFormatta la risposta come segue:\n\nword: [la parola]\nFamily: [elenco di codici di famiglia a 4 cifre, senza punti]\nMatched Suggestion: [elenco di suggerimenti abbinati a 12 cifre, senza punti]. Assicurati di fornire tutte le informazioni richieste e di includere i codici dei materiali se presenti.`;
    const prompt = `Basato sulla seguente descrizione ${
      language === "it" ? "in italiano" : "in inglese"
    }, fornisci una frase che descrive l'oggetto utilizzando il termine corretto e includendo tutti i materiali specifici in un elenco. Ad esempio, se l'oggetto è un appendiabiti di plastica o di metallo, rispondi "Appendiabiti di legno, materiale plastico, metallo".\n\nDescrizione: "${textToProcess}".\n\nFormatta la risposta come segue:\n\n"[la frase completa con il termine corretto e i materiali in un elenco separato da virgole]". Assicurati di includere tutti i materiali menzionati nella descrizione e di fornire la risposta nel formato richiesto.`;

    //const prompt = `Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci una frase che descrive l'oggetto utilizzando il termine corretto e includendo i materiali specifici. Ad esempio, se l'oggetto è un appendiabiti di plastica o di metallo, rispondi "Appendiabiti di materiale plastico o di metallo".\n\nDescrizione: "${textToProcess}".\n\nRispondi con la seguente struttura:\n\n"word e material: [la frase completa]". Assicurati di fornire tutte le informazioni richieste.`;

    const result = await model.generateContent([prompt]);

    // Get the generated response
    const responseText = result.response.text().trim(); // Trim any whitespace

    // Process the response to extract the desired fields
    const lines = responseText.split("\n").reduce((acc, line) => {
      const [key, value] = line.split(":").map((item) => item.trim());
      if (key && value) {
        acc[key] = value.split(",").map((item) => item.trim());
      }
      return acc;
    }, {});

    // Return the structured response
    /*res.json({
      word: lines.word ? lines.word.join(', ') : '', // Join array if more than one word
      Family: lines.Family || [],
      'Matched Suggestion': lines['Matched Suggestion'] || []
    });*/
    res.json({ responseText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Define calculateScore function
function calculateScore(code, description) {
  // Example scoring logic
  if (description.includes(code)) {
    return 100; // Perfect match
  } else {
    return 50; // Partial match
  }
}

router.post("/get-taric-codes", async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate the input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    let textToProcess = description;

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Updated prompt to include the necessary instruction for code and description display
    const prompt = `
    Basato sulla seguente descrizione ${
      language === "it" ? "in italiano" : "in inglese"
    }, fornisci le seguenti informazioni:
  
    1. Una frase che descrive l'oggetto e i materiali utilizzati.
    2. Elenca i codici di famiglia TARIC (6 cifre) associati ai materiali.
    3. Elenca i suggerimenti abbinati (12 cifre) corrispondenti a questi codici.
    4. Aggiungi altri codici TARIC simili ai precedenti e vicini nella classificazione.
    
    Descrizione: "${textToProcess}". 
  
    Formatta la risposta come segue:
  
    word: [la frase]
    Family: [codici di famiglia a 6 cifre]
    Descriptions: [descrizioni per ciascun codice TARIC]
    Matched Suggestion: [suggerimenti abbinati a 12 cifre]
    Descriptions: [descrizioni per ciascun suggerimento]
    Possible Other Codes: [altri codici TARIC più vicini]
    Descriptions: [descrizioni per gli altri codici TARIC].
  `;

    // Fetch response from the model
    const result = await model.generateContent([prompt]);
    let responseText = result.response.text().trim();
    console.log("responseText: " + responseText);

    // Remove the "Note" section if present
    responseText = responseText.replace(/(\*\*Note:\*\*)([\s\S]*)/, "");

    // Clean up formatting (remove unnecessary markdown and line breaks)
    responseText = responseText.replace(/\*\*|\*\*/g, ""); // Remove bold formatting
    responseText = responseText.replace(/(\*\s*)|(\*\*\s*)/g, ""); // Remove asterisks from list items
    responseText = responseText.replace(/\n\n+/g, "\n"); // Replace multiple newlines with a single newline

    // Split the responseText to create a more structured response
    const sections = responseText.split("Family:")[1].split("Descriptions:");
    const familyCodes = sections[0]
      ? sections[0]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];
    const descriptions = sections[1]
      ? sections[1]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];

    const matchedSuggestions = sections[2]
      ? sections[2]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];
    const suggestionDescriptions = sections[3]
      ? sections[3]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];

    const otherCodes = sections[4]
      ? sections[4]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];
    const otherDescriptions = sections[5]
      ? sections[5]
          .trim()
          .split("\n")
          .map((line) => line.trim())
      : [];

    // Prepare the response as a JSON list
    const family = familyCodes.map((code, index) => {
      return {
        code,
        score: calculateScore(code, descriptions[index]), // Add a score based on some calculation
        description: descriptions[index] || "No description available",
      };
    });

    // Add matched suggestions and their descriptions
    const suggestions = matchedSuggestions
      .map((suggestion, index) => {
        // Only include valid codes (12 digits)
        if (/^\d{12}$/.test(suggestion)) {
          return {
            suggestion,
            score: calculateScore(suggestion, suggestionDescriptions[index]), // Add a score based on some calculation
            description:
              suggestionDescriptions[index] || "No description available",
          };
        }
      })
      .filter(Boolean); // Filter out any undefined (invalid codes)

    // Add other possible codes and their descriptions
    const otherSuggestions = otherCodes.map((code, index) => {
      return {
        code,
        description: otherDescriptions[index] || "No description available",
      };
    });

    // Send the response back as JSON
    res.json({
      family, // main TARIC codes and descriptions
      suggestions, // matched suggestions with valid codes and descriptions
      otherSuggestions, // other possible codes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Endpoint to get suggested terms
router.post("/get-suggested-terms", async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    let textToProcess = description;

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Generate suggestions for terms with materials, uses, and category
    const suggestionPrompt = `
    Given the product description, provide suggested terms for classification, along with relevant details about each term in ${
      language === "it" ? "Italian" : "English"
    }.

    - Translate terms, categories, materials, and uses to ${
      language === "it" ? "Italian" : "English"
    } where appropriate.
    - Use only the description given without adding "term" or other text.

    Description: "${textToProcess}"

    Response format (in JSON):
    {
      "suggestedTerms": [
        {
          "term": "Suggested term in ${
            language === "it" ? "Italian" : "English"
          }",
          "category": "Product category (e.g., Household item, Beverage, Electronics, etc.) in ${
            language === "it" ? "Italian" : "English"
          }",
          "materials": "Main materials (e.g., metal, plastic, milk, coffee) in ${
            language === "it" ? "Italian" : "English"
          }",
          "uses": "Main uses (e.g., consumption, cooking, industrial use) in ${
            language === "it" ? "Italian" : "English"
          }"
        }
      ]
    }

    just give me 1 word answer when it comes to the term
    
    Only respond with the JSON structure, filled out based on the description provided, in ${
      language === "it" ? "Italian" : "English"
    }.
    `;

    // Fetch suggestions from the model
    const suggestionResult = await model.generateContent([suggestionPrompt]);
    let suggestionResponseText = suggestionResult.response.text().trim();

    // Log the raw response from the model for debugging
    console.log("Raw suggestion response:", suggestionResponseText);

    // Clean up formatting by removing any code block markers (` ```json ... ``` `)
    suggestionResponseText = suggestionResponseText
      .replace(/```json|```/g, "") // Remove markdown code block syntax
      .trim(); // Trim leading/trailing whitespace

    // Parse JSON response to extract suggested terms
    let suggestedTerms;
    try {
      suggestedTerms = JSON.parse(suggestionResponseText).suggestedTerms;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return res.status(400).json({
        error:
          "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Log the final suggested terms for debugging
    console.log("Suggested terms:", suggestedTerms);

    // Send the suggested terms back as JSON
    res.json({ suggestedTerms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-term-definition", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    // Initialize the model
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Prompt for generating the term definition
    const definitionPrompt = `
    Provide a concise definition (a short paragraph) for the given term in ${
      language === "it" ? "Italian" : "English"
    }. The definition should be simple, clear, and suitable for general understanding.

    Term: "${term}"

    Response format (in JSON):
    {
      "definition": "Definition of the term in ${
        language === "it" ? "Italian" : "English"
      }"
    }

    Only respond with the JSON structure, filled out based on the term provided.
    `;

    // Fetch the definition from the model
    const definitionResult = await model.generateContent([definitionPrompt]);
    let definitionResponseText = definitionResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Raw definition response:", definitionResponseText);

    // Clean up formatting by removing any code block markers
    definitionResponseText = definitionResponseText
      .replace(/```json|```/g, "")
      .trim();

    // Parse JSON response to extract the definition
    let definition;
    try {
      definition = JSON.parse(definitionResponseText).definition;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return res.status(400).json({
        error:
          "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Log the final definition for debugging
    console.log("Term definition:", definition);

    // Send the term definition back as JSON
    res.json({ term, definition });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-taric-summary", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    // Initialize the model
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Prompt for generating the TARIC code summary
    const definitionPrompt = `
    Provide a detailed overview of the TARIC code for the given product. Include the following elements:  
    0. Please alwawys mention the product
    1. A general explanation that the TARIC code for the product depends on its composition, characteristics, and materials used.  


    Term: "${term}"

    Response format (in JSON):
    {
      "definition": "Definition of the term in ${
        language === "it" ? "Italian" : "English"
      }"
    }

    Only respond with the JSON structure, filled out based on the term provided make sure to alwawys return the json above.
    `;

    // Fetch the definition from the model
    const definitionResult = await model.generateContent([definitionPrompt]);
    let definitionResponseText = definitionResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Raw definition response:", definitionResponseText);

    // Clean up formatting by removing any code block markers
    definitionResponseText = definitionResponseText
      .replace(/```json|```/g, "")
      .trim();

    // Parse JSON response to extract the definition
    let definition;
    try {
      definition = JSON.parse(definitionResponseText).definition;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return res.status(400).json({
        error:
          "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Log the final definition for debugging
    console.log("Term definition:", definition);

    // Send the term definition back as JSON
    res.json({ term, definition });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-suggested-taric-codes", async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    let textToProcess = description;

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Generate TARIC code suggestions based on the specified language
    const languagePrompts = {
      it: `
      In base alla seguente descrizione, genera i migliori codici TARIC possibili in italiano,
      con lunghezze variabili (4, 8, 10, 12 e 16). Ogni codice TARIC dovrebbe essere la classificazione 
      più accurata per questo articolo in Italia.

      Descrizione: "${textToProcess}".

      Fornisci i codici TARIC in questo formato:
      - Codice TARIC a 4 cifre: XXXX
      - Codice TARIC a 8 cifre: XXXXXXXX
      - Codice TARIC a 10 cifre: XXXXXXXXXX
      - Codice TARIC a 12 cifre: XXXXXXXXXXXX
      - Codice TARIC a 16 cifre: XXXXXXXXXXXXXXXX

      Assicurati che questi codici siano accurati per la descrizione fornita.
      `,
      en: `
      Based on the following description, please generate the best possible TARIC codes in English,
      with varying digit lengths (4, 8, 10, 12, and 16). Each TARIC code should be the most accurate 
      classification for this item in Italy.

      Description: "${textToProcess}".

      Provide the TARIC codes in this format:

      - 4-digit TARIC code: XXXX
      - 8-digit TARIC code: XXXXXXXX
      - 10-digit TARIC code: XXXXXXXXXX
      - 12-digit TARIC code: XXXXXXXXXXXX
      - 16-digit TARIC code: XXXXXXXXXXXXXXXX

      Please ensure these codes are accurate for the given description.
      `,
    };

    const taricPrompt = languagePrompts[language];

    // Fetch TARIC code suggestions from the model
    const taricResult = await model.generateContent([taricPrompt]);
    let taricResponseText = taricResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Raw TARIC response:", taricResponseText);

    // Extract TARIC codes
    const taricCodes = {
      fourDigit:
        taricResponseText.match(
          /(?:Codice TARIC a 4 cifre|4-digit TARIC code):\s*(\d{4})/
        )?.[1] || null,
      eightDigit:
        taricResponseText.match(
          /(?:Codice TARIC a 8 cifre|8-digit TARIC code):\s*(\d{8})/
        )?.[1] || null,
      tenDigit:
        taricResponseText.match(
          /(?:Codice TARIC a 10 cifre|10-digit TARIC code):\s*(\d{10})/
        )?.[1] || null,
      twelveDigit:
        taricResponseText.match(
          /(?:Codice TARIC a 12 cifre|12-digit TARIC code):\s*(\d{12})/
        )?.[1] || null,
      sixteenDigit:
        taricResponseText.match(
          /(?:Codice TARIC a 16 cifre|16-digit TARIC code):\s*(\d{16})/
        )?.[1] || null,
    };

    // Log the final TARIC codes for debugging
    console.log("TARIC codes:", taricCodes);

    // Send the TARIC codes back as JSON
    res.json({ taricCodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Endpoint to get TARIC codes for the selected suggestion
router.post("/get-taric-code-questions", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("Language: " + language);
    console.log("Term: " + term);

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Define the prompt for generating detailed TARIC-specific questions
    const questionPrompt = `
      Given the following term, create a series of questions to determine the appropriate TARIC code. 
      Ask these questions in ${language === "it" ? "Italian" : "English"}.

      The questions should cover all critical aspects needed for TARIC classification, including:
      - Physical properties (material composition, dimensions, weight, etc.)
      - Functional characteristics (usage, intended recipient, consumption type, etc.)
      - Any required technical specifics (e.g., voltage for electronics, alcohol content for beverages)
      - Regulatory requirements (e.g., whether the product meets safety standards)
      
      For each term, tailor questions to what is typical for that type of product as per TARIC code specifications. 
      Here are a few examples of specific criteria you might use:
      - For textiles: "What material is used?", "Is it intended for household or industrial use?"
      - For electronics: "What is the voltage requirement?", "Is it used for personal or industrial purposes?"
      - For vehicles: "What type of vehicle?", "Is it for cargo or passenger transport?"
      - For chemicals: "What is the composition?", "Is it classified as hazardous?"

      Ask me about:
        - Customs Duties and VAT: Specific customs duties based on percentage values or duty percentage requirements.
        - Origin of Goods: Preferential tariffs or local content percentages that may impact the classification.
        - Composition of Goods: Material composition or percentage of each component for composite goods.
        - Specific Exemptions: Any exemptions based on environmental impact, production methods, or other characteristics.
        - Product Classification Criteria: Details like percentage weight, volume, or other ingredient characteristics that affect classification.
        - Mixed Goods: Percentage breakdown for goods that fall into multiple categories.
        - Value Thresholds: Any applicable value or quantity thresholds impacting the rate or code.
        

      For yes or no questions please don't give suggestions of simply yes or no but  give the entire phrase

      Format the questions in JSON like this:

      {
        "questions": [
          {
            "question": "1. What is the primary material of the product?",
            "answers": [
              {
                "answer": "Metal"
              },
              {
                "answer": "Plastic"
              },
              {
                "answer": "Wood"
              }
            ]
          }
        ]
      }

      Term: "${term}"

      Ensure questions are detailed, relevant to TARIC classification, and answer options are provided in complete phrases (e.g., "Yes, it is for industrial use"). If the product requires specific classification points, make sure to ask about them.
    `;

    // Fetch questions from the model
    const questionsResult = await model.generateContent([questionPrompt]);
    const questionsText = questionsResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Generated Questions:", questionsText);

    // Clean and parse the generated JSON
    let parsedQuestions;
    try {
      const cleanedText = questionsText
        .replace(/```json/, "") // Remove opening ```json
        .replace(/```/, "") // Remove closing ```
        .replace(/\\n/g, "") // Remove newline escape characters
        .trim();

      parsedQuestions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return res.status(400).json({
        error:
          "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Process and reformat the questions and answers
    const structuredQuestions = parsedQuestions.questions.map((q) => ({
      question: q.question,
      answers: q.answers.map((a) => a), // Return the original answer without any formatting
    }));

    // Send the structured questions back as JSON
    res.json({ questions: structuredQuestions });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-dynamic-taric-code-questions", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("Language:", language);
    console.log("Term:", term);

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Adjusted Prompt
    const prompt = `
  Given the term "${term}", identify the most accurate and up-to-date TARIC codes, including the full hierarchy from chapter to the deepest subheadings in the current TARIC database (for today's date). Each TARIC code's description should be as detailed as possible, including attributes like product type, contents, preparation methods, and any defining features (e.g., fat content, added ingredients) specific to that TARIC code.

  Break down the code structure into the following levels:

  1. **Chapter**: Determine the correct TARIC chapter based on the term in ${
    language === "it" ? "Italian" : "English"
  }.
  2. **Heading**: Include all available heading within that chapter in ${
    language === "it" ? "Italian" : "English"
  }.
  3. **Subheading**: Include all available subheadings under that heading in ${
    language === "it" ? "Italian" : "English"
  }.
  4. **Sub-Subheading**: Include all available sub-subheadings under each subheading in ${
    language === "it" ? "Italian" : "English"
  }.
  5. **Detailed Codes**: For each detailed code, include the exact description from the TARIC database, ensuring full specificity for the product classification. For example, “04032031” should yield: “Yogurts containing added sugar or other sweetening matter, but not flavoured or containing added fruit, nuts, cocoa, chocolate, spices, coffee, plants, cereals or bakery products, of a fat content by weight of ≤ 3%.” in 

  For the Detailed Codes if it's in english and ${
    language === "it"
  } please translate it to italian
  For each level, generate specific questions to help refine the classification and ensure accuracy. Structure the questions in ${
    language === "it" ? "Italian" : "English"
  } and return only JSON in the following format without any additional text:
  Please Make sure that if language === "it" all of the result should be in italian else if language === "en" the result should be in english
  Please use the latest taric code database make sure the data is updated as September 24, 2024
  use this as source: https://taxation-customs.ec.europa.eu/customs-4/calculation-customs-duties/customs-tariff/eu-customs-tariff-taric_en
  use it with the latest update
  
  {
    "chapter": "XX",
    "heading": "XXXX",
    "year": "Database Version",
    "source": "information source",
    "subheadings": [
      {
        "subheading": "XXXX.XX",
        "sub-subheadings": [
          { 
            "sub-subheading": "XXXX.XX.XX",
            "detailed-codes": [
              { "code": "XXXX.XX.XX.XX", "description": "Full specific description as found in TARIC database" },
              { "code": "XXXX.XX.XX.XX", "description": "Full specific description as found in TARIC database" }
            ]
          }
        ],
        "questions": [
          {
            "question": "Does the product include [specific attribute]?",
            "answers": [
              { "answer": "Yes, it includes [attribute]" },
              { "answer": "No, it does not include [attribute]" }
            ]
          }
        ]
      }
    ],
    "questions": [
      {
        "question": "Which subheading best describes the product?",
        "answers": [
          { "answer": "Subheading XXXX.XX - Description" },
          { "answer": "Subheading XXXX.XX - Description" }
        ]
      }
    ]
  }
`;

    // Fetch the generated response from the model
    const response = await model.generateContent([prompt]);
    let responseText = response.response.text().trim();

    // Remove potential markdown code blocks
    responseText = responseText.replace(/```json|```/g, "").trim();

    // Log the raw response for debugging
    console.log("Generated Response:", responseText);

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "Error parsing JSON:",
        parseError,
        "Response text:",
        responseText
      );

      // Attempt to clean up and re-parse if JSON format is incorrect
      const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Extract JSON
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error("Second parsing attempt failed:", secondParseError);
          return res.status(400).json({
            error:
              "Invalid JSON format returned from model. Please check the model response.",
          });
        }
      } else {
        return res.status(400).json({
          error: "Unable to find JSON structure in model response.",
        });
      }
    }

    // Send the structured questions and classification information back as JSON
    res.json(parsedResponse);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-dynamic-taric-code-questions-gemini", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("Language:", language);
    console.log("Term:", term);

    // Initialize the model
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Adjusted Prompt
    const prompt = `
      Given the term "${term}", identify the most accurate and up-to-date TARIC codes, including the complete hierarchy from the chapter level down to the deepest subheadings and detailed codes available in the current TARIC database as of today’s date. Ensure that all levels are fully populated and structured, displaying each chapter, heading, subheading, sub-subheading, and detailed codes relevant to the term.

      Break down the code structure with the following requirements:

      1. **Chapter**: Find the chapter based on the term in ${
        language === "it" ? "Italian" : "English"
      }.
      2. **Heading**: Include all headings within the chapter, along with descriptions in ${
        language === "it" ? "Italian" : "English"
      }.
      3. **Subheading**: List all subheadings under each heading.
      4. **Sub-Subheading**: Include all sub-subheadings under each subheading.
      5. **Detailed Codes**: For each sub-subheading, include all available detailed codes and their exact, full descriptions from the TARIC database.

      Each level should be presented in detail as specified, with every code and description structured in ${
        language === "it" ? "Italian" : "English"
      }.

      Additionally:
      - Include specific questions for each level to refine the classification process. Questions should prompt for attributes relevant to each level, such as contents, preparation methods, or specific characteristics that further define the product classification.
      - Provide all questions in ${language === "it" ? "Italian" : "English"}.

      Return only JSON in the following format without any additional text, and ensure the content matches the latest data as of September 24, 2024. Use the latest TARIC database available at: https://taxation-customs.ec.europa.eu/customs-4/calculation-customs-duties/customs-tariff/eu-customs-tariff-taric_en.

      Please ensure full adherence to the JSON structure, which is as follows:
      
      {
        "chapter": "XX",
        "heading": "XXXX",
        "year": "Database Version",
        "source": "https://taxation-customs.ec.europa.eu/customs-4/calculation-customs-duties/customs-tariff/eu-customs-tariff-taric_en",
        "subheadings": [
          {
            "subheading": "XXXX.XX",
            "sub-subheadings": [
              { 
                "sub-subheading": "XXXX.XX.XX",
                "detailed-codes": [
                  { "code": "XXXX.XX.XX.XX", "description": "Full specific description as found in TARIC database" },
                  { "code": "XXXX.XX.XX.XX", "description": "Full specific description as found in TARIC database" }
                ]
              }
            ],
            "questions": [
              {
                "question": "Does the product include [specific attribute]?",
                "answers": [
                  { "answer": "Yes, it includes [attribute]" },
                  { "answer": "No, it does not include [attribute]" }
                ]
              }
            ]
          }
        ],
        "questions": [
          {
            "question": "Which subheading best describes the product?",
            "answers": [
              { "answer": "Subheading XXXX.XX - Description" },
              { "answer": "Subheading XXXX.XX - Description" }
            ]
          }
        ]
      }
    `;

    // Fetch the generated response from the model
    const response = await model.generateContent([prompt]);
    let responseText = response.response.text().trim();

    // Remove potential markdown code blocks
    responseText = responseText.replace(/```json|```/g, "").trim();

    // Log the raw response for debugging
    console.log("Generated Response:", responseText);

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "Error parsing JSON:",
        parseError,
        "Response text:",
        responseText
      );

      // Attempt to clean up and re-parse if JSON format is incorrect
      const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Extract JSON
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error("Second parsing attempt failed:", secondParseError);
          return res.status(400).json({
            error:
              "Invalid JSON format returned from model. Please check the model response.",
          });
        }
      } else {
        return res.status(400).json({
          error: "Unable to find JSON structure in model response.",
        });
      }
    }

    // Send the structured questions and classification information back as JSON
    res.json(parsedResponse);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-dynamic-taric-code-questions-hybrid", async (req, res) => {
  try {
    const { term, language } = req.body;

    if (!term || !language) {
      return res.status(400).json({ error: "Term and language are required" });
    }

    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    const prompt = `
      Based on the term "${term}", find and return only the relevant four-digit TARIC code that best represents this term.
      The response should be in JSON format as follows please make detailed to have 12 digits currently it's just up to 10:

      {
        "code": "XXXX"
      }
    `;

    const response = await model.generateContent([prompt]);
    let responseText = await response.response.text().trim();
    responseText = responseText.replace(/```json|```/g, "").trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error("Second parsing attempt failed:", secondParseError);
          return res.status(400).json({
            error:
              "Invalid JSON format returned from model. Please check the model response.",
          });
        }
      } else {
        return res.status(400).json({
          error: "Unable to find JSON structure in model response.",
        });
      }
    }

    let fourDigitCode = parsedResponse.code;
    console.log("Raw Four-Digit Code:", fourDigitCode);

    // Ensure the four-digit code is properly trimmed to 4 digits if necessary
    if (fourDigitCode.length > 4) {
      fourDigitCode = fourDigitCode.substring(0, 4);
    }

    console.log("Trimmed Four-Digit Code:", fourDigitCode);

    const url =
      language === "it"
        ? "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/scraped_data_it.json"
        : "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/scraped_data_en.json";

    const responseData = await fetch(url);
    const data = await responseData.json();

    const mainItem = data.find(
      (item) => item.code && item.code === fourDigitCode
    );
    if (!mainItem) {
      return res.status(404).json({ error: "Code not found in data files" });
    }

    // Recursive function to fetch unique subheadings at each level
    const getUniqueSubheadings = (parentCode, length) => {
      const uniqueCodes = new Set();
      return data
        .filter(
          (item) =>
            item.code.startsWith(parentCode) &&
            item.code.replace(/\s/g, "").length === length
        )
        .filter((item) => {
          if (uniqueCodes.has(item.code)) return false;
          uniqueCodes.add(item.code);
          return true;
        })
        .map((item) => ({
          code: item.code,
          description: `${item.description} &nbsp;`,
          subs: getUniqueSubheadings(item.code, length + 2),
        }));
    };

    const subheadings = getUniqueSubheadings(fourDigitCode, 6);

    res.json({
      code: fourDigitCode,
      details: {
        code: mainItem.code,
        description: `${mainItem.description} &nbsp;`,
      },
      subheadings,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

router.post("/get-dynamic-taric-code-questions-json", async (req, res) => {
  try {
    const { jsonData, language } = req.body;

    if (!jsonData || !language) {
      return res
        .status(400)
        .json({ error: "JSON data and language are required" });
    }

    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    const generateQuestion = async (data) => {
      const options = data.map((item, index) => ({
        index: index + 1,
        code: item.Goodscode,
        description: item.DescriptionEN || item.Description,
        subs: item.Subs,
      }));

      const prompt = `
        You are an intelligent assistant that helps users identify the correct TARIC code based on hierarchical data.

        Given the following options:
        ${options
          .map(
            (opt) =>
              `Option ${opt.index}: ${opt.description}, Code: ${opt.code}`
          )
          .join("\n")}

        Generate a question to help the user pick the most appropriate option. The question should be clear, concise, and guide the user to choose between these options.

        If there is only one option, confirm it with the user by asking something like: "Is this your product: [description]?".
      `;

      const response = await model.generateContent([prompt]);
      const questionText = response.response.text().trim();

      return {
        question: questionText,
        options,
      };
    };

    const askQuestionsRecursively = async (data) => {
      if (data.length === 0) return null;

      const { question, options } = await generateQuestion(data);

      // Continue recursion even for a single option
      const detailedOptions = await Promise.all(
        options.map(async (option) => ({
          ...option,
          subs: option.subs?.length
            ? await askQuestionsRecursively(option.subs)
            : null,
        }))
      );

      return {
        question,
        options: detailedOptions,
      };
    };

    // Start recursive question generation
    const result = await askQuestionsRecursively(jsonData);

    res.json({
      message: "Here are the questions for identifying the TARIC code.",
      result,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

/**
 * Searches for a word in the JSON data based on the language and returns the first 4 digits of the Goodscode.
 * @param {string} word - The word to search for.
 * @param {string} language - The language to search in ('EN' for English, otherwise use the default description).
 * @returns {Array<string>} - An array of the first 4 digits of matching Goodscode.
 */
const searchGoodscode = async (word, language) => {
  try {
    // Fetch the JSON file from the URL using axios
    //"https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/output.json"
    const response = await axios.get(
      "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/nested_output.json"
    );
    const data = response.data;

    console.log("Data fetched:", data); // Log the fetched data

    // Helper function to recursively search through the data
    const searchRecursively = (items, results) => {
      items.forEach((item) => {
        console.log("Processing item:", item); // Log each item being processed

        // Check if 'family' and 'Code' exist before destructuring
        if (item.family && item.family.Code) {
          const { Code, Subs } = item.family;
          const descriptionField =
            language === "EN" ? "DescriptionEN" : "Description";

          // Log the description field being checked
          console.log(`Checking ${descriptionField} for word:`, word);
          console.log("Description:", Code[descriptionField]);

          // Check the current item's description (family level)
          if (
            Code[descriptionField] &&
            Code[descriptionField].toLowerCase().includes(word.toLowerCase())
          ) {
            console.log(
              "Match found at family level:",
              Code.Goodscode.slice(0, 4)
            ); // Log the matched Goodscode
            results.push(Code.Goodscode.slice(0, 4)); // Save first 4 digits of Goodscode
          }

          // Check the subs (nested items) for matches at all levels
          if (Subs && Subs.length > 0) {
            searchRecursively(Subs, results); // Recursive call to process subs
          }
        }
      });
    };

    // Perform the search
    const results = [];
    searchRecursively([data], results); // Pass the root data in an array

    console.log("Search results:", results); // Log the final results

    return results;
  } catch (error) {
    console.error("Error fetching or processing JSON:", error);
    return [];
  }
};

// Define the POST endpoint
router.post("/search-goodscode", async (req, res) => {
  const { word, language } = req.body;

  // Validate input
  if (!word) {
    return res.status(400).json({ error: 'The "word" field is required.' });
  }

  const results = await searchGoodscode(word, language);
  if (results.length === 0) {
    return res.status(404).json({ message: "No matching results found." });
  }

  res.json({ results });
});

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // Cache for 1 hour

router.post("/get-taric-code-json", async (req, res) => {
  try {
    const { code } = req.body;

    console.log("Received request with code:", code);

    if (!code || code.length !== 4) {
      console.error("Invalid code provided:", code);
      return res.status(400).json({ error: "A 4-digit code is required" });
    }

    // Check if data is cached and still valid
    const currentTime = Date.now();
    if (!cachedData || currentTime - lastFetchTime > CACHE_DURATION) {
      console.log("Cache expired or not found. Fetching data...");
      const response = await fetch(
        "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/nested_output.json"
      );
      cachedData = await response.json();
      lastFetchTime = currentTime;
      console.log("Fetched and cached data:", cachedData);
    } else {
      console.log("Using cached data");
    }

    // Filter data with cached JSON
    const matchingFamilies = cachedData
      .flatMap((item) =>
        Array.isArray(item.family) ? item.family : [item.family]
      )
      .filter((familyItem) => {
        console.log("Inspecting family item:", familyItem);
        return (
          familyItem.Code &&
          familyItem.Code["Goods code"] &&
          familyItem.Code["Goods code"].replace(/\s/g, "").startsWith(code)
        );
      });

    console.log("Matching families:", matchingFamilies);

    if (matchingFamilies.length === 0) {
      console.warn("No matching families found for code:", code);
      return res.status(404).json({ error: "Code not found in data file" });
    }

    res.json(matchingFamilies);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Recursive function to dynamically ask questions based on JSON structure
function askQuestion(subCategories, level) {
  // Base case: if no subcategories exist, return the final product code
  if (!subCategories || subCategories.length === 0) {
    return {
      question:
        "You've reached the final product, no further subcategories available.",
      code: subCategories[0].Code.Goodscode,
    };
  }

  let question = "";
  let options = [];

  // For the first level, ask general questions about categories
  if (level === 1) {
    question = "Do you want to select a category from the following?";
  }

  // For subsequent levels, ask for more specific details
  if (level > 1) {
    question = "Which specific product would you like to choose?";
  }

  // Collect options (descriptions of subcategories)
  subCategories.forEach((sub) => {
    options.push(sub.Code.DescriptionEN);
  });

  // If subcategories have more nested subcategories, continue down
  return {
    question,
    options,
    nextLevel: level + 1,
    subs: subCategories,
  };
}

// Main POST route for receiving the hierarchical JSON and interacting with the user
router.post("/get-taric-code", (req, res) => {
  const data = req.body; // The entire JSON body with categories and subcategories
  let currentLevel = 1; // Start at the first level of the hierarchy
  let currentSubs = data; // Start with the root level categories/subcategories

  // Function to recursively ask questions and send responses
  function handleRequest(currentSubs, currentLevel) {
    const response = askQuestion(currentSubs, currentLevel);

    // If we've reached the leaf category (i.e., no more subcategories)
    if (!response.subs || response.subs.length === 0) {
      res.json({
        question: response.question,
        code: response.code, // Return the final code when no further questions are needed
      });
    } else {
      // Otherwise, provide options for further refinement
      res.json({
        question: response.question,
        options: response.options,
        nextLevel: response.nextLevel,
      });
    }
  }

  // Start the recursive process of asking questions
  handleRequest(currentSubs, currentLevel);
});

// Endpoint to get TARIC codes based on structured chapter, heading, subheadings, and questions
router.post("/get-taric-code-by-structure", async (req, res) => {
  const { chapter, heading, subheadings, questions } = req.body;
  const language = req.body.language || "en";
  const isItalian = language === "it";

  if (!chapter || !heading || !subheadings || !questions) {
    return res.status(400).json({
      error: "Chapter, heading, subheadings, and questions are required",
    });
  }

  try {
    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    const taricCodePrompt = `
    Based on the specified chapter, heading, and detailed subheadings, as well as answers to product-specific questions, identify the most accurate TARIC code and description. Follow these steps for an accurate TARIC classification:

    1. **Identify the Chapter and Heading Code (4 to 6 digits)**: 
       - Start by narrowing down to the provided chapter (e.g., 20) and heading (e.g., 2009) to set a general category.

    2. **Match Subheading and Sub-Subheading Details**:
       - Use the subheadings and sub-subheadings to refine the code by matching the product’s attributes (e.g., juice type, added sugar, fermentation).

    3. **Answer-based Refinement**:
       - Utilize the questions and answers provided to further classify the product, considering specific traits (e.g., country-specific tariffs, product additives).

    **Output format**:
    Provide the most accurate TARIC codes and descriptions in the following structured format:
    
    {
      "taricCodes": [
        { "code": "XXXX", "description": "General description" },
        { "code": "XXXX XX", "description": "Detailed description based on heading" },
        { "code": "XXXX XX XX", "description": "Granular description, based on subheadings" },
        { "code": "XXXX XX XX XX", "description": "Highly specific classification based on all answers" }
      ]
    }

    **Chapter**: ${chapter}
    **Heading**: ${heading}
    **Subheadings**: ${JSON.stringify(subheadings)}
    **Questions and Answers**: ${JSON.stringify(questions)}

    Do not include explanations or disclaimers. Provide the most specific TARIC classification possible.
    `;

    const taricCodeResult = await model.generateContent([taricCodePrompt]);
    let taricCodeText = taricCodeResult.response.text().trim();
    console.log("Generated TARIC Code Text:", taricCodeText);

    // Clean up and parse the response as JSON
    taricCodeText = taricCodeText.replace(/```json|```/g, "");
    const taricCodesObject = JSON.parse(taricCodeText);

    const taricCodesArray = taricCodesObject?.taricCodes || [];
    console.log("Extracted TARIC Codes with Descriptions:", taricCodesArray);

    // Return the result with a localized message
    if (isItalian) {
      return res.json({
        taricCodes: taricCodesArray,
        message: "Codici TARIC generati con successo",
      });
    } else {
      return res.json({
        taricCodes: taricCodesArray,
        message: "TARIC codes generated successfully",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: isItalian ? "Qualcosa è andato storto!" : "Something went wrong!",
    });
  }
});

// Endpoint to generate TARIC code with questions
router.post("/generate-taric-code-with-questions", async (req, res) => {
  try {
    const inputJson = req.body;

    // Validate input
    if (!inputJson || !inputJson.family || !inputJson.family.Code) {
      return res.status(400).json({ error: "Invalid input JSON format" });
    }

    console.log("Input JSON received:", inputJson);

    // Initialize the model (same as the previous working endpoint)
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    // Build the prompt to generate TARIC codes and questions
    const taricCodeWithQuestionsPrompt = `
    Given the provided input JSON, generate TARIC classification codes with associated questions for each code and subcategory. 

    The input JSON contains a family code with its subcodes, and each subcode may have further subcategories. For each TARIC code and its subcategories, provide the following:

    1. The TARIC code and its description.
    2. A set of questions that can help identify or further refine the classification for the subcategory. For example:
        - Is this product used for industrial or consumer purposes?
        - Does it contain any special materials or treatments?
        - What is its intended use (e.g., furniture, construction, etc.)?
        - What is its country of origin, if relevant?
    3. For each level of subcategory (including sub-subcategories), ask more refined questions to further classify the product.

    **Output format**:
    The output should return a JSON with TARIC codes, descriptions, and a list of questions for each code and its subcategories.

    {
      "taricCodesWithQuestions": [
        {
          "code": "XXXX",
          "description": "Description for this code",
          "questions": [
            "What is the intended use of this product?",
            "Does it have any special materials or treatments?"
          ],
          "subcategories": [
            {
              "code": "XXXX XX",
              "description": "Subcategory description",
              "questions": [
                "What is the specific use for this subcategory?",
                "Does this product belong to a particular country of origin?"
              ],
              "subcategories": [...]
            }
          ]
        }
      ]
    }

    **Input Data**: ${JSON.stringify(inputJson)}

    Do not include explanations or disclaimers. Provide only the classifications, descriptions, and questions based on the input.
    `;

    // Generate TARIC code classifications and questions using the model's generateContent method
    const taricCodeWithQuestionsResult = await model.generateContent([
      taricCodeWithQuestionsPrompt,
    ]);
    let taricCodeResponseText = taricCodeWithQuestionsResult.response
      .text()
      .trim();

    // Log the raw response from the model for debugging
    console.log(
      "Raw TARIC code with questions response:",
      taricCodeResponseText
    );

    // Clean up formatting by removing any code block markers (` ```json ... ``` `)
    taricCodeResponseText = taricCodeResponseText
      .replace(/```json|```/g, "") // Remove markdown code block syntax
      .trim(); // Trim leading/trailing whitespace

    // Parse JSON response to extract TARIC codes with questions
    let taricCodesWithQuestions;
    try {
      taricCodesWithQuestions = JSON.parse(
        taricCodeResponseText
      ).taricCodesWithQuestions;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return res.status(400).json({
        error:
          "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Log the final TARIC codes with questions for debugging
    console.log(
      "Generated TARIC codes with questions:",
      taricCodesWithQuestions
    );

    // Send the generated TARIC codes with questions back as JSON
    res.json({ taricCodesWithQuestions });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Endpoint to get TARIC codes based on user answers
router.post("/get-taric-code-answers", async (req, res) => {
  const { answers, language, term } = req.body;
  const isItalian = language === "it";

  if (!answers || !language || !term) {
    return res
      .status(400)
      .json({ error: "Answers, language, and term are required" });
  }

  try {
    console.log("Received Answers:", answers);
    console.log("Language:", language);
    console.log("Term:", term);

    //const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );

    const taricCodePrompt = `
    Based on the specified term and the detailed answers provided, identify the most accurate TARIC codes and descriptions by following a logical progression through HS, CN, and TARIC codes. Ensure accuracy and specificity by leveraging a comprehensive and updated TARIC code database. The model should:
    
    1. **Identify HS Code Family (first 4 digits)**: 
        - Use the provided term (e.g., "milk," "yogurt," "car") to identify the general HS code family (first 4 digits) based on the product type. 
        - For example, for dairy products, the first 4 digits will typically fall under the '04' series, such as '0403' for yogurt.
    
    2. **Refine the Code Based on Answers**: 
        - Once the HS family code is determined, refine it using the detailed answers provided. Each answer should influence the TARIC code refinement based on specific attributes such as:
            - **Dairy Products**: Attributes like fat percentage, milk origin, pasteurization, additives, and packaging type should refine codes under the general family (e.g., from '0403' to '040320' for flavored yogurt).
            - **Vehicles**: Attributes like engine type, fuel type, weight class, and intended use (e.g., passenger or commercial) should refine codes under the vehicle family.
            - **General Goods**: Consider main materials, additives, production process, and regulatory standards for further refinement.
    
    3. **Detailed Code Breakdown**:
        - Ensure the model identifies the appropriate code not just at the 6-digit level, but also goes deeper to the 8-digit level where applicable for greater specificity.
        - For example, when dealing with a product like yogurt, the model should not just return the 4-digit HS code but should provide more granular codes such as '0403 20' for flavored yogurt, '0403 90' for others, or even more detailed classifications as available.
    
    **Instructions**: 
    - Ensure the latest TARIC code base is used, considering all chapters, sub-chapters, and specific regulations.
    - The more detailed and accurate, the better. Prioritize precision in identifying the exact TARIC classification.
    
    **Output format**:
    Provide the most accurate and detailed TARIC codes and descriptions in the following structured list format:
    
    {
      "taricCodes": [
        { "code": "XXXX", "description": "General description of the code" },
        { "code": "XXXX XX", "description": "Detailed description including key attributes such as fat content, flavor, etc." },
        { "code": "XXXX XX XX", "description": "Description with further granularity, indicating specific variations" },
        { "code": "XXXX XX XX XX", "description": "Even more detailed description, specific to niche products or variations" },
        { "code": "XXXX XX XX XX XX", "description": "Highly specific classification based on answers" },
        { "code": "XXXX XX XX XX XX XX", "description": "Deepest level of classification with all relevant details" }
      ]
    }

    please don't give me the Explanation
    
    **Term**: ${term}
    **Answers**: ${JSON.stringify(answers)}
    
    Avoid disclaimers, limitations, or vague language. Provide the best possible TARIC codes with the most accurate and detailed descriptions based on the term and the answers provided, ensuring specificity and correctness.
    `;

    const taricCodeResult = await model.generateContent([taricCodePrompt]);
    let taricCodeText = taricCodeResult.response.text().trim();
    console.log("taricCodeText", taricCodeText);

    // Clean up the response by removing unwanted formatting
    taricCodeText = taricCodeText.replace(/```json|```/g, "");

    // Parse taricCodeText as JSON
    const taricCodesObject = JSON.parse(taricCodeText);

    const taricCodesArray = taricCodesObject?.taricCodes || [];
    console.log("Extracted TARIC Codes with Descriptions:", taricCodesArray);

    // Return the result with a localized message
    if (isItalian) {
      return res.json({
        taricCodes: taricCodesArray,
        message: "Codici TARIC generati con successo",
      });
    } else {
      return res.json({
        taricCodes: taricCodesArray,
        message: "TARIC codes generated successfully",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: isItalian ? "Qualcosa è andato storto!" : "Something went wrong!",
    });
  }
});

router.post("/get-taric-codes-new-json", async (req, res) => {
  try {
    const { word, materials, uses, language } = req.body;

    // Validate input
    if (!word || !materials || !uses) {
      return res
        .status(400)
        .json({ error: "Word, materials, and uses are required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    const family = [];

    // Function to find matching TARIC codes based on materials and uses
    const findTaricCodes = (material) => {
      return goodsData.filter(
        (item) =>
          item.Description.toLowerCase().includes(material.toLowerCase()) ||
          item.DescriptionEN.toLowerCase().includes(material.toLowerCase())
      );
    };

    // Prepare an array of materials
    const materialsArray = materials
      .split(",")
      .map((material) => material.trim());

    // Iterate through materials to find TARIC codes
    materialsArray.forEach((material) => {
      const codes = findTaricCodes(material);
      codes.forEach((code) => {
        const codeToAdd = {
          code: code.Goodscode,
          description:
            language === "it" ? code.Description : code.DescriptionEN,
        };
        family.push(codeToAdd);
      });
    });

    // Send the TARIC codes and descriptions back as JSON
    res.json({ family });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

const searchWordInJson = (word, language, data) => {
  console.log(`Searching for word "${word}" in language "${language}"`);

  const results = [];

  // Ensure we have valid language input
  if (language !== "it" && language !== "en") {
    console.error("Invalid language provided:", language);
    return results;
  }

  // Recursive function to search through family and its subs at all levels
  const searchFamily = (family) => {
    const descriptionField =
      language === "it" ? "Description" : "DescriptionEN";

    // Check if family has a valid Code and description field
    if (family.Code && family.Code[descriptionField]) {
      const description = family.Code[descriptionField].trim(); // Trim spaces for a clean match
      console.log(`Checking description at family level: "${description}"`); // Debugging output

      if (description.toLowerCase().includes(word.toLowerCase())) {
        console.log(`Match found in family description: ${description}`);
        results.push(family.Code); // Add the matching family
      }
    }

    // Check the subs (sub-items) under the family, recursively if needed
    if (Array.isArray(family.Subs)) {
      family.Subs.forEach((sub) => {
        // Recursively search through sub and its subs (this will check every nested level)
        searchSub(sub); // Use the searchSub function for deeper levels
      });
    }
  };

  // Recursive function to search subs and their subs at all levels
  const searchSub = (sub) => {
    const descriptionField =
      language === "it" ? "Description" : "DescriptionEN";

    // Check if sub has a valid Code and description field
    if (sub.Code && sub.Code[descriptionField]) {
      const description = sub.Code[descriptionField].trim(); // Trim spaces for a clean match
      console.log(`Checking description at sub level: "${description}"`); // Debugging output

      if (description.toLowerCase().includes(word.toLowerCase())) {
        console.log(`Match found in sub description: ${description}`);
        results.push(sub.Code); // Add the matching sub
      }
    }

    // Check the subs (sub-items) under the sub, recursively if needed
    if (Array.isArray(sub.Subs)) {
      sub.Subs.forEach((nestedSub) => {
        searchSub(nestedSub); // Recursively search deeper nested subs
      });
    }
  };

  // Iterate through the families to search for matching descriptions
  data.forEach((family) => {
    searchFamily(family); // Start the recursive search at the family level
  });

  console.log(`Found ${results.length} matches`);
  return results;
};

// Fetch JSON data and initiate the search
const fetchJsonData = async () => {
  try {
    //"https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/output.json"
    const response = await axios.get(
      "https://raw.githubusercontent.com/OnsJannet/taric-backend/refs/heads/main/nested_output.json"
    );
    console.log("Data fetched successfully");
    return response.data;
  } catch (error) {
    console.error("Error fetching JSON data:", error);
    throw new Error("Failed to fetch JSON data");
  }
};

// Your POST endpoint for the search request
router.post("/search", async (req, res) => {
  const { word, language } = req.body; // Access data from the request body

  // Validate that both word and language parameters are provided
  if (!word || !language) {
    console.error("Missing word or language in request body:", req.body);
    return res.status(400).json({
      message: 'Please provide both "word" and "language" parameters.',
    });
  }

  try {
    const data = await fetchJsonData(); // Fetch the data from the JSON URL
    if (!data || !Array.isArray(data)) {
      console.error("Invalid data structure received:", data);
      return res
        .status(500)
        .json({ message: "Invalid data structure received from JSON source" });
    }

    const results = searchWordInJson(word, language, data);

    if (results.length === 0) {
      return res.status(404).json({ message: "No matches found." });
    }

    res.json(results); // Return the search results
  } catch (error) {
    console.error("Error in /search endpoint:", error);
    // Handle any errors and send a server error response
    res.status(500).json({ message: "Internal server error" });
  }
});

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"; // Correct API endpoint

router.post("/get-taric-codes-openai", async (req, res) => {
  const { term, language } = req.body;

  if (!term) {
    return res.status(400).json({ error: "Term is required" });
  }

  if (!language || !["it", "en"].includes(language)) {
    return res
      .status(400)
      .json({ error: "Language must be 'it' (Italian) or 'en' (English)" });
  }

  const languagePrompts = {
    en: `Based on the term "${term}", provide all possible Italian TARIC codes with their descriptions in English. Only list valid four-digit TARIC codes and their descriptions.`,
    it: `Sulla base del termine "${term}", fornisci tutti i possibili codici TARIC italiani con le loro descrizioni in italiano. Elenca solo codici TARIC validi di quattro cifre e le loro descrizioni.`,
  };

  try {
    // Make the request to OpenAI
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo", // Or use "gpt-4" if required
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that provides TARIC codes and descriptions.",
          },
          {
            role: "user",
            content: languagePrompts[language],
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log the full response from OpenAI for debugging
    console.log("OpenAI Response:", response.data);

    // Extract the text response
    const textResponse = response.data.choices[0]?.message?.content?.trim();
    if (!textResponse) {
      return res.status(500).json({ error: "No response from OpenAI" });
    }

    // Process the response to extract TARIC codes
    const taricData = textResponse
      .split("\n")
      .map((line) => line.match(/^(\d{4})\s*-\s*(.+)$/)) // Match "4-digit code - description"
      .filter(Boolean) // Filter out invalid matches
      .map((match) => ({
        code: match[1], // 4-digit code
        description: match[2], // description
      }));

    if (taricData.length === 0) {
      return res.status(404).json({ error: "No TARIC codes found" });
    }

    // Return the response to the client
    res.json({ term, language, taricCodes: taricData });
  } catch (error) {
    // Log the error for debugging
    console.error(
      "Error fetching TARIC codes:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch TARIC codes" });
  }
});

//gemini family:
router.post("/get-taric-code-family", async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    const isItalian = language === "it";

    // Define the AI prompt
    const taricCodePrompt = `

    Given the term "${term}", identify the primary material and provide the related TARIC codes grouped by their first four digits. Use the hierarchical structure of TARIC codes and their descriptions. Only return a JSON object in this format:
    
    {
    
    "taricCodes": [
    
    { "code": "XXXX", "description": "General description for the group" }
    
    ]
    
    }
    
    Guidelines:
    
    1. Carefully analyze the input term to infer the material, purpose, and context.
    
    2. Focus on identifying TARIC codes that are most relevant to the term's intended use or industry. For instance:
    
    - For "coat hanger" (gruccia): Based on material:
    
      - Metal: Use codes under 7326 for articles of iron or steel.
    
      - Plastic: Use codes under 3924 for household plastic articles.
    
      - Wood: Use codes under 4421 for wooden articles.
    
    - For "telai per biciclette non verniciati" (unpainted bicycle frames): Refer to codes under **8714**, as this code covers bicycle frames and parts.
    
    3. Only include relevant TARIC codes and descriptions grouped by material, purpose, or industry.
    
    4. Use hierarchical descriptions in ${
      language === "it" ? "Italian" : "English"
    } for clarity.
    
    5. Always return exactly four-digit codes (not less, not more).
    
    6. Cross-check against TARIC database logic to avoid generic or unrelated codes.
    
    Output example for "gruccia" or "appendiabiti" or "grucce":
    
    {
    
    "taricCodes": [
    
    { "code": "7326", "description": "Altri articoli di ferro o acciaio non specificati altrove" },
    
    { "code": "3924", "description": "Articoli per la casa in plastica" },
    
    { "code": "4421", "description": "Altri articoli in legno non specificati altrove" }
    
    ]
    
    }
    
    Example for "telai per biciclette non verniciati":
    
    {
    
    "taricCodes": [
    
    { "code": "8714", "description": "Parti e accessori per biciclette, incluse le strutture non verniciate" }
    
    ]
    
    }

    }
    
    Example for "LOGLIO D'ITALIA - LOLIUM MULTIFLORUM LAM. SACCHI 0.0 10 BIG BOSS" or "SEMI DI MELONE - SEMENTI CARTONE 3.0 10":
    
    {
    
    "taricCodes": [
    
    { "code": "1209", "description": "	Semi, frutti e spore da sementa" }
    
    ]
    
    }
    
    Example for "A description that includes RISO":
    
    {
    
    "taricCodes": [
    
    { "code": "1006", "description": "Riso" }
    
    ]
    
    }

    Example for "FARINA DI RISO" or "FARINA DI MIGLIO - KURRAKAN FLOUR":
    
    {
    
    "taricCodes": [
    
    { "code": "1102", "description": "Farine di cereali diversi dal frumento (grano) o dal frumento segalato" }
    
    ]

        Example for "PESCI SECCHI SALATI O IN SALAMOIA PESCI AFFUMICATI ANCHE COTTI
PRIMA O DURANTE L AFFUMICATURA FARINE POLVERI E AGGLOMERATI IN
FORMA DI PELLETS DI PESCI ATTI ALL ALIMENTAZIONE UMANA, ALTRI,
ALTRI, ALTRI" or "PESCI SECCHI SALATI O IN SALAMOIA PESCI AFFUMICATI ANCHE COTTI
PRIMA O DURANTE L AFFUMICATURA FARINE POLVERI E AGGLOMERATI IN
FORMA DI PELLETS DI PESCI ATTI ALL ALIMENTAZIONE UMANA, ACCIUGHE
ENGRAULIS SPP, ALTRI":
    
    {
    
    "taricCodes": [
    
    { "code": "0305", "description": "	
Pesci secchi, salati o in salamoia; pesci affumicati, anche cotti prima o durante l'affumicatura
" }
    
    ]

    Example for "ALTRI CEREALIBBQ CHANACHUR":
    
    {
    
    "taricCodes": [
    
    { "code": "1008", "description": "	
Grano saraceno, miglio e scagliola; altri cereali

" }
    
    ]

        Example for "FARINA DI CECI" or "FARINA DI LENTICCHIE" or "FARINA DI PALMYRAH" or "FARINA DI MANIOCA":
    
    {
    
    "taricCodes": [
    
    { "code": "1106", "description": "	
Farine, semolini e polveri dei legumi da granella secchi della voce)0713, di sago o di radici o tuberi della voce)0714)e dei prodotti del capitolo)8


" }
    
    ]
    
    }
    
        Example for "PARTI ED ACCESSORI DI MACCHINE DELLA VOCE8469":
    
    {
    
    "taricCodes": [
    
    { "code": "8473", "description": "Parti e accessori per macchine per scrivere o trattamento testi" }
    
    ]
    
    }`;

    // Initialize and generate content using the AI model
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-pro" },
      { apiVersion: "v1beta" }
    );
    const taricCodeResult = await model.generateContent([taricCodePrompt]);
    let taricCodeText = taricCodeResult.response.text().trim();
    console.log("Generated TARIC Code Text:", taricCodeText);

    // Clean up and parse the response as JSON
    taricCodeText = taricCodeText.replace(/```json|```/g, ""); // Remove any Markdown formatting
    const taricCodesObject = JSON.parse(taricCodeText);

    // Extract TARIC codes array
    const taricCodesArray = taricCodesObject?.taricCodes || [];
    console.log("Extracted TARIC Codes with Descriptions:", taricCodesArray);

    // Return the result with a localized message
    if (taricCodesArray.length === 0) {
      return res.status(404).json({
        error:
          language === "it"
            ? "Nessun codice TARIC valido trovato per il termine fornito."
            : "No valid TARIC codes found for the provided term.",
      });
    }

    res.json({
      taricCodes: taricCodesArray,
      message:
        language === "it"
          ? "Codici TARIC generati con successo"
          : "TARIC codes generated successfully",
    });
  } catch (error) {
    console.error("Error processing TARIC codes:", error);
    res.status(500).json({
      error:
        language === "it"
          ? "Qualcosa è andato storto!"
          : "Something went wrong!",
    });
  }
});

router.post("/get-taric-code-family-openai", async (req, res) => {
  console.log("process.env.OPENAI_API_KEY", process.env.OPENAI_API_KEY);
  try {
    const { term, language, taric } = req.body;

    // Validate input
    if (!term || typeof term !== "string") {
      return res
        .status(400)
        .json({ error: "Term is required and must be a string." });
    }
    if (!["it", "en"].includes(language)) {
      return res
        .status(400)
        .json({
          error: "Unsupported language. Only 'it' or 'en' are allowed.",
        });
    }

    const isItalian = language === "it";

    // Define the AI prompt with more detailed instructions
    const taricCodePrompt = `
    Act as an expert in TARIC classification. Your task is to accurately determine the most appropriate 4-digit TARIC "heading" or "commodity codes" for the term "${term}". Please ensure that the classification follows the correct rules based on use-case  and product type. 

    The term "grattugia in metallo" refers specifically to a **metal kitchen grater** used for domestic purposes. The code should align with kitchen utensils for household use rather than general cutting instruments. Ensure that only **high-confidence** classifications are provided.

    Provide a JSON object formatted as follows:
    
    {
      "taricCodes": [
        { "code": "XXXX", "description": "Official TARIC description" },
        { "code": "YYYY", "description": "Official TARIC description" }
      ]
    }
    
    **Classification Rules:**
    1. Prioritize official Italian TARIC classifications over general suggestions.
    2. Provide only **high-confidence** classifications, avoiding broad or unrelated chapters.
    3. Ensure descriptions use precise TARIC terminology in ${ isItalian ? "Italian" : "English" }.
    4. If multiple materials exist, list codes for each one, **ensuring they match the specific use-case**.
    5. **Avoid incorrect recommendations.** If there are common misclassifications, mention them inside the note field as follows:  
       \\"note\\": \\"Some systems incorrectly suggest XXXX; however, YYYY is the correct classification.\\"  
   
    **Exceptions:**
    - If the term is similar to "chiave per fissaggio corpiwc in materia plastica e a larghezza fissa", **include both 8205 and 3926**.
    - If the term is **exactly** "Scolapasta in alluminio" or "scolapasta in aluminum", **ensure 7615 is included**.
    - If the term is **exactly** "la chiusura dei pantaloni", **ensure 6217 is included**.
    - If the term is **exactly** "grattugia in metallo", **ensure 8205 is included**.
    - If the term is **exactly** "coprisedile automobile", **ensure 6307 and 6304 are included**.
    - If the term is **exactly** "braccio doccia in plastica multifunzione", **ensure 8424 is included**.
    - If the term is **exactly** "pistola stura lavandino ad aria", **ensure 8424 is included**.

    **Example for Accuracy:**  
    - "Pinze spelacavi" should return **8203200000** (not 820310 or 820330).  
    - "Braccio doccia in plastica multifunzione" should return **8424** (not 3922, 3924, 3926, 8481).
    
    **Output Format:**
    Return only the JSON object—no explanations, commentary, or additional text.
`;


    // Request to OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: taricCodePrompt }],
      max_tokens: 500,
      temperature: 0.2,
    });

    // Extract and clean the generated response
    const taricCodeText = response.choices[0]?.message?.content.trim();
    if (!taricCodeText) {
      throw new Error("No response from OpenAI.");
    }

    console.log("Generated TARIC Code Text:", taricCodeText);

    // Clean up response (removing any Markdown or extra explanation)
    const cleanedTaricCodeText = taricCodeText.replace(/```json|```/g, ""); // Remove Markdown formatting

    // Regex to extract the JSON part of the response
    const regex = /{(?:[^{}]|(?:{[^}]*}))*}/;
    const taricCodeMatch = cleanedTaricCodeText.match(regex);

    let taricCodesArray = [];
    if (taricCodeMatch && taricCodeMatch[0]) {
      try {
        const taricCodesObject = JSON.parse(taricCodeMatch[0]);
        taricCodesArray = taricCodesObject?.taricCodes || [];
      } catch (error) {
        console.error("Error parsing TARIC JSON:", error);
      }
    }

    // Return the result with a localized message
    if (taricCodesArray.length === 0) {
      return res.status(404).json({
        error: isItalian
          ? "Nessun codice TARIC valido trovato per il termine fornito."
          : "No valid TARIC codes found for the provided term.",
      });
    }

    return res.json({
      taricCodes: taricCodesArray,
      message: isItalian
        ? "Codici TARIC generati con successo."
        : "TARIC codes generated successfully.",
    });
  } catch (error) {
    console.error("Error processing TARIC codes:", error);

    // Localize error message
    const errorMessage = error.message || "Unknown error occurred.";
    return res.status(500).json({
      error:
        language === "it"
          ? `Qualcosa è andato storto: ${errorMessage}`
          : `Something went wrong: ${errorMessage}`,
    });
  }
});

router.post("/get-suggested-terms-openai", async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!["it", "en"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("Language: " + language);

    let textToProcess = description;

    // Generalized prompt for handling different cases
    const suggestionPrompt = 
`### **Instructions:**
1. **Translate all terms, categories, materials, and uses** into ${language === "it" ? "Italian" : "English"}.
2. **Identify and list the main uses** (e.g., domestic, industrial, medical, construction, etc.).
2. **If the same product can be made from different materials, list each material as a separate entry if it's an animal or something living don't show materials**.
4. **Act as an expert in TARIC classification. Your task is to accurately determine the most appropriate 2-digit TARIC "heading" or "commodity codes" for the term if there's possibility of more than just one give all. Please ensure that the classification follows the correct rules based on product type and use-case. 
5. **Ensure correct classification, avoiding confusion between raw materials and finished products.**

### **Product Description:**
"${textToProcess}"

### **Response Format (JSON):**
{
  "description": "Provide a summary of all suggested terms based on '${textToProcess}'",
  "suggestedTerms": [
    {
      "term": "Suggested term in ${language === "it" ? "Italian" : "English"}",
      "category": "Product category (e.g., Household item, Beverage, Electronics, etc.)",
      "materials": "Main materials (e.g., metal, plastic, wood). If it's a living thing, set this to 'N/A'.",
      "uses": "Main uses (e.g., domestic, industrial, construction) in ${language === "it" ? "Italian" : "English"}",
      "taricChapter": {
        "number": "The TARIC Chapter number (e.g., 73 for raw metal, 82 for tools, 39 for plastics, etc.)",
        "description": "Brief definition of the TARIC chapter in ${language === "it" ? "Italian" : "English"}"
      }
    }
  ]
}`;

    // Fetch suggestions from OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4', // Using GPT-4
      messages: [{ role: 'user', content: suggestionPrompt }],
      max_tokens: 500,
      temperature: 0,
    });

    let suggestionResponseText = completion.choices[0].message.content.trim();

    // Log the raw response from OpenAI
    console.log("Raw suggestion response:", suggestionResponseText);

    // Clean up formatting
    suggestionResponseText = suggestionResponseText.replace(/```json|```/g, "").trim();

    // Parse JSON response
    let suggestedTerms;
    try {
      suggestedTerms = JSON.parse(suggestionResponseText).suggestedTerms;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return res.status(400).json({
        error: "Invalid JSON format returned from model. Please check the model response.",
      });
    }

    // Log the final suggested terms
    console.log("Suggested terms:", suggestedTerms);

    // Return the suggested terms
    res.json({ suggestedTerms });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});


module.exports = router;
