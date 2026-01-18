import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, BackHandler } from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';

// Services
import { companiesService, Company } from '../services/companiesService';
import { profilesService, Profile } from '../services/profilesService';
import { mailService } from '../services/mailService';
import { masterSendersService } from '../services/masterSendersService';
import { recognizeText, MailType, classifyMail, preprocessImage as ocrPreprocess } from '../services/ocrService';

// Utils
import { registerForPushNotificationsAsync } from '../utils/notificationHelper';
import { messaging, getToken, VAPID_KEY } from '../lib/firebase';
import { Platform } from 'react-native';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'tenant_login' | 'tenant_dashboard';

interface AppContextType {
    // Global State
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    isInitializing: boolean;
    expoPushToken: string;
    webPushToken: string;
    brandingCompany: Company | null;
    setBrandingCompany: (comp: Company | null) => void;

    // Admin Data
    companies: Company[];
    selectedCompany: Company | null;
    setSelectedCompany: (comp: Company | null) => void;
    profiles: Profile[]; // Tenants inside selected company
    setProfiles: (profiles: Profile[]) => void;
    mailLogs: any[];
    setMailLogs: (logs: any[]) => void;
    masterSenders: string[];
    setMasterSenders: (senders: string[]) => void;

    // UI Visibility States (Modals)
    isAdminMgmtVisible: boolean;
    setIsAdminMgmtVisible: (v: boolean) => void;
    isTenantMgmtVisible: boolean;
    setIsTenantMgmtVisible: (v: boolean) => void;
    isSenderMgmtVisible: boolean;
    setIsSenderMgmtVisible: (v: boolean) => void;
    isHistoryVisible: boolean;
    setIsHistoryVisible: (v: boolean) => void;
    isAdminMenuVisible: boolean;
    setIsAdminMenuVisible: (v: boolean) => void;
    isManualSearchVisible: boolean;
    setIsManualSearchVisible: (v: boolean) => void;

    // Other UI States
    selectedProfileForHistory: Profile | null;
    setSelectedProfileForHistory: (p: Profile | null) => void;
    logSearchQuery: string;
    setLogSearchQuery: (q: string) => void;
    logPageSize: number;
    setLogPageSize: (s: number) => void;
    manualSearchQuery: string;
    setManualSearchQuery: (q: string) => void;

    // OCR & Mail Registration State
    selectedImage: string | null;
    setSelectedImage: (uri: string | null) => void;
    ocrLoading: boolean;
    recognizedText: string;
    detectedMailType: MailType;
    setDetectedMailType: (t: MailType) => void;
    detectedSender: string;
    setDetectedSender: (s: string) => void;
    matchedProfile: Profile | null;
    setMatchedProfile: (p: Profile | null) => void;
    extraImages: string[];
    setExtraImages: (imgs: string[]) => void;

    isRefreshing: boolean;

    // Actions
    loadData: () => Promise<void>;
    handleBranchSelect: (company: Company) => Promise<void>;
    runOCR: (uri: string) => Promise<void>;
    handleRegisterMail: () => Promise<void>;
    // copyTenantLink removed
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    // --- States ---
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState('');
    const [webPushToken, setWebPushToken] = useState('');

    // Admin Data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);
    const [mailLogs, setMailLogs] = useState<any[]>([]);

