const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import the correct class
require('dotenv').config(); // Load environment variables
const axios = require('axios');

const router = express.Router();
let goodsData = [];

// Load TARIC data from the given URL
const loadGoodsData = async () => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/OnsJannet/taric-backend/e529cf1b638f3b03a4b32d4716ea7d09d7802a81/taric.json');
    const parsedData = response.data;
    goodsData = parsedData.Sheet1 || [];
  } catch (error) {
    console.error('Error fetching taric.json:', error);
  }
};

// Middleware to load TARIC data
const loadDataMiddleware = async (req, res, next) => {
  await loadGoodsData();
  next();
};



// Initialize Google Generative AI instance
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // Use your Google API key directly here

// POST route to get word from description
router.post('/get-word', async (req, res) => {
  try {
    const { description, language } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    let textToProcess;
    console.log("description: " + description);

    // Use the description based on the provided language
    if (language === 'it') {
      textToProcess = description; // The original description in Italian

    } else if (language === 'en') {
      textToProcess = description; // The original description in English

    } else {
      return res.status(400).json({ error: "Unsupported language" });
    }
    
    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Specify the model

    // Generate content based on the description
    //const prompt = `Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci le seguenti informazioni in modo dettagliato:\n\n1. Una sola parola che descrive meglio l'oggetto (es. "appendiabiti" o "hanger").\n2. Un elenco di codici di famiglia TARIC (6 cifre) associati ai materiali descritti (legno, plastica, metallo), separati da virgole. Se nella descrizione ci sono materiali specifici, aggiungi i loro codici TARIC. I codici devono essere privi di punti (.) e consistenti di 6 cifre.\n3. Un elenco di suggerimenti abbinati (12 cifre) corrispondenti a quei codici di famiglia, separati da virgole. Anche i suggerimenti devono essere privi di punti (.) e consistenti di 12 cifre.\n\nDescrizione: "${textToProcess}".\n\nFormatta la risposta come segue:\n\nword: [la parola]\nFamily: [elenco di codici di famiglia a 4 cifre, senza punti]\nMatched Suggestion: [elenco di suggerimenti abbinati a 12 cifre, senza punti]. Assicurati di fornire tutte le informazioni richieste e di includere i codici dei materiali se presenti.`;
    const prompt = `Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci una frase che descrive l'oggetto utilizzando il termine corretto e includendo tutti i materiali specifici in un elenco. Ad esempio, se l'oggetto è un appendiabiti di plastica o di metallo, rispondi "Appendiabiti di legno, materiale plastico, metallo".\n\nDescrizione: "${textToProcess}".\n\nFormatta la risposta come segue:\n\n"[la frase completa con il termine corretto e i materiali in un elenco separato da virgole]". Assicurati di includere tutti i materiali menzionati nella descrizione e di fornire la risposta nel formato richiesto.`;

    //const prompt = `Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci una frase che descrive l'oggetto utilizzando il termine corretto e includendo i materiali specifici. Ad esempio, se l'oggetto è un appendiabiti di plastica o di metallo, rispondi "Appendiabiti di materiale plastico o di metallo".\n\nDescrizione: "${textToProcess}".\n\nRispondi con la seguente struttura:\n\n"word e material: [la frase completa]". Assicurati di fornire tutte le informazioni richieste.`;

    const result = await model.generateContent([prompt]);

    // Get the generated response
    const responseText = result.response.text().trim(); // Trim any whitespace


    // Process the response to extract the desired fields
    const lines = responseText.split('\n').reduce((acc, line) => {
      const [key, value] = line.split(':').map(item => item.trim());
      if (key && value) {
        acc[key] = value.split(',').map(item => item.trim());
      }
      return acc;
    }, {});

    // Return the structured response
    /*res.json({
      word: lines.word ? lines.word.join(', ') : '', // Join array if more than one word
      Family: lines.Family || [],
      'Matched Suggestion': lines['Matched Suggestion'] || []
    });*/
    res.json({responseText})
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});

// Define calculateScore function
function calculateScore(code, description) {
  // Example scoring logic
  if (description.includes(code)) {
    return 100;  // Perfect match
  } else {
    return 50;   // Partial match
  }
}

router.post('/get-taric-codes', async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate the input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!['it', 'en'].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    let textToProcess = description;

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Updated prompt to include the necessary instruction for code and description display
    const prompt = `
    Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci le seguenti informazioni:
  
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
    responseText = responseText.replace(/(\*\*Note:\*\*)([\s\S]*)/, '');

    // Clean up formatting (remove unnecessary markdown and line breaks)
    responseText = responseText.replace(/\*\*|\*\*/g, ''); // Remove bold formatting
    responseText = responseText.replace(/(\*\s*)|(\*\*\s*)/g, ''); // Remove asterisks from list items
    responseText = responseText.replace(/\n\n+/g, '\n'); // Replace multiple newlines with a single newline

    // Split the responseText to create a more structured response
    const sections = responseText.split('Family:')[1].split('Descriptions:');
    const familyCodes = sections[0] ? sections[0].trim().split('\n').map(line => line.trim()) : [];
    const descriptions = sections[1] ? sections[1].trim().split('\n').map(line => line.trim()) : [];

    const matchedSuggestions = sections[2] ? sections[2].trim().split('\n').map(line => line.trim()) : [];
    const suggestionDescriptions = sections[3] ? sections[3].trim().split('\n').map(line => line.trim()) : [];

    const otherCodes = sections[4] ? sections[4].trim().split('\n').map(line => line.trim()) : [];
    const otherDescriptions = sections[5] ? sections[5].trim().split('\n').map(line => line.trim()) : [];

    // Prepare the response as a JSON list
    const family = familyCodes.map((code, index) => {
      return {
        code,
        score: calculateScore(code, descriptions[index]), // Add a score based on some calculation
        description: descriptions[index] || 'No description available'
      };
    });

    // Add matched suggestions and their descriptions
    const suggestions = matchedSuggestions.map((suggestion, index) => {
      // Only include valid codes (12 digits)
      if (/^\d{12}$/.test(suggestion)) {
        return {
          suggestion,
          score: calculateScore(suggestion, suggestionDescriptions[index]), // Add a score based on some calculation
          description: suggestionDescriptions[index] || 'No description available'
        };
      }
    }).filter(Boolean);  // Filter out any undefined (invalid codes)

    // Add other possible codes and their descriptions
    const otherSuggestions = otherCodes.map((code, index) => {
      return {
        code,
        description: otherDescriptions[index] || 'No description available'
      };
    });

    // Send the response back as JSON
    res.json({
      family, // main TARIC codes and descriptions
      suggestions, // matched suggestions with valid codes and descriptions
      otherSuggestions // other possible codes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});


// Endpoint to get suggested terms
router.post('/get-suggested-terms', async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!['it', 'en'].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    let textToProcess = description;

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Generate suggestions for terms with materials, uses, and category
    const suggestionPrompt = `
    Given the following description, please generate suggested terms in ${language === 'it' ? 'Italian' : 'English'} without any additional text:
    
    Description: "${textToProcess}".

    Provide the terms in the following format:
    - Term: 
      - Category: ...
      - Materials: ...
      - Uses: ...
    Categorize the term based on its likely use (e.g., "Household item", "Industrial equipment", "Electronics", etc.).
    `;

    // Fetch suggestions from the model
    const suggestionResult = await model.generateContent([suggestionPrompt]);
    let suggestionResponseText = suggestionResult.response.text().trim();

    // Log the raw response from the model for debugging
    console.log("Raw suggestion response:", suggestionResponseText);

    // Clean up formatting
    suggestionResponseText = suggestionResponseText
      .replace(/\*\*/g, '') // Remove bold formatting
      .trim(); // Trim leading/trailing whitespace

    // Split the response into individual terms based on new lines and dashes
    const suggestedTerms = suggestionResponseText.split(/\n(?=-)/).map(term => {
      // Clean up each term
      const cleanedTerm = term.trim();

      // Extract the term name using a regex to capture up to the first colon
      const termMatch = cleanedTerm.match(/^(.+?):/);
      if (!termMatch) {
        console.warn(`Unexpected format for term: ${cleanedTerm}`);
        return null; // Skip if not in expected format
      }

      const termName = termMatch[1].trim();

      // Split category, materials, and uses
      const categoryMatch = cleanedTerm.match(/Category:\s*(.+?)(?:\n|$)/);
      const materialsMatch = cleanedTerm.match(/Materials:\s*(.+?)(?:\n|$)/);
      const usesMatch = cleanedTerm.match(/Uses:\s*(.+?)(?:\n|$)/);

      const category = categoryMatch ? categoryMatch[1].trim() : 'Uncategorized';
      const materials = materialsMatch ? materialsMatch[1].trim() : '';
      const uses = usesMatch ? usesMatch[1].trim() : '';

      return {
        term: termName,
        category: category,
        materials: materials,
        uses: uses,
      };
    }).filter(term => term !== null); // Filter out any null entries

    // Log the final suggested terms for debugging
    console.log("Suggested terms:", suggestedTerms);

    // Send the suggested terms back as JSON
    res.json({ suggestedTerms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});


router.post('/get-suggested-taric-codes', async (req, res) => {
  try {
    const { description, language } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }
    if (!['it', 'en'].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("language: " + language);

    let textToProcess = description;

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      `
    };

    const taricPrompt = languagePrompts[language];

    // Fetch TARIC code suggestions from the model
    const taricResult = await model.generateContent([taricPrompt]);
    let taricResponseText = taricResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Raw TARIC response:", taricResponseText);

    // Extract TARIC codes
    const taricCodes = {
      fourDigit: taricResponseText.match(/(?:Codice TARIC a 4 cifre|4-digit TARIC code):\s*(\d{4})/)?.[1] || null,
      eightDigit: taricResponseText.match(/(?:Codice TARIC a 8 cifre|8-digit TARIC code):\s*(\d{8})/)?.[1] || null,
      tenDigit: taricResponseText.match(/(?:Codice TARIC a 10 cifre|10-digit TARIC code):\s*(\d{10})/)?.[1] || null,
      twelveDigit: taricResponseText.match(/(?:Codice TARIC a 12 cifre|12-digit TARIC code):\s*(\d{12})/)?.[1] || null,
      sixteenDigit: taricResponseText.match(/(?:Codice TARIC a 16 cifre|16-digit TARIC code):\s*(\d{16})/)?.[1] || null
    };

    // Log the final TARIC codes for debugging
    console.log("TARIC codes:", taricCodes);

    // Send the TARIC codes back as JSON
    res.json({ taricCodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});




// Endpoint to get TARIC codes for the selected suggestion
router.post('/get-taric-code-questions', async (req, res) => {
  try {
    const { term, language } = req.body;

    // Validate input
    if (!term) {
      return res.status(400).json({ error: "Term is required" });
    }
    if (!['it', 'en'].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    console.log("Language: " + language);
    console.log("Term: " + term);

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Define the prompt for generating questions
    const questionPrompt = `
      Based on the following term, generate a series of questions to determine the appropriate TARIC code. 
      Ask these questions in ${language === 'it' ? 'Italian' : 'English'}.
      
      Ensure to provide each question as a separate line and in a clear format.

      Term: "${term}"

      Ensure to cover all aspects needed for TARIC classification.
    `;

    // Fetch questions from the model
    const questionsResult = await model.generateContent([questionPrompt]);
    const questionsText = questionsResult.response.text().trim();

    // Log the raw response for debugging
    console.log("Generated Questions:", questionsText);

    // Process the questions into a structured format
    const structuredQuestions = questionsText.split('\n').map((question) => ({
      question: question.trim(), // Clean the question
      answers: [] // Initialize an empty answers array for potential user inputs
    })).filter(q => q.question); // Remove any empty questions

    // Send the structured questions back as JSON
    res.json({ questions: structuredQuestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});


// Endpoint to get TARIC codes based on user answers
router.post('/get-taric-code-answers', async (req, res) => {
  try {
    const { answers } = req.body;

    // Validate input
    if (!answers) {
      return res.status(400).json({ error: "Answers are required" });
    }

    console.log("Received Answers:", answers);

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Define the prompt for generating the TARIC code based on the answers
    const taricCodePrompt = `
      Based on the following answers, please generate the most appropriate TARIC codes with their descriptions. 
      Please ensure that if the answers are in Italian, the description of the code is also in Italian; otherwise, it should be in English.
      Provide the TARIC codes in the following formats as a list:
      
      - **4-digit:** XXXX: description
      - **8-digit:** XXXX.XX: description
      - **10-digit:** XXXX.XX.XX: description
      - **12-digit:** XXXX.XX.XX.XX: description

      Answers: ${JSON.stringify(answers)}

      Do not respond with any limitations or reasons why TARIC codes cannot be provided. Instead, please provide the best possible TARIC codes based on the provided information, formatted as a list. Ensure that the list contains TARIC codes regardless of the specificity of the details. 

    `;

    // Fetch TARIC codes from the model
    const taricCodeResult = await model.generateContent([taricCodePrompt]);
    const taricCodeText = taricCodeResult.response.text().trim();
    console.log("taricCodeText", taricCodeText);

    // Log the raw response for debugging
    console.log("Generated TARIC Codes:", taricCodeText);

    // Extract TARIC codes and descriptions using regex
    const taricCodes = {};
    const taricCodeRegex = /(\b\d{4}(?:\.\d{2}){0,3}\b): (.+?)(?=\n|$)/g;
    let match;

    // Loop through all matches and add them to the taricCodes object
    while ((match = taricCodeRegex.exec(taricCodeText)) !== null) {
      const code = match[1];
      const description = match[2];
      taricCodes[code] = description;
    }

    // Log the final TARIC codes for debugging
    console.log("Extracted TARIC Codes with Descriptions:", taricCodes);

    // Send the TARIC codes back as JSON
    res.json({ taricCodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});







router.post('/get-taric-codes-new-json', async (req, res) => {
  try {
    const { word, materials, uses, language } = req.body;

    // Validate input
    if (!word || !materials || !uses) {
      return res.status(400).json({ error: "Word, materials, and uses are required" });
    }
    if (!['it', 'en'].includes(language)) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    const family = [];

    // Function to find matching TARIC codes based on materials and uses
    const findTaricCodes = (material) => {
      return goodsData.filter(item => 
        item.Description.toLowerCase().includes(material.toLowerCase()) ||
        item.DescriptionEN.toLowerCase().includes(material.toLowerCase())
      );
    };

    // Prepare an array of materials
    const materialsArray = materials.split(',').map(material => material.trim());

    // Iterate through materials to find TARIC codes
    materialsArray.forEach(material => {
      const codes = findTaricCodes(material);
      codes.forEach(code => {
        const codeToAdd = {
          code: code.Goodscode,
          description: language === 'it' ? code.Description : code.DescriptionEN
        };
        family.push(codeToAdd);
      });
    });

    // Send the TARIC codes and descriptions back as JSON
    res.json({ family });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});

module.exports = router;






module.exports = router;
