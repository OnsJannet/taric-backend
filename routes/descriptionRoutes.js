const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import the correct class
require('dotenv').config(); // Load environment variables

// Initialize router
const router = express.Router();

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
    Basato sulla seguente descrizione ${language === 'it' ? 'in italiano' : 'in inglese'}, fornisci le seguenti informazioni in modo dettagliato:

    1. fornisci una frase che descrive l'oggetto utilizzando il termine corretto e includendo tutti i materiali specifici in un elenco. Ad esempio, se l'oggetto è un appendiabiti di plastica o di metallo, rispondi "Appendiabiti di legno, materiale plastico, metallo".\n\nDescrizione: "${textToProcess}".\n\nFormatta la risposta come segue:\n\n"[la frase completa con il termine corretto e i materiali in un elenco separato da virgole]". Assicurati di includere tutti i materiali menzionati nella descrizione e di fornire la risposta nel formato richiesto.\n
    2. Un elenco di codici di famiglia TARIC (6 cifre) associati ai materiali descritti.
    3. Un elenco di suggerimenti abbinati (12 cifre) corrispondenti a quei codici.
    4. Una breve descrizione per ciascun codice TARIC fornito.
    5. Mostra il codice e la descrizione per ciascun suggerimento abbinato.

    Descrizione: "${textToProcess}". 

    Formatta la risposta come segue:

    word: [la frase]
    Family: [elenco di codici di famiglia a 6 cifre, separati da una nuova linea per ogni codice]
    Descriptions: [descrizioni per ciascun codice, separati da una nuova linea per ogni descrizione]
    Matched Suggestion: [elenco di suggerimenti abbinati a 12 cifre, separati da una nuova linea per ogni suggerimento]
    Descriptions: [descrizioni per ciascun suggerimento, separati da una nuova linea per ogni descrizione]
    Possible Other Codes: [altri codici TARIC, separati da una nuova linea per ogni codice]
    Descriptions: [descrizioni per ciascun codice, separati da una nuova linea per ogni descrizione]. 
        
    Assicurati che ciascun codice e la sua descrizione siano su righe separate.
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


module.exports = router;