    // UI Visibility
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false);
    const [isTenantMgmtVisible, setIsTenantMgmtVisible] = useState(false);
    const [isSenderMgmtVisible, setIsSenderMgmtVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isAdminMenuVisible, setIsAdminMenuVisible] = useState(false);
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);

    // Search & Filters
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Profile | null>(null);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logPageSize, setLogPageSize] = useState(10);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    // OCR & Mail Flow
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState('');
    const [detectedMailType, setDetectedMailType] = useState<MailType>('일반');
    const [detectedSender, setDetectedSender] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extraImages, setExtraImages] = useState<string[]>([]);
    const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

    // --- Effects ---

    // --- UI/Loading States ---
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadInitialData = async () => {
        try {
            // 병렬로 초기 필수 데이터만 로드
            const [compList, senders] = await Promise.all([
                companiesService.getCompanies(),
                masterSendersService.getAllSenders()
            ]);
            setCompanies(compList);
            setMasterSenders(senders.map(s => s.name));
        } catch (e) {
            console.error("Failed to load initial data", e);
        } finally {
            setIsInitialLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            // 1. 초기 필수 데이터 비동기 병렬 실행
            loadInitialData();

            // 2. 알림 권한 체크 (백그라운드 처리)
            setupNotifications();

            // 3. 딥링크 핸들링
            setupDeepLinking();
        };

        init();
    }, []);

    const setupNotifications = async () => {
        if (Platform.OS === 'web') {
            if (messaging && typeof Notification !== 'undefined') {
                try {
                    const permission = Notification.permission === 'default'
                        ? await Notification.requestPermission()
                        : Notification.permission;

                    if (permission === 'granted') {
                        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                        if (token) setWebPushToken(token);
                    }
                } catch (e) {
                    console.error("Web push registration failed", e);
                }
            }
        } else {
            const token = await registerForPushNotificationsAsync();
            if (token) setExpoPushToken(token);
        }
    };

    const setupDeepLinking = async () => {
        const handleDeepLink = async (url: string | null) => {
            if (!url) return;
            let slug = '';
            if (url.includes('postnoti://')) {
                const parts = url.replace('postnoti://', '').split('/');
                if (parts[0] === 'branch') slug = parts[1];
            } else {
                try {
                    const urlObj = new URL(url);
                    const pathParts = urlObj.pathname.split('/').filter(p => p);
                    if (pathParts[0] === 'branch') slug = pathParts[1];
                } catch (e) { }
            }

            if (slug) {
                const { data } = await supabase.from('companies').select('*').eq('slug', slug).single();
                if (data) {
                    setBrandingCompany(data);
                    setMode('tenant_login');
                }
            }
        };

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleDeepLink(initialUrl);

        const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
        return () => subscription.remove();
    };

    // Back Handler Logic is now handled by React Navigation in App.tsx
    // (Manual removal to avoid conflict with Stack Navigator)



    // --- Actions --- (handleBranchSelect has been moved and optimized)


    // copyTenantLink removed - logic moved to AdminDashboardScreen menu

    // OCR Logic Helper
    const findMatch = (text: string, excludeSender?: string) => {
        const lines = text.split('\n').map(l => l.trim().toLowerCase());
        const candidates = profiles.map(p => {
            let score = 0;
            const name = p.name.toLowerCase();
            const compName = p.company_name?.toLowerCase() || '';
            const room = p.room_number?.toLowerCase() || '';

            lines.forEach(line => {
                if (excludeSender && line.includes(excludeSender.toLowerCase())) return;
                if (compName && line.includes(compName)) score += compName.length > 2 ? 15 : 8;
                if (line.includes(name)) {
                    score += 5;
                    if (room && line.includes(room)) score += 10;
                    if (line.includes(`${name} 귀하`) || line.includes(`${name}님`) || line.includes(`${name} 앞`)) score += 7;
                }
                if (room) {
                    const roomPattern = new RegExp(`(^|[^0-9])${room}([^0-9]|$)`);
                    if (roomPattern.test(line)) score += 5;
                }
            });
            return { profile: p, score };
        });

        const best = candidates.filter(c => c.score > 1).sort((a, b) => b.score - a.score)[0];
        return best ? best.profile : null;
    };

    const runOCR = async (uri: string) => {
        try {
            setOcrLoading(true);
            const processed = await ocrPreprocess(uri);
            setSelectedImage(processed.data);

            const result = await recognizeText(uri, masterSenders);
            setRecognizedText(result.text);

            const type = classifyMail(result.text, result.sender);
            setDetectedMailType(type);

            const match = findMatch(result.text, result.sender);
            setMatchedProfile(match || null);

            const isKnownSender = masterSenders.some(s => result.sender.includes(s) || s.includes(result.sender));
            if (isKnownSender && result.sender) {
                let cleanSender = result.sender;
                if (match?.name) cleanSender = cleanSender.replace(match.name, '').trim();
                if (match?.company_name) cleanSender = cleanSender.replace(match.company_name, '').trim();
                setDetectedSender(cleanSender);
            } else {
                setDetectedSender('');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('오류', 'OCR 인식 중 문제가 발생했습니다.');
        } finally {
            setOcrLoading(false);
        }
    };

    const handleBranchSelect = async (company: Company) => {
        setSelectedCompany(company);
        setMode('admin_dashboard');

        setIsRefreshing(true);
        try {
            const [p, m] = await Promise.all([
                profilesService.getProfilesByCompany(company.id),
                mailService.getMailsByCompany(company.id)
            ]);
            setProfiles(p);
            setMailLogs(m);
        } catch (e) {
            console.error("Failed to load branch data", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleRegisterMail = async () => {
        if (!selectedCompany || !matchedProfile) return;

        try {
            setOcrLoading(true);
            await mailService.registerMail(
                selectedCompany.id,
                matchedProfile.id!,
                detectedMailType,
                detectedSender,
                selectedImage || '',
                extraImages
            );

            // Background notification task
            const runNotifications = async () => {
                const title = `[${selectedCompany.name}] 우편물 도착 📮`;
                const body = `${detectedSender ? `${detectedSender}에서 보낸 ` : ''}${detectedMailType} 우편물이 도착했습니다.`;

                if (matchedProfile.push_token) {
                    fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: matchedProfile.push_token, sound: 'default', title, body })
                    }).catch(() => { });
                }
                if (matchedProfile.web_push_token) {
                    fetch('https://postnoti-app.vercel.app/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: matchedProfile.web_push_token, title, body, data: { company_id: selectedCompany.id } })
                    }).catch(() => { });
                }
            };
            runNotifications();

            Alert.alert('완료', `${matchedProfile.name}님께 알림을 보냈습니다.`);
            const refreshedMails = await mailService.getMailsByCompany(selectedCompany.id);
            setMailLogs(refreshedMails);
            setMode('admin_dashboard');

            // Reset
            setSelectedImage(null);
            setDetectedSender('');
            setMatchedProfile(null);
            setExtraImages([]);
        } catch (error) {
            Alert.alert('오류', '등록 실패');
        } finally {
            setOcrLoading(false);
        }
    };

    return (
        <AppContext.Provider
            value={{
                mode, setMode,
                isInitializing: isInitialLoading,
                isRefreshing,
                expoPushToken,
                webPushToken,
                brandingCompany, setBrandingCompany,
                companies, selectedCompany, setSelectedCompany,
                profiles, setProfiles,
                mailLogs, setMailLogs,
                masterSenders, setMasterSenders,
                isAdminMgmtVisible, setIsAdminMgmtVisible,
                isTenantMgmtVisible, setIsTenantMgmtVisible,
                isSenderMgmtVisible, setIsSenderMgmtVisible,
                isHistoryVisible, setIsHistoryVisible,
                isAdminMenuVisible, setIsAdminMenuVisible,
                isManualSearchVisible, setIsManualSearchVisible,
                selectedProfileForHistory, setSelectedProfileForHistory,
                logSearchQuery, setLogSearchQuery,
                logPageSize, setLogPageSize,
                manualSearchQuery, setManualSearchQuery,
                selectedImage, setSelectedImage,
                ocrLoading,
                recognizedText,
                detectedMailType, setDetectedMailType,
                detectedSender, setDetectedSender,
                matchedProfile, setMatchedProfile,
                extraImages, setExtraImages,
                loadData: loadInitialData,
                handleBranchSelect,
                runOCR,
                handleRegisterMail,
                // copyTenantLink removed
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContent = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContent must be used within an AppProvider');
    }
    return context;
};
