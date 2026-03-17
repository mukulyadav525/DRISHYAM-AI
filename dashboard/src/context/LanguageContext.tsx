"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "hi";

interface Translations {
    [key: string]: {
        [key: string]: string;
    };
}

const translations: Translations = {
    en: {
        overview: "Overview",
        detection: "Detection Grid",
        honeypot: "AI Honeypot",
        graph: "Fraud Graph",
        alerts: "Alert Console",
        settings: "Settings",
        deepfake: "Deepfake Defense",
        history: "Forensic History",
        mule: "Mule Interceptor",
        inoculation: "Inoculation",
        upi_shield: "UPI Shield",
        sentinel_score: "Sentinel Score",
        recovery: "Recovery",
        bharat_layer: "Bharat Layer",
        reverse_profiling: "Reverse Profiling",
        command_center: "Command Center",
        agency_portal: "Agency Portal",
        launch_control: "Launch Control",
        call_shield: "Call Shield",
        welcome: "Welcome, National Officer",
        protecting: "Protecting 1.4B Indians",
        system_online: "System Online",
        // Overview Page
        sub_welcome: "Bharat Anti-Scam Intelligence Grid Master Operational Interface.",
        export_report: "Export Report",
        view_live_map: "View Live Map",
        total_scams_blocked: "Total Scams Blocked",
        across_states: "Across 28 States & 8 UTs",
        citizens_protected: "Citizens Protected",
        active_grid_participants: "Active Grid Participants",
        estimated_savings: "Estimated Savings",
        financial_loss_prevented: "Direct Financial Loss Prevented",
        active_threats: "Active Threats",
        high_intensity_surges: "Ongoing High-Intensity Surges",
        scam_weather_forecast: "Scam Weather Forecast",
        today: "Today",
        past_week: "Past Week",
        init_geo_layer: "Initialize Geographic Intelligence Layer",
        node_access_required: "Requires NPCI & DoT Node Access",
        live_intel_feed: "Live Intelligence Feed",
        connect_live_ticker: "Connect Live Ticker",
        // Detection Page
        detection_grid: "Detection Grid",
        telecom_analysis: "Real-time telecom metadata analysis & fraud scoring.",
        search_number: "Search Number...",
        live_stream: "Live Stream",
        calls_per_min: "Calls/Min",
        source_number: "Source Number",
        inferred_location: "Inferred Location",
        fraud_risk_index: "Fraud Risk Index",
        verdict: "Verdict",
        activity: "Activity",
        details: "Details",
        view_history: "View Historical Archive",
        top_risk_vectors: "Top Risk Vectors",
        network_integrity: "Network Layer Integrity",
        network_desc: "Sentinel Grid is currently integrated with 4 major telecom operators. Cryptographic signatures verified for 98.4% of traffic.",
        active_nodes: "Active Nodes",
        latency: "Latency",
        // Honeypot Page
        honeypot_engine: "AI Honeypot Engine",
        agentic_orchestration: "Agentic AI orchestration for scammer fatigue & extraction.",
        optimize_strategies: "Optimize Strategies",
        launch_probe: "Launch New Probe",
        live_interceptions: "Live Conversational Interceptions",
        sessions_active: "Sessions Active",
        persona: "Persona",
        live_transcript: "Live Transcript Excerpt",
        intervene: "Intervene",
        audio_verified: "Audio Stream Verified",
        persona_library: "Persona Library",
        create_persona: "Create New Persona",
        extraction_metrics: "Extraction Metrics",
        time_wasted: "Scammer Time Wasted",
        data_extracted: "Data Points Extracted",
        fatigue_index: "Fatigue Index",
        sample_transcript_placeholder: "Yes, I understand beta, the OTP is very important. Let me find my glasses first, they were right here on the table...",
        // Alerts Page
        public_alert_console: "Public Alert Console",
        broadcast_warnings: "Broadcast high-priority scam warnings to citizen devices.",
        alert_history: "Alert History",
        broadcast_emergency: "Broadcast Emergency Alert",
        new_composer: "New Alert Composer",
        alert_category: "Alert Category",
        target_region: "Target Region",
        alert_message: "Alert Message (Multilingual)",
        standard_templates: "Standard Templates Available",
        auto_translation: "Auto-Translation Active",
        trans_desc: "Message will be broadcast in Hindi, English, and Marathi based on region.",
        edit_trans: "Edit Translations",
        save_draft: "Save Draft",
        preview_send: "Preview & Send",
        audience_coverage: "Audience Coverage",
        target_reach: "Target Reach",
        geo_spread: "Geograhic Spread",
        priority_delivery: "Priority Delivery",
        recent_records: "Recent Records",
        critical_note: "Critical Note",
        tokens_note: "Broadcasts consume National Priority Tokens. Use only for confirmed multi-victim campaigns.",
        // Graph Page
        fraud_graph: "Fraud Intelligence Graph",
        cross_entity: "Cross-entity correlation showing suspicious network linkages.",
        query_entity: "Query Entity (UPI/Phone)...",
        generate_fir: "Generate FIR Packet",
        graph_active: "Interactive Graph Active",
        entities_found: "Found 12 related entities for current cluster.",
        node_health: "Node Health: Optimal",
        refresh_correlations: "Refresh Correlations",
        entity_intel: "Entity Intelligence",
        current_target: "Current Target",
        network_profile: "Network Profile",
        role: "Role",
        confidence: "Confidence",
        report_count: "Report Count",
        connected_wallets: "Connected Wallets",
        export_evidence: "Export SID-Evidence",
        compliance_note: "Automated package ready for Section 65B compliance."
    },
    hi: {
        overview: "अवलोकन",
        detection: "डिटेक्शन ग्रिड",
        honeypot: "एआई हनीपॉट",
        graph: "धोखाधड़ी ग्राफ",
        alerts: "अलर्ट कंसोल",
        settings: "सेटिंग्स",
        deepfake: "डीपफेक रक्षा",
        history: "फॉरेंसिक इतिहास",
        mule: "म्यूल इंटरceptor",
        inoculation: "टीकाकरण",
        upi_shield: "UPI शील्ड",
        sentinel_score: "सेंटिनल स्कोर",
        recovery: "पुनर्प्राप्ति",
        bharat_layer: "भारत लेयर",
        reverse_profiling: "रिवर्स प्रोफाइलिंग",
        command_center: "कमांड सेंटर",
        agency_portal: "एजेंसी पोर्टल",
        launch_control: "लॉन्च कंट्रोल",
        call_shield: "कॉल शील्ड",
        welcome: "स्वागत है, राष्ट्रीय अधिकारी",
        protecting: "140 करोड़ भारतीयों की सुरक्षा",
        system_online: "सिस्टम ऑनलाइन",
        // Overview Page (Roughly translated for now as requested removal of hardcoded)
        sub_welcome: "भारत एंटी-स्कैम इंटेलिजेंस ग्रिड मास्टर ऑपरेशनल इंटरफेस।",
        export_report: "रिपोर्ट निर्यात करें",
        view_live_map: "लाइव मैप देखें",
        total_scams_blocked: "कुल स्कैम ब्लॉक किए गए",
        across_states: "28 राज्यों और 8 केंद्र शासित प्रदेशों में",
        citizens_protected: "नागरिक सुरक्षित",
        active_grid_participants: "सक्रिय ग्रिड प्रतिभागी",
        estimated_savings: "अनुमानित बचत",
        financial_loss_prevented: "प्रत्यक्ष वित्तीय हानि को रोका गया",
        active_threats: "सक्रिय खतरे",
        high_intensity_surges: "चल रहे उच्च-तीव्रता वाले उछाल",
        scam_weather_forecast: "स्कैम पूर्वानुमान",
        today: "आज",
        past_week: "पिछला सप्ताह",
        init_geo_layer: "भौगोलिक खुफिया परत शुरू करें",
        node_access_required: "NPCI और DoT नोड एक्सेस की आवश्यकता है",
        live_intel_feed: "लाइव इंटेलिजेंस फीड",
        connect_live_ticker: "लाइव टिकर कनेक्ट करें",
        // Detection Page
        detection_grid: "डिटेक्शन ग्रिड",
        telecom_analysis: "वास्तविक समय दूरसंचार मेटाडेटा विश्लेषण और धोखाधड़ी स्कोरिंग।",
        search_number: "नंबर खोजें...",
        live_stream: "लाइव स्ट्रीम",
        calls_per_min: "कॉल/मिनट",
        source_number: "स्रोत नंबर",
        inferred_location: "अनुमानित स्थान",
        fraud_risk_index: "धोखाधड़ी जोखिम सूचकांक",
        verdict: "निर्णय",
        activity: "गतिविधि",
        details: "विवरण",
        view_history: "ऐतिहासिक संग्रह देखें",
        top_risk_vectors: "शीर्ष जोखिम कारक",
        network_integrity: "नेटवर्क परत अखंडता",
        network_desc: "सेंटिनल ग्रिड वर्तमान में 4 प्रमुख दूरसंचार ऑपरेटरों के साथ एकीकृत है। 98.4% ट्रैफ़िक के लिए क्रिप्टोग्राफ़िक हस्ताक्षर सत्यापित।",
        active_nodes: "सक्रिय नोड्स",
        latency: "विलंबता",
        // Honeypot Page
        honeypot_engine: "एआई हनीपॉट इंजन",
        agentic_orchestration: "स्कैमर थकान और निष्कर्षण के लिए एजेंटिक एआई ऑर्केस्ट्रेशन।",
        optimize_strategies: "रणनीति अनुकूलित करें",
        launch_probe: "नई जांच शुरू करें",
        live_interceptions: "लाइव संवादात्मक अवरोधन",
        sessions_active: "सत्र सक्रिय",
        persona: "व्यक्तित्व",
        live_transcript: "लाइव प्रतिलेख अंश",
        intervene: "हस्तक्षेप करें",
        audio_verified: "ऑडियो स्ट्रीम सत्यापित",
        persona_library: "व्यक्तित्व पुस्तकालय",
        create_persona: "नया व्यक्तित्व बनाएं",
        extraction_metrics: "निष्कर्षण मेट्रिक्स",
        time_wasted: "स्कैमर का समय बर्बाद हुआ",
        data_extracted: "डेटा अंक निकाले गए",
        fatigue_index: "थकान सूचकांक",
        sample_transcript_placeholder: "हाँ, मैं समझती हूँ बेटा, ओटीपी बहुत ज़रूरी है। पहले मुझे अपना चश्मा ढूंढने दो, वे यहीं मेज पर थे...",
        // Alerts Page
        public_alert_console: "सार्वजनिक अलर्ट कंसोल",
        broadcast_warnings: "नागरिक उपकरणों पर उच्च-प्राथमिकता स्कैम चेतावनी प्रसारित करें।",
        alert_history: "अलर्ट इतिहास",
        broadcast_emergency: "आपातकालीन अलर्ट प्रसारित करें",
        new_composer: "नया अलर्ट कंपोजर",
        alert_category: "अलर्ट श्रेणी",
        target_region: "लक्ष्य क्षेत्र",
        alert_message: "अलर्ट संदेश (बहुभाषी)",
        standard_templates: "मानक टेम्पलेट उपलब्ध",
        auto_translation: "ऑटो-अनुवाद सक्रिय",
        trans_desc: "क्षेत्र के आधार पर संदेश हिंदी, अंग्रेजी और मराठी में प्रसारित किया जाएगा।",
        edit_trans: "अनुवाद संपादित करें",
        save_draft: "ड्रॉफ्ट सहेजें",
        preview_send: "पूर्वावलोकन और भेजें",
        audience_coverage: "दर्शकों का कवरेज",
        target_reach: "लक्ष्य पहुंच",
        geo_spread: "भौगोलिक प्रसार",
        priority_delivery: "प्राथमिकता वितरण",
        recent_records: "हाल के रिकॉर्ड",
        critical_note: "महत्वपूर्ण नोट",
        tokens_note: "प्रसारण राष्ट्रीय प्राथमिकता टोकन का उपयोग करते हैं। केवल पुष्ट बहु-पीड़ित अभियानों के लिए उपयोग करें।",
        // Graph Page
        fraud_graph: "धोखाधड़ी खुफिया ग्राफ",
        cross_entity: "संदिग्ध नेटवर्क जुड़ाव दिखाने वाला क्रॉस-एंटीटी सहसंबंध।",
        query_entity: "एंटीटी पूछताछ (UPI/फोन)...",
        generate_fir: "FIR पैकेट उत्पन्न करें",
        graph_active: "इंटरएक्टिव ग्राफ सक्रिय",
        entities_found: "वर्तमान क्लस्टर के लिए 12 संबंधित संस्थाएं मिलीं।",
        node_health: "नोड स्वास्थ्य: इष्टतम",
        refresh_correlations: "सहसंबंध ताज़ा करें",
        entity_intel: "एंटीटी इंटेलिजेंस",
        current_target: "वर्तमान लक्ष्य",
        network_profile: "नेटवर्क प्रोफाइल",
        role: "भूमिका",
        confidence: "आत्मविश्वास",
        report_count: "रिपोर्ट संख्या",
        connected_wallets: "जुड़े हुए वॉलेट",
        export_evidence: "SID-साक्ष्य निर्यात करें",
        compliance_note: "धारा 65B अनुपालन के लिए स्वचालित पैकेज तैयार।"
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>("en");

    const t = (key: string) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
