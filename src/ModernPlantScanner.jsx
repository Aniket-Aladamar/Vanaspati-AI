// Modern DruvyaGuna Plant Scanner - Enhanced with Chat & Interactive Features
// Frontend-only AI plant scanner with conversational AI and advanced mobile features

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { track } from '@vercel/analytics';
import { 
  CameraIcon, 
  DocumentArrowUpIcon, 
  XMarkIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SpeakerWaveIcon,
  ShareIcon,
  QuestionMarkCircleIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

export default function ModernPlantScanner() {
  // Basic state
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plantData, setPlantData] = useState(null);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  
  // Chat features
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const fileRef = useRef();
  const chatEndRef = useRef();

  // Enhanced prompting for better plant identification
  const getPlantPrompt = () => `
You are an expert botanist and Ayurvedic practitioner. Analyze this plant image with highest accuracy.

IDENTIFICATION REQUIREMENTS:
1. Examine leaf shape, arrangement, venation, margins carefully
2. Look for flowers, fruits, bark texture, growth habit
3. Consider size indicators and environmental context
4. Cross-reference with known medicinal plants

AYURVEDIC ANALYSIS:
1. Include Sanskrit names and regional variations
2. Detail Rasa (taste), Virya (potency), Vipaka (post-digestive effect)
3. Specify Dosha effects (Vata, Pitta, Kapha)
4. Traditional formulations and preparations

RESPONSE FORMAT (JSON only):
{
  "confidence": 0.95,
  "identification": {
    "commonName": "Common English name",
    "botanicalName": "Genus species",
    "family": "Plant family",
    "ayurvedicName": "Primary Sanskrit name",
    "synonyms": ["Alt name 1", "Alt name 2"]
  },
  "ayurvedic": {
    "classification": {
      "rasa": ["Sweet", "Bitter"],
      "virya": "Hot/Cold",
      "vipaka": "Sweet/Pungent/Bitter",
      "doshaEffect": {
        "vata": "Increases/Decreases/Balances",
        "pitta": "Increases/Decreases/Balances", 
        "kapha": "Increases/Decreases/Balances"
      }
    },
    "partsUsed": ["Root", "Leaves", "Bark"],
    "primaryUses": ["Traditional use 1", "Traditional use 2"],
    "preparations": [
      {
        "name": "Preparation name",
        "method": "How it's prepared",
        "dosage": "Traditional dosage"
      }
    ],
    "contraindications": ["Safety warning 1", "Safety warning 2"]
  },
  "cultivation": {
    "growingConditions": "How to grow this plant",
    "seasonality": "When it's available"
  }
}

Focus on accuracy. If uncertain about Ayurvedic uses, be honest about limitations.
`;

  // Chat prompts for follow-up questions
  const getChatPrompt = (question, plantContext = null) => `
You are an expert Ayurvedic botanist and plant medicine specialist.

${plantContext ? `
CONTEXT: User identified plant: ${plantContext.identification?.commonName} (${plantContext.identification?.botanicalName})
Previous analysis: ${JSON.stringify(plantContext, null, 2)}
` : ''}

USER QUESTION: "${question}"

Provide helpful, accurate answers about plants, Ayurveda, botany, or traditional medicine.

Guidelines:
- Be conversational and friendly
- Provide practical, actionable information  
- Include safety warnings when relevant
- Reference traditional texts when appropriate
- Be honest if you don't know something
- Keep responses concise but informative

Response: Natural conversational text (no JSON)
`;

  const quickQuestions = [
    "How do I prepare this plant medicinally?",
    "What are the side effects or precautions?", 
    "Can I grow this plant at home?",
    "What other plants are similar to this?",
    "How is this used in modern medicine?",
    "What's the best time to harvest this plant?"
  ];

  const initializeGemini = () => {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not found. Please add REACT_APP_GEMINI_API_KEY to your environment variables.');
    }
    return new GoogleGenerativeAI(GEMINI_API_KEY);
  };

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      handleFileSelection(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleFileSelection = (file) => {
    setError(null);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPlantData(null);
    setScanProgress(0);
    setChatMessages([]);
    setShowChat(false);
    toast.success('Image loaded! Ready to scan.');
    
    // Track image upload
    track('image_uploaded', {
      fileSize: file.size,
      fileType: file.type
    });
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  };

  const simulateProgress = () => {
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return interval;
  };

  const identifyPlant = async () => {
    if (!imageFile) {
      toast.error('Please upload or take a photo first.');
      return;
    }

    setLoading(true);
    setError(null);
    setPlantData(null);
    
    const progressInterval = simulateProgress();
    
    // Track identification attempt
    track('plant_identification_started', {
      imageSize: imageFile.size,
      imageType: imageFile.type
    });
    
    try {
      const genAI = initializeGemini();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const imagePart = await fileToGenerativePart(imageFile);
      const prompt = getPlantPrompt();
      
      toast.loading('AI analyzing plant...', { id: 'scanning' });
      
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        const jsonText = text.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonText);
        
        setPlantData(data);
        toast.success('Plant identified successfully!', { id: 'scanning' });
        
        // Track successful identification
        track('plant_identification_success', {
          confidence: data.confidence,
          plantFamily: data.identification?.family,
          commonName: data.identification?.commonName,
          hasAyurvedicData: !!data.ayurvedic
        });
        
        // Add welcome chat message
        const welcomeMessage = {
          type: 'ai',
          content: `Great! I've identified this as ${data.identification?.commonName}. Feel free to ask me any questions about this plant - preparation methods, safety concerns, cultivation tips, or anything else you'd like to know!`,
          timestamp: new Date()
        };
        setChatMessages([welcomeMessage]);
        
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        track('plant_identification_parse_error', {
          error: parseError.message
        });
        throw new Error('Failed to parse AI response. Please try again.');
      }
      
    } catch (err) {
      console.error('Plant identification error:', err);
      clearInterval(progressInterval);
      setScanProgress(0);
      const errorMessage = err.message || 'Identification failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage, { id: 'scanning' });
      
      // Track identification failure
      track('plant_identification_error', {
        error: errorMessage,
        errorType: err.name || 'Unknown'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setPlantData(null);
    setError(null);
    setScanProgress(0);
    setChatMessages([]);
    setShowChat(false);
    setChatInput('');
    if (fileRef.current) fileRef.current.value = '';
    toast.success('Reset complete');
    
    // Track reset action
    track('app_reset');
  };

  // Chat functionality
  const sendChatMessage = async (message = null) => {
    const question = message || chatInput.trim();
    if (!question) return;

    setChatInput('');
    setChatLoading(true);
    
    const userMessage = { type: 'user', content: question, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);

    // Track chat interaction
    track('chat_message_sent', {
      messageLength: question.length,
      isQuickQuestion: !!message,
      hasPlantContext: !!plantData
    });

    try {
      const genAI = initializeGemini();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = getChatPrompt(question, plantData);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const aiMessage = { type: 'ai', content: text, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMessage]);
      
      // Track successful chat response
      track('chat_response_received', {
        responseLength: text.length,
        questionType: message ? 'quick_question' : 'custom_question'
      });
      
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = { 
        type: 'ai', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      };
      setChatMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to get response');
      
      // Track chat error
      track('chat_error', {
        error: err.message || 'Unknown error'
      });
    } finally {
      setChatLoading(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
      toast.success('Speaking...');
      
      // Track text-to-speech usage
      track('text_to_speech_used', {
        textLength: text.length
      });
    } else {
      toast.error('Text-to-speech not supported');
    }
  };

  const shareResults = async () => {
    if (!plantData) return;

    const shareText = `🌱 Plant Identified: ${plantData.identification?.commonName}\n📋 Botanical: ${plantData.identification?.botanicalName}\n🔬 Confidence: ${Math.round((plantData.confidence || 0) * 100)}%\n\nIdentified with Vanaspati AI Plant Scanner`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Plant Identification Results',
          text: shareText,
          url: window.location.href
        });
        
        // Track native share
        track('results_shared', {
          method: 'native_share',
          plantName: plantData.identification?.commonName,
          confidence: plantData.confidence
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Results copied to clipboard!');
        
        // Track clipboard share
        track('results_shared', {
          method: 'clipboard',
          plantName: plantData.identification?.commonName,
          confidence: plantData.confidence
        });
      } catch (err) {
        toast.error('Share failed');
      }
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-primary-50 via-white to-primary-100'}`}>
      <Toaster position="top-right" />
      
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${darkMode ? 'bg-gray-800/80' : 'bg-white/80'} backdrop-blur-md border-b ${darkMode ? 'border-gray-700' : 'border-primary-200'} sticky top-0 z-50`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center"
              >
                <SparklesIcon className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold gradient-text ${darkMode ? 'text-white' : ''}`}>
                  Vanaspati AI
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Advanced Plant Scanner
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const newMode = !darkMode;
                  setDarkMode(newMode);
                  track('dark_mode_toggled', { enabled: newMode });
                }}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-primary-100 text-primary-700'}`}
              >
                {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </motion.button>
              
              {plantData && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={shareResults}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-100 text-blue-700'}`}
                >
                  <ShareIcon className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          
          {/* Upload Section */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg border ${darkMode ? 'border-gray-700' : 'border-primary-100'} overflow-hidden`}>
              <div className="p-4 sm:p-6">
                <h2 className={`text-xl font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : ''}`}>
                  <CameraIcon className="w-5 h-5 mr-2 text-primary-600" />
                  Plant Photo
                </h2>
                
                {/* Drag & Drop Area */}
                <div
                  {...getRootProps()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-all duration-300
                    ${isDragActive ? 'border-primary-400 bg-primary-50' : `${darkMode ? 'border-gray-600 hover:border-primary-400 bg-gray-700/50' : 'border-gray-300 hover:border-primary-400'}`}
                  `}
                >
                  <input {...getInputProps()} />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  
                  {previewUrl ? (
                    <div className="space-y-4">
                      <motion.img
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={previewUrl}
                        alt="Plant preview"
                        className="w-full rounded-lg shadow-md"
                      />
                      
                      {loading && (
                        <div className="space-y-2">
                          <div className={`w-full ${darkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded-full h-2 relative overflow-hidden`}>
                            <motion.div
                              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: `${scanProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            Analyzing... {Math.round(scanProgress)}%
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <DocumentArrowUpIcon className={`w-12 h-12 mx-auto ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                          {isDragActive ? 'Drop image here' : 'Upload plant photo'}
                        </p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                          Drag & drop or click to select
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-3 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-primary-600 text-white rounded-lg font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    <CameraIcon className="w-4 h-4" />
                    <span>Camera</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={identifyPlant}
                    disabled={!imageFile || loading}
                    className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        <span>Scan</span>
                      </>
                    )}
                  </motion.button>
                </div>
                
                {imageFile && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={resetAll}
                    className={`w-full mt-3 py-2 px-4 border rounded-lg font-medium flex items-center justify-center space-x-2 ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                    <span>Reset</span>
                  </motion.button>
                )}
                
                {/* Tips */}
                <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-primary-50'}`}>
                  <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-green-400' : 'text-primary-800'}`}>
                    📸 Photo Tips
                  </h3>
                  <ul className={`text-xs space-y-1 ${darkMode ? 'text-gray-300' : 'text-primary-700'}`}>
                    <li>• Include leaves, flowers, or fruits if visible</li>
                    <li>• Capture clear, well-lit images</li>
                    <li>• Show distinctive plant features</li>
                    <li>• Avoid blurry or distant shots</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
          
          {/* Results Section */}
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg border ${darkMode ? 'border-gray-700' : 'border-primary-100'}`}>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-semibold flex items-center ${darkMode ? 'text-white' : ''}`}>
                    <EyeIcon className="w-5 h-5 mr-2 text-primary-600" />
                    Analysis Results
                  </h2>
                  
                  {plantData && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const newChatState = !showChat;
                        setShowChat(newChatState);
                        track('chat_toggled', { opened: newChatState });
                      }}
                      className={`p-2 rounded-lg ${showChat ? 'bg-primary-600 text-white' : darkMode ? 'bg-gray-700 text-primary-400' : 'bg-primary-100 text-primary-700'}`}
                    >
                      <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
                
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6"
                    >
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-red-700">{error}</p>
                    </motion.div>
                  )}
                  
                  {!plantData && !loading && !error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-gray-700' : 'bg-primary-100'}`}
                      >
                        <SparklesIcon className="w-8 h-8 text-primary-600" />
                      </motion.div>
                      <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                        Upload a plant photo to get started
                      </p>
                      <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        AI-powered identification with Ayurvedic knowledge
                      </p>
                    </motion.div>
                  )}
                  
                  {plantData && !showChat && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {/* Plant Identification Header */}
                      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 sm:p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold">
                              {plantData.identification?.commonName || 'Unknown Plant'}
                            </h3>
                            <p className="text-primary-100 italic text-sm sm:text-base">
                              {plantData.identification?.botanicalName || 'Classification pending'}
                            </p>
                            <p className="text-primary-200 font-medium text-sm sm:text-base">
                              {plantData.identification?.ayurvedicName || 'Sanskrit name unknown'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl sm:text-3xl font-bold">
                              {Math.round((plantData.confidence || 0) * 100)}%
                            </div>
                            <div className="text-primary-200 text-sm">Confidence</div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Plant Information */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Basic Information */}
                        <div className={`p-4 sm:p-6 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                            Basic Information
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Common Name:</label>
                              <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {plantData.identification?.commonName || 'Not identified'}
                              </p>
                            </div>
                            <div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Botanical Name:</label>
                              <p className={`font-medium italic ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                                {plantData.identification?.botanicalName || 'Not classified'}
                              </p>
                            </div>
                            <div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Ayurvedic Name:</label>
                              <p className={`font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                {plantData.identification?.ayurvedicName || 'Sanskrit name unknown'}
                              </p>
                            </div>
                            <div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Family:</label>
                              <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {plantData.identification?.family || 'Family unknown'}
                              </p>
                            </div>
                            {plantData.identification?.synonyms && plantData.identification.synonyms.length > 0 && (
                              <div>
                                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Synonyms:</label>
                                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {plantData.identification.synonyms.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ayurvedic Classification */}
                        {plantData.ayurvedic?.classification && (
                          <div className={`p-4 sm:p-6 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                            <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                              Ayurvedic Classification
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Rasa (Taste):</label>
                                <p className={`font-medium ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                                  {plantData.ayurvedic.classification.rasa?.join(', ') || 'Not documented'}
                                </p>
                              </div>
                              <div>
                                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Virya (Potency):</label>
                                <p className={`font-medium ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                                  {plantData.ayurvedic.classification.virya || 'Not documented'}
                                </p>
                              </div>
                              <div>
                                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Vipaka (Post-digestive effect):</label>
                                <p className={`font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                                  {plantData.ayurvedic.classification.vipaka || 'Not documented'}
                                </p>
                              </div>
                              {plantData.ayurvedic.classification.doshaEffect && (
                                <div>
                                  <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Dosha Effects:</label>
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="text-center p-2 bg-yellow-100 rounded border">
                                      <div className="text-xs font-medium text-yellow-800">Vata</div>
                                      <div className="text-xs text-yellow-700">
                                        {plantData.ayurvedic.classification.doshaEffect.vata || 'Unknown'}
                                      </div>
                                    </div>
                                    <div className="text-center p-2 bg-red-100 rounded border">
                                      <div className="text-xs font-medium text-red-800">Pitta</div>
                                      <div className="text-xs text-red-700">
                                        {plantData.ayurvedic.classification.doshaEffect.pitta || 'Unknown'}
                                      </div>
                                    </div>
                                    <div className="text-center p-2 bg-green-100 rounded border">
                                      <div className="text-xs font-medium text-green-800">Kapha</div>
                                      <div className="text-xs text-green-700">
                                        {plantData.ayurvedic.classification.doshaEffect.kapha || 'Unknown'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Parts Used & Traditional Uses */}
                        <div className={`p-4 sm:p-6 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                            Medicinal Parts & Uses
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Parts Used:</label>
                              <p className={`font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                {plantData.ayurvedic?.partsUsed?.join(', ') || 'Not documented'}
                              </p>
                            </div>
                            {plantData.ayurvedic?.primaryUses && plantData.ayurvedic.primaryUses.length > 0 && (
                              <div>
                                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Traditional Uses:</label>
                                <ul className="mt-2 space-y-1">
                                  {plantData.ayurvedic.primaryUses.map((use, index) => (
                                    <li key={index} className={`text-sm flex items-start ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                      {use}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preparations & Recipes */}
                        {plantData.ayurvedic?.preparations && plantData.ayurvedic.preparations.length > 0 && (
                          <div className={`p-4 sm:p-6 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                            <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                              Preparations & Recipes
                            </h4>
                            <div className="space-y-4">
                              {plantData.ayurvedic.preparations.map((prep, index) => (
                                <div key={index} className={`p-3 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-600/30' : 'border-gray-200 bg-gray-50'}`}>
                                  <h5 className={`font-semibold text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                                    {prep.name}
                                  </h5>
                                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <strong>Method:</strong> {prep.method}
                                  </p>
                                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <strong>Dosage:</strong> {prep.dosage}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cultivation Information */}
                        {plantData.cultivation && (
                          <div className={`lg:col-span-2 p-4 sm:p-6 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                            <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                              Cultivation Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {plantData.cultivation.growingConditions && (
                                <div>
                                  <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Growing Conditions:</label>
                                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {plantData.cultivation.growingConditions}
                                  </p>
                                </div>
                              )}
                              {plantData.cultivation.seasonality && (
                                <div>
                                  <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Seasonality:</label>
                                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {plantData.cultivation.seasonality}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Safety & Contraindications */}
                        {plantData.ayurvedic?.contraindications && plantData.ayurvedic.contraindications.length > 0 && (
                          <div className={`lg:col-span-2 p-4 sm:p-6 rounded-xl border-2 border-red-200 ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
                            <h4 className={`text-lg font-semibold mb-4 flex items-center ${darkMode ? 'text-red-300' : 'text-red-800'}`}>
                              <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                              Safety & Contraindications
                            </h4>
                            <ul className="space-y-2">
                              {plantData.ayurvedic.contraindications.map((warning, index) => (
                                <li key={index} className={`text-sm flex items-start ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Chat Prompt */}
                      <div className={`p-4 rounded-lg border-2 border-dashed ${darkMode ? 'border-gray-600 bg-gray-700/50' : 'border-primary-300 bg-primary-50'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-primary-800'}`}>
                              Ask me anything about this plant!
                            </h4>
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-primary-600'}`}>
                              Preparation methods, safety, cultivation, similar plants...
                            </p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowChat(true)}
                            className="bg-primary-600 text-white p-2 rounded-lg"
                          >
                            <ChatBubbleLeftRightIcon className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>
                      
                      {/* Quick Questions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {quickQuestions.slice(0, 4).map((question, index) => (
                          <motion.button
                            key={index}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setShowChat(true);
                              sendChatMessage(question);
                            }}
                            className={`p-3 text-left rounded-lg border text-sm ${darkMode ? 'border-gray-600 hover:bg-gray-700 text-gray-300' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                          >
                            <QuestionMarkCircleIcon className="w-4 h-4 inline mr-2 text-primary-600" />
                            {question}
                          </motion.button>
                        ))}
                      </div>
                      
                      {/* Disclaimer */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-xs text-red-700">
                          <strong>Medical Disclaimer:</strong> This information is for educational purposes only. 
                          AI identification may not be 100% accurate. Always consult qualified healthcare 
                          practitioners before using any plant medicinally.
                        </p>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Chat Interface */}
                  {showChat && plantData && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      {/* Chat Header */}
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          Chat with AI Expert
                        </h3>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowChat(false)}
                          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        >
                          <XMarkIcon className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        </motion.button>
                      </div>
                      
                      {/* Chat Messages */}
                      <div className={`h-96 overflow-y-auto border rounded-lg p-4 space-y-4 ${darkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}>
                        {chatMessages.map((message, index) => (
                          <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs sm:max-w-md p-3 rounded-lg ${
                              message.type === 'user' 
                                ? 'bg-primary-600 text-white' 
                                : darkMode ? 'bg-gray-600 text-gray-100' : 'bg-white text-gray-800'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                              {message.type === 'ai' && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => speakText(message.content)}
                                  className="mt-2 p-1 opacity-70 hover:opacity-100"
                                >
                                  <SpeakerWaveIcon className="w-4 h-4" />
                                </motion.button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                              <div className="flex space-x-1">
                                <motion.div
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                                  className="w-2 h-2 bg-primary-600 rounded-full"
                                />
                                <motion.div
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                                  className="w-2 h-2 bg-primary-600 rounded-full"
                                />
                                <motion.div
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                                  className="w-2 h-2 bg-primary-600 rounded-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      
                      {/* Chat Input */}
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                          placeholder="Ask about this plant..."
                          className={`flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            darkMode ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white'
                          }`}
                        />
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => sendChatMessage()}
                          disabled={chatLoading || !chatInput.trim()}
                          className="p-3 bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PaperAirplaneIcon className="w-5 h-5" />
                        </motion.button>
                      </div>
                      
                      {/* Quick Question Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {quickQuestions.map((question, index) => (
                          <motion.button
                            key={index}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => sendChatMessage(question)}
                            className={`px-3 py-1 text-xs rounded-full border ${
                              darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {question.slice(0, 25)}...
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
      
      {/* Floating Action Buttons */}
      <div className="fixed bottom-4 right-4 flex flex-col space-y-3 z-40">
        {plantData && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowChat(!showChat)}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center ${
              showChat ? 'bg-red-600' : 'bg-primary-600'
            } text-white`}
          >
            {showChat ? <XMarkIcon className="w-6 h-6" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" />}
          </motion.button>
        )}
        
        {!loading && plantData && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={resetAll}
            className="w-12 h-12 bg-gray-600 text-white rounded-full shadow-lg flex items-center justify-center"
          >
            <ArrowPathIcon className="w-6 h-6" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
